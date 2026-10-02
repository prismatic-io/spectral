import { resolve } from "path";
import { ModuleKind, ModuleResolutionKind, Project, ScriptTarget } from "ts-morph";
import { describe, expect, it } from "vitest";
import integrationConfiguration from "./integrationConfiguration";

const SPECTRAL_PACKAGE = resolve(__dirname, "../../../../spectral");
const ROOT = resolve(__dirname, "__typecheck__");

const CONFIG_PAGES = `
import {
  configPage,
  configVar,
  connectionConfigVar,
  dataSourceConfigVar,
  userActivatedConnection,
  userLevelConfigPage,
} from "@prismatic-io/spectral";

declare module "@prismatic-io/spectral" {
  interface IntegrationDefinitionConfigPages extends ConfigPages {}
  interface IntegrationDefinitionUserLevelConfigPages extends UserLevelConfigPages {}
}
type ConfigPages = typeof configPages;
type UserLevelConfigPages = typeof userLevelConfigPages;

export const configPages = {
  Connections: configPage({
    elements: {
      "Acme Connection": connectionConfigVar({
        stableKey: "acme",
        dataType: "connection",
        inputs: { token: { label: "Token", type: "password" } },
      }),
    },
  }),
  Settings: configPage({
    elements: {
      "Object Key": configVar({ stableKey: "object-key", dataType: "string" }),
      limit: configVar({ stableKey: "limit", dataType: "number" }),
      fields: dataSourceConfigVar({
        stableKey: "fields",
        dataSourceType: "picklist",
        collectionType: "valuelist",
        perform: async () => ({ result: ["a"] }),
      }),
      "Region Choices": dataSourceConfigVar({
        stableKey: "region-choices",
        dataSourceType: "picklist",
        perform: async (context) => {
          const connection = context.configVars["Acme Connection"];
          const key = context.configVars["Object Key"];
          return { result: [String(key), String(connection)] };
        },
      }),
    },
  }),
};

export const userLevelConfigPages = {
  Personal: userLevelConfigPage({
    elements: {
      nickname: configVar({ stableKey: "nickname", dataType: "string" }),
      "Personal Slack": userActivatedConnection({ stableKey: "personal-slack" }),
      "Personal Channels": dataSourceConfigVar({
        stableKey: "personal-channels",
        dataSourceType: "picklist",
        async perform({ configVars }) {
          return { result: [String(configVars.nickname), String(configVars["Personal Slack"])] };
        },
      }),
    },
  }),
};
`;

/** Reads config vars the way a flow did before the migration. */
const FLOWS = `
import { flow } from "@prismatic-io/spectral";

export default [
  flow({
    name: "Sync",
    stableKey: "sync",
    onExecution: async (context) => {
      const key: string | undefined = context.configVars["Object Key"];
      const connection = context.configVars["Acme Connection"];
      const personal = context.configVars["Personal Slack"];
      return { data: { key, connection, personal } };
    },
  }),
  flow({
    name: "Deploy",
    stableKey: "deploy",
    onInstanceDeploy: async ({ configVars, logger }) => {
      logger.info(String(configVars.limit));
    },
    onExecution: async () => ({ data: null }),
  }),
];
`;

const INDEX = `
import {
  customerActivatedConnection,
  integration,
  organizationActivatedConnection,
  userActivatedConnection,
} from "@prismatic-io/spectral";
import { configPages, userLevelConfigPages } from "./configPages";
import flows from "./flows";

export default integration({
  name: "Acme",
  flows,
  configPages,
  userLevelConfigPages,
  scopedConfigVars: {
    orgConnection: organizationActivatedConnection({ stableKey: "org" }),
    customerConnection: customerActivatedConnection({ stableKey: "customer" }),
    userConnection: userActivatedConnection({ stableKey: "user" }),
  },
});
`;

/** Runs the codemod over `files` and returns the diagnostics in them, against this repository's spectral. */
const typecheck = (files: Record<string, string>): string[] => {
  const project = new Project({
    compilerOptions: {
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      target: ScriptTarget.ES2022,
      module: ModuleKind.ESNext,
      moduleResolution: ModuleResolutionKind.Bundler,
      types: [],
      paths: {
        "@prismatic-io/spectral": [resolve(SPECTRAL_PACKAGE, "src/index.ts")],
        zod: [resolve(SPECTRAL_PACKAGE, "node_modules/zod")],
      },
    },
    skipAddingFilesFromTsConfig: true,
  });
  for (const [name, text] of Object.entries(files)) {
    project.createSourceFile(resolve(ROOT, name), text);
  }

  integrationConfiguration.transform(project);

  return project
    .getPreEmitDiagnostics()
    .filter((diagnostic) => diagnostic.getSourceFile()?.getFilePath().startsWith(ROOT))
    .map(
      (diagnostic) =>
        `${diagnostic.getSourceFile()?.getBaseName()}:${diagnostic.getLineNumber()} ${project.formatDiagnosticsWithColorAndContext([diagnostic])}`,
    );
};

describe("v10.0.0/integration-configuration output", () => {
  it("type checks against the spectral in this repository", () => {
    expect(
      typecheck({ "configPages.ts": CONFIG_PAGES, "flows.ts": FLOWS, "index.ts": INDEX }),
    ).toEqual([]);
  }, 60_000);

  it("types a flow's user-level value read by the user-level schema", () => {
    const diagnostics = typecheck({
      "index.ts": `
import { configVar, flow, integration, userLevelConfigPage } from "@prismatic-io/spectral";

export default integration({
  name: "User Level",
  flows: [
    flow({
      name: "Greet",
      stableKey: "greet",
      onExecution: async (context) => {
        const nickname: string = context.configVars.nickname;
        return { data: nickname };
      },
    }),
  ],
  userLevelConfigPages: {
    Personal: userLevelConfigPage({
      elements: { nickname: configVar({ stableKey: "nickname", dataType: "string" }) },
    }),
  },
});
`,
    });

    // The read is now \`context.userConfiguration?.nickname\`: typed by the schema, and
    // absent until the user configures the instance.
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toContain(
      "Type 'string | undefined' is not assignable to type 'string'",
    );
  }, 60_000);

  it("compiles when the author already uses every name it declares and imports", () => {
    expect(
      typecheck({
        "settings.ts": "export const configuration = { zone: 1 };",
        "rpc.ts": "export const serverFunction = { schema: 2 };",
        "index.ts": `
import { configPage, configVar, dataSourceConfigVar, integration } from "@prismatic-io/spectral";
import { configuration } from "./settings";
import { serverFunction } from "./rpc";

const z = configuration.zone;
const configPagesSchema = serverFunction.schema;
const configurationSchema = { z };
const integrationConfiguration = { configPagesSchema, configurationSchema };
const elementSchema = { integrationConfiguration };

export default integration({
  name: "Clash",
  flows: [],
  configPages: {
    Page: configPage({
      elements: {
        selection: configVar({ stableKey: "s", dataType: "objectSelection" }),
        configuration: configVar({ stableKey: "c", dataType: "string" }),
        choices: dataSourceConfigVar({
          stableKey: "choices",
          dataSourceType: "picklist",
          perform: async () => ({ result: [String(elementSchema)] }),
        }),
      },
    }),
  },
});
`,
      }),
    ).toEqual([]);
  }, 60_000);

  it("leaves the reads of hoisted inline pages for the author to delete with them", () => {
    expect(
      typecheck({
        "index.ts": `
import { configPage, configVar, dataSourceConfigVar, integration } from "@prismatic-io/spectral";

export default integration({
  name: "Inline",
  flows: [],
  configPages: {
    Page: configPage({
      elements: {
        region: configVar({ stableKey: "region", dataType: "string" }),
        choices: dataSourceConfigVar({
          stableKey: "choices",
          dataSourceType: "picklist",
          perform: async (context) => ({ result: [String(context.configVars.region)] }),
        }),
      },
    }),
  },
});
`,
      }),
    ).toEqual([]);
  }, 60_000);

  it("leaves each configVars read it cannot convert for the compiler to flag", () => {
    const diagnostics = typecheck({
      "index.ts": `
import { configPage, dataSourceConfigVar, integration } from "@prismatic-io/spectral";

const pick = (configVars: unknown): string[] => [String(configVars)];

export default integration({
  name: "Unresolved",
  flows: [],
  configPages: {
    Page: configPage({
      elements: {
        choices: dataSourceConfigVar({
          stableKey: "choices",
          dataSourceType: "picklist",
          perform: async (context) => ({ result: pick(context.configVars) }),
        }),
      },
    }),
  },
});
`,
    });

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toContain("Property 'configVars' does not exist");
  }, 60_000);
});
