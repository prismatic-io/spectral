import rule from "./noDistImports";
import { ruleTester } from "./ruleTester";

ruleTester.run("no-dist-imports", rule, {
  valid: [
    `import { component } from "@prismatic-io/spectral";`,
    `import { createClient } from "@prismatic-io/spectral/http";`,
    `import { createHarness } from "@prismatic-io/spectral/testing";`,
    `import type { Component } from "@prismatic-io/spectral";`,
    `const { invoke } = require("@prismatic-io/spectral/testing");`,
    `const spectral = await import("@prismatic-io/spectral");`,
    `type Conn = import("@prismatic-io/spectral").Connection;`,
    // Other packages' dist/ are not this rule's concern.
    `import { x } from "@prismatic-io/other/dist/thing";`,
    `import { x } from "some-lib/dist/index.js";`,
    `import { x } from "./dist/local";`,
    // A different package that merely shares the prefix.
    `import { x } from "@prismatic-io/spectral-extras/dist/thing";`,
    `require(dynamicPath);`,
  ],
  invalid: [
    {
      code: `import { createClient } from "@prismatic-io/spectral/dist/clients/http";`,
      output: `import { createClient } from "@prismatic-io/spectral/http";`,
      errors: [{ messageId: "distImport" }],
    },
    {
      code: `import { handleErrors } from '@prismatic-io/spectral/dist/clients/http/index.js';`,
      output: `import { handleErrors } from '@prismatic-io/spectral/http';`,
      errors: [{ messageId: "distImport" }],
    },
    {
      code: `import { createHarness } from "@prismatic-io/spectral/dist/testing";`,
      output: `import { createHarness } from "@prismatic-io/spectral/testing";`,
      errors: [{ messageId: "distImport" }],
    },
    {
      code: `import type { Connection } from "@prismatic-io/spectral/dist/types";`,
      output: `import type { Connection } from "@prismatic-io/spectral";`,
      errors: [{ messageId: "distImport" }],
    },
    {
      code: `import { ConnectionError } from "@prismatic-io/spectral/dist/errors";`,
      output: `import { ConnectionError } from "@prismatic-io/spectral";`,
      errors: [{ messageId: "distImport" }],
    },
    {
      code: `import { component } from "@prismatic-io/spectral/dist";`,
      output: `import { component } from "@prismatic-io/spectral";`,
      errors: [{ messageId: "distImport" }],
    },
    {
      code: `import { component } from "@prismatic-io/spectral/dist/index.js";`,
      output: `import { component } from "@prismatic-io/spectral";`,
      errors: [{ messageId: "distImport" }],
    },
    {
      code: `export { invoke } from "@prismatic-io/spectral/dist/testing";`,
      output: `export { invoke } from "@prismatic-io/spectral/testing";`,
      errors: [{ messageId: "distImport" }],
    },
    {
      code: `export * from "@prismatic-io/spectral/dist/types";`,
      output: `export * from "@prismatic-io/spectral";`,
      errors: [{ messageId: "distImport" }],
    },
    {
      code: `const { invoke } = require("@prismatic-io/spectral/dist/testing");`,
      output: `const { invoke } = require("@prismatic-io/spectral/testing");`,
      errors: [{ messageId: "distImport" }],
    },
    {
      code: `const testing = await import("@prismatic-io/spectral/dist/testing");`,
      output: `const testing = await import("@prismatic-io/spectral/testing");`,
      errors: [{ messageId: "distImport" }],
    },
    {
      code: `type Conn = import("@prismatic-io/spectral/dist/types").Connection;`,
      output: `type Conn = import("@prismatic-io/spectral").Connection;`,
      errors: [{ messageId: "distImport" }],
    },
    // No public path exposes these modules, so there is nothing safe to rewrite to.
    {
      code: `import type { Action } from "@prismatic-io/spectral/dist/serverTypes";`,
      output: null,
      errors: [{ messageId: "distImportNoPublicPath" }],
    },
    {
      code: `import { requireContext } from "@prismatic-io/spectral/dist/serverTypes/asyncContext";`,
      output: null,
      errors: [{ messageId: "distImportNoPublicPath" }],
    },
    {
      code: `import type { Exact } from "@prismatic-io/spectral/dist/types/utils";`,
      output: null,
      errors: [{ messageId: "distImportNoPublicPath" }],
    },
    {
      code: `import util from "@prismatic-io/spectral/dist/util";`,
      output: null,
      errors: [{ messageId: "distImportNoPublicPath" }],
    },
  ],
});
