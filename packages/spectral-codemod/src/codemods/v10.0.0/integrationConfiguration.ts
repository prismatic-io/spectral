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
  accessor,
  capitalize,
  ensureNamedImport,
  literalString,
  literalStrings,
  objectKey,
  propertyKey,
  propertyValue,
  resolveObjectLiteral,
  SPECTRAL,
  wrapperName,
} from "./ast";
import type { ClassifiedElement, Scope } from "./element";
import {
  emitServerFunction,
  type PlannedServerFunction,
  planServerFunctions,
} from "./serverFunctions";
import {
  type ConfigVarShape,
  ELEMENT_SCHEMA_NAME,
  ELEMENT_SCHEMA_SOURCE,
  zodSchemaFor,
} from "./zodSchema";

const VERSION = "INITIAL";
const CONFIGURATION_NAME = "integrationConfiguration";
const SCOPED_PROPERTY = "scopedConfigVars";

/** Each configuration scope, the page property it replaces, and the names of its schemas. */
const SCOPES = [
  {
    scope: "instance",
    pages: "configPages",
    configPagesSchema: "configPagesSchema",
    schema: "configurationSchema",
  },
  {
    scope: "userLevel",
    pages: "userLevelConfigPages",
    configPagesSchema: "userLevelConfigPagesSchema",
    schema: "userConfigurationSchema",
  },
] as const satisfies readonly {
  scope: Scope;
  pages: string;
  configPagesSchema: string;
  schema: string;
}[];

type ScopeNames = (typeof SCOPES)[number];

const CONNECTION_WRAPPERS = new Set([
  "connectionConfigVar",
  "customerActivatedConnection",
  "organizationActivatedConnection",
  "userActivatedConnection",
]);

/**
 * Replaces an integration's config wizard with an integration `configuration`.
 *
 * `configPages` become the `instance` scope and `userLevelConfigPages` the `userLevel`
 * scope. Each non-connection config variable becomes a required field of that scope's
 * zod schema. The schema starts as an alias of a `configPagesSchema` that records the
 * wizard's values, so `init` can read them, typed, when `configurationVersion` is null.
 *
 * Connections are referenced where they already live rather than copied. A
 * user-activated connection belongs to `userLevel`; an organization- or
 * customer-activated one, including every other scoped config var, to `instance`; a
 * connection with its own inputs stays in the scope of its page. Data source config
 * vars become schema fields. Each one with an inline `perform` also becomes a server
 * function declared beside it; a comment lists the rest.
 *
 * The codemod also opts flows into `context.configuration` through the
 * `integrationConfiguration` experimental flag. It does not emit a `uiSchema`.
 */
export default defineCodemod({
  name: "v10.0.0/integration-configuration",
  description:
    "Migrate configPages, userLevelConfigPages, and scopedConfigVars to an integration configuration",
  transform(project) {
    const call = findIntegrationCall(project);
    const file = call.getSourceFile();
    const definition = resolveObjectLiteral(call.getArguments()[0]);
    if (!definition) {
      throw new Error(`${file.getFilePath()}: integration() must be given an object literal.`);
    }

    const elements: ClassifiedElement[] = [];
    const hoisted: Node[] = [];
    const pageScopes = new Set<Scope>();
    for (const { scope, pages: propertyName } of SCOPES) {
      const pages = hoistedProperty(definition, propertyName, call);
      if (pages) {
        pageScopes.add(scope);
        elements.push(...classifyPages(pages.name, pages.literal, scope));
        if (pages.hoisted) hoisted.push(pages.hoisted);
      }
    }
    const scoped = hoistedProperty(definition, SCOPED_PROPERTY, call);
    if (scoped) {
      if (scoped.hoisted) hoisted.push(scoped.hoisted);
      for (const property of scoped.literal.getProperties()) {
        const key = propertyKey(property);
        const value = propertyValue(property);
        if (key !== undefined && value) {
          elements.push({
            key,
            path: `${scoped.name}${accessor(key)}`,
            scope: connectionScope(value, "instance"),
            kind: "connection",
            shape: {},
          });
        }
      }
    }
    const pageProperties = [...SCOPES.map(({ pages }) => pages), SCOPED_PROPERTY];
    if (elements.length === 0 && !hasAnyProperty(definition, pageProperties)) {
      throw new Error(`${file.getFilePath()}: integration() declares no configPages to migrate.`);
    }

    const scopes = SCOPES.filter(
      ({ scope }) =>
        scope === "instance" ||
        pageScopes.has(scope) ||
        elements.some((element) => element.scope === scope),
    );
    const { planned, unconverted } = planServerFunctions(elements);
    const statement = topLevelStatement(call);
    file.insertStatements(
      statement.getChildIndex(),
      `${[
        ...scopes.map((names) => schemaSource(names, elements, pageScopes.has(names.scope))),
        `const ${CONFIGURATION_NAME} = ${configurationSource(scopes, elements, pageScopes, planned, unconverted)};`,
        augmentationSource(scopes, elements),
      ].join("\n\n")}\n`,
    );
    for (const declaration of hoisted) {
      declaration.appendWhitespace("\n");
    }

    for (const name of pageProperties) {
      definition.getProperty(name)?.remove();
    }
    definition.addPropertyAssignment({ name: "configuration", initializer: CONFIGURATION_NAME });

    // A server function stays beside its data source so the copied perform keeps the
    // helpers it uses. In the integration file it precedes the configuration that
    // refers to it; elsewhere it goes last, after everything it could use.
    const pageFiles = new Set<SourceFile>();
    for (const serverFunction of planned) {
      if (serverFunction.file === file) {
        const index = file.getVariableStatementOrThrow(CONFIGURATION_NAME).getChildIndex();
        emitServerFunction(serverFunction, elements, index);
      } else {
        emitServerFunction(serverFunction, elements, serverFunction.file.getStatements().length);
        ensureNamedImport(
          file,
          file.getRelativePathAsModuleSpecifierTo(serverFunction.file),
          serverFunction.name,
        );
        pageFiles.add(serverFunction.file);
      }
    }
    for (const pageFile of pageFiles) {
      ensureElementSchema(pageFile);
    }
    ensureElementSchema(file);
    ensureNamedImport(file, SPECTRAL, "configuration");
    ensureNamedImport(file, "zod", "z");
    file.formatText({ indentSize: 2 });
    file.replaceWithText(file.getFullText().replace(/\n{3,}/g, "\n\n"));
    return [file, ...pageFiles];
  },
});

/**
 * A scope's schema statements. A scope with pages records their values in a
 * `configPagesSchema` and starts its schema as an alias of it; a scope that only holds
 * connections has an empty schema.
 */
const schemaSource = (
  names: ScopeNames,
  elements: ClassifiedElement[],
  hasPages: boolean,
): string => {
  if (!hasPages) {
    return `export const ${names.schema} = z.object({});`;
  }
  const fields = elements.filter(
    (element) => element.scope === names.scope && element.kind !== "connection",
  );
  const body = fields
    .map((element) => `  ${objectKey(element.key)}: ${zodSchemaFor(element.shape)},`)
    .join("\n");
  return [
    `export const ${names.configPagesSchema} = z.object(${body ? `{\n${body}\n}` : "{}"});`,
    `export const ${names.schema} = ${names.configPagesSchema};`,
  ].join("\n");
};

/** Declares `elementSchema` before its first use when a statement refers to it. */
const ensureElementSchema = (file: SourceFile): void => {
  if (file.getVariableDeclaration(ELEMENT_SCHEMA_NAME)) {
    return;
  }
  const usage = new RegExp(`\\b${ELEMENT_SCHEMA_NAME}\\b`);
  const first = file.getStatements().find((statement) => usage.test(statement.getText()));
  if (first) {
    file.insertStatements(first.getChildIndex(), ELEMENT_SCHEMA_SOURCE)[0].prependWhitespace("\n");
  }
};

const configurationSource = (
  scopes: ScopeNames[],
  elements: ClassifiedElement[],
  pageScopes: ReadonlySet<Scope>,
  serverFunctions: PlannedServerFunction[],
  unconverted: ClassifiedElement[],
): string => {
  const scopeSource = (names: ScopeNames): string[] => {
    const connections = elements.filter(
      (element) => element.scope === names.scope && element.kind === "connection",
    );
    return [
      `  ${names.scope}: {`,
      `    schema: ${names.schema},`,
      `    version: ${JSON.stringify(VERSION)},`,
      ...(pageScopes.has(names.scope)
        ? [propertySource("configPagesSchema", names.configPagesSchema)]
        : []),
      ...(connections.length
        ? [
            "    connections: {",
            ...connections.map((element) => `      ${objectKey(element.key)}: ${element.path},`),
            "    },",
          ]
        : []),
      "  },",
    ];
  };
  return [
    "configuration({",
    ...scopes.flatMap(scopeSource),
    "  init: {",
    "    perform: async (context) => {",
    "      if (context.configurationVersion === null) {",
    "        // context.configuration holds the values the config wizard collected.",
    "      }",
    "      // Return the proposed configuration for context.configurationVersion.",
    "    },",
    "  },",
    ...(serverFunctions.length
      ? [
          "  serverFunctions: {",
          ...serverFunctions.map(({ key, name }) => `    ${objectKey(key)}: ${name},`),
          "  },",
        ]
      : []),
    ...(unconverted.length
      ? [
          "  // These data sources have no inline perform to convert. Replace them with",
          "  // serverFunctions:",
          ...unconverted.map((element) => `  //   ${element.path}`),
        ]
      : []),
    "})",
  ].join("\n");
};

/**
 * Opts flows into `context.configuration` and types it by the emitted schemas and
 * connection names. It is written out rather than taken from `typeof` the
 * configuration: that type reaches the config pages, whose data source performs take
 * the flow context this augmentation defines, and the cycle leaves both untyped.
 */
const augmentationSource = (scopes: ScopeNames[], elements: ClassifiedElement[]): string => {
  const scopeSource = (names: ScopeNames): string[] => {
    const connections = elements.filter(
      (element) => element.scope === names.scope && element.kind === "connection",
    );
    return [
      `    ${names.scope}: {`,
      `      schema: typeof ${names.schema};`,
      ...(connections.length
        ? [
            `      connections: Record<${connections
              .map((element) => JSON.stringify(element.key))
              .join(" | ")}, unknown>;`,
          ]
        : []),
      "    };",
    ];
  };
  return [
    `declare module "${SPECTRAL}" {`,
    "  interface Experimental {",
    "    integrationConfiguration: true;",
    "  }",
    "  interface IntegrationDefinitionConfiguration {",
    ...scopes.flatMap(scopeSource),
    "  }",
    "}",
  ].join("\n");
};

const propertySource = (name: string, value: string): string =>
  name === value ? `    ${name},` : `    ${name}: ${value},`;

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
  // The local symbol, not its definition: once the module resolves, definitions lead
  // past the import into spectral itself.
  return (expression.getSymbol()?.getDeclarations() ?? []).some(
    (declaration) =>
      Node.isImportSpecifier(declaration) &&
      declaration.getName() === exportName &&
      declaration.getImportDeclaration().getModuleSpecifierValue() === SPECTRAL,
  );
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

const classifyPages = (
  pagesName: string,
  pages: ObjectLiteralExpression,
  scope: Scope,
): ClassifiedElement[] => {
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
      const classified = classifyElement(value, scope);
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
  pageScope: Scope,
): Pick<ClassifiedElement, "scope" | "kind" | "shape" | "literal"> | undefined => {
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
    return { scope: connectionScope(value, pageScope), kind: "connection", shape: {}, literal };
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
      scope: pageScope,
      kind: "dataSource",
      shape: { valueType: literalString(literal, "dataSourceType"), collectionType },
      literal,
    };
  }
  return {
    scope: pageScope,
    kind: "value",
    literal,
    shape: {
      valueType: dataType,
      collectionType,
      pickList: literalStrings(literal, "pickList"),
      codeLanguage: literalString(literal, "codeLanguage"),
    },
  };
};

/**
 * The scope a connection belongs to. A user-activated connection is `userLevel` and a
 * pointer at an organization- or customer-activated one is `instance`, wherever it was
 * declared. A connection that carries its own inputs or references a component's
 * connection stays in the scope it was declared in.
 */
const connectionScope = (value: Expression, declaredScope: Scope): Scope => {
  const wrapper = Node.isCallExpression(value) ? wrapperName(value) : undefined;
  if (wrapper === "userActivatedConnection") {
    return "userLevel";
  }
  if (wrapper === "organizationActivatedConnection" || wrapper === "customerActivatedConnection") {
    return "instance";
  }
  const literal = resolveObjectLiteral(value);
  if (!literal) {
    return declaredScope;
  }
  if (literalString(literal, "dataType") === "userScopedConnection") {
    return "userLevel";
  }
  return literal.getProperty("inputs") || literal.getProperty("connection")
    ? declaredScope
    : "instance";
};

const hasAnyProperty = (literal: ObjectLiteralExpression, names: readonly string[]): boolean =>
  names.some((name) => literal.getProperty(name) !== undefined);

/** The source file statement that contains `node`. */
const topLevelStatement = (node: Node): Node => {
  const statement = node.getAncestors().find((ancestor) => Node.isSourceFile(ancestor.getParent()));
  if (!statement) {
    throw new Error("integration() must be called at the top level of a module.");
  }
  return statement;
};
