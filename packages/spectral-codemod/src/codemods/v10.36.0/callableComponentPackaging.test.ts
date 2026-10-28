import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { main } from "../../cli";
import { runCodemod } from "../../runner";
import codemod from "./callableComponentPackaging";

const [config, packagedConfig] = await Promise.all([
  readFile(new URL("./fixtures/tsdown-component.txt", import.meta.url), "utf8"),
  readFile(new URL("./fixtures/tsdown-callable.txt", import.meta.url), "utf8"),
]);
const component = `import { component, action } from "@prismatic-io/spectral";
export default component({
  key: "acme", display: { label: "Acme", description: "Test component", iconPath: "icon.png" },
  actions: { hello: action({ display: { label: "Hello", description: "Hello" }, inputs: {},
    perform: async () => ({ data: "hello" }) }) },
});
`;
const fixture = () => ({
  "tsdown.config.mts": config,
  "src/index.ts": component,
  "tsconfig.json": JSON.stringify({
    compilerOptions: {
      target: "es2022",
      module: "esnext",
      moduleResolution: "bundler",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
    },
    include: ["src"],
  }),
  "package.json": `${JSON.stringify(
    {
      name: "@acme/component",
      version: "2.3.4",
      private: true,
      main: "index.js",
      scripts: { build: "tsdown", test: "vitest run", prepare: "echo prepare" },
      dependencies: { "@prismatic-io/spectral": "^10.36.0", axios: "^1.0.0" },
      devDependencies: { tsdown: "0.22.3", typescript: "6.0.3" },
      files: ["LICENSE", "assets"],
    },
    null,
    2,
  )}\n`,
});
const apply = async (files: Record<string, string>) => ({
  ...files,
  ...Object.fromEntries(
    (await codemod.plan({ read: async (path) => files[path] })).map(({ path, content }) => [
      path,
      content,
    ]),
  ),
});
const changePackage = (files: Record<string, string>, change: (pkg: any) => void) => {
  const pkg = JSON.parse(files["package.json"]);
  change(pkg);
  files["package.json"] = JSON.stringify(pkg);
};
const dirs: string[] = [];
const onDisk = async (files: Record<string, string>) => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "callable-packaging-")));
  dirs.push(dir);
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(dir, path, ".."), { recursive: true });
    await writeFile(join(dir, path), content);
  }
  return dir;
};
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});

describe("callable-component-packaging", async () => {
  it("adds a callable build and package metadata while retaining project customizations", async () => {
    const before = fixture();
    const after = await apply(before);
    const pkg = JSON.parse(after["package.json"]);
    expect(pkg).toMatchObject({
      name: "@acme/component",
      version: "2.3.4",
      private: true,
      main: "./npm-dist/index.cjs",
      types: "./npm-dist/index.d.cts",
      exports: { ".": { types: "./npm-dist/index.d.cts", default: "./npm-dist/index.cjs" } },
      prismatic: { component: "./dist/index.js" },
      peerDependencies: { "@prismatic-io/spectral": "^10.36.0" },
      devDependencies: { "@prismatic-io/spectral": "^10.36.0", tsdown: "0.22.3" },
      dependencies: { axios: "^1.0.0" },
      scripts: { prepare: "echo prepare && npm run build", test: "vitest run", build: "tsdown" },
      files: ["LICENSE", "assets", "npm-dist", "dist"],
    });
    expect(pkg.dependencies).not.toHaveProperty("@prismatic-io/spectral");
    expect(after["src/index.ts"]).toBe(before["src/index.ts"]);
    expect(after["tsdown.config.mts"]).toContain("export default callableComponent(component);");
    expect(after["tsdown.config.mts"]).toContain('outDir: "dist"');
    expect(await apply(after)).toEqual(after);
  });

  it("accepts the existing Prism callable build without rewriting it", async () => {
    const files = { ...fixture(), "tsdown.config.mts": packagedConfig };
    expect((await apply(files))["tsdown.config.mts"]).toBe(packagedConfig);
  });

  it("accepts an object config, import aliases, and a component exported through a variable", async () => {
    const files = fixture();
    files["tsdown.config.mts"] = config
      .replace("defineConfig([", "defineConfig(")
      .replace(/,\s*\]\);/, ");")
      .replace("{ defineConfig }", "{ defineConfig as configure }")
      .replace("default defineConfig", "default configure");
    files["src/index.ts"] =
      component
        .replace("component, action", "component as connector, action")
        .replace("export default component(", "const instance = connector(") +
      "export default instance;\n";
    const after = await apply(files);
    expect(after["tsdown.config.mts"]).toMatch(/configure\(\s*\[/);
    expect(await apply(after)).toEqual(after);
  });

  it("preserves subpath exports, required peers, registry settings, and a build prepare script", async () => {
    const files = fixture();
    changePackage(files, (pkg) => {
      delete pkg.private;
      delete pkg.files;
      pkg.exports = { "./helpers": "./helpers.js" };
      pkg.peerDependencies = { "@prismatic-io/spectral": ">=10.36.0 <11", other: "*" };
      pkg.publishConfig = { registry: "https://registry.example.com" };
      pkg.scripts.prepare = "npm run build";
    });
    const pkg = JSON.parse((await apply(files))["package.json"]);
    expect(pkg).not.toHaveProperty("private");
    expect(pkg.exports["./helpers"]).toBe("./helpers.js");
    expect(pkg.peerDependencies).toEqual({ "@prismatic-io/spectral": ">=10.36.0 <11", other: "*" });
    expect(pkg.publishConfig.registry).toBe("https://registry.example.com");
    expect(pkg.scripts.prepare).toBe("npm run build");
    expect(pkg).not.toHaveProperty("files");
  });

  it.each([
    "npm run typecheck && tsdown",
    "npm run format && npm run lint && tsdown",
  ])("accepts a build script of %s and keeps it", async (build) => {
    const files = fixture();
    changePackage(files, (pkg) => {
      pkg.scripts.build = build;
    });
    expect(JSON.parse((await apply(files))["package.json"]).scripts.build).toBe(build);
  });

  it("accepts the flattened assets/* copy of earlier Prism scaffolds without rewriting it", async () => {
    const legacy = config.replace(
      'copy: [{ from: "assets/**/*", to: "dist", flatten: false }]',
      'copy: [{ from: "assets/*", to: "dist" }]',
    );
    const after = await apply({ ...fixture(), "tsdown.config.mts": legacy });
    expect(after["tsdown.config.mts"]).toContain('copy: [{ from: "assets/*", to: "dist" }]');
    expect(after["tsdown.config.mts"]).toContain(
      'copy: [{ from: "assets/**/*", to: "npm-dist", flatten: false }]',
    );
  });

  it.each([
    ["dist/\nnode_modules\n", "dist/\nnpm-dist/\nnode_modules\n"],
    ["/dist\n", "/dist\n/npm-dist\n"],
    ["node_modules\n", "node_modules\n"],
    ["dist\nnpm-dist/\n", "dist\nnpm-dist/\n"],
  ])("ignores npm-dist beside dist in .gitignore %j", async (gitignore, expected) => {
    const after = await apply({ ...fixture(), ".gitignore": gitignore });
    expect(after[".gitignore"]).toBe(expected);
    expect(await apply(after)).toEqual(after);
  });

  it.each([
    [
      "biome.json",
      '{\n  "files": { "includes": ["**", "!**/dist", "!**/node_modules"] }\n}\n',
      '{\n  "files": { "includes": ["**", "!**/dist", "!**/npm-dist", "!**/node_modules"] }\n}\n',
    ],
    [
      "biome.jsonc",
      '{\n  // Generated output\n  "files": {\n    "includes": [\n      "**",\n      "!**/dist/**"\n    ]\n  }\n}\n',
      '{\n  // Generated output\n  "files": {\n    "includes": [\n      "**",\n      "!**/dist/**",\n      "!**/npm-dist/**"\n    ]\n  }\n}\n',
    ],
    [
      "biome.json",
      '{ "files": { "ignore": ["dist", "coverage"] } }\n',
      '{ "files": { "ignore": ["dist", "npm-dist", "coverage"] } }\n',
    ],
    [
      "biome.json",
      '{ "files": { "includes": ["src/**"] } }\n',
      '{ "files": { "includes": ["src/**"] } }\n',
    ],
  ])("excludes npm-dist beside dist in %s", async (path, biome, expected) => {
    const after = await apply({ ...fixture(), [path]: biome });
    expect(after[path]).toBe(expected);
    expect(await apply(after)).toEqual(after);
  });

  it.each([
    "^10.35.0",
    "*",
    "latest",
    "workspace:*",
    "10.36.0-preview.1",
    "^10.36.0 || ^9.0.0",
  ])("rejects unsupported Spectral range %s", async (range) => {
    const files = fixture();
    changePackage(files, (pkg) => {
      pkg.dependencies["@prismatic-io/spectral"] = range;
    });
    await expect(apply(files)).rejects.toThrow("release range entirely at or above 10.36.0");
  });

  it.each([
    [
      "missing tsdown",
      (pkg: any) => {
        delete pkg.devDependencies.tsdown;
      },
      "tsdown must declare",
    ],
    [
      "old tsdown",
      (pkg: any) => {
        pkg.devDependencies.tsdown = "^0.20.0";
      },
      "tsdown must declare",
    ],
    [
      "missing TypeScript",
      (pkg: any) => {
        delete pkg.devDependencies.typescript;
      },
      "TypeScript is required",
    ],
    [
      "custom build",
      (pkg: any) => {
        pkg.scripts.build = "webpack";
      },
      "build script",
    ],
    [
      "build that runs after tsdown",
      (pkg: any) => {
        pkg.scripts.build = "tsdown && node scripts/postbuild.js";
      },
      "build script",
    ],
    [
      "tsdown with arguments",
      (pkg: any) => {
        pkg.scripts.build = "tsdown --watch";
      },
      "build script",
    ],
    [
      "module package",
      (pkg: any) => {
        pkg.type = "module";
      },
      "CommonJS package",
    ],
    [
      "custom main",
      (pkg: any) => {
        pkg.main = "custom.js";
      },
      "custom entry",
    ],
    [
      "custom exports",
      (pkg: any) => {
        pkg.exports = { ".": "./custom.js" };
      },
      "different root export",
    ],
    [
      "optional peer",
      (pkg: any) => {
        pkg.peerDependenciesMeta = { "@prismatic-io/spectral": { optional: true } };
      },
      "required peer",
    ],
  ])("rejects %s", async (_, change, error) => {
    const files = fixture();
    changePackage(files, change);
    await expect(apply(files)).rejects.toThrow(error);
  });

  it.each([
    [
      "custom loader",
      config.replace('".md": "text"', '".html": "text"'),
      "Unsupported platform loader",
    ],
    ["custom copy", config.replace("assets/**/*", "templates/**/*"), "Unsupported platform copy"],
    ["dynamic config", "export default () => [];", "defineConfig"],
    ["different entry", config.replace("src/index.ts", "src/other.ts"), "platform build must"],
    [
      "different output",
      config.replace('outDir: "dist"', 'outDir: "build"'),
      "platform build must",
    ],
    ["spread config", config.replace('format: "cjs",', 'format: "cjs", ...custom,'), "spread"],
    [
      "different npm build",
      packagedConfig
        .replace('target: "node22"', 'target: "node20"')
        .replace('outDir: "npm-dist"', 'outDir: "other"'),
      "second tsdown build",
    ],
  ])("rejects %s", async (_, content, error) => {
    await expect(apply({ ...fixture(), "tsdown.config.mts": content })).rejects.toThrow(error);
  });

  it("leaves files untouched when build validation fails after manifest planning", async () => {
    const files = {
      ...fixture(),
      "tsdown.config.mts": config.replace("assets/**/*", "templates/**/*"),
    };
    const dir = await onDisk(files);
    await expect(runCodemod(codemod, { path: dir })).rejects.toThrow("Unsupported platform copy");
    for (const [path, content] of Object.entries(files))
      expect(await readFile(join(dir, path), "utf8")).toBe(content);
  });

  it.each([undefined, ""])("preserves ignore precedence with npmignore %s", async (npmignore) => {
    const files: Record<string, string> = {
      ...fixture(),
      ".gitignore": "private.txt\ndist/\nnpm-dist/\n",
    };
    changePackage(files, (pkg) => {
      delete pkg.files;
    });
    if (npmignore !== undefined) files[".npmignore"] = npmignore;
    const after = await apply(files);
    expect(after[".npmignore"].includes("private.txt")).toBe(npmignore === undefined);
    expect(after[".npmignore"]).toContain("!npm-dist/**");
    expect(await apply(after)).toEqual(after);
  });

  it("rejects an integration entry point", async () => {
    await expect(
      apply({ ...fixture(), "src/index.ts": component.replaceAll("component(", "integration(") }),
    ).rejects.toThrow("default-export a component()");
  });

  it("previews the same files it applies and reports no changes on a second run", async () => {
    const files = fixture();
    const dir = await onDisk(files);
    const preview = await runCodemod(codemod, { path: dir, dryRun: true });
    expect(preview.changed).toEqual([join(dir, "tsdown.config.mts"), join(dir, "package.json")]);
    for (const [path, content] of Object.entries(files))
      expect(await readFile(join(dir, path), "utf8")).toBe(content);
    expect((await runCodemod(codemod, { path: dir })).changed).toEqual(preview.changed);
    expect((await runCodemod(codemod, { path: dir })).changed).toEqual([]);
  });

  it("is available through the CLI", async () => {
    const dir = await onDisk(fixture());
    const output: string[] = [];
    expect(
      await main(
        ["callable-component-packaging", "--target-spectral", "10.36.1", dir, "--dry-run"],
        { log: (line) => output.push(line), error: (line) => output.push(line) },
      ),
    ).toBe(0);
    expect(output.join("\n")).toContain("would change 2");
  });
});
