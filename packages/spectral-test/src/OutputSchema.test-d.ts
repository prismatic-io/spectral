import type { OutputSchema } from "@prismatic-io/spectral";
import { expectAssignable, expectNotAssignable } from "tsd";

// actionOutput carries a single `schema`.
expectAssignable<OutputSchema>({
  type: "actionOutput",
  schema: { type: "object", properties: { id: { type: "string" } } },
});

// branchingOutput carries a per-branch map under `branchSchemas`.
expectAssignable<OutputSchema>({
  type: "branchingOutput",
  branchSchemas: {
    found: { type: "object" },
    notFound: { type: "object" },
  },
});

// branchingOutput requires `branchSchemas`; the legacy `branches` key is invalid.
expectNotAssignable<OutputSchema>({
  type: "branchingOutput",
  branches: { found: { type: "object" } },
});

// The two variants don't cross: actionOutput cannot carry branchSchemas, and
// branchingOutput cannot carry a bare schema.
expectNotAssignable<OutputSchema>({
  type: "actionOutput",
  branchSchemas: { found: { type: "object" } },
});
expectNotAssignable<OutputSchema>({
  type: "branchingOutput",
  schema: { type: "object" },
});

// Unknown discriminants are rejected.
expectNotAssignable<OutputSchema>({
  type: "somethingElse",
  schema: { type: "object" },
});
