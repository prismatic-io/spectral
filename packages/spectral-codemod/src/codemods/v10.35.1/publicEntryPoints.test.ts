import { describe, expect, it } from "vitest";
import { applyCodemod } from "../../testing";
import publicEntryPoints from "./publicEntryPoints";

const run = (source: string) => applyCodemod(publicEntryPoints, { "src/index.ts": source });

describe("v10.35.1/public-entry-points", () => {
  it("moves imports, exports, and type imports to the public entry points", async () => {
    const { files, changed } = await run(`import { component } from "@prismatic-io/spectral/dist";
import { inputs } from '@prismatic-io/spectral/dist/clients/http';
import { invoke } from "@prismatic-io/spectral/dist/testing.js";
export { util } from "@prismatic-io/spectral/dist/index";
type Http = import("@prismatic-io/spectral/dist/clients/http/index").HttpClient;
`);
    expect(changed).toEqual(["src/index.ts"]);
    expect(files["src/index.ts"]).toBe(`import { component } from "@prismatic-io/spectral";
import { inputs } from '@prismatic-io/spectral/http';
import { invoke } from "@prismatic-io/spectral/testing";
export { util } from "@prismatic-io/spectral";
type Http = import("@prismatic-io/spectral/http").HttpClient;
`);
  });

  it("moves require, dynamic import, and mock paths", async () => {
    const { files } = await run(`const spectral = require("@prismatic-io/spectral/dist");
const testing = await import("@prismatic-io/spectral/dist/testing");
vi.mock("@prismatic-io/spectral/dist/clients/http", () => ({}));
`);
    expect(files["src/index.ts"]).toBe(`const spectral = require("@prismatic-io/spectral");
const testing = await import("@prismatic-io/spectral/testing");
vi.mock("@prismatic-io/spectral/http", () => ({}));
`);
  });

  it("leaves dist paths without a public entry point, and strings that name no module", async () => {
    const source = `import { ActionContext } from "@prismatic-io/spectral/dist/types";
const label = "@prismatic-io/spectral/dist";
log("x", "@prismatic-io/spectral/dist/testing");
`;
    const { files, changed } = await run(source);
    expect(changed).toEqual([]);
    expect(files["src/index.ts"]).toBe(source);
  });
});
