/**
 * Verifies what spectral serializes for the inline-action example-perform fields
 * on publish — the converted server component `prism component publish` sends.
 *
 * Scope is conversion output only: which fields land on the wire, with what values.
 * It does not verify runtime dispatch (SAFE vs. UNSAFE vs. NOT_ALLOWED choosing
 * which perform runs) — the safety flags are inert metadata spectral passes through
 * verbatim, and the runner decides at execution time.
 */
import { renderFile } from "ejs";
import path from "path";
import { describe, expect, it } from "vitest";
import { helpers } from "../generators/componentManifest/helpers";
import { action, component, input, PerformSafety, structuredObjectInput } from "../index";

const display = (label: string) => ({ label, description: label });

// Three input shapes exercised on every permutation.
const connectionInput = input({ label: "Connection", type: "connection", required: true });
const structuredInput = structuredObjectInput({
  label: "Name",
  inputs: {
    first: input({ type: "string", label: "First", required: true }),
    last: input({ type: "string", label: "Last", required: true }),
  },
});
const collectionInput = input({ label: "Tags", type: "string", collection: "valuelist" });

const sharedInputs = {
  connection: connectionInput,
  name: structuredInput,
  tags: collectionInput,
};

const noop = async () => ({ data: null });
const echo = async (_ctx: any, params: any) => ({ data: params });

// Action permutations.
const testComponent = component({
  key: "inline-action-testbed",
  public: false,
  display: { ...display("Inline Action Testbed"), iconPath: "icon.png" },
  actions: {
    // A — no inline-calling fields.
    plainAction: action({
      display: display("Plain Action"),
      inputs: sharedInputs,
      perform: noop,
    }),
    // B — example perform + its safety flag.
    examplePerformAction: action({
      display: display("Example Perform Action"),
      inputs: sharedInputs,
      perform: noop,
      examplePerform: echo,
      examplePerformSafety: PerformSafety.SAFE,
    }),
    // C — real perform marked runnable.
    runnablePerformAction: action({
      display: display("Runnable Perform Action"),
      inputs: sharedInputs,
      perform: noop,
      performSafety: PerformSafety.UNSAFE,
    }),
    // D — real perform marked not runnable.
    notAllowedPerformAction: action({
      display: display("Not Allowed Perform Action"),
      inputs: sharedInputs,
      perform: noop,
      performSafety: PerformSafety.NOT_ALLOWED,
    }),
  },
});

// Converted actions are keyed by action key.
const actionsByKey = testComponent.actions as Record<string, any>;

describe("inline action calling: publish-wire conversion output", () => {
  it("A — plain action: no inline-calling fields leak onto the wire", () => {
    const a = actionsByKey.plainAction;
    expect("examplePerform" in a).toBe(false);
    expect(a.examplePerformSafety).toBeUndefined();
    expect(a.performSafety).toBeUndefined();
  });

  it("B — example perform is wrapped (invokable) and its safety flag is carried", async () => {
    const a = actionsByKey.examplePerformAction;
    expect(typeof a.examplePerform).toBe("function");
    expect(a.examplePerformSafety).toBe("SAFE");
    // Only the field the author set is carried; no performSafety leaks in.
    expect(a.performSafety).toBeUndefined();
    // Wrapped fn is invokable and passes params through.
    const result: any = await a.examplePerform?.({} as any, { tags: ["x"] });
    expect(result.data.tags).toStrictEqual(["x"]);
  });

  it("C — real-perform UNSAFE flag carried; no separate example perform", () => {
    const a = actionsByKey.runnablePerformAction;
    expect(a.performSafety).toBe("UNSAFE");
    expect("examplePerform" in a).toBe(false);
    expect(a.examplePerformSafety).toBeUndefined();
  });

  it("D — real-perform NOT_ALLOWED flag carried verbatim; no example perform", () => {
    const a = actionsByKey.notAllowedPerformAction;
    expect(a.performSafety).toBe("NOT_ALLOWED");
    expect("examplePerform" in a).toBe(false);
    expect(a.examplePerformSafety).toBeUndefined();
  });

  it("the three input shapes survive conversion on every permutation", () => {
    for (const key of [
      "plainAction",
      "examplePerformAction",
      "runnablePerformAction",
      "notAllowedPerformAction",
    ]) {
      const inputs = actionsByKey[key].inputs;
      const byKey = Object.fromEntries(inputs.map((i: any) => [i.key, i]));
      expect(byKey.connection.type).toBe("connection");
      expect(byKey.name.type).toBe("structuredObject");
      expect(byKey.name.inputs).toHaveLength(2); // nested children survived
      expect(byKey.tags.collection).toBe("valuelist");
    }
  });
});

describe("inline action calling: component-manifest emit", () => {
  const templatePath = path.join(
    __dirname,
    "../generators/componentManifest/templates/actions/action.ts.ejs",
  );
  const baseAction = {
    typeInterface: "DoThing",
    import: "doThing",
    key: "doThing",
    label: "Do Thing",
    description: "Does a thing.",
    inputs: [],
    componentKey: "testbed",
  };
  const render = (extra: Record<string, unknown>) =>
    renderFile(templatePath, { action: { ...baseAction, ...extra }, helpers, imports: {} });

  it("emits both *Safety scalars when present", async () => {
    const out = await render({
      examplePerformSafety: "SAFE",
      performSafety: "UNSAFE",
    });
    expect(out).toContain('examplePerformSafety: "SAFE"');
    expect(out).toContain('performSafety: "UNSAFE"');
  });

  it("emits a NOT_ALLOWED performSafety scalar verbatim", async () => {
    const out = await render({ performSafety: "NOT_ALLOWED" });
    expect(out).toContain('performSafety: "NOT_ALLOWED"');
  });

  it("omits the *Safety scalars when absent (permutation A)", async () => {
    const out = await render({});
    expect(out).not.toContain("examplePerformSafety");
    expect(out).not.toContain("performSafety");
  });

  it("never emits an examplePerform stub (invoked via the server action, not the manifest)", async () => {
    const out = await render({
      examplePerformSafety: "SAFE",
      performSafety: "UNSAFE",
    });
    expect(out).not.toContain("examplePerform:");
  });
});
