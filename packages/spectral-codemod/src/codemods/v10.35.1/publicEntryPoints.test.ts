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

  it("leaves call arguments that share a name with an Object.prototype member", async () => {
    const source = `parse("toString");
parse("constructor");
parse("__proto__");
`;
    const { files, changed } = await run(source);
    expect(changed).toEqual([]);
    expect(files["src/index.ts"]).toBe(source);
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

  it("warns once per file for each dist path it leaves", async () => {
    const { files, warnings } = await applyCodemod(publicEntryPoints, {
      "src/index.ts": `import { component } from "@prismatic-io/spectral/dist";
import { convertInput } from "@prismatic-io/spectral/dist/serverTypes/convertComponent";
import type { Input } from "@prismatic-io/spectral/dist/serverTypes/convertComponent.js";
const label = "@prismatic-io/spectral/dist/types";
`,
      "src/inputs.test.ts": `const { convertInput } = require("@prismatic-io/spectral/dist/serverTypes/convertComponent");
`,
      "src/other.ts": `import { other } from "@prismatic-io/spectral-other/dist/types";
`,
    });
    expect(files["src/index.ts"]).toContain('from "@prismatic-io/spectral";');
    expect(warnings).toEqual([
      {
        message:
          "@prismatic-io/spectral/dist/serverTypes/convertComponent has no public entry point, so it stays as it is. Spectral's dist/ paths are deprecated; move off it by hand.",
        file: "src/index.ts",
      },
      {
        message: expect.stringMatching(
          /^@prismatic-io\/spectral\/dist\/serverTypes\/convertComponent\.js has/,
        ),
        file: "src/index.ts",
      },
      {
        message: expect.stringMatching(
          /^@prismatic-io\/spectral\/dist\/serverTypes\/convertComponent has/,
        ),
        file: "src/inputs.test.ts",
      },
    ]);
  });

  it("does not warn when every dist path moves", async () => {
    const { warnings } = await run(
      `import { invoke } from "@prismatic-io/spectral/dist/testing";\n`,
    );
    expect(warnings).toEqual([]);
  });
});
