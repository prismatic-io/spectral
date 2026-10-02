import {
  type CallExpression,
  type Expression,
  Node,
  type ObjectLiteralExpression,
  type Project,
  type SourceFile,
  SyntaxKind,
  ts,
} from "ts-morph";
import { defineCodemod } from "../../codemod";
import {
  accessor,
  capitalize,
  ensureNamedImport,
  literalString,
  literalStrings,
  location,
  objectKey,
  ownProperties,
  propertyKey,
  propertyValue,
  resolveObjectLiteral,
  SPECTRAL,
  wrapperName,
} from "./ast";
import type { ClassifiedElement, Scope } from "./element";
import { migrateConfigVarReferences, migrateFlowReads } from "./flowReads";
import { migrateInvokeFlowCalls } from "./invokeFlowCalls";
import { createNamer, type FileNames, withNames } from "./names";
import {
  emitServerFunction,
  type PlannedServerFunction,
  planServerFunctions,
} from "./serverFunctions";
import {
  type ConfigVarShape,
  ELEMENT_SCHEMA_SOURCE,
  storedAsString,
  unreadTypeComment,
  zodSchemaFor,
} from "./zodSchema";

const CODEMOD_NAME = "v10.0.0/integration-configuration";
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
] as const satisfies readonly ScopeNames[];

interface ScopeNames {
  scope: Scope;
  pages: string;
  configPagesSchema: string;
  schema: string;
}

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
  name: CODEMOD_NAME,
  description:
    "Migrate configPages, userLevelConfigPages, and scopedConfigVars to an integration configuration",
  transform(project) {
    const call = findIntegrationCall(project);
    const file = call.getSourceFile();
    const definition = resolveObjectLiteral(call.getArguments()[0]);
    if (!definition) {
      throw new Error(`${file.getFilePath()}: integration() must be given an object literal.`);
    }

    const pageProperties = [...SCOPES.map(({ pages }) => pages), SCOPED_PROPERTY];
    for (const spread of definition.getProperties().filter(Node.isSpreadAssignment)) {
      const literal = resolveObjectLiteral(spread.getExpression());
      if (!literal) {
        throw new Error(
          `${location(spread)}: could not resolve ${spread.getText()} to tell whether it holds config pages.`,
        );
      }
      const properties = ownProperties(literal);
      if (pageProperties.some((name) => properties.has(name))) {
        throw new Error(
          `${location(spread)}: move configPages, userLevelConfigPages, and scopedConfigVars out of ${spread.getText()} and into the integration() call.`,
        );
      }
    }

    const elements: ClassifiedElement[] = [];
    const hoisted: Node[] = [];
    const pageScopes = new Set<Scope>();
    for (const { scope, pages: propertyName } of SCOPES) {
      const pages = hoistedProperty(definition, propertyName, call, (name, literal) => {
        elements.push(...classifyPages(name, literal, scope));
      });
      if (pages) {
        pageScopes.add(scope);
        if (pages.hoisted) hoisted.push(pages.hoisted);
      }
    }
    const scoped = hoistedProperty(definition, SCOPED_PROPERTY, call, (name, literal) => {
      for (const [key, value] of ownProperties(literal)) {
        elements.push({
          key,
          path: `${name}${accessor(key)}`,
          scope: connectionScope(value, "instance"),
          kind: "connection",
          shape: {},
        });
      }
    });
    if (scoped?.hoisted) hoisted.push(scoped.hoisted);
    if (elements.length === 0 && !hasAnyProperty(definition, pageProperties)) {
      throw new Error(`${file.getFilePath()}: integration() declares no configPages to migrate.`);
    }

    // Names are resolved before any edit, against what the author's files already bind.
    const namer = createNamer();
    const names = namer.namesFor(file);
    const scopes = SCOPES.filter(
      ({ scope }) =>
        scope === "instance" ||
        pageScopes.has(scope) ||
        elements.some((element) => element.scope === scope),
    ).map(
      (scope): ScopeNames => ({
        ...scope,
        configPagesSchema: namer.declare(file, scope.configPagesSchema),
        schema: namer.declare(file, scope.schema),
      }),
    );
    const configurationName = namer.declare(file, CONFIGURATION_NAME);
    const { planned, unconverted } = planServerFunctions(elements, namer);
    const augmentationFiles = removePageAugmentations(project);
    const statement = topLevelStatement(call);
    file.insertStatements(
      statement.getChildIndex(),
      `${withNames(
        [
          ...scopes.map((scope) => schemaSource(scope, elements, pageScopes.has(scope.scope))),
          `const ${configurationName} = ${configurationSource(scopes, elements, pageScopes, planned, unconverted)};`,
          augmentationSource(scopes, elements),
        ].join("\n\n"),
        names,
      )}\n`,
    );
    for (const declaration of hoisted) {
      declaration.appendWhitespace("\n");
    }

    rewriteDefinition(definition, pageProperties, configurationName);

    // A server function stays beside its data source so the copied perform keeps the
    // helpers it uses. In the integration file it precedes the configuration that
    // refers to it; elsewhere it goes last, after everything it could use.
    const pageFiles = new Set<SourceFile>();
    for (const serverFunction of planned) {
      if (serverFunction.file === file) {
        const index = file.getVariableStatementOrThrow(configurationName).getChildIndex();
        emitServerFunction(serverFunction, elements, index, namer);
      } else {
        emitServerFunction(
          serverFunction,
          elements,
          serverFunction.file.getStatements().length,
          namer,
        );
        ensureNamedImport(
          file,
          file.getRelativePathAsModuleSpecifierTo(serverFunction.file),
          serverFunction.name,
        );
        pageFiles.add(serverFunction.file);
      }
    }
    for (const pageFile of pageFiles) {
      ensureElementSchema(pageFile, namer.namesFor(pageFile));
    }
    ensureElementSchema(file, names);

    // The page declarations stay for review, including the copies hoisted out of the
    // definition, and each server function already reads the new context, so none is
    // a flow to migrate.
    const excluded = [
      ...elements.flatMap((element) => element.literal ?? []),
      ...hoisted,
      ...planned.map(({ file, name }) => file.getVariableStatementOrThrow(name)),
    ];
    const flowFiles = migrateFlowReads(project, elements, excluded);
    const referenceFiles = migrateConfigVarReferences(project, elements);
    const testFiles = migrateInvokeFlowCalls(project, elements);
    namer.addImports(file, ["configuration", "z"]);
    file.formatText({ indentSize: 2 });
    file.replaceWithText(file.getFullText().replace(/\n{3,}/g, "\n\n"));
    return [
      ...new Set([
        file,
        ...pageFiles,
        ...augmentationFiles,
        ...flowFiles,
        ...referenceFiles,
        ...testFiles,
      ]),
    ];
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
    .map(
      (element) =>
        `  ${objectKey(element.key)}: ${zodSchemaFor(element.shape)},${unreadTypeComment(element.shape)}`,
    )
    .join("\n");
  return [
    `export const ${names.configPagesSchema} = z.object(${body ? `{\n${body}\n}` : "{}"});`,
    `export const ${names.schema} = ${names.configPagesSchema};`,
  ].join("\n");
};

const PAGE_AUGMENTATIONS = new Set([
  "IntegrationDefinitionConfigPages",
  "IntegrationDefinitionUserLevelConfigPages",
  "IntegrationDefinitionScopedConfigVars",
]);

/**
 * Removes the project's augmentations that type `configVars` from its config pages.
 * They would keep a flow's stale `configVars` reads compiling. Returns the files it
 * changed.
 */
const removePageAugmentations = (project: Project): SourceFile[] =>
  project.getSourceFiles().filter((file) => {
    let changed = false;
    for (const module of file.getDescendantsOfKind(SyntaxKind.ModuleDeclaration)) {
      if (module.getName().replace(/^["']|["']$/g, "") !== SPECTRAL) continue;
      const stale = module
        .getInterfaces()
        .filter((declaration) => PAGE_AUGMENTATIONS.has(declaration.getName()));
      for (const declaration of stale) {
        declaration.remove();
      }
      if (stale.length && module.getStatements().length === 0) {
        module.remove();
      }
      changed ||= stale.length > 0;
    }
    return changed;
  });

/** Declares the element schema before its first use when a statement refers to it. */
const ensureElementSchema = (file: SourceFile, names: FileNames): void => {
  if (file.getVariableDeclaration(names.elementSchema)) {
    return;
  }
  const usage = new RegExp(`(?<![\\w$.])${names.elementSchema.replace(/\$/g, "\\$")}(?![\\w$])`);
  const first = file.getStatements().find((statement) => usage.test(statement.getText()));
  if (first) {
    file
      .insertStatements(first.getChildIndex(), withNames(ELEMENT_SCHEMA_SOURCE, names))[0]
      .prependWhitespace("\n");
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
    ...initSource(elements, scopes[0].schema),
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
 * An `init` that proposes the saved configuration as it is. The config wizard's values
 * arrive while `configurationVersion` is null, and the instance schema starts as their
 * shape. A collection whose items the wizard stored as strings gets a TODO to parse them.
 */
const initSource = (elements: ClassifiedElement[], schemaName: string): string[] => {
  const unparsed = elements.filter(
    (element) =>
      element.scope === "instance" &&
      element.kind !== "connection" &&
      storedAsString(element.shape),
  );
  return [
    "  init: {",
    "    perform: async (context) => {",
    "      // The config wizard's values arrive while context.configurationVersion is null,",
    `      // and ${schemaName} starts as their shape. Branch on the version when the`,
    "      // schema changes.",
    ...(unparsed.length
      ? [
          "      // TODO: The config wizard stored each item of these collections as a string.",
          `      // Parse them before you return the configuration: ${unparsed.map((element) => element.key).join(", ")}.`,
        ]
      : []),
    "      return context.configuration;",
    "    },",
    "  },",
  ];
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
    "  // No config page declares config vars any more, so a configVars read that was",
    "  // not migrated fails to compile.",
    "  interface IntegrationDefinitionConfigPages {",
    "    [page: string]: { elements: Record<never, never> };",
    "  }",
    "  interface IntegrationDefinitionUserLevelConfigPages {",
    "    [page: string]: { elements: Record<never, never> };",
    "  }",
    "}",
  ].join("\n");
};

const propertySource = (name: string, value: string): string =>
  name === value ? `    ${name},` : `    ${name}: ${value},`;

const TEST_FILE = /(\.(test|spec)\.[cm]?tsx?$)|(\/__tests__\/)/;

/**
 * The single `integration()` call in the project, located through its spectral import.
 * A call in a test file is ignored when the project has one elsewhere.
 */
const findIntegrationCall = (project: Project): CallExpression => {
  const all = project
    .getSourceFiles()
    .flatMap((file) =>
      file
        .getDescendantsOfKind(SyntaxKind.CallExpression)
        .filter((call) => isSpectralImport(call.getExpression(), "integration")),
    );
  const outsideTests = all.filter((call) => !TEST_FILE.test(call.getSourceFile().getFilePath()));
  const calls = outsideTests.length ? outsideTests : all;
  if (calls.length === 0) {
    throw new Error(`No integration() call imported from ${SPECTRAL} was found.`);
  }
  if (calls.length > 1) {
    throw new Error(
      [
        `Found ${calls.length} integration() calls: ${calls.map(location).join(", ")}.`,
        "Pass the file of the integration to migrate as the path, for example:",
        `  spectral-codemod ${CODEMOD_NAME} ${calls[0].getSourceFile().getFilePath()}`,
      ].join("\n"),
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
 * A page-holding property of the integration definition, handed to `classify` with an
 * identifier the new `configuration` can reach it by. An inline object literal is then
 * hoisted into a `const` before the integration so it can be referenced too. It is
 * classified first, so an error names the author's line rather than the copy's.
 */
const hoistedProperty = (
  definition: ObjectLiteralExpression,
  propertyName: string,
  call: CallExpression,
  classify: (name: string, literal: ObjectLiteralExpression) => void,
): { hoisted?: Node } | undefined => {
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
    throw new Error(`${location(property)}: ${propertyName} must be a property assignment.`);
  }
  if (isNothing(initializer)) {
    return undefined;
  }
  const literal = resolveObjectLiteral(initializer);
  if (!literal) {
    throw new Error(
      `${location(initializer)}: could not resolve ${propertyName} (${initializer.getText()}) to an object literal.`,
    );
  }

  if (Node.isIdentifier(initializer)) {
    classify(initializer.getText(), literal);
    return {};
  }

  const file = call.getSourceFile();
  const name = file.getVariableDeclaration(propertyName)
    ? `integration${capitalize(propertyName)}`
    : propertyName;
  classify(name, literal);
  const [hoisted] = file.insertStatements(topLevelStatement(call).getChildIndex(), [
    `const ${name} = ${initializer.getText()};`,
  ]);
  return { hoisted };
};

const classifyPages = (
  pagesName: string,
  pages: ObjectLiteralExpression,
  scope: Scope,
): ClassifiedElement[] => {
  const elements: ClassifiedElement[] = [];
  for (const [pageKey, pageValue] of ownProperties(pages)) {
    const page = resolveObjectLiteral(pageValue);
    const pageElements = page && resolveObjectLiteral(ownProperties(page).get("elements"));
    if (!pageElements) {
      throw new Error(
        `${location(pageValue)}: could not resolve page "${pageKey}" to its elements.`,
      );
    }
    for (const [key, value] of ownProperties(pageElements)) {
      if (Node.isStringLiteral(value) || Node.isNoSubstitutionTemplateLiteral(value)) {
        continue;
      }
      const classified = classifyElement(value, scope);
      if (!classified) {
        throw new Error(`${location(value)}: could not resolve element "${key}" to a config var.`);
      }
      elements.push({
        key,
        path: `${pagesName}${accessor(pageKey)}.elements${accessor(key)}`,
        ...classified,
      });
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
  const dataSourceType = literalString(literal, "dataSourceType");
  if (
    wrapper === "dataSourceConfigVar" ||
    literal.getProperty("dataSource") ||
    literal.getProperty("dataSourceType")
  ) {
    return {
      scope: pageScope,
      kind: "dataSource",
      shape: {
        valueType: dataSourceType,
        collectionType,
        ...(dataSourceType === undefined && literal.getProperty("dataSourceType")
          ? { unreadType: "dataSourceType" as const }
          : {}),
      },
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
      ...(dataType === undefined && literal.getProperty("dataType")
        ? { unreadType: "dataType" as const }
        : {}),
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

/**
 * Rewrites the integration definition without its page properties and with
 * `configuration`, one property per line. Each property keeps its comments: one on a
 * line of its own before it, and one after it on its line. A removed property's
 * comments go with it. Removing properties in place instead leaves them behind, and
 * merges the neighbors of a definition written on one line.
 */
const rewriteDefinition = (
  definition: ObjectLiteralExpression,
  removed: readonly string[],
  configurationName: string,
): void => {
  const text = definition.getSourceFile().getFullText();
  const properties = definition.getProperties();
  const closeBrace = definition.getLastChildByKindOrThrow(SyntaxKind.CloseBraceToken);
  // A comment in the trivia before a node belongs to the property before it when it
  // is still on that property's line, and to the node when it starts a line.
  const split = (node: Node) => {
    const comments = (ranges: ts.CommentRange[] | undefined) =>
      (ranges ?? []).map((range) => text.slice(range.pos, range.end));
    return {
      previous: comments(ts.getTrailingCommentRanges(text, node.getPos())),
      own: comments(ts.getLeadingCommentRanges(text, node.getPos())),
    };
  };
  const entries = properties.map((property) => ({
    property,
    before: split(property).own,
    after: [] as string[],
  }));
  for (const [index, entry] of entries.entries()) {
    const next = entries[index + 1]?.property ?? closeBrace;
    entry.after = split(next).previous;
  }
  const trailing = split(closeBrace).own;
  // A comment on the opening brace's line stays there.
  const opening = split(properties[0] ?? closeBrace).previous;

  const lines = entries
    .filter(({ property }) => {
      // Only a plain name can be a page property; anything else is kept as written.
      const nameNode =
        Node.isPropertyAssignment(property) || Node.isShorthandPropertyAssignment(property)
          ? property.getNameNode()
          : undefined;
      const key =
        Node.isIdentifier(nameNode) || Node.isStringLiteral(nameNode)
          ? propertyKey(property)
          : undefined;
      return key === undefined || !removed.includes(key);
    })
    .flatMap(({ property, before, after }) => [
      ...before,
      `${property.getText()},${after.length ? ` ${after.join(" ")}` : ""}`,
    ]);
  definition
    .replaceWithText(
      `{${opening.length ? ` ${opening.join(" ")}` : ""}\n${[...lines, `configuration: ${configurationName},`, ...trailing].join("\n")}\n}`,
    )
    .formatText({ indentSize: 2 });
};

/** True for `undefined`, `null`, or `void 0`: a page property that declares nothing. */
const isNothing = (expression: Node): boolean =>
  (Node.isIdentifier(expression) && expression.getText() === "undefined") ||
  Node.isNullLiteral(expression) ||
  Node.isVoidExpression(expression);

const hasAnyProperty = (literal: ObjectLiteralExpression, names: readonly string[]): boolean =>
  names.some((name) => {
    const value = propertyValue(literal.getProperty(name));
    return value !== undefined && !isNothing(value);
  });

/** The source file statement that contains `node`. */
const topLevelStatement = (node: Node): Node => {
  const statement = node.getAncestors().find((ancestor) => Node.isSourceFile(ancestor.getParent()));
  if (!statement) {
    throw new Error("integration() must be called at the top level of a module.");
  }
  return statement;
};
