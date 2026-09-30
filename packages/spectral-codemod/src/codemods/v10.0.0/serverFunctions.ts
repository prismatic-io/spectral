import {
  type ArrowFunction,
  type FunctionExpression,
  type MethodDeclaration,
  Node,
  type ObjectLiteralExpression,
  type SourceFile,
  SyntaxKind,
} from "ts-morph";
import { accessor, capitalize, literalString, objectKey } from "./ast";
import { findElement, prependComments, rewriteConfigVarsReads } from "./configVarsReads";
import type { ClassifiedElement } from "./element";
import { type Namer, withNames } from "./names";
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

const savedValueTodo = (reads: ClassifiedElement[]): string =>
  [
    "// TODO: Validate the saved configuration before you read it. It can be empty or",
    `// written under an earlier version: ${reads.map((read) => `${read.scope === "instance" ? "context.configuration" : "context.userConfiguration"}${accessor(read.key)}`).join(", ")}.`,
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
  namer: Namer,
): { planned: PlannedServerFunction[]; unconverted: ClassifiedElement[] } => {
  const planned: PlannedServerFunction[] = [];
  const unconverted: ClassifiedElement[] = [];
  const keys = new Set<string>();
  for (const dataSource of elements.filter((element) => element.kind === "dataSource")) {
    const literal = dataSource.literal;
    const performSource = literal && inlinePerformSource(literal);
    if (!literal || !performSource) {
      unconverted.push(dataSource);
      continue;
    }
    const file = literal.getSourceFile();
    // Resolve the file's names before the codemod edits it.
    namer.namesFor(file);
    const key = uniqueName(camelCase(dataSource.key), (name) => keys.has(name));
    keys.add(key);
    const name = namer.declare(file, `${key}ServerFunction`);
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
  namer: Namer,
): void => {
  const { file, name } = planned;
  const names = namer.namesFor(file);
  // The copied perform is the author's code, so only the generated parts are renamed.
  const properties = [
    `label: ${JSON.stringify(planned.dataSource.key)},`,
    ...(planned.description ? [`description: ${JSON.stringify(planned.description)},`] : []),
    withNames("inputSchema: z.object({}),", names),
    withNames(`outputSchema: ${dataSourceResultSchemaFor(planned.dataSourceType)},`, names),
    `${planned.performSource},`,
  ];
  file.insertStatements(
    index,
    `export const ${name} = ${names.serverFunction}({\n${properties.join("\n")}\n});`,
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
      withNames(
        inputs.length
          ? `z.object({\n${inputs.map((input) => `${objectKey(input.key)}: ${zodSchemaFor(input.shape)}.optional(),`).join("\n")}\n})`
          : "z.object({})",
        names,
      ),
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
  namer.addImports(file, ["serverFunction", "z"]);
};

/**
 * Maps a data source `perform` onto a server function's:
 *
 * - a `configVars` read of a connection becomes `context.connections.<scope>.<key>`,
 *   and the connection is declared;
 * - a `configVars` read of a value in the data source's scope becomes `params.<key>`,
 *   declared as an optional `inputSchema` field: a host passes unsaved form values as
 *   params, and the data source ran while they were still empty;
 * - a read of a value in the other scope becomes the saved one,
 *   `context.configuration.<key>` or `context.userConfiguration.<key>`, under a TODO:
 *   the form in this scope does not send it, and the saved value is not validated;
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
      // A value from the other scope is not on this scope's form, so it is the saved one.
      if (element.scope !== dataSource.scope) {
        return {
          contextProperty: element.scope === "instance" ? "configuration" : "userConfiguration",
          access: accessor(element.key),
        };
      }
      const params = paramsName();
      return params ? { text: `${params}${accessor(element.key)}` } : undefined;
    },
  );
  const connections = converted.filter((element) => element.kind === "connection");
  const savedValues = converted.filter(
    (element) => element.kind !== "connection" && element.scope !== dataSource.scope,
  );
  const inputs = converted.filter(
    (element) => element.kind !== "connection" && element.scope === dataSource.scope,
  );
  if (inputs.length && perform().getParameters().length < 2) {
    perform().addParameter({ name: "params" });
  }

  const supplementalData = unwrapResults(perform);
  const todos = [
    ...(unresolved ? [UNRESOLVED_TODO] : []),
    ...(savedValues.length ? [savedValueTodo(savedValues)] : []),
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
