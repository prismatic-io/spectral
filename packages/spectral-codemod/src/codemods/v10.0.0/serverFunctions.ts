import {
  type ArrowFunction,
  type FunctionExpression,
  type MethodDeclaration,
  Node,
  type ObjectLiteralExpression,
  type SourceFile,
  SyntaxKind,
} from "ts-morph";
import { accessor, capitalize, ensureNamedImport, literalString, objectKey, SPECTRAL } from "./ast";
import { findElement, prependComments, rewriteConfigVarsReads } from "./configVarsReads";
import type { ClassifiedElement } from "./element";
import { dataSourceResultSchemaFor, zodSchemaFor } from "./zodSchema";

/** A data source with an inline `perform`, to be declared as a server function. */
export interface PlannedServerFunction {
  /** Key under `configuration.serverFunctions`. */
  key: string;
  /** Exported const the server function is declared as. */
  name: string;
  /** File that declares the data source, so the copied `perform` keeps the helpers it uses. */
  file: SourceFile;
  dataSource: ClassifiedElement;
  description?: string;
  dataSourceType?: string;
  /** The data source's `perform` property, copied verbatim. */
  performSource: string;
}

type PerformFunction = ArrowFunction | FunctionExpression | MethodDeclaration;

const UNRESOLVED_TODO = [
  "// TODO: Fix the configVars reads the codemod could not convert. Read unsaved form",
  "// values from params and declare them in inputSchema, saved values from",
  "// context.configuration, and connections from context.connections and declare",
  "// them in connections.",
].join("\n");

const SUPPLEMENTAL_DATA_TODO =
  "// TODO: A server function has no supplementalData. Return only the result.";

/**
 * Splits data sources into those with an inline `perform`, which become server
 * functions, and the rest: component data source references and a `perform` declared
 * elsewhere.
 */
export const planServerFunctions = (
  elements: ClassifiedElement[],
): { planned: PlannedServerFunction[]; unconverted: ClassifiedElement[] } => {
  const planned: PlannedServerFunction[] = [];
  const unconverted: ClassifiedElement[] = [];
  const keys = new Set<string>();
  const names = new Map<SourceFile, Set<string>>();
  for (const dataSource of elements.filter((element) => element.kind === "dataSource")) {
    const literal = dataSource.literal;
    const performSource = literal && inlinePerformSource(literal);
    if (!literal || !performSource) {
      unconverted.push(dataSource);
      continue;
    }
    const file = literal.getSourceFile();
    const taken = names.get(file) ?? new Set<string>();
    names.set(file, taken);
    const key = uniqueName(camelCase(dataSource.key), (name) => keys.has(name));
    keys.add(key);
    const name = uniqueName(
      `${key}ServerFunction`,
      (candidate) => taken.has(candidate) || isDeclared(file, candidate),
    );
    taken.add(name);
    planned.push({
      key,
      name,
      file,
      dataSource,
      description: literalString(literal, "description"),
      dataSourceType: literalString(literal, "dataSourceType"),
      performSource,
    });
  }
  return { planned, unconverted };
};

/**
 * Declares a planned server function at `index` in its file and rewrites the copied
 * `perform` to the server function contract.
 */
export const emitServerFunction = (
  planned: PlannedServerFunction,
  elements: ClassifiedElement[],
  index: number,
): void => {
  const { file, name } = planned;
  const properties = [
    `label: ${JSON.stringify(planned.dataSource.key)},`,
    ...(planned.description ? [`description: ${JSON.stringify(planned.description)},`] : []),
    "inputSchema: z.object({}),",
    `outputSchema: ${dataSourceResultSchemaFor(planned.dataSourceType)},`,
    `${planned.performSource},`,
  ];
  file.insertStatements(
    index,
    `export const ${name} = serverFunction({\n${properties.join("\n")}\n});`,
  );
  const literal = (): ObjectLiteralExpression =>
    file
      .getVariableDeclarationOrThrow(name)
      .getInitializerIfKindOrThrow(SyntaxKind.CallExpression)
      .getArguments()[0]
      .asKindOrThrow(SyntaxKind.ObjectLiteralExpression);

  const { inputs, connections } = rewritePerform(
    () => performOf(literal()),
    planned.dataSource,
    elements,
  );
  literal()
    .getPropertyOrThrow("inputSchema")
    .asKindOrThrow(SyntaxKind.PropertyAssignment)
    .setInitializer(
      inputs.length
        ? `z.object({\n${inputs.map((input) => `${objectKey(input.key)}: ${zodSchemaFor(input.shape)},`).join("\n")}\n})`
        : "z.object({})",
    );
  if (connections.length) {
    const properties = literal().getProperties();
    const outputSchema = literal().getPropertyOrThrow("outputSchema");
    literal().insertPropertyAssignment(properties.indexOf(outputSchema) + 1, {
      name: "connections",
      initializer: `[${connections.map((connection) => JSON.stringify(`${connection.scope}.${connection.key}`)).join(", ")}]`,
    });
  }
  const statement = file.getVariableStatementOrThrow(name);
  statement.formatText({ indentSize: 2 });
  statement.prependWhitespace("\n");
  ensureNamedImport(file, SPECTRAL, "serverFunction");
  ensureNamedImport(file, "zod", "z");
};

/**
 * Maps a data source `perform` onto a server function's:
 *
 * - a `configVars` read of a connection becomes `context.connections.<scope>.<key>`,
 *   and the connection is declared;
 * - a `configVars` read of any other config var becomes `params.<key>`, and the value
 *   is declared in `inputSchema`, because a host passes unsaved form values as params;
 * - `{ result }` is unwrapped, since a server function returns the value itself.
 *
 * A read the codemod cannot follow, such as a computed key or `configVars` passed on
 * whole, is left as it is under a TODO. `configVars` is not on a server function's
 * context, so the compiler flags each one.
 */
const rewritePerform = (
  perform: () => PerformFunction,
  dataSource: ClassifiedElement,
  elements: ClassifiedElement[],
): { inputs: ClassifiedElement[]; connections: ClassifiedElement[] } => {
  for (const parameter of perform().getParameters()) {
    parameter.removeType();
  }
  perform().removeReturnType();

  const paramsName = (): string | undefined => {
    const nameNode = perform().getParameters()[1]?.getNameNode();
    if (!nameNode) return "params";
    return Node.isIdentifier(nameNode) ? nameNode.getText() : undefined;
  };
  const { converted, unresolved } = rewriteConfigVarsReads(
    perform,
    (key) => findElement(elements, key, dataSource.scope),
    (element) => {
      if (element.kind === "connection") {
        return {
          contextProperty: "connections",
          access: `.${element.scope}${accessor(element.key)}`,
        };
      }
      const params = paramsName();
      return params ? { text: `${params}${accessor(element.key)}` } : undefined;
    },
  );
  const inputs = converted.filter((element) => element.kind !== "connection");
  const connections = converted.filter((element) => element.kind === "connection");
  if (inputs.length && perform().getParameters().length < 2) {
    perform().addParameter({ name: "params" });
  }

  const supplementalData = unwrapResults(perform);
  const todos = [
    ...(unresolved ? [UNRESOLVED_TODO] : []),
    ...(supplementalData ? [SUPPLEMENTAL_DATA_TODO] : []),
  ];
  const body = perform().getBody();
  if (todos.length && body) {
    prependComments(body, todos.join("\n"));
  }
  return { inputs, connections };
};

const performOf = (literal: ObjectLiteralExpression): PerformFunction => {
  const property = literal.getPropertyOrThrow("perform");
  if (Node.isMethodDeclaration(property)) {
    return property;
  }
  const initializer = property.asKindOrThrow(SyntaxKind.PropertyAssignment).getInitializerOrThrow();
  return Node.isArrowFunction(initializer)
    ? initializer
    : initializer.asKindOrThrow(SyntaxKind.FunctionExpression);
};

const inlinePerformSource = (literal: ObjectLiteralExpression): string | undefined => {
  const property = literal.getProperty("perform");
  if (Node.isMethodDeclaration(property)) {
    return property.getText();
  }
  if (Node.isPropertyAssignment(property)) {
    const initializer = property.getInitializer();
    if (Node.isArrowFunction(initializer) || Node.isFunctionExpression(initializer)) {
      return property.getText();
    }
  }
  return undefined;
};

/**
 * Unwraps `{ result }` from each value `perform` returns. A literal with anything
 * besides `result` keeps its other properties and reads `.result`; any other value is
 * awaited and its `.result` read. Reports whether a result carried `supplementalData`.
 */
const unwrapResults = (perform: () => PerformFunction): boolean => {
  const fn = perform();
  const body = fn.getBody();
  if (!body) return false;
  const expressions = Node.isBlock(body)
    ? body
        .getDescendantsOfKind(SyntaxKind.ReturnStatement)
        .filter((statement) => enclosingFunction(statement) === fn)
        .flatMap((statement) => statement.getExpression() ?? [])
    : [body];

  let supplementalData = false;
  let awaits = false;
  for (const expression of expressions.reverse()) {
    let inner: Node = expression;
    while (Node.isParenthesizedExpression(inner)) inner = inner.getExpression();
    let replacement: string;
    if (Node.isObjectLiteralExpression(inner)) {
      const result = inner.getProperty("result");
      supplementalData ||= inner.getProperty("supplementalData") !== undefined;
      if (inner.getProperties().length === 1 && Node.isPropertyAssignment(result)) {
        replacement = result.getInitializerOrThrow().getText();
      } else if (inner.getProperties().length === 1 && Node.isShorthandPropertyAssignment(result)) {
        replacement = "result";
      } else {
        replacement = `(${inner.getText()}).result`;
      }
    } else {
      replacement = `(await ${inner.getText()}).result`;
      awaits = true;
    }
    const isExpressionBody = expression === body;
    expression.replaceWithText(
      isExpressionBody && replacement.startsWith("{") ? `(${replacement})` : replacement,
    );
  }
  if (awaits) perform().setIsAsync(true);
  return supplementalData;
};

const enclosingFunction = (node: Node): Node | undefined =>
  node.getFirstAncestor(
    (ancestor) =>
      Node.isArrowFunction(ancestor) ||
      Node.isFunctionExpression(ancestor) ||
      Node.isFunctionDeclaration(ancestor) ||
      Node.isMethodDeclaration(ancestor),
  );

const isDeclared = (file: SourceFile, name: string): boolean =>
  file.getVariableDeclaration(name) !== undefined ||
  file.getFunction(name) !== undefined ||
  file
    .getImportDeclarations()
    .some((declaration) =>
      declaration.getNamedImports().some((specifier) => specifier.getName() === name),
    );

const uniqueName = (base: string, isTaken: (name: string) => boolean): string => {
  let name = base;
  for (let suffix = 2; isTaken(name); suffix++) name = `${base}${suffix}`;
  return name;
};

const camelCase = (key: string): string => {
  const [first, ...rest] = key.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (!first) return "dataSource";
  const head =
    first === first.toUpperCase()
      ? first.toLowerCase()
      : first.charAt(0).toLowerCase() + first.slice(1);
  const name = head + rest.map(capitalize).join("");
  return /^[0-9]/.test(name) ? `_${name}` : name;
};
