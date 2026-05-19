/**
 * SCRATCH — companion to `_NestingProbe.test-d.ts`.
 *
 * The probe file demonstrates what the *current* `sj/typescript-so-doodling`
 * types allow. This file sketches a position-aware variant of the same types
 * and re-runs the same four cases against the sketch.
 *
 * Nothing here is imported from `@prismatic-io/spectral` — the alt types are
 * declared inline so the expert can read both files without leaving tsd.
 *
 * Goal matrix:
 *
 *   (A) DO → SO → SO            allow
 *   (B) DO → SO → SO → SO       block
 *   (C) SO → DO                 block
 *   (D) top-level SO → SO       block
 *
 * Core idea: depth is encoded by *position*, via two SO types.
 *
 *   StructuredObjectInputField           — top-level / inside another SO.
 *                                          `inputs` accepts leaves only.
 *   NestableStructuredObjectInputField   — only valid as a DO configuration
 *                                          value. `inputs` accepts leaves +
 *                                          leaf-only SO.
 *
 * `NestableStructuredObjectInputField` is intentionally NOT a member of
 * `InputFieldDefinition` — the only way to reach it is through
 * `DynamicObjectInputField.configurations`. That's what keeps depth bounded.
 */

// ---------------------------------------------------------------
// Minimal stand-ins for the types we're not changing.
// (Trimmed copies of the real definitions; just enough to type-check.)
// ---------------------------------------------------------------

interface BaseInputField {
  label: { key: string; value: string } | string;
  comments?: string;
  required?: boolean;
}

type StringInputField = BaseInputField & {
  type: "string";
  default?: string;
};

type BooleanInputField = BaseInputField & {
  type: "boolean";
  default?: string;
};

// Stand-in leaf union — the real one has ~15 members; only the count of
// alternatives matters for the depth question, not which ones.
type LeafInputFieldDefinition = StringInputField | BooleanInputField;

// ---------------------------------------------------------------
// The two SO types + the DO type.
// ---------------------------------------------------------------

/** Leaf-only SO. Used at top-level and as a child of another SO.
 *  This is the variant exposed on `InputFieldDefinition`. */
type StructuredObjectInputField = Omit<BaseInputField, "dataSource"> & {
  type: "structuredObject";
  inputs: Record<string, LeafInputFieldDefinition>;
};

/** Nestable SO. Reachable *only* as a value of
 *  `DynamicObjectInputField.configurations`. Permits one extra level: its
 *  `inputs` may contain leaf-only `StructuredObjectInputField`s. */
type NestableStructuredObjectInputField = Omit<BaseInputField, "dataSource"> & {
  type: "structuredObject";
  inputs: Record<string, LeafInputFieldDefinition | StructuredObjectInputField>;
};

/** DO. Each configuration is a *nestable* SO. */
type DynamicObjectInputField = Omit<BaseInputField, "dataSource"> & {
  type: "dynamicObject";
  configurations: Record<string, NestableStructuredObjectInputField>;
};

/** The top-level union. Note: `NestableStructuredObjectInputField` is NOT
 *  here. The only way to reach it is via `DynamicObjectInputField`. */
type InputFieldDefinition =
  | LeafInputFieldDefinition
  | StructuredObjectInputField
  | DynamicObjectInputField;

// ---------------------------------------------------------------
// Factories. Two options sketched; see notes at bottom.
//
// Option 1 (sketched here): three factories. The most explicit; the call
// site picks the right one for the position.
//
//   - input                            → leaves
//   - structuredObjectInput            → leaf-only SO (top-level / SO child)
//   - nestableStructuredObjectInput    → nestable SO (DO config value)
//   - dynamicObjectInput               → DO
// ---------------------------------------------------------------

const input = <T extends LeafInputFieldDefinition>(definition: T): T => definition;

const structuredObjectInput = <
  T extends Omit<StructuredObjectInputField, "type"> & { type?: never },
>(
  definition: T,
): T & { type: "structuredObject" } => ({ ...definition, type: "structuredObject" as const });

const nestableStructuredObjectInput = <
  T extends Omit<NestableStructuredObjectInputField, "type"> & { type?: never },
>(
  definition: T,
): T & { type: "structuredObject" } => ({ ...definition, type: "structuredObject" as const });

const dynamicObjectInput = <
  T extends Omit<DynamicObjectInputField, "type"> & { type?: never },
>(
  definition: T,
): T & { type: "dynamicObject" } => ({ ...definition, type: "dynamicObject" as const });

// ---------------------------------------------------------------
// The four probe cases, asserted against the proposed types.
// Each case is wrapped in a function body so the expression is type-checked
// in the same `InputFieldDefinition` position the real factories return.
// ---------------------------------------------------------------

// (A) DO → SO → SO   (should be ALLOWED)
const probeA: InputFieldDefinition = dynamicObjectInput({
  label: "A",
  configurations: {
    cfg: nestableStructuredObjectInput({
      label: "A.cfg",
      inputs: {
        nested: structuredObjectInput({
          label: "A.cfg.nested",
          inputs: {
            leaf: input({ type: "string", label: "L" }),
          },
        }),
      },
    }),
  },
});
void probeA;

// (B) DO → SO → SO → SO   (should be BLOCKED)
// The innermost call has to be `structuredObjectInput` (leaf-only); its
// `inputs` won't accept another SO, so the build-up fails.
const probeB: InputFieldDefinition = dynamicObjectInput({
  label: "B",
  configurations: {
    cfg: nestableStructuredObjectInput({
      label: "B.cfg",
      inputs: {
        nested1: structuredObjectInput({
          label: "B.cfg.nested1",
          inputs: {
            // @ts-expect-error: leaf-only SO does not accept SO children.
            nested2: structuredObjectInput({
              label: "B.cfg.nested1.nested2",
              inputs: {
                leaf: input({ type: "string", label: "L" }),
              },
            }),
          },
        }),
      },
    }),
  },
});
void probeB;

// (C) SO → DO   (should be BLOCKED)
const probeC: InputFieldDefinition = structuredObjectInput({
  label: "C",
  inputs: {
    // @ts-expect-error: leaf-only SO `inputs` excludes dynamicObject children.
    bad: dynamicObjectInput({
      label: "C.bad",
      configurations: {
        cfg: nestableStructuredObjectInput({
          label: "C.bad.cfg",
          inputs: { leaf: input({ type: "string", label: "L" }) },
        }),
      },
    }),
  },
});
void probeC;

// (D) Top-level SO → SO   (should be BLOCKED)
const probeD: InputFieldDefinition = structuredObjectInput({
  label: "D",
  inputs: {
    // @ts-expect-error: leaf-only SO `inputs` excludes SO children.
    nested: structuredObjectInput({
      label: "D.nested",
      inputs: { leaf: input({ type: "string", label: "L" }) },
    }),
  },
});
void probeD;

// ---------------------------------------------------------------
// Notes for the reviewer
// ---------------------------------------------------------------
//
// 1. Why two SO types instead of one with a "depth parameter":
//    A single `StructuredObjectInputField<Depth>` parameterized by a numeric
//    literal would also work, but every consumer (`InputValue`,
//    `ActionInputParameters`, the factory) has to pipe the parameter
//    through, and inference at the call site becomes a guessing game. Two
//    nominal types localize the rule to one place: the SO vs. nestable-SO
//    boundary, which is the same boundary as "child of a DO vs. not."
//
// 2. Why the nestable variant is NOT in `InputFieldDefinition`:
//    If it were, a caller could declare a top-level nestable SO (or use one
//    as a child of an SO via the union) and reintroduce the unbounded-depth
//    shape. Hiding it from the union is the structural guarantee that
//    "nestable" only appears as a DO configuration value.
//
// 3. Factory shape — three options the expert may want to weigh:
//
//    (a) Three factories (above): explicit, easy error messages, two new
//        names. Call sites have to know the position to pick.
//
//    (b) One factory whose generic widens both ways:
//          structuredObjectInput<T extends SO | NestableSO>(definition: T): T
//        Inference at the call site picks the variant. Fewer names, but
//        error messages on a misuse get muddier — the failure surface
//        becomes "doesn't match either variant" rather than "this is in the
//        wrong position."
//
//    (c) One factory plus a context-aware overload — overload signatures
//        for "inside DO" vs. "elsewhere." Cleanest at call sites but the
//        most TypeScript machinery and the hardest to evolve.
//
// 4. `InputValue<T>` / `ActionInputParameters<T>` need a branch for the
//    nestable variant (or share a structural helper between both SO
//    variants), since DO's per-configuration `values` shape is derived from
//    the nestable variant's `inputs`. Mechanical; not shown here.
//
// 5. Caveat: this sketch declares types inline; it does not exercise the
//    real `@prismatic-io/spectral` exports. The companion file
//    `_NestingProbe.test-d.ts` exercises the actual exports and shows the
//    current behavior. The pair of files is the artifact for the expert.
