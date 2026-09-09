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
          "Object Key": z.string(),
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
          limit: z.number(),
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
      import { configPages, userLevelConfigPages, fieldsServerFunction, mappedRegionsServerFunction, quickServerFunction } from "./configPages";
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
            if (context.configurationVersion === null) {
              // context.configuration holds the values the config wizard collected.
            }
            // Return the proposed configuration for context.configurationVersion.
          },
        },
        serverFunctions: {
          fields: fieldsServerFunction,
          mappedRegions: mappedRegionsServerFunction,
          quick: quickServerFunction,
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
      }

      export default integration({
        name: "Acme",
        description: "Sync Acme",
        flows,
        configuration: integrationConfiguration
      });
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
            if (context.configurationVersion === null) {
              // context.configuration holds the values the config wizard collected.
            }
            // Return the proposed configuration for context.configurationVersion.
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
      }

      export default integration({
        name: "Inline",
        configuration: integrationConfiguration
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
  });
});
