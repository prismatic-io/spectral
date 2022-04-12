module.exports = {
  preset: "ts-jest",
  globals: {
    "ts-jest": {
      tsconfig: "./tsconfig.test.json",
    },
  },
  testEnvironment: "node",
  testPathIgnorePatterns: ["dist"],
};
