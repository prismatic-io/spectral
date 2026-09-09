import {
  type CallExpression,
  type Expression,
  Node,
  type ObjectLiteralExpression,
  type Project,
  type SourceFile,
  SyntaxKind,
} from "ts-morph";
import { defineCodemod } from "../../codemod";
import {
  type ConfigVarShape,
  ELEMENT_SCHEMA_SOURCE,
  usesElementSchema,
  zodSchemaFor,
} from "./zodSchema";

const SPECTRAL = "@prismatic-io/spectral";
const E_TAG = "INITIAL";
const SCHEMA_NAME = "configurationSchema";
const PAGE_PROPERTIES = ["configPages", "userLevelConfigPages"] as const;
const SCOPED_PROPERTY = "scopedConfigVars";

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

const CONNECTION_WRAPPERS = new Set([
  "connectionConfigVar",
  "customerActivatedConnection",
  "organizationActivatedConnection",
  "userActivatedConnection",
]);

interface ClassifiedElement {
  key: string;
  /** Source that reaches the element from the integration file, e.g. `configPages.Page.elements.key`. */
  path: string;
  kind: "connection" | "dataSource" | "value";
  shape: ConfigVarShape;
}

/**
 * Replaces an integration's config wizard with a headless `configuration`.
 *
 * Every non-connection config variable becomes a required field of an exported zod
 * schema. Connections, including scoped config vars, move to
 * `configuration.connections`; data source config vars move to
 * `configuration.dataSources`. Both are referenced where they already live rather
 * than copied, so the original page declarations stay in place for the author to
 * remove after review. The codemod does not emit a `uiSchema`.
 */
export default defineCodemod({
  name: "v10.0.0/headless-configuration",
  description: "Migrate configPages, userLevelConfigPages, and scopedConfigVars to configuration",
  transform(project) {
    const call = findIntegrationCall(project);
    const file = call.getSourceFile();
    const definition = resolveObjectLiteral(call.getArguments()[0]);
    if (!definition) {
      throw new Error(`${file.getFilePath()}: integration() must be given an object literal.`);
    }

    const elements: ClassifiedElement[] = [];
    const hoisted: Node[] = [];
    for (const propertyName of PAGE_PROPERTIES) {
      const pages = hoistedProperty(definition, propertyName, call);
      if (pages) {
        elements.push(...classifyPages(pages.name, pages.literal));
        if (pages.hoisted) hoisted.push(pages.hoisted);
      }
    }
    const scoped = hoistedProperty(definition, SCOPED_PROPERTY, call);
    if (scoped) {
      if (scoped.hoisted) hoisted.push(scoped.hoisted);
      for (const property of scoped.literal.getProperties()) {
        const key = propertyKey(property);
        if (key !== undefined) {
          elements.push({
            key,
            path: `${scoped.name}${accessor(key)}`,
            kind: "connection",
            shape: {},
          });
        }
      }
    }
    if (
      elements.length === 0 &&
      !hasAnyProperty(definition, [...PAGE_PROPERTIES, SCOPED_PROPERTY])
    ) {
      throw new Error(`${file.getFilePath()}: integration() declares no configPages to migrate.`);
    }

    const values = elements.filter((element) => element.kind === "value");
    const statement = topLevelStatement(call);
    const schemaStatements = [
      ...(values.some((element) => usesElementSchema(element.shape))
        ? [ELEMENT_SCHEMA_SOURCE]
        : []),
      `export const ${SCHEMA_NAME} = z.object({\n${values
        .map((element) => `  ${objectKey(element.key)}: ${zodSchemaFor(element.shape)},`)
        .join("\n")}\n});\n`,
    ];
    file.insertStatements(statement.getChildIndex(), schemaStatements);
    for (const declaration of hoisted) {
      declaration.appendWhitespace("\n");
    }

    for (const name of [...PAGE_PROPERTIES, SCOPED_PROPERTY]) {
      definition.getProperty(name)?.remove();
    }
    definition.addPropertyAssignment({
      name: "configuration",
      initializer: configurationSource(elements),
    });

    ensureNamedImport(file, SPECTRAL, "configuration");
    ensureNamedImport(file, "zod", "z");
    file.formatText({ indentSize: 2 });
    file.replaceWithText(file.getFullText().replace(/\n{3,}/g, "\n\n"));
    return [file];
  },
});

const configurationSource = (elements: ClassifiedElement[]): string => {
  const group = (kind: ClassifiedElement["kind"], name: string): string[] => {
    const entries = elements.filter((element) => element.kind === kind);
    if (entries.length === 0) {
      return [];
    }
    const body = entries
      .map((element) => `    ${objectKey(element.key)}: ${element.path},`)
      .join("\n");
    return [`  ${name}: {\n${body}\n  },`];
  };
  return [
    "configuration({",
    `  schema: ${SCHEMA_NAME},`,
    `  eTag: ${JSON.stringify(E_TAG)},`,
    "  init: async () => {",
    "    // code to handle migrating between different configuration versions",
    "  },",
    ...group("connection", "connections"),
    ...group("dataSource", "dataSources"),
    "})",
  ].join("\n");
};

/** The single `integration()` call in the project, located through its spectral import. */
const findIntegrationCall = (project: Project): CallExpression => {
  const calls = project
    .getSourceFiles()
    .flatMap((file) =>
      file
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .filter((call) => isSpectralImport(call.getExpression(), "integration")),
    );
  if (calls.length !== 1) {
    throw new Error(
      calls.length === 0
        ? `No integration() call imported from ${SPECTRAL} was found.`
        : `Found ${calls.length} integration() calls; run the codemod against one integration at a time.`,
    );
  }
  return calls[0];
};

/** True when `expression` is an identifier bound by a named import of `exportName` from `SPECTRAL`. */
const isSpectralImport = (expression: Expression, exportName: string): boolean => {
  if (!Node.isIdentifier(expression)) {
    return false;
  }
  return expression
    .getDefinitionNodes()
    .some(
      (definition) =>
        Node.isImportSpecifier(definition) &&
        definition.getName() === exportName &&
        definition.getImportDeclaration().getModuleSpecifierValue() === SPECTRAL,
    );
};

/**
 * The object literal behind an expression: unwrapped from `as`, `satisfies`, and
 * parentheses; taken from the first argument of a spectral identity helper; or
 * followed from an identifier to its declaration, in this file or an imported one.
 */
const resolveObjectLiteral = (
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

const wrapperName = (call: CallExpression): string | undefined => {
  const callee = call.getExpression();
  return Node.isIdentifier(callee) && WRAPPERS.has(callee.getText()) ? callee.getText() : undefined;
};

/**
 * A page-holding property of the integration definition, as an identifier the new
 * `configuration` can reach it by. An inline object literal is hoisted into a
 * `const` before the integration so it can be referenced too.
 */
const hoistedProperty = (
  definition: ObjectLiteralExpression,
  propertyName: string,
  call: CallExpression,
): { name: string; literal: ObjectLiteralExpression; hoisted?: Node } | undefined => {
  const property = definition.getProperty(propertyName);
  if (!property) {
    return undefined;
  }
  const initializer = Node.isShorthandPropertyAssignment(property)
    ? property.getNameNode()
    : Node.isPropertyAssignment(property)
      ? property.getInitializerOrThrow()
      : undefined;
  if (!initializer) {
    throw new Error(`${propertyName} must be a property assignment.`);
  }

  if (Node.isIdentifier(initializer)) {
    const literal = resolveObjectLiteral(initializer);
    if (!literal) {
      throw new Error(
        `Could not resolve ${propertyName} (${initializer.getText()}) to an object literal.`,
      );
    }
    return { name: initializer.getText(), literal };
  }

  const file = call.getSourceFile();
  const statement = topLevelStatement(call);
  const name = file.getVariableDeclaration(propertyName)
    ? `integration${capitalize(propertyName)}`
    : propertyName;
  const [hoisted] = file.insertStatements(statement.getChildIndex(), [
    `const ${name} = ${initializer.getText()};`,
  ]);
  const literal = resolveObjectLiteral(
    hoisted.asKindOrThrow(SyntaxKind.VariableStatement).getDeclarations()[0].getInitializer(),
  );
  if (!literal) {
    throw new Error(`Could not resolve ${propertyName} to an object literal.`);
  }
  return { name, literal, hoisted };
};

const classifyPages = (pagesName: string, pages: ObjectLiteralExpression): ClassifiedElement[] => {
  const elements: ClassifiedElement[] = [];
  for (const pageProperty of pages.getProperties()) {
    const pageKey = propertyKey(pageProperty);
    const page = resolveObjectLiteral(propertyValue(pageProperty));
    if (pageKey === undefined || !page) {
      continue;
    }
    const pageElements = resolveObjectLiteral(propertyValue(page.getProperty("elements")));
    if (!pageElements) {
      continue;
    }
    for (const elementProperty of pageElements.getProperties()) {
      const key = propertyKey(elementProperty);
      const value = propertyValue(elementProperty);
      if (
        key === undefined ||
        !value ||
        Node.isStringLiteral(value) ||
        Node.isNoSubstitutionTemplateLiteral(value)
      ) {
        continue;
      }
      const classified = classifyElement(value);
      if (classified) {
        elements.push({
          key,
          path: `${pagesName}${accessor(pageKey)}.elements${accessor(key)}`,
          ...classified,
        });
      }
    }
  }
  return elements;
};

const classifyElement = (
  value: Expression,
): Pick<ClassifiedElement, "kind" | "shape"> | undefined => {
  const wrapper = Node.isCallExpression(value) ? wrapperName(value) : undefined;
  const literal = resolveObjectLiteral(value);
  if (!literal) {
    return undefined;
  }
  const dataType = literalString(literal, "dataType");
  if (
    (wrapper && CONNECTION_WRAPPERS.has(wrapper)) ||
    dataType === "connection" ||
    dataType === "userScopedConnection" ||
    literal.getProperty("connection")
  ) {
    return { kind: "connection", shape: {} };
  }
  const collectionType = literalString(
    literal,
    "collectionType",
  ) as ConfigVarShape["collectionType"];
  if (
    wrapper === "dataSourceConfigVar" ||
    literal.getProperty("dataSource") ||
    literal.getProperty("dataSourceType")
  ) {
    return {
      kind: "dataSource",
      shape: { valueType: literalString(literal, "dataSourceType"), collectionType },
    };
  }
  return {
    kind: "value",
    shape: {
      valueType: dataType,
      collectionType,
      pickList: literalStrings(literal, "pickList"),
      codeLanguage: literalString(literal, "codeLanguage"),
    },
  };
};

const propertyKey = (property: Node): string | undefined => {
  if (!Node.isPropertyAssignment(property) && !Node.isShorthandPropertyAssignment(property)) {
    return undefined;
  }
  const nameNode = property.getNameNode();
  return Node.isStringLiteral(nameNode) ? nameNode.getLiteralText() : nameNode.getText();
};

const propertyValue = (property: Node | undefined): Expression | undefined => {
  if (Node.isPropertyAssignment(property)) {
    return property.getInitializer();
  }
  if (Node.isShorthandPropertyAssignment(property)) {
    return property.getNameNode();
  }
  return undefined;
};

const literalString = (literal: ObjectLiteralExpression, name: string): string | undefined => {
  const value = propertyValue(literal.getProperty(name));
  return value && (Node.isStringLiteral(value) || Node.isNoSubstitutionTemplateLiteral(value))
    ? value.getLiteralText()
    : undefined;
};

const literalStrings = (literal: ObjectLiteralExpression, name: string): string[] | undefined => {
  const value = propertyValue(literal.getProperty(name));
  if (!Node.isArrayLiteralExpression(value)) {
    return undefined;
  }
  const items = value.getElements();
  return items.every((item) => Node.isStringLiteral(item))
    ? items.map((item) => item.asKindOrThrow(SyntaxKind.StringLiteral).getLiteralText())
    : undefined;
};

const hasAnyProperty = (literal: ObjectLiteralExpression, names: readonly string[]): boolean =>
  names.some((name) => literal.getProperty(name) !== undefined);

const ensureNamedImport = (file: SourceFile, moduleSpecifier: string, name: string): void => {
  const existing = file.getImportDeclaration(
    (declaration) => declaration.getModuleSpecifierValue() === moduleSpecifier,
  );
  if (!existing) {
    file.addImportDeclaration({ moduleSpecifier, namedImports: [name] });
    return;
  }
  if (!existing.getNamedImports().some((specifier) => specifier.getName() === name)) {
    existing.addNamedImport(name);
  }
};

/** The source file statement that contains `node`. */
const topLevelStatement = (node: Node): Node => {
  const statement = node.getAncestors().find((ancestor) => Node.isSourceFile(ancestor.getParent()));
  if (!statement) {
    throw new Error("integration() must be called at the top level of a module.");
  }
  return statement;
};

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const objectKey = (key: string): string => (IDENTIFIER.test(key) ? key : JSON.stringify(key));
const accessor = (key: string): string =>
  IDENTIFIER.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
