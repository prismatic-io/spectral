import {
  type ArrowFunction,
  type FunctionDeclaration,
  type FunctionExpression,
  type MethodDeclaration,
  Node,
  type ObjectBindingPattern,
  SyntaxKind,
} from "ts-morph";
import type { ClassifiedElement } from "./element";

/** A function whose first parameter is an execution context carrying `configVars`. */
export type ContextFunction =
  | ArrowFunction
  | FunctionExpression
  | FunctionDeclaration
  | MethodDeclaration;

export const isContextFunction = (node: Node): node is ContextFunction =>
  Node.isArrowFunction(node) ||
  Node.isFunctionExpression(node) ||
  Node.isFunctionDeclaration(node) ||
  Node.isMethodDeclaration(node);

/**
 * Where a converted read goes: a property of the context followed by `access`, or
 * text of its own.
 */
export type Replacement = { contextProperty: string; access: string } | { text: string };

/**
 * Rewrites each `configVars` read with a static key that `resolve` names and `replace`
 * maps. A context property is read off the context parameter; when the parameter is
 * destructured, off a binding added to it. A `configVars` binding that nothing reads
 * any more is removed.
 *
 * Returns the elements converted, in the order first read, and whether reads the
 * codemod could not convert remain.
 */
export const rewriteConfigVarsReads = (
  fn: () => ContextFunction,
  resolve: (key: string) => ClassifiedElement | undefined,
  replace: (element: ClassifiedElement) => Replacement | undefined,
): { converted: ClassifiedElement[]; unresolved: boolean } => {
  const converted: ClassifiedElement[] = [];
  const context = contextName(fn());
  const rewriteNext = (): boolean => {
    for (const source of configVarsReads(fn())) {
      const access = keyedAccess(source);
      const element = access && resolve(access.key);
      const replacement = element && replace(element);
      if (!access || !element || !replacement) continue;
      if ("text" in replacement) {
        access.node.replaceWithText(replacement.text);
      } else if (context) {
        access.node.replaceWithText(
          `${context}.${replacement.contextProperty}${replacement.access}`,
        );
      } else {
        const pattern = fn().getParameters()[0]?.getNameNode();
        if (!Node.isObjectBindingPattern(pattern)) continue;
        const binding = bindingElement(pattern, replacement.contextProperty)?.getNameNode();
        if (binding && !Node.isIdentifier(binding)) continue;
        access.node.replaceWithText(
          `${binding?.getText() ?? replacement.contextProperty}${replacement.access}`,
        );
        if (!binding) {
          const current = fn().getParameters()[0].getNameNode() as ObjectBindingPattern;
          replacePattern(current, [
            ...current.getElements().map((other) => other.getText()),
            replacement.contextProperty,
          ]);
        }
      }
      if (!converted.includes(element)) converted.push(element);
      return true;
    }
    return false;
  };
  while (rewriteNext());
  while (pruneConfigVarsBinding(fn()));

  const unresolved =
    configVarsReads(fn()).length > 0 ||
    configVarsPatterns(fn()).some((pattern) => bindingElement(pattern, "configVars"));
  return { converted, unresolved };
};

const contextName = (fn: ContextFunction): string | undefined => {
  const nameNode = fn.getParameters()[0]?.getNameNode();
  return Node.isIdentifier(nameNode) ? nameNode.getText() : undefined;
};

/**
 * Destructurings that take `configVars` off the context: the context parameter itself,
 * or `const { configVars } = context` in the body.
 */
const configVarsPatterns = (fn: ContextFunction): ObjectBindingPattern[] => {
  const patterns: ObjectBindingPattern[] = [];
  const parameter = fn.getParameters()[0]?.getNameNode();
  if (Node.isObjectBindingPattern(parameter)) {
    patterns.push(parameter);
  }
  const context = contextName(fn);
  if (context) {
    for (const declaration of fn.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
      const nameNode = declaration.getNameNode();
      const initializer = declaration.getInitializer();
      if (
        Node.isObjectBindingPattern(nameNode) &&
        Node.isIdentifier(initializer) &&
        initializer.getText() === context
      ) {
        patterns.push(nameNode);
      }
    }
  }
  return patterns;
};

const bindingElement = (pattern: ObjectBindingPattern, property: string) =>
  pattern
    .getElements()
    .find(
      (element) =>
        !element.getDotDotDotToken() &&
        (element.getPropertyNameNode()?.getText() ?? element.getName()) === property,
    );

/** Every expression in the body that evaluates to the context's `configVars`. */
export const configVarsReads = (fn: ContextFunction): Node[] => {
  const body = fn.getBody();
  if (!body) return [];
  const context = contextName(fn);
  const aliases = configVarsPatterns(fn).flatMap((pattern) => {
    const nameNode = bindingElement(pattern, "configVars")?.getNameNode();
    return Node.isIdentifier(nameNode) ? [nameNode.getText()] : [];
  });
  return body
    .getDescendants()
    .filter(
      (node) =>
        (context !== undefined &&
          Node.isPropertyAccessExpression(node) &&
          node.getName() === "configVars" &&
          node.getExpression().getText() === context) ||
        (Node.isIdentifier(node) && aliases.includes(node.getText()) && isReference(node)),
    );
};

/** False for an identifier that names a property or a binding rather than reading one. */
const isReference = (identifier: Node): boolean => {
  const parent = identifier.getParent();
  return !(
    (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === identifier) ||
    Node.isBindingElement(parent) ||
    (Node.isPropertyAssignment(parent) && parent.getNameNode() === identifier)
  );
};

/** `configVars.key` or `configVars["key"]`, with its static key. */
const keyedAccess = (source: Node): { node: Node; key: string } | undefined => {
  const parent = source.getParent();
  if (Node.isPropertyAccessExpression(parent) && parent.getExpression() === source) {
    return { node: parent, key: parent.getName() };
  }
  if (Node.isElementAccessExpression(parent) && parent.getExpression() === source) {
    const argument = parent.getArgumentExpression();
    if (Node.isStringLiteral(argument) || Node.isNoSubstitutionTemplateLiteral(argument)) {
      return { node: parent, key: argument.getLiteralText() };
    }
  }
  return undefined;
};

/** The config var a key names, preferring one in `scope`. */
export const findElement = (
  elements: ClassifiedElement[],
  key: string,
  scope: ClassifiedElement["scope"],
): ClassifiedElement | undefined =>
  elements.find((element) => element.key === key && element.scope === scope) ??
  elements.find((element) => element.key === key);

/** Removes one `configVars` binding that nothing reads any more; false when there is none. */
const pruneConfigVarsBinding = (fn: ContextFunction): boolean => {
  const reads = configVarsReads(fn).map((read) => read.getText());
  for (const pattern of configVarsPatterns(fn)) {
    const element = bindingElement(pattern, "configVars");
    const nameNode = element?.getNameNode();
    if (!element || !Node.isIdentifier(nameNode) || reads.includes(nameNode.getText())) {
      continue;
    }
    const remaining = pattern
      .getElements()
      .filter((other) => other !== element)
      .map((other) => other.getText());
    const parent = pattern.getParent();
    if (remaining.length) {
      replacePattern(pattern, remaining);
    } else if (Node.isVariableDeclaration(parent)) {
      parent.remove();
    } else if (fn.getParameters().length > 1) {
      pattern.replaceWithText("_context");
    } else {
      fn.getParameters()[0].remove();
    }
    return true;
  }
  return false;
};

const replacePattern = (pattern: ObjectBindingPattern, elements: string[]): void => {
  pattern.replaceWithText(`{ ${elements.join(", ")} }`);
};

/**
 * Rewrites a function body so it starts with `comments`. The body is rebuilt as text:
 * inserted as statements, comments in a block written on one line would comment out
 * the code after them. An expression body becomes a block that returns it.
 */
export const prependComments = (body: Node, comments: string): void => {
  const statements = Node.isBlock(body)
    ? body.getText().slice(1, -1).trim()
    : `return ${body.getText()};`;
  body.replaceWithText(`{\n${comments}\n${statements}\n}`).formatText({ indentSize: 2 });
};
