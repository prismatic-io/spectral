import path from "path";
import { defaults } from "jest-config";
import type { Config } from "@jest/types";

const config: Config.InitialOptions = {
  preset: "ts-jest",
  testEnvironment: "node",
  testPathIgnorePatterns: [
    ...defaults.testPathIgnorePatterns,
    "templates",
    ".*\.test\.js"
  ],
};

export default config;
