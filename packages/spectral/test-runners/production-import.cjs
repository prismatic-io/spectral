const assert = require("node:assert/strict");
const Module = require("node:module");
const original = Module._load;
Module._load = function (name, ...args) {
  assert(
    !/^(jest-mock|@jest\/|vitest|@vitest\/|bun:test)/.test(name),
    `Production imported ${name}`,
  );

  return original.call(this, name, ...args);
};
require("../dist/index.js");
require("../dist/testing.js");
const pkg = require("../package.json");

assert(!pkg.dependencies["jest-mock"]);
