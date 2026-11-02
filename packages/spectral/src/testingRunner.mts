/**
 * Native ESM import is required: Vitest explicitly does not support require(). The
 * webpackIgnore comment keeps webpack from warning that the import's name is an
 * expression in every bundle that includes Spectral; Node or Bun resolves it at runtime.
 */
export async function loadRunner(): Promise<(implementation?: (...args: any[]) => any) => any> {
  const name = process.env.VITEST ? "vitest" : process.versions.bun ? "bun:test" : undefined;
  if (!name)
    throw new Error("CNI callable mocks require an active Vitest, Jest, or Bun test runner.");
  const runner = await import(/* webpackIgnore: true */ name);

  return name === "vitest" ? runner.vi.fn : runner.mock;
}
