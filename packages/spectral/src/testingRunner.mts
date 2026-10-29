/** Native ESM import is required: Vitest explicitly does not support require(). */
export async function loadRunner(): Promise<(implementation?: (...args: any[]) => any) => any> {
  const name = process.env.VITEST ? "vitest" : process.versions.bun ? "bun:test" : undefined;
  if (!name)
    throw new Error("CNI callable mocks require an active Vitest, Jest, or Bun test runner.");
  const runner = await import(name);

  return name === "vitest" ? runner.vi.fn : runner.mock;
}
