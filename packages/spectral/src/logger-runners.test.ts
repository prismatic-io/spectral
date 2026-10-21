import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";

const exec = promisify(execFile);

it.each([
  { runner: "Jest", injectGlobals: true },
  { runner: "Jest", injectGlobals: false },
  { runner: "Bun", injectGlobals: false },
])("supports $runner mock usage with injectGlobals=$injectGlobals", async ({
  runner,
  injectGlobals,
}) => {
  const root = await mkdtemp(join(tmpdir(), "spectral-runners-"));
  const packageRoot = resolve(__dirname, "..");
  try {
    // Compile source in Jest so this test cannot accidentally exercise stale dist files.
    await writeFile(
      join(root, "transform.cjs"),
      `
const ts = require(${JSON.stringify(require.resolve("typescript"))});
exports.process = (source, filename) => ({ code: ts.transpileModule(source, {
  fileName: filename,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText });
`,
    );
    await writeFile(
      join(root, "logger.test.cjs"),
      `
${
  runner === "Bun"
    ? 'const { expect, test } = require("bun:test");'
    : injectGlobals
      ? "const jestApi = jest;"
      : 'const { jest: jestApi, expect, test } = require("@jest/globals");'
}
const { loggerMock } = require(${JSON.stringify(join(packageRoot, "src/testing.ts"))});
const logger = loggerMock();

test("existing assertions and mock methods work", async () => {
  ${runner === "Jest" ? "expect(jestApi.isMockFunction(logger.info)).toBe(true);" : ""}
  logger.info.mockName("info").mockReturnValueOnce("once").mockReturnValue("default");
  expect(logger.info("first")).toBe("once");
  expect(logger.info("second")).toBe("default");
  expect(logger.info).toHaveBeenCalledTimes(2);
  expect(logger.info).toHaveBeenNthCalledWith(1, "first");
  expect(logger.info).toHaveBeenLastCalledWith("second");
  expect(logger.info).toHaveReturnedWith("default");
  expect(() => expect(logger.info).toHaveBeenCalledWith("never")).toThrow();
  expect(logger.info.mock.lastCall).toEqual(["second"]);
  expect(logger.info.getMockName()).toBe("info");
  logger.info.mockClear();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.info()).toBe("default");
  logger.info.mockReset();
  expect(logger.info()).toBeUndefined();
  logger.info.mockResolvedValueOnce("async");
  await expect(logger.info()).resolves.toBe("async");
  logger.info.mockRestore();
  expect(logger.info).not.toHaveBeenCalled();
  expect(logger.info()).toBeUndefined();

  logger.info.mockReturnValue("default").mockReturnValueOnce("queued");
  await logger.info.withImplementation(() => "temporary", async () => {
    await Promise.resolve();
    expect(logger.info()).toBe("temporary");
  });
  expect(logger.info()).toBe("queued");
  expect(logger.info()).toBe("default");
  const error = new Error("failure");
  logger.info.mockImplementationOnce(() => { throw error; });
  expect(() => logger.info("failed")).toThrow(error);
  expect(logger.info).toHaveBeenLastCalledWith("failed");
  expect(logger.info.mock.results.at(-1)).toEqual({ type: "throw", value: error });
});
`,
    );
    const { stderr } = await exec(
      runner === "Bun" ? "bun" : process.execPath,
      runner === "Bun"
        ? ["test", join(root, "logger.test.cjs")]
        : [
            require.resolve("jest/bin/jest"),
            "--runInBand",
            "--config",
            JSON.stringify({
              rootDir: root,
              testMatch: ["<rootDir>/logger.test.cjs"],
              transform: { "^.+\\.ts$": join(root, "transform.cjs") },
              moduleDirectories: [join(packageRoot, "node_modules"), "node_modules"],
              injectGlobals,
              cache: false,
            }),
          ],
      { env: { ...process.env, VITEST: "", JEST_WORKER_ID: runner === "Bun" ? "1" : undefined } },
    );
    expect(stderr).toContain(runner === "Bun" ? "1 pass" : "1 passed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 30_000);
