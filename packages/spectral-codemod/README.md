<div align="center">
  <img src="https://prismatic.io/favicon-48x48.png" />
  <h1>@prismatic-io/spectral-codemod</h1>
</div>

Codemods that migrate Prismatic connectors and code-native integrations across
[`@prismatic-io/spectral`](../spectral) releases. Each codemod is a named rule that
rewrites your source files in place.

## Usage

Run the latest published codemods without installing anything:

```sh
npx @prismatic-io/spectral-codemod@latest <codemod> [path]
```

`path` is a project directory, a `tsconfig.json`, or a single source file. It defaults
to the current directory. A directory with a `tsconfig.json` contributes the files that
config includes; any other directory contributes every `.ts` and `.tsx` file beneath it
except `node_modules` and `dist`. A source file contributes itself, the files it imports,
and the test files that import one of those, compiled with the options of the nearest
`tsconfig.json`.

```sh
npx @prismatic-io/spectral-codemod@latest --list                          # available codemods
npx @prismatic-io/spectral-codemod@latest v10.0.0/integration-configuration --dry-run   # report without writing
```

Commit or stash your work first, then review the diff the codemod leaves behind. When a
project holds more than one integration, pass the file of the one to migrate as the path.

## Codemods

### `v10.0.0/integration-configuration`

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
- adds an `init` that proposes the saved configuration as it is, and no `uiSchema`,
- keeps data source config variables as schema fields, and converts each data source
  with an inline `perform` to a server function in `configuration.serverFunctions`
  (see below),
- enables the `integrationConfiguration` experimental flag and augments
  `IntegrationDefinitionConfiguration`, so that flows read `context.configuration` and
  `context.connections`, typed,
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
A `{ configVar }` reference to a value, such as a schedule's, is left as it is: the
configuration has no equivalent yet.

The reads are optional, because a flow's configurations and connections can be absent.
Code that relied on a value being present now needs to handle `undefined`.

#### Flow tests

A migrated flow reads nothing from `configVars`, so a test must hand it the configuration
instead. The codemod rewrites the `configVars` of each `invokeFlow` call into the options
that replace them:

- a value goes to `configuration` or `userConfiguration`, by its scope,
- a connection goes to `connections.<scope>`, and `invokeFlow` gives it the
  `configVarKey` the runner does, `<scope>.<key>`.

A call whose `configVars` is not an object literal of declared config vars, for example a
shared constant, keeps it under a TODO. Once the integration enables the
`integrationConfiguration` flag, `invokeFlow` takes no `configVars`, so the compiler flags
each such call. The migrated tests need a spectral release whose `invokeFlow` takes
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

A codemod is a `Codemod` from `src/codemod.ts`: a `name`, a `description`, and a
`transform(project)` that edits a [ts-morph](https://ts-morph.com) `Project` and returns
the files it changed. Wrap a file-level transform with `eachFile`. Add the codemod to
`src/codemods/index.ts` and give it a test built on `applyCodemod` from `src/testing.ts`.
