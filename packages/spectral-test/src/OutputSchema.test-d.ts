import { type OutputSchema, outputSchema } from "@prismatic-io/spectral";
import { expectAssignable, expectNotAssignable, expectType } from "tsd";

// The `outputSchema` helper preserves the literal discriminant without a
// trailing `as const` — even when the schema is hoisted into its own variable,
// where TS would otherwise widen `type` to `string`.
const hoistedAction = outputSchema({
  type: "actionOutput",
  schema: { type: "object", properties: { id: { type: "string" } } },
});
expectAssignable<OutputSchema>(hoistedAction);
expectType<"actionOutput">(hoistedAction.type);

const hoistedBranching = outputSchema({
  type: "branchingOutput",
  branchSchemas: { found: { type: "object" }, notFound: { type: "object" } },
});
expectAssignable<OutputSchema>(hoistedBranching);
expectType<"branchingOutput">(hoistedBranching.type);

// The helper still rejects invalid shapes (no escape hatch from the union).
// @ts-expect-error — unknown discriminant is not an OutputSchema.
outputSchema({ type: "somethingElse", schema: { type: "object" } });

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
