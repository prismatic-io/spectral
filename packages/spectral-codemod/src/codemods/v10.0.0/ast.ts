import {
  type CallExpression,
  type Expression,
  Node,
  type ObjectLiteralExpression,
  type SourceFile,
  SyntaxKind,
} from "ts-morph";

export const SPECTRAL = "@prismatic-io/spectral";

/** Spectral identity helpers whose first argument is the definition they return. */
const WRAPPERS = new Set([
  "configPage",
  "userLevelConfigPage",
  "configVar",
  "dataSourceConfigVar",
  "connectionConfigVar",
  "customerActivatedConnection",
  "organizationActivatedConnection",
  "userActivatedConnection",
]);

/**
 * The object literal behind an expression: unwrapped from `as`, `satisfies`, and
 * parentheses; taken from the first argument of a spectral identity helper; or
 * followed from an identifier to its declaration, in this file or an imported one.
 */
export const resolveObjectLiteral = (
  expression: Node | undefined,
): ObjectLiteralExpression | undefined => {
  if (!expression) {
    return undefined;
  }
  if (Node.isObjectLiteralExpression(expression)) {
    return expression;
  }
  if (
    Node.isAsExpression(expression) ||
    Node.isSatisfiesExpression(expression) ||
    Node.isParenthesizedExpression(expression)
  ) {
    return resolveObjectLiteral(expression.getExpression());
  }
  if (Node.isCallExpression(expression) && wrapperName(expression) !== undefined) {
    return resolveObjectLiteral(expression.getArguments()[0]);
  }
  if (Node.isIdentifier(expression)) {
    for (const declaration of declarationsOf(expression)) {
      const resolved = Node.isVariableDeclaration(declaration)
        ? resolveObjectLiteral(declaration.getInitializer())
        : undefined;
      if (resolved) {
        return resolved;
      }
    }
  }
  return undefined;
};

/**
 * The declarations an identifier refers to, followed through named imports into the
 * exporting module. A shorthand property's name is bound to the property, so its
 * value symbol is used instead.
 */
const declarationsOf = (identifier: Node): Node[] => {
  const parent = identifier.getParent();
  const symbol = Node.isShorthandPropertyAssignment(parent)
    ? parent.getValueSymbol()
    : identifier.getSymbol();
  return (
    symbol?.getDeclarations().flatMap((declaration) => {
      if (!Node.isImportSpecifier(declaration)) {
        return [declaration];
      }
      const exported = declaration
        .getImportDeclaration()
        .getModuleSpecifierSourceFile()
        ?.getExportedDeclarations()
        .get(declaration.getName());
      return exported ?? [];
    }) ?? []
  );
};

export const wrapperName = (call: CallExpression): string | undefined => {
  const callee = call.getExpression();
  return Node.isIdentifier(callee) && WRAPPERS.has(callee.getText()) ? callee.getText() : undefined;
};

/**
 * The properties an object literal ends up with, in order. A spread is resolved to its
 * object literal and flattened, and a later key replaces an earlier one, as at runtime.
 * A spread that does not resolve throws, rather than lose what it holds.
 */
export const ownProperties = (literal: ObjectLiteralExpression): Map<string, Expression> => {
  const properties = new Map<string, Expression>();
  const set = (key: string, value: Expression) => {
    properties.delete(key);
    properties.set(key, value);
  };
  for (const property of literal.getProperties()) {
    if (Node.isSpreadAssignment(property)) {
      const spread = resolveObjectLiteral(property.getExpression());
      if (!spread) {
        throw new Error(
          `${location(property)}: could not resolve ${property.getText()} to an object literal.`,
        );
      }
      for (const [key, value] of ownProperties(spread)) {
        set(key, value);
      }
      continue;
    }
    const key = propertyKey(property);
    const value = propertyValue(property);
    if (key !== undefined && value) {
      set(key, value);
    }
  }
  return properties;
};

/** `path:line` of a node, for errors that name the source to change. */
export const location = (node: Node): string =>
  `${node.getSourceFile().getFilePath()}:${node.getStartLineNumber()}`;

export const propertyKey = (property: Node): string | undefined => {
  if (!Node.isPropertyAssignment(property) && !Node.isShorthandPropertyAssignment(property)) {
    return undefined;
  }
  const nameNode = property.getNameNode();
  return Node.isStringLiteral(nameNode) ? nameNode.getLiteralText() : nameNode.getText();
};

export const propertyValue = (property: Node | undefined): Expression | undefined => {
  if (Node.isPropertyAssignment(property)) {
    return property.getInitializer();
  }
  if (Node.isShorthandPropertyAssignment(property)) {
    return property.getNameNode();
  }
  return undefined;
};

export const literalString = (
  literal: ObjectLiteralExpression,
  name: string,
): string | undefined => {
  const value = propertyValue(literal.getProperty(name));
  return value && (Node.isStringLiteral(value) || Node.isNoSubstitutionTemplateLiteral(value))
    ? value.getLiteralText()
    : undefined;
};

export const literalStrings = (
  literal: ObjectLiteralExpression,
  name: string,
): string[] | undefined => {
  const value = propertyValue(literal.getProperty(name));
  if (!Node.isArrayLiteralExpression(value)) {
    return undefined;
  }
  const items = value.getElements();
  return items.every((item) => Node.isStringLiteral(item))
    ? items.map((item) => item.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralText())
    : undefined;
};

/**
 * Adds `name` to the file's import from `moduleSpecifier`. An import already written
 * one name per line stays that way, which ts-morph alone does not keep.
 */
export const ensureNamedImport = (
  file: SourceFile,
  moduleSpecifier: string,
  name: string,
): void => {
  const existing = file.getImportDeclaration(
    (declaration) => declaration.getModuleSpecifierValue() === moduleSpecifier,
  );
  if (!existing) {
    file.addImportDeclaration({ moduleSpecifier, namedImports: [name] });
    return;
  }
  const specifiers = existing.getNamedImports();
  if (specifiers.some((specifier) => specifier.getName() === name)) {
    return;
  }
  const multiline = specifiers.length > 0 && existing.getText().includes("\n");
  if (!multiline || existing.getDefaultImport() || existing.isTypeOnly()) {
    existing.addNamedImport(name);
    return;
  }
  const names = [...specifiers.map((specifier) => specifier.getText()), name];
  existing.replaceWithText(
    `import {\n${names.map((text) => `  ${text},`).join("\n")}\n} from ${existing.getModuleSpecifier().getText()};`,
  );
};

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
export const objectKey = (key: string): string =>
  IDENTIFIER.test(key) ? key : JSON.stringify(key);
export const accessor = (key: string): string =>
  IDENTIFIER.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
export const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
