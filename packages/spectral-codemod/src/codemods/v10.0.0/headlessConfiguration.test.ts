import { describe, expect, it } from "vitest";
import { applyCodemod } from "../../testing";
import headlessConfiguration from "./headlessConfiguration";

const run = (files: Record<string, string>) => applyCodemod(headlessConfiguration, files);

const CONFIG_PAGES = `
import {
  configPage,
  configVar,
  connectionConfigVar,
  dataSourceConfigVar,
  userLevelConfigPage,
} from "@prismatic-io/spectral";

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
        perform: async () => ({ result: ["a"] }),
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
    },
  }),
};
`;

const INDEX = `
import { integration, organizationActivatedConnection } from "@prismatic-io/spectral";
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
  },
});
`;

describe("v10.0.0/headless-configuration", () => {
  it("rewrites the integration file and leaves the page declarations alone", () => {
    const { files, changed } = run({
      "src/index.ts": INDEX,
      "src/configPages.ts": CONFIG_PAGES,
      "src/flows.ts": "export default [];",
    });

    expect(changed).toEqual(["src/index.ts"]);
    expect(files["src/configPages.ts"]).toBe(CONFIG_PAGES);
    expect(files["src/index.ts"]).toMatchInlineSnapshot(`
      "
      import { integration, organizationActivatedConnection, configuration } from "@prismatic-io/spectral";
      import { configPages, userLevelConfigPages } from "./configPages";
      import flows from "./flows";
      import { z } from "zod";

      const scopedConfigVars = {
        orgConnection: organizationActivatedConnection({ stableKey: "org" }),
      };

      const elementSchema = z.object({ key: z.string(), label: z.string().optional() });
      export const configurationSchema = z.object({
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
        nickname: z.string(),
      });

      export default integration({
        name: "Acme",
        description: "Sync Acme",
        flows,
        configuration: configuration({
          schema: configurationSchema,
          eTag: "INITIAL",
          init: async () => {
            // code to handle migrating between different configuration versions
          },
          connections: {
            "Acme Connection": configPages.Connections.elements["Acme Connection"],
            orgConnection: scopedConfigVars.orgConnection,
          },
          dataSources: {
            fields: configPages.Settings.elements.fields,
            "Field Map": configPages.Settings.elements["Field Map"],
          },
        })
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

      export const configurationSchema = z.object({
        name: z.string(),
      });

      export default integration({
        name: "Inline",
        configuration: configuration({
          schema: configurationSchema,
          eTag: "INITIAL",
          init: async () => {
            // code to handle migrating between different configuration versions
          },
          connections: {
            conn: configPages.Page.elements.conn,
          },
        })
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
    expect(files["src/index.ts"]).toContain("configuration: configuration({");
    expect(files["src/index.ts"]).not.toContain("configPages: pages");
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
