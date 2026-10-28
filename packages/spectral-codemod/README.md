<div align="center">
  <img src="https://prismatic.io/favicon-48x48.png" />
  <h1>@prismatic-io/spectral-codemod</h1>
</div>

Codemods that migrate Prismatic connectors and code-native integrations across
[`@prismatic-io/spectral`](../spectral) releases. Each codemod is a named rule that
rewrites source or project files in place.

## Usage

Run the latest published codemods without installing anything:

```sh
npx @prismatic-io/spectral-codemod@latest v<version>/<codemod> [path]
npx @prismatic-io/spectral-codemod@latest <codemod> --target-spectral <version> [path]
```

Each codemod has the spectral version it migrates to, as in
`v10.36.0/integration-configuration`. Name the codemod with its version, or name it alone
and pass the spectral version to migrate to with `--target-spectral`. The latest version of
the codemod at or below that spectral version runs. A preview release, such as
`10.26.2-preview.1`, is below its release. You must give the version in one of the two
ways, and not in both.

`path` is a project directory, a `tsconfig.json`, or a single source file. It defaults
to the current directory. A directory with a `tsconfig.json` contributes the files that
config includes; any other directory contributes every `.ts` and `.tsx` file beneath it
except `node_modules` and `dist`. A source file contributes itself, the files it imports,
and the test files that import one of those, compiled with the options of the nearest
`tsconfig.json`.

```sh
npx @prismatic-io/spectral-codemod@latest --list                          # available codemods
npx @prismatic-io/spectral-codemod@latest v10.36.0/integration-configuration --dry-run   # report without writing
npx @prismatic-io/spectral-codemod@latest integration-configuration --target-spectral 10.36.2   # v10.36.0
```

Commit or stash your work first, then review the diff the codemod leaves behind. When a
project holds more than one integration, pass the file of the one to migrate as the path.

## Codemods

### `v10.36.0/callable-component-packaging`

Adds a callable npm package alongside the component's platform build. Run from
the component's project directory:

```sh
npx @prismatic-io/spectral-codemod@latest callable-component-packaging --target-spectral 10.36.1 . --dry-run
```

Remove `--dry-run` to apply. The codemod validates these prerequisites before writing:

- tsdown `>=0.22.3`, Spectral `>=10.36.0`, TypeScript, and `tsconfig.json`.
  Declared dependency ranges must exclude older releases; dependencies are not upgraded.
- `src/index.ts` default-exports Spectral's `component()`.
- One static `defineConfig` tsdown config builds `src/index.ts` into a self-contained
  CommonJS `dist/index.js`. Supported loaders and copy rules are Markdown text and
  `assets/**/*`, or the flattened `assets/*` that Prism scaffolded before October 2026;
  custom settings or conflicting builds require manual changes.
- A CommonJS package with no conflicting entry points and a build script that ends with
  `tsdown`, such as `tsdown` or `npm run lint && tsdown`.

The codemod adds `npm-dist/index.cjs` and its declarations, configures package
exports and artifact inclusion, and sets `prismatic.component` to `./dist/index.js`.
It moves Spectral to peer and development dependencies and appends `npm run build`
to `prepare`. Existing exports, ignore rules, and publishing settings are preserved.
Wherever `.gitignore` or a Biome config excludes `dist`, it excludes `npm-dist` beside
it, in the same style. Running it again makes no changes.

After applying, reinstall dependencies to update the lockfile, run your tests, and
run `npm pack`. Consumers need Spectral installed and use the package's default
export to access callable components.

### `v10.35.1/public-entry-points`

Moves imports of Spectral's soft-deprecated `dist/` paths to the public entry points
that resolve to the same modules:

| From | To |
| --- | --- |
| `@prismatic-io/spectral/dist`, `@prismatic-io/spectral/dist/index` | `@prismatic-io/spectral` |
| `@prismatic-io/spectral/dist/clients/http`, `@prismatic-io/spectral/dist/clients/http/index` | `@prismatic-io/spectral/http` |
| `@prismatic-io/spectral/dist/testing` | `@prismatic-io/spectral/testing` |

Paths with a `.js` extension are moved too. It rewrites import and export sources,
`import()` types, and the first argument of calls such as `require`, dynamic `import`,
and `vi.mock`. Other `dist/` paths have no public entry point and stay as they are.

```sh
npx @prismatic-io/spectral-codemod@latest v10.35.1/public-entry-points . --dry-run
```

### `v10.36.0/integration-configuration`

Replaces an integration's config wizard with an integration `configuration`. The codemod
finds the project's single `integration()` call, ignoring calls in test files, and:

- turns `configPages` into the `instance` scope and `userLevelConfigPages` into the
  `userLevel` scope,
- emits, for each scope with pages, an exported zod `configPagesSchema` with one required
  field per non-connection config variable, and a scope `schema` that starts as an alias
  of it (`configurationSchema` for `instance`, `userConfigurationSchema` for `userLevel`),
- sets each scope's `version` to `"INITIAL"` and its `configPagesSchema`, so that `init`
  reads the config wizard's values, typed, when `context.configurationVersion` is `null`,
- moves every connection, including `scopedConfigVars`, into the `connections` of its
  scope: user-activated connections into `userLevel`, organization- and
  customer-activated connections into `instance`, and a connection with its own inputs
  into the scope of its page,
- adds an `init` that proposes the saved configuration of each scope as it is, cast to
  the scope's schema, and no `ui` metadata,
- keeps data source config variables as schema fields, and converts each data source
  with an inline `perform` to a server function in `configuration.serverFunctions`
  (see below),
- augments `IntegrationDefinitionConfiguration`, so that flows read
  `context.configuration` and `context.connections`, typed,
- takes each flow schedule that reads a config var from the deploying user (see below),
- rewrites the flows' `configVars` reads and connection references, and the `configVars`
  that flow tests pass to `invokeFlow` (see below), removes
  the project's `IntegrationDefinitionConfigPages`, `IntegrationDefinitionUserLevelConfigPages`,
  and `IntegrationDefinitionScopedConfigVars` augmentations, and declares page maps with no
  config vars, so that a read it could not migrate fails to compile,
- removes `configPages`, `userLevelConfigPages`, and `scopedConfigVars` from the call.

The codemod follows spreads in pages, `elements`, and `scopedConfigVars`, and a later key
replaces an earlier one, as at runtime. A spread, page, or element that it cannot resolve to
an object literal stops the run with its location, rather than lose what it holds. So does
an `integration()` definition that spreads in its config pages.

When a file already uses a name the codemod declares, such as `configurationSchema` or
`elementSchema`, the codemod adds a suffix, for example `configurationSchema2`. When a file
already binds `z`, `configuration`, or `serverFunction` to something else, the codemod imports
the export under an alias, such as `z as zod`. When the file already imports that export, it
uses the existing import.

Connections are referenced where they already live, for example
`configPages.Connections.elements["Acme Connection"]`, so the original page declarations
stay in place. Delete them once you have reviewed the result. Install `zod` if the project
does not already depend on it.

When you change a scope's schema, give it a new `version`, keep the previous schema
under `versionSchemas`, and keep `configPagesSchema` as the codemod wrote it. The
augmentation lists each scope's schema and connection names. Keep it in step when you add
or remove a connection.

#### Data sources

A server function is declared beside the data source it replaces, as an exported
`<key>ServerFunction` in the same file, so the copied `perform` keeps the helpers it uses.
The codemod rewrites the copy to the server function contract:

- a `configVars` read of a connection becomes `context.connections.<scope>.<key>`, and
  the connection is added to the function's `connections`,
- a `configVars` read of a value in the data source's own scope becomes `params.<key>`,
  and the value is added to `inputSchema` as optional: a host passes unsaved form values
  as params, and the data source ran while they were still empty,
- a read of a value in the other scope, such as a user-level data source that reads an
  instance value, becomes `context.configuration.<key>` or `context.userConfiguration.<key>`
  under a TODO. That form does not send the value, and the saved configuration can be
  empty or from an earlier version, so validate it before you read it,
- `{ result }` is unwrapped, because a server function returns the value itself,
- `outputSchema` comes from the `dataSourceType`: the choices the data source returns,
  not the value a person saves.

When the codemod cannot follow a `configVars` read, for example a computed key or
`configVars` passed whole to a helper, it still converts the function. It leaves that read
unchanged and adds a TODO at the top of the body. A server function's context has no
`configVars`, so the compiler flags each read that remains. A result that carries
`supplementalData` keeps it under a TODO, because a server function has no equivalent.

A component data source reference (`dataSource: { component, key }`) and a `perform`
declared elsewhere are not converted. A comment in the configuration lists them.
`dataSourceReset` and `validationMode` have no equivalent: the host decides when to call
a server function.

#### Flows

After the migration, a flow's `configVars` no longer holds the config pages' values, and
each connection is keyed as `<scope>.<key>`. The codemod rewrites every function outside
the page declarations and the new server functions:

- a read of a connection becomes `context.connections?.<scope>?.[key]`,
- a read of an instance value becomes `context.configuration?.[key]`, and a read of a
  user-level value becomes `context.userConfiguration?.[key]`, both typed by the
  configuration's schemas,
- a `{ configVar: "<connection>" }` reference, such as a component trigger's connection
  input, becomes `{ configVar: "<scope>.<key>" }`.

When the codemod cannot follow a read, for example a computed key or `configVars` passed
whole, it leaves the read as it is under a TODO. The compiler flags each read that remains.
Any other `{ configVar }` reference to a value is left as it is: the configuration has no
equivalent.

The reads are optional, because a flow's configurations and connections can be absent.
Code that relied on a value being present now needs to handle `undefined`.

#### Flow schedules

An integration with a configuration has no config vars, so a flow schedule cannot read
one. The codemod rewrites each flow schedule that reads a declared config var to
`{ fromDeployer: true }`, and the deploying user supplies the schedule and its timezone. A
schedule declared apart from its flow is rewritten where it is declared. A flow is the
argument of `flow()` or an object literal with `onExecution`, so a component trigger's
schedule input is left alone.

- Flows that read one schedule config var get a TODO each: the deploying user now
  supplies a schedule for each flow.
- A schedule that reads an undeclared config var keeps it under a TODO, and the compiler
  flags it.
- A config var that only schedules read is not part of the configuration, and its value
  leaves the flow tests. When a function uses `configVars` without a static key, every
  config var stays.

#### Flow tests

A migrated flow reads nothing from `configVars`, so a test must hand it the configuration
instead. The codemod rewrites the `configVars` of each `invokeFlow` call into the options
that replace them:

- a value goes to `configuration` or `userConfiguration`, by its scope,
- a connection goes to `connections.<scope>`, and `invokeFlow` gives it the
  `configVarKey` the runner does, `<scope>.<key>`.

A call whose `configVars` is not an object literal of declared config vars, for example a
shared constant, keeps it under a TODO. Once the integration augments
`IntegrationDefinitionConfiguration`, `invokeFlow` takes no `configVars`, so the compiler
flags each such call. The migrated tests need a spectral release whose `invokeFlow` takes
`configuration`, `userConfiguration`, and `connections`.

#### Schemas

| Config variable | Schema |
|---|---|
| `string`, `htmlElement` | `z.string()` |
| `code` with `codeLanguage: "json"` | `z.json()`, the parsed document |
| `code` with any other language | `z.string()` |
| `picklist` with a literal `pickList` | `z.enum([...])`, otherwise `z.string()` |
| `date` / `timestamp` | `z.iso.date()` / `z.iso.datetime({ local: true, offset: true })`, which accepts the wizard's local time to the minute |
| `boolean` / `number` | `z.boolean()` / `z.number()` |
| `schedule` | `z.object({ value, schedule_type, time_zone })` |
| `objectSelection` / `objectFieldMap` | zod objects built from a shared `elementSchema` |
| `jsonForm`, or a component data source reference | `z.unknown()` |
| `collectionType: "valuelist"` | `z.array(T)` |
| `collectionType: "keyvaluelist"` | `z.array(z.object({ key: z.string(), value: T }))` |

A data source config variable takes the row of its `dataSourceType`. The schema describes
the unpacked value of each variable. The config wizard stored every
scalar inside a collection as a string, so `init` must parse booleans and numbers in a
`valuelist` or `keyvaluelist` when it migrates an existing instance.

Page heading strings are skipped. Permission and visibility settings and default values
are not carried into the schema.

## Writing a codemod

For project files, implement `ProjectCodemod.plan(files)`: read with
`await files.read(path)`, validate, and return `{ path, content }` edits. Paths must
stay within the target directory. The runner writes changed files; `--dry-run`
previews them.

A source codemod is a `SourceCodemod` from `src/codemod.ts`: the spectral `version` it migrates to, a
`name` shared by each version of the migration, a `description`, and a
`transform(project)` that edits a [ts-morph](https://ts-morph.com) `Project` and returns
the files it changed. The `version` is a release, such as `10.36.0`, and the codemod lives
in `src/codemods/v<version>/`. Wrap a file-level transform with `eachFile`. Add the codemod
to `src/codemods/index.ts` and give it a test built on `applyCodemod` from `src/testing.ts`.

Transforms return `Promise<SourceFile[]>`. `eachFile` awaits callbacks sequentially.
In tests, await `applyCodemod` or `applyCodemodToSource`.
