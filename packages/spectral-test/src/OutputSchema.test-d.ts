import type { OutputSchema } from "@prismatic-io/spectral";
import { expectAssignable, expectNotAssignable } from "tsd";

// actionOutput carries a single `schema`.
expectAssignable<OutputSchema>({
  type: "actionOutput",
  schema: { type: "object", properties: { id: { type: "string" } } },
});

// branchingOutput carries an ordered array of named branch schemas.
expectAssignable<OutputSchema>({
  type: "branchingOutput",
  branches: [
    { name: "found", schema: { type: "object" } },
    { name: "notFound", schema: { type: "object" } },
  ],
});

// branchingOutput requires `branches`; the record form is invalid.
expectNotAssignable<OutputSchema>({
  type: "branchingOutput",
  branchSchemas: { found: { type: "object" } },
});

// The two variants don't cross: actionOutput cannot carry branches, and
// branchingOutput cannot carry a bare schema.
expectNotAssignable<OutputSchema>({
  type: "actionOutput",
  branches: [{ name: "found", schema: { type: "object" } }],
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
