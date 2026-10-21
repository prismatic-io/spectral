const runner = process.versions.bun ? require("bun:test") : require("@jest/globals");
require("./contract.cjs").contract(runner);
require("./edge-cases.cjs").contract(runner);
require("./packaged-contract.cjs").packagedContract(runner, () =>
  require("./node_modules/.cache/callable-fixture/component.cjs"),
);
