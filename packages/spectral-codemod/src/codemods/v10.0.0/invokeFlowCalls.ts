import { type CallExpression, Node, type Project, type SourceFile, SyntaxKind } from "ts-morph";
import { objectKey, propertyKey, SPECTRAL } from "./ast";
import { findElement } from "./configVarsReads";
import type { ClassifiedElement } from "./element";

const TODO = [
  "// TODO: A flow of an integration with a configuration reads no config vars. Pass",
  "// invokeFlow configuration, userConfiguration, and connections instead.",
].join("\n");

/**
 * Rewrites the `configVars` that each `invokeFlow` call passes into the options that
 * replace them: a value into `configuration` or `userConfiguration` by its scope, and a
 * connection into `connections.<scope>`. A call whose `configVars` is not an object
 * literal of config vars the integration declares gets a TODO; the compiler also flags
 * it, because `invokeFlow` takes no `configVars` once the integration enables the
 * `integrationConfiguration` flag.
 *
 * Returns the files it changed.
 */
export const migrateInvokeFlowCalls = (
  project: Project,
  elements: ClassifiedElement[],
): SourceFile[] =>
  project.getSourceFiles().filter((file) => {
    if (file.isDeclarationFile() || file.isInNodeModules()) {
      return false;
    }
    let changed = false;
    for (const call of file.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (call.wasForgotten() || !isInvokeFlow(call)) continue;
      const options = call.getArguments()[1];
      if (!Node.isObjectLiteralExpression(options)) continue;
      const configVars = options.getProperty("configVars");
      if (!configVars) continue;
      const replacement = Node.isPropertyAssignment(configVars)
        ? replacementOptions(configVars.getInitializer(), elements)
        : undefined;
      if (replacement) {
        const index = options.getProperties().indexOf(configVars);
        options.insertPropertyAssignments(index, replacement);
        configVars.remove();
        options.formatText({ indentSize: 2 });
      } else {
        addTodo(call);
      }
      changed = true;
    }
    return changed;
  });

type PropertyAssignmentSource = { name: string; initializer: string };

/**
 * The options that replace an object literal of config vars, or undefined when a
 * property is not a config var the integration declares.
 */
const replacementOptions = (
  initializer: Node | undefined,
  elements: ClassifiedElement[],
): PropertyAssignmentSource[] | undefined => {
  if (!Node.isObjectLiteralExpression(initializer)) {
    return undefined;
  }
  const configuration: string[] = [];
  const userConfiguration: string[] = [];
  const connections: Record<ClassifiedElement["scope"], string[]> = {
    instance: [],
    userLevel: [],
  };
  for (const property of initializer.getProperties()) {
    const key = staticKey(property);
    const element = key === undefined ? undefined : findElement(elements, key, "instance");
    if (!element || !Node.isPropertyAssignment(property)) {
      return undefined;
    }
    const entry = `${objectKey(element.key)}: ${property.getInitializerOrThrow().getText()}`;
    if (element.kind === "connection") {
      connections[element.scope].push(entry);
    } else if (element.scope === "instance") {
      configuration.push(entry);
    } else {
      userConfiguration.push(entry);
    }
  }
  const scopedConnections = (["instance", "userLevel"] as const).flatMap((scope) =>
    connections[scope].length ? [`${scope}: ${objectSource(connections[scope])}`] : [],
  );
  return [
    ...(configuration.length
      ? [{ name: "configuration", initializer: objectSource(configuration) }]
      : []),
    ...(userConfiguration.length
      ? [{ name: "userConfiguration", initializer: objectSource(userConfiguration) }]
      : []),
    ...(scopedConnections.length
      ? [{ name: "connections", initializer: objectSource(scopedConnections) }]
      : []),
  ];
};

/** A property's key when it is written as a name or a string, not computed. */
const staticKey = (property: Node): string | undefined => {
  if (!Node.isPropertyAssignment(property)) return undefined;
  const nameNode = property.getNameNode();
  return Node.isIdentifier(nameNode) || Node.isStringLiteral(nameNode)
    ? propertyKey(property)
    : undefined;
};

const objectSource = (entries: string[]): string => `{\n${entries.join(",\n")},\n}`;

/**
 * True for `invokeFlow(...)` or `testing.invokeFlow(...)`, where the function or the
 * object that holds it is imported from spectral.
 */
const isInvokeFlow = (call: CallExpression): boolean => {
  const callee = call.getExpression();
  if (Node.isIdentifier(callee)) {
    return callee.getText() === "invokeFlow" && importedFromSpectral(callee);
  }
  return (
    Node.isPropertyAccessExpression(callee) &&
    callee.getName() === "invokeFlow" &&
    importedFromSpectral(callee.getExpression())
  );
};

const importedFromSpectral = (expression: Node): boolean =>
  Node.isIdentifier(expression) &&
  (expression.getSymbol()?.getDeclarations() ?? []).some((declaration) => {
    const importDeclaration = declaration.getFirstAncestorByKind(SyntaxKind.ImportDeclaration);
    const specifier = importDeclaration?.getModuleSpecifierValue();
    return specifier === SPECTRAL || specifier?.startsWith(`${SPECTRAL}/`) === true;
  });

/**
 * Puts the TODO on the lines before the statement that makes the call. The block that
 * holds the statement is formatted, so the comment takes the statement's indentation.
 */
const addTodo = (call: CallExpression): void => {
  const statement = call.getFirstAncestor(
    (ancestor) => Node.isStatement(ancestor) && Node.isStatemented(ancestor.getParent()),
  );
  statement
    ?.replaceWithText(`${TODO}\n${statement.getText()}`)
    .getParentOrThrow()
    .formatText({ indentSize: 2 });
};
