import type { JsonSchema } from "./jsonforms/JsonSchema";

/**
 * Describes the shape of a non-branching action's output `data` payload as a
 * JSON Schema. Used by the Prismatic UI to let integration authors reference a
 * step's output before a real execution has produced data. Descriptive only —
 * it is not enforced at runtime.
 */
export interface ActionOutputSchema {
  type: "actionOutput";
  schema: JsonSchema;
}

/**
 * Describes the output `data` payload of a branching action, one JSON Schema
 * per branch keyed by branch name. A branching action returns `{ branch, data }`,
 * and the `data` shape may differ per branch, so each branch carries its own
 * schema. Descriptive only — not enforced at runtime.
 *
 * @remarks
 * Valid only for actions with `staticBranchNames` — a closed, build-time list.
 * NOT supported with `dynamicBranchInput`, where branch names are computed at
 * runtime and cannot be enumerated; publishing such a component is rejected
 * server-side. (Unrelated to `dynamicObject` *inputs*, whose `configurations`
 * are fully declared at build time — that's an input feature and does not
 * affect `outputSchema`.)
 */
export interface BranchingOutputSchema {
  type: "branchingOutput";
  branchSchemas: Record<string, JsonSchema>;
}

/**
 * The output-schema contract declared on an action via `outputSchema`. A
 * discriminated union on `type`: `actionOutput` for a single payload shape,
 * `branchingOutput` for a per-branch map of payload shapes.
 */
export type OutputSchema = ActionOutputSchema | BranchingOutputSchema;
