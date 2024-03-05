module.exports = {
  parser: "@typescript-eslint/parser",
  env: {
    node: true,
  },
  parserOptions: {
    project: true,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "import", "prettier"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended-type-checked",
    "plugin:@typescript-eslint/stylistic-type-checked",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "plugin:prettier/recommended",
  ],
  ignorePatterns: [
    "dist",
    "node_modules",
    "webpack.config.js",
    "jest.config.js",
  ],
  rules: {
    camelcase: "off",
    "@typescript-eslint/camelcase": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-base-to-string": "off",
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/prefer-nullish-coalescing": "off",
    "@typescript-eslint/restrict-template-expressions": "off",
  },
  settings: {
    "import/parsers": {
      "@typescript-eslint/parser": [".ts"],
    },
    "import/resolver": {
      typescript: {
        project: "./tsconfig.json",
        alwaysTryTypes: true,
      },
    },
  },
};
