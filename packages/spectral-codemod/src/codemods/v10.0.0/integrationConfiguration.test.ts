import { describe, expect, it } from "vitest";
import { applyCodemod } from "../../testing";
import integrationConfiguration from "./integrationConfiguration";

const run = (files: Record<string, string>) => applyCodemod(integrationConfiguration, files);

const CONFIG_PAGES = `
import {
  configPage,
  configVar,
  connectionConfigVar,
  dataSourceConfigVar,
  userActivatedConnection,
  userLevelConfigPage,
} from "@prismatic-io/spectral";

const listRegions = (limit: unknown, configVars: unknown): string[] => ["us"];

export const configPages = {
  Connections: configPage({
    tagline: "Connect",
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
      heading: "<h1>Settings</h1>",
      "Object Key": configVar({ stableKey: "object-key", dataType: "string" }),
      region: configVar({ stableKey: "region", dataType: "picklist", pickList: ["us", "eu"] }),
      tags: configVar({ stableKey: "tags", dataType: "string", collectionType: "valuelist" }),
      headers: configVar({ stableKey: "headers", dataType: "string", collectionType: "keyvaluelist" }),
      enabled: configVar({ stableKey: "enabled", dataType: "boolean" }),
      limit: configVar({ stableKey: "limit", dataType: "number" }),
      start: configVar({ stableKey: "start", dataType: "date" }),
      at: configVar({ stableKey: "at", dataType: "timestamp" }),
      body: configVar({ stableKey: "body", dataType: "code", codeLanguage: "json" }),
      markup: configVar({ stableKey: "markup", dataType: "code", codeLanguage: "xml" }),
      schedule: configVar({ stableKey: "schedule", dataType: "schedule" }),
      selection: configVar({ stableKey: "selection", dataType: "objectSelection" }),
      fieldMap: configVar({ stableKey: "field-map", dataType: "objectFieldMap" }),
      form: configVar({ stableKey: "form", dataType: "jsonForm" }),
      banner: configVar({ stableKey: "banner", dataType: "htmlElement" }),
      fields: dataSourceConfigVar({
        stableKey: "fields",
        dataSourceType: "picklist",
        collectionType: "valuelist",
        perform: async (context) => {
          const connection = context.configVars["Acme Connection"];
          const prefix = context.configVars["Object Key"];
          return { result: [\`\${prefix}-\${connection.fields.token}\`] };
        },
      }),
      "Mapped Regions": dataSourceConfigVar({
        stableKey: "mapped-regions",
        dataSourceType: "picklist",
        description: "Regions for the chosen limit",
        async perform({ configVars, logger }) {
          logger.info("listing regions");
          return {
            result: listRegions(configVars.limit, configVars),
            supplementalData: { data: {}, contentType: "application/json" },
          };
        },
      }),
      quick: dataSourceConfigVar({
        stableKey: "quick",
        dataSourceType: "string",
        perform: async () => ({ result: "a" }),
      }),
      "Field Map": dataSourceConfigVar({
        stableKey: "remote-fields",
        dataSource: { component: "salesforce", key: "listFields" },
      }),
    },
  }),
};

export const userLevelConfigPages = {
  Personal: userLevelConfigPage({
    elements: {
      nickname: configVar({ stableKey: "nickname", dataType: "string" }),
      "Personal Region": dataSourceConfigVar({
        stableKey: "personal-region",
        dataSourceType: "string",
        perform: async (context) => ({
          result: \`\${context.configVars.region}-\${context.configVars.nickname}\`,
        }),
      }),
      "Personal Slack": userActivatedConnection({ stableKey: "personal-slack" }),
      "Personal Acme": connectionConfigVar({
        stableKey: "personal-acme",
        dataType: "connection",
        inputs: { token: { label: "Token", type: "password" } },
      }),
    },
  }),
};
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
  description: "Sync Acme",
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

describe("v10.0.0/integration-configuration", () => {
  it("rewrites the integration file and declares server functions beside their data sources", () => {
    const { files, changed } = run({
      "src/index.ts": INDEX,
      "src/configPages.ts": CONFIG_PAGES,
      "src/flows.ts": "export default [];",
    });

    expect(changed).toEqual(["src/index.ts", "src/configPages.ts"]);
    const pagesOutput = files["src/configPages.ts"];
    expect(pagesOutput).toMatch(
      / {2}userLevelConfigPage,\n {2}serverFunction,\n\} from "@prismatic-io\/spectral";\nimport \{ z \} from "zod";/,
    );
    expect(
      pagesOutput.slice(pagesOutput.indexOf("\n\nconst elementSchema")),
    ).toMatchInlineSnapshot(`
      "

      const elementSchema = z.object({ key: z.string(), label: z.string().optional() });

      export const fieldsServerFunction = serverFunction({
        label: "fields",
        inputSchema: z.object({
          "Object Key": z.string().optional(),
        }),
        outputSchema: z.union([z.array(z.string()), z.array(elementSchema)]),
        connections: ["instance.Acme Connection"],
        perform: async (context, params) => {
          const connection = context.connections.instance["Acme Connection"];
          const prefix = params["Object Key"];
          return [\`\${prefix}-\${connection.fields.token}\`];
        },
      });

      export const mappedRegionsServerFunction = serverFunction({
        label: "Mapped Regions",
        description: "Regions for the chosen limit",
        inputSchema: z.object({
          limit: z.number().optional(),
        }),
        outputSchema: z.union([z.array(z.string()), z.array(elementSchema)]),
        async perform({ configVars, logger }, params) {
          // TODO: Fix the configVars reads the codemod could not convert. Read unsaved form
          // values from params and declare them in inputSchema, saved values from
          // context.configuration, and connections from context.connections and declare
          // them in connections.
          // TODO: A server function has no supplementalData. Return only the result.
          logger.info("listing regions");
          return ({
            result: listRegions(params.limit, configVars),
            supplementalData: { data: {}, contentType: "application/json" },
          }).result;
        },
      });

      export const quickServerFunction = serverFunction({
        label: "quick",
        inputSchema: z.object({}),
        outputSchema: z.string(),
        perform: async () => "a",
      });

      export const personalRegionServerFunction = serverFunction({
        label: "Personal Region",
        inputSchema: z.object({
          nickname: z.string().optional(),
        }),
        outputSchema: z.string(),
        perform: async (context, params) => {
          // TODO: Validate the saved configuration before you read it. It can be empty or
          // written under an earlier version: context.configuration.region.
          return \`\${context.configuration.region}-\${params.nickname}\`;
        },
      });
      "
    `);
    expect(files["src/index.ts"]).toMatchInlineSnapshot(`
      "
      import {
        customerActivatedConnection,
        integration,
        organizationActivatedConnection,
        userActivatedConnection,
        configuration,
      } from "@prismatic-io/spectral";
      import { configPages, userLevelConfigPages, fieldsServerFunction, mappedRegionsServerFunction, quickServerFunction, personalRegionServerFunction } from "./configPages";
      import flows from "./flows";
      import { z } from "zod";

      const scopedConfigVars = {
        orgConnection: organizationActivatedConnection({ stableKey: "org" }),
        customerConnection: customerActivatedConnection({ stableKey: "customer" }),
        userConnection: userActivatedConnection({ stableKey: "user" }),
      };

      const elementSchema = z.object({ key: z.string(), label: z.string().optional() });

      export const configPagesSchema = z.object({
        "Object Key": z.string(),
        region: z.enum(["us", "eu"]),
        tags: z.array(z.string()),
        headers: z.array(z.object({ key: z.string(), value: z.string() })),
        enabled: z.boolean(),
        limit: z.number(),
        start: z.iso.date(),
        at: z.iso.datetime(),
        body: z.json(),
        markup: z.string(),
        schedule: z.object({ value: z.string(), schedule_type: z.string(), time_zone: z.string() }),
        selection: z.array(z.object({ object: elementSchema, fields: z.array(elementSchema).optional(), defaultSelected: z.boolean().optional() })),
        fieldMap: z.object({ fields: z.array(z.object({ field: elementSchema, mappedObject: elementSchema.optional(), mappedField: elementSchema.optional(), defaultObject: elementSchema.optional(), defaultField: elementSchema.optional() })), options: z.array(z.object({ object: elementSchema, fields: z.array(elementSchema) })).optional() }),
        form: z.unknown(),
        banner: z.string(),
        fields: z.array(z.string()),
        "Mapped Regions": z.string(),
        quick: z.string(),
        "Field Map": z.unknown(),
      });
      export const configurationSchema = configPagesSchema;

      export const userLevelConfigPagesSchema = z.object({
        nickname: z.string(),
        "Personal Region": z.string(),
      });
      export const userConfigurationSchema = userLevelConfigPagesSchema;

      const integrationConfiguration = configuration({
        instance: {
          schema: configurationSchema,
          version: "INITIAL",
          configPagesSchema,
          connections: {
            "Acme Connection": configPages.Connections.elements["Acme Connection"],
            orgConnection: scopedConfigVars.orgConnection,
            customerConnection: scopedConfigVars.customerConnection,
          },
        },
        userLevel: {
          schema: userConfigurationSchema,
          version: "INITIAL",
          configPagesSchema: userLevelConfigPagesSchema,
          connections: {
            "Personal Slack": userLevelConfigPages.Personal.elements["Personal Slack"],
            "Personal Acme": userLevelConfigPages.Personal.elements["Personal Acme"],
            userConnection: scopedConfigVars.userConnection,
          },
        },
        init: {
          perform: async (context) => {
            // The config wizard's values arrive while context.configurationVersion is null,
            // and configurationSchema starts as their shape. Branch on the version when the
            // schema changes.
            return context.configuration;
          },
        },
        serverFunctions: {
          fields: fieldsServerFunction,
          mappedRegions: mappedRegionsServerFunction,
          quick: quickServerFunction,
          personalRegion: personalRegionServerFunction,
        },
        // These data sources have no inline perform to convert. Replace them with
        // serverFunctions:
        //   configPages.Settings.elements["Field Map"]
      });

      declare module "@prismatic-io/spectral" {
        interface Experimental {
          integrationConfiguration: true;
        }
        interface IntegrationDefinitionConfiguration {
          instance: {
            schema: typeof configurationSchema;
            connections: Record<"Acme Connection" | "orgConnection" | "customerConnection", unknown>;
          };
          userLevel: {
            schema: typeof userConfigurationSchema;
            connections: Record<"Personal Slack" | "Personal Acme" | "userConnection", unknown>;
          };
        }
        // No config page declares config vars any more, so a configVars read that was
        // not migrated fails to compile.
        interface IntegrationDefinitionConfigPages {
          [page: string]: { elements: Record<never, never> };
        }
        interface IntegrationDefinitionUserLevelConfigPages {
          [page: string]: { elements: Record<never, never> };
        }
      }

      export default integration({
        name: "Acme",
        description: "Sync Acme",
        flows,
        configuration: integrationConfiguration,
      });
      "
    `);
  });

  it("migrates flow reads and connection references, and drops the page augmentation", () => {
    const { files, changed } = run({
      "src/index.ts": INDEX,
      "src/configPages.ts": `${CONFIG_PAGES}
declare module "@prismatic-io/spectral" {
  interface IntegrationDefinitionConfigPages extends ConfigPages {}
  interface IntegrationDefinitionUserLevelConfigPages extends UserLevelConfigPages {}
}
type ConfigPages = typeof configPages;
type UserLevelConfigPages = typeof userLevelConfigPages;
`,
      "src/flows.ts": `
import { flow } from "@prismatic-io/spectral";

export default [
  flow({
    name: "Sync",
    stableKey: "sync",
    trigger: { component: "acme", key: "poll", values: { connection: { configVar: "Acme Connection" } } },
    onExecution: async (context) => {
      const client = context.configVars["Acme Connection"];
      const keys = [1, 2].map((n) => \`\${context.configVars["Object Key"]}-\${n}\`);
      return { data: { client, keys, org: context.configVars.orgConnection } };
    },
  }),
  flow({
    name: "Greet",
    stableKey: "greet",
    onInstanceDeploy: async ({ configVars, logger }) => { logger.info(configVars.nickname); },
    onExecution: async ({ configVars }) => ({ data: configVars.limit }),
  }),
  flow({
    name: "Audit",
    stableKey: "audit",
    onExecution: async (context) => ({ data: Object.keys(context.configVars) }),
  }),
];
`,
    });

    expect(changed).toEqual(["src/index.ts", "src/configPages.ts", "src/flows.ts"]);
    expect(files["src/configPages.ts"]).not.toContain("interface IntegrationDefinitionConfigPages");
    expect(files["src/flows.ts"]).toMatchInlineSnapshot(`
      "
      import { flow } from "@prismatic-io/spectral";

      export default [
        flow({
          name: "Sync",
          stableKey: "sync",
          trigger: { component: "acme", key: "poll", values: { connection: { configVar: "instance.Acme Connection" } } },
          onExecution: async (context) => {
            const client = context.connections?.instance?.["Acme Connection"];
            const keys = [1, 2].map((n) => \`\${context.configuration?.["Object Key"]}-\${n}\`);
            return { data: { client, keys, org: context.connections?.instance?.orgConnection } };
          },
        }),
        flow({
          name: "Greet",
          stableKey: "greet",
          onInstanceDeploy: async ({ logger, userConfiguration }) => { logger.info(userConfiguration?.nickname); },
          onExecution: async ({ configuration }) => ({ data: configuration?.limit }),
        }),
        flow({
          name: "Audit",
          stableKey: "audit",
          onExecution: async (context) => {
            // TODO: Fix the configVars reads the codemod could not convert. Read saved values
            // from context.configuration and context.userConfiguration, and connections from
            // context.connections.
            return { data: Object.keys(context.configVars) };
          },
        }),
      ];
      "
    `);
  });

  it("hoists inline pages so the configuration can reference them", () => {
    const { files } = run({
      "src/index.ts": `
import { configPage, configVar, connectionConfigVar, integration } from "@prismatic-io/spectral";

export default integration({
  name: "Inline",
  configPages: {
    Page: configPage({
      elements: {
        conn: connectionConfigVar({ stableKey: "c", dataType: "connection", inputs: {} }),
        name: configVar({ stableKey: "n", dataType: "string" }),
      },
    }),
  },
});
`,
    });

    expect(files["src/index.ts"]).toMatchInlineSnapshot(`
      "
      import { configPage, configVar, connectionConfigVar, integration, configuration } from "@prismatic-io/spectral";
      import { z } from "zod";

      const configPages = {
        Page: configPage({
          elements: {
            conn: connectionConfigVar({ stableKey: "c", dataType: "connection", inputs: {} }),
            name: configVar({ stableKey: "n", dataType: "string" }),
          },
        }),
      };

      export const configPagesSchema = z.object({
        name: z.string(),
      });
      export const configurationSchema = configPagesSchema;

      const integrationConfiguration = configuration({
        instance: {
          schema: configurationSchema,
          version: "INITIAL",
          configPagesSchema,
          connections: {
            conn: configPages.Page.elements.conn,
          },
        },
        init: {
          perform: async (context) => {
            // The config wizard's values arrive while context.configurationVersion is null,
            // and configurationSchema starts as their shape. Branch on the version when the
            // schema changes.
            return context.configuration;
          },
        },
      });

      declare module "@prismatic-io/spectral" {
        interface Experimental {
          integrationConfiguration: true;
        }
        interface IntegrationDefinitionConfiguration {
          instance: {
            schema: typeof configurationSchema;
            connections: Record<"conn", unknown>;
          };
        }
        // No config page declares config vars any more, so a configVars read that was
        // not migrated fails to compile.
        interface IntegrationDefinitionConfigPages {
          [page: string]: { elements: Record<never, never> };
        }
        interface IntegrationDefinitionUserLevelConfigPages {
          [page: string]: { elements: Record<never, never> };
        }
      }

      export default integration({
        name: "Inline",
        configuration: integrationConfiguration,
      });
      "
    `);
  });

  it("follows an aliased pages identifier and an element declared elsewhere", () => {
    const { files } = run({
      "src/vars.ts": `
import { configVar } from "@prismatic-io/spectral";
export const count = configVar({ stableKey: "count", dataType: "number" });
`,
      "src/index.ts": `
import { configPage, integration } from "@prismatic-io/spectral";
import { count } from "./vars";

const pages = { Page: configPage({ elements: { count } }) };

export const acme = integration({ name: "Aliased", configPages: pages });
`,
    });

    expect(files["src/index.ts"]).toContain("count: z.number(),");
    expect(files["src/index.ts"]).toContain("configuration: integrationConfiguration");
    expect(files["src/index.ts"]).not.toContain("configPages: pages");
  });

  it("gives a scope that only holds scoped connections an empty schema", () => {
    const { files } = run({
      "src/index.ts": `
import { integration, organizationActivatedConnection, userActivatedConnection } from "@prismatic-io/spectral";

export default integration({
  name: "Scoped",
  scopedConfigVars: {
    shared: organizationActivatedConnection({ stableKey: "shared" }),
    personal: userActivatedConnection({ stableKey: "personal" }),
  },
});
`,
    });

    expect(files["src/index.ts"]).toContain(`export const configurationSchema = z.object({});

export const userConfigurationSchema = z.object({});`);
    expect(files["src/index.ts"]).not.toContain("configPagesSchema");
    expect(files["src/index.ts"]).toContain(`  instance: {
    schema: configurationSchema,
    version: "INITIAL",
    connections: {
      shared: scopedConfigVars.shared,
    },
  },
  userLevel: {
    schema: userConfigurationSchema,
    version: "INITIAL",
    connections: {
      personal: scopedConfigVars.personal,
    },
  },`);
  });

  it("adds a TODO to a perform whose body is written on one line", () => {
    const { files } = run({
      "src/index.ts": `
import { configPage, dataSourceConfigVar, integration } from "@prismatic-io/spectral";

export default integration({
  name: "One Line",
  configPages: {
    Page: configPage({
      elements: {
        choices: dataSourceConfigVar({
          stableKey: "choices",
          dataSourceType: "picklist",
          perform: async (context) => { return { result: ["a"], supplementalData: { data: {}, contentType: "text/plain" } }; },
        }),
      },
    }),
  },
});
`,
    });

    expect(files["src/index.ts"]).toContain(`  perform: async (context) => {
    // TODO: A server function has no supplementalData. Return only the result.
    return ({ result: ["a"], supplementalData: { data: {}, contentType: "text/plain" } }).result;
  },`);
  });

  it("follows spread pages and elements", () => {
    const { files } = run({
      "src/connectionPages.ts": `
import { configPage, connectionConfigVar } from "@prismatic-io/spectral";

export const connectionPages = {
  Connections: configPage({
    elements: {
      conn: connectionConfigVar({ stableKey: "c", dataType: "connection", inputs: {} }),
    },
  }),
};
`,
      "src/index.ts": `
import { configPage, configVar, integration } from "@prismatic-io/spectral";
import { connectionPages } from "./connectionPages";

const baseElements = {
  region: configVar({ stableKey: "r", dataType: "string" }),
  limit: configVar({ stableKey: "old-limit", dataType: "string" }),
};

export default integration({
  name: "Spread",
  configPages: {
    ...connectionPages,
    Settings: configPage({
      elements: { ...baseElements, limit: configVar({ stableKey: "l", dataType: "number" }) },
    }),
  },
});
`,
    });

    expect(files["src/index.ts"]).toContain(`export const configPagesSchema = z.object({
  region: z.string(),
  limit: z.number(),
});`);
    expect(files["src/index.ts"]).toContain(`    connections: {
      conn: configPages.Connections.elements.conn,
    },`);
  });

  it("fails on a spread it cannot resolve rather than drop what it holds", () => {
    expect(() =>
      run({
        "src/index.ts": `
import { integration } from "@prismatic-io/spectral";
import { makePages } from "./pages";

export default integration({ name: "Opaque", configPages: { ...makePages() } });
`,
      }),
    ).toThrow("index.ts:5: could not resolve ...makePages() to an object literal.");
  });

  it("fails when the definition spreads in its config pages", () => {
    expect(() =>
      run({
        "src/index.ts": `
import { configPage, configVar, integration } from "@prismatic-io/spectral";

const shared = {
  configPages: { Page: configPage({ elements: { a: configVar({ stableKey: "a", dataType: "string" }) } }) },
};

export default integration({ name: "Shared", ...shared });
`,
      }),
    ).toThrow("move configPages, userLevelConfigPages, and scopedConfigVars out of ...shared");
  });

  it("proposes the saved configuration from init, flagging collections stored as strings", () => {
    const { files } = run({
      "src/index.ts": `
import { configPage, configVar, integration } from "@prismatic-io/spectral";

export default integration({
  name: "Init",
  configPages: {
    Page: configPage({
      elements: {
        ports: configVar({ stableKey: "ports", dataType: "number", collectionType: "valuelist" }),
        names: configVar({ stableKey: "names", dataType: "string", collectionType: "valuelist" }),
      },
    }),
  },
});
`,
    });

    expect(files["src/index.ts"]).toContain(`  init: {
    perform: async (context) => {
      // The config wizard's values arrive while context.configurationVersion is null,
      // and configurationSchema starts as their shape. Branch on the version when the
      // schema changes.
      // TODO: The config wizard stored each item of these collections as a string.
      // Parse them before you return the configuration: ports.
      return context.configuration;
    },
  },`);
  });

  it.each([
    ['import * as z from "zod";'],
    ['import { z } from "zod/v4";'],
  ])("uses zod as the file already imports it: %s", (zodImport) => {
    const { files } = run({
      "src/index.ts": `
import { configPage, configVar, integration } from "@prismatic-io/spectral";
${zodImport}

export const extra = z.string();

export default integration({
  name: "Zod",
  configPages: {
    Page: configPage({ elements: { name: configVar({ stableKey: "n", dataType: "string" }) } }),
  },
});
`,
    });

    const imports = files["src/index.ts"].split("\n").filter((line) => line.includes('from "zod'));
    expect(imports).toEqual([zodImport]);
  });

  it("adds a value import beside a type-only one", () => {
    const { files } = run({
      "src/index.ts": `
import type { ConfigPage } from "@prismatic-io/spectral";
import { configPage, configVar, integration } from "@prismatic-io/spectral";

const page: ConfigPage = configPage({
  elements: { name: configVar({ stableKey: "n", dataType: "string" }) },
});

export default integration({ name: "Types", configPages: { Page: page } });
`,
    });

    expect(files["src/index.ts"]).toContain(
      'import type { ConfigPage } from "@prismatic-io/spectral";',
    );
    expect(files["src/index.ts"]).toContain(
      'import { configPage, configVar, integration, configuration } from "@prismatic-io/spectral";',
    );
  });

  it("resolves a computed element key to the constant it names", () => {
    const { files } = run({
      "src/index.ts": `
import { configPage, configVar, connectionConfigVar, integration } from "@prismatic-io/spectral";

const REGION = "Region";
const KEYS = { connection: "Acme Connection" } as const;

export default integration({
  name: "Computed",
  configPages: {
    Page: configPage({
      elements: {
        [REGION]: configVar({ stableKey: "r", dataType: "string" }),
        [KEYS.connection]: connectionConfigVar({ stableKey: "c", dataType: "connection", inputs: {} }),
      },
    }),
  },
});
`,
    });

    expect(files["src/index.ts"]).toContain(`export const configPagesSchema = z.object({
  Region: z.string(),
});`);
    expect(files["src/index.ts"]).toContain(
      `"Acme Connection": configPages.Page.elements["Acme Connection"],`,
    );
  });

  it("fails on a computed element key that is not a constant", () => {
    expect(() =>
      run({
        "src/index.ts": `
import { configPage, configVar, integration } from "@prismatic-io/spectral";
import { keyFor } from "./keys";

export default integration({
  name: "Dynamic",
  configPages: {
    Page: configPage({ elements: { [keyFor("region")]: configVar({ stableKey: "r", dataType: "string" }) } }),
  },
});
`,
      }),
    ).toThrow('could not resolve the computed key [keyFor("region")] to a string.');
  });

  it("renames what it declares and imports when the author already uses the name", () => {
    const { files } = run({
      "src/settings.ts": "export const configuration = { zone: 1 };",
      "src/rpc.ts": "export const serverFunction = { schema: 2 };",
      "src/index.ts": `
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
    });
    const output = files["src/index.ts"];

    expect(output).toContain(
      'import { configPage, configVar, dataSourceConfigVar, integration, serverFunction as spectralServerFunction, configuration as spectralConfiguration } from "@prismatic-io/spectral";',
    );
    expect(output).toContain('import { z as zod } from "zod";');
    expect(output).toContain("const elementSchema2 = zod.object({ key: zod.string(),");
    expect(output).toContain(`export const configPagesSchema2 = zod.object({
  selection: zod.array(zod.object({ object: elementSchema2,`);
    expect(output).toContain("  configuration: zod.string(),");
    expect(output).toContain("export const configurationSchema2 = configPagesSchema2;");
    expect(output).toContain("export const choicesServerFunction = spectralServerFunction({");
    expect(output).toContain("  perform: async () => [String(elementSchema)],");
    expect(output).toContain("const integrationConfiguration2 = spectralConfiguration({");
    expect(output).toContain("  configuration: integrationConfiguration2");
  });

  it("ignores an integration() call in a test file", () => {
    const { changed } = run({
      "src/index.ts": `
import { configPage, configVar, integration } from "@prismatic-io/spectral";

export default integration({
  name: "Real",
  configPages: {
    Page: configPage({ elements: { name: configVar({ stableKey: "n", dataType: "string" }) } }),
  },
});
`,
      "src/index.test.ts": `
import { integration } from "@prismatic-io/spectral";

export const fixture = integration({ name: "Fixture", flows: [] });
`,
    });

    expect(changed).toEqual(["src/index.ts"]);
  });

  it("names each integration() call and the path to pass when there are several", () => {
    const source = (name: string) => `import { integration } from "@prismatic-io/spectral";
export default integration({ name: "${name}", flows: [] });
`;
    expect(() => run({ "src/a.ts": source("A"), "src/b.ts": source("B") })).toThrow(
      [
        "Found 2 integration() calls: /src/a.ts:2, /src/b.ts:2.",
        "Pass the file of the integration to migrate as the path, for example:",
        "  spectral-codemod v10.0.0/integration-configuration /src/a.ts",
      ].join("\n"),
    );
  });

  it("skips a page property that declares nothing", () => {
    const { files } = run({
      "src/index.ts": `
import { configPage, configVar, integration } from "@prismatic-io/spectral";

export default integration({
  name: "Nothing",
  configPages: {
    Page: configPage({ elements: { name: configVar({ stableKey: "n", dataType: "string" }) } }),
  },
  userLevelConfigPages: undefined,
  scopedConfigVars: null,
});
`,
    });

    expect(files["src/index.ts"]).not.toContain("userLevel");
    expect(files["src/index.ts"]).not.toContain("scopedConfigVars");
    expect(files["src/index.ts"]).toContain("  configuration: integrationConfiguration");
  });

  it("follows a constant dataType and flags one it cannot read", () => {
    const { files } = run({
      "src/index.ts": `
import { configPage, configVar, integration } from "@prismatic-io/spectral";
import { pickType } from "./types";

const TYPES = { number: "number" } as const;

export default integration({
  name: "Types",
  configPages: {
    Page: configPage({
      elements: {
        limit: configVar({ stableKey: "l", dataType: TYPES.number }),
        mystery: configVar({ stableKey: "m", dataType: pickType() }),
      },
    }),
  },
});
`,
    });

    expect(files["src/index.ts"]).toContain(`export const configPagesSchema = z.object({
  limit: z.number(),
  mystery: z.unknown(), // TODO: The codemod could not read this config var's dataType.
});`);
  });

  it.each([
    ['name: "x", configPages, flows'],
    ['name: "x",\n  // The config wizard.\n  configPages,\n  flows,'],
    ['name: "x",\n  configPages, // The config wizard.\n  flows,'],
  ])("writes one property per line and drops a removed property's comments: %j", (body) => {
    const { files } = run({
      "src/index.ts": `
import { configPage, configVar, integration } from "@prismatic-io/spectral";

const configPages = { Page: configPage({ elements: { a: configVar({ stableKey: "a", dataType: "string" }) } }) };
const flows = [];

export default integration({
  ${body}
});
`,
    });

    const output = files["src/index.ts"];
    expect(output.slice(output.indexOf("export default"))).toBe(`export default integration({
  name: "x",
  flows,
  configuration: integrationConfiguration,
});
`);
  });

  it("keeps the comments of the properties it keeps", () => {
    const { files } = run({
      "src/index.ts": `
import { configPage, configVar, integration } from "@prismatic-io/spectral";

const configPages = { Page: configPage({ elements: { a: configVar({ stableKey: "a", dataType: "string" }) } }) };

export default integration({ // The only integration.
  // Shown in the marketplace.
  name: "x", // Keep it short.
  configPages,
  flows: [], // Added later.
  // Nothing else yet.
});
`,
    });

    const output = files["src/index.ts"];
    expect(
      output.slice(output.indexOf("export default")),
    ).toBe(`export default integration({ // The only integration.
  // Shown in the marketplace.
  name: "x", // Keep it short.
  flows: [], // Added later.
  configuration: integrationConfiguration,
  // Nothing else yet.
});
`);
  });

  it("fails when the project has no integration() call", () => {
    expect(() => run({ "src/index.ts": "export const x = 1;" })).toThrow(
      "No integration() call imported from @prismatic-io/spectral was found.",
    );
  });

  it("fails when the integration declares no config pages", () => {
    expect(() =>
      run({
        "src/index.ts": `import { integration } from "@prismatic-io/spectral";
export default integration({ name: "Bare", flows: [] });`,
      }),
    ).toThrow("declares no configPages to migrate");
    expect(() =>
      run({
        "src/index.ts": `import { integration } from "@prismatic-io/spectral";
export default integration({ name: "Undefined", flows: [], configPages: undefined });`,
      }),
    ).toThrow("declares no configPages to migrate");
  });
});
