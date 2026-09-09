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
except `node_modules` and `dist`.

```sh
npx @prismatic-io/spectral-codemod@latest --list                          # available codemods
npx @prismatic-io/spectral-codemod@latest v10.0.0/headless-configuration --dry-run   # report without writing
```

Commit or stash your work first, then review the diff the codemod leaves behind.

## Codemods

### `v10.0.0/headless-configuration`

Replaces an integration's config wizard with a headless `configuration`. The codemod
finds the project's single `integration()` call and:

- emits an exported `configurationSchema` zod object with one required field per
  non-connection config variable across `configPages` and `userLevelConfigPages`,
- adds `configuration: configuration({ schema, eTag: "INITIAL", init, connections, dataSources })`
  to the integration, with an empty `init` for you to fill in and no `uiSchema`,
- moves every connection, including `scopedConfigVars`, into `configuration.connections`,
- moves every data source config variable into `configuration.dataSources`,
- removes `configPages`, `userLevelConfigPages`, and `scopedConfigVars` from the call.

Connections and data sources are referenced where they already live, for example
`configPages.Settings.elements["Field Map"]`, so the original page declarations stay in
place. Delete them once you have reviewed the result. Install `zod` if the project does
not already depend on it.

| Config variable | Schema |
|---|---|
| `string`, `htmlElement` | `z.string()` |
| `code` with `codeLanguage: "json"` | `z.json()`, the parsed document |
| `code` with any other language | `z.string()` |
| `picklist` with a literal `pickList` | `z.enum([...])`, otherwise `z.string()` |
| `date` / `timestamp` | `z.iso.date()` / `z.iso.datetime()` |
| `boolean` / `number` | `z.boolean()` / `z.number()` |
| `schedule` | `z.object({ value, schedule_type, time_zone })` |
| `objectSelection` / `objectFieldMap` | zod objects built from a shared `elementSchema` |
| `jsonForm`, or a component data source reference | `z.unknown()` |
| `collectionType: "valuelist"` | `z.array(T)` |
| `collectionType: "keyvaluelist"` | `z.array(z.object({ key: z.string(), value: T }))` |

The schema describes the unpacked value of each variable. The config wizard stored every
scalar inside a collection as a string, so `init` must parse booleans and numbers in a
`valuelist` or `keyvaluelist` when it migrates an existing instance.

Page heading strings are skipped. Permission and visibility settings and default values
are not carried into the schema.

## Writing a codemod

A codemod is a `Codemod` from `src/codemod.ts`: a `name`, a `description`, and a
`transform(project)` that edits a [ts-morph](https://ts-morph.com) `Project` and returns
the files it changed. Wrap a file-level transform with `eachFile`. Add the codemod to
`src/codemods/index.ts` and give it a test built on `applyCodemod` from `src/testing.ts`.
