import { dynamicObjectInput, input, structuredObjectInput } from "@prismatic-io/spectral";

// (A) DO -> SO -> SO   (user wants ALLOWED)
dynamicObjectInput({
  label: "A",
  configurations: {
    cfg: structuredObjectInput({
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

// (B) DO -> SO -> SO -> SO  (user wants BLOCKED)
dynamicObjectInput({
  label: "B",
  configurations: {
    cfg: structuredObjectInput({
      label: "B.cfg",
      inputs: {
        nested1: structuredObjectInput({
          label: "B.cfg.nested1",
          inputs: {
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

// (C) SO -> DO  (user wants BLOCKED)
structuredObjectInput({
  label: "C",
  inputs: {
    bad: dynamicObjectInput({
      label: "C.bad",
      configurations: {
        cfg: structuredObjectInput({
          label: "C.bad.cfg",
          inputs: { leaf: input({ type: "string", label: "L" }) },
        }),
      },
    }),
  },
});

// (D) Top-level SO -> SO  (user wants BLOCKED)
structuredObjectInput({
  label: "D",
  inputs: {
    nested: structuredObjectInput({
      label: "D.nested",
      inputs: { leaf: input({ type: "string", label: "L" }) },
    }),
  },
});
