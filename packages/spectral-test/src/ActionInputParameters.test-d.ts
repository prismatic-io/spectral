import {
  type ActionInputParameters,
  type ConditionalExpression,
  type Connection,
  dynamicObjectInput,
  input,
  structuredObjectInput,
  util,
} from "@prismatic-io/spectral";
import { expectType } from "tsd";

const inputs = {
  plain: input({
    label: "Plain",
    type: "string",
  }),
  cleaned: input({
    label: "Cleaned",
    type: "string",
    clean: (value) => util.types.toNumber(value),
  }),
  connection: input({
    label: "Connection",
    type: "connection",
  }),
  conditional: input({
    label: "Conditional",
    type: "conditional",
    collection: "valuelist",
  }),
};

const result: ActionInputParameters<typeof inputs> = {
  plain: "200",
  cleaned: 200,
  connection: { key: "", configVarKey: "", fields: {} },
  conditional: [],
};
expectType<{
  plain: unknown;
  cleaned: number;
  connection: Connection;
  conditional: ConditionalExpression[];
}>(result);
expectType<Connection>(result.connection);
expectType<ConditionalExpression[]>(result.conditional);

const structuredInputs = {
  name: structuredObjectInput({
    label: "Name",
    inputs: {
      first: input({ type: "string", label: "First Name", required: true }),
      last: input({ type: "string", label: "Last Name", required: true }),
    },
  }),
};

const structuredResult: ActionInputParameters<typeof structuredInputs> = {
  name: { first: "Ada", last: "Lovelace" },
};
expectType<unknown>(structuredResult.name.first);
expectType<unknown>(structuredResult.name.last);
// @ts-expect-error: structuredObject params only expose declared children.
structuredResult.name.nonexistent;

const dynamicInputs = {
  data: dynamicObjectInput({
    label: "Record Data",
    required: true,
    configurations: {
      contact: {
        label: "Contact",
        inputs: {
          name: structuredObjectInput({
            label: "Name",
            inputs: {
              first: input({ type: "string", label: "First", required: true }),
              last: input({ type: "string", label: "Last", required: true }),
            },
          }),
          email: input({ type: "string", label: "Email", required: true }),
        },
      },
      account: {
        label: "Account",
        inputs: {
          companyName: input({ type: "string", label: "Company Name", required: true }),
        },
      },
    },
  }),
};

const dynamicResult: ActionInputParameters<typeof dynamicInputs> = {
  data: {
    configuration: "contact",
    values: { name: { first: "Ada", last: "Lovelace" }, email: "ada@example.com" },
  },
};
if (dynamicResult.data.configuration === "contact") {
  expectType<unknown>(dynamicResult.data.values.email);
  expectType<unknown>(dynamicResult.data.values.name.first);
  // @ts-expect-error: companyName is on the `account` variant, not `contact`.
  dynamicResult.data.values.companyName;
}
if (dynamicResult.data.configuration === "account") {
  expectType<unknown>(dynamicResult.data.values.companyName);
  // @ts-expect-error: email is on the `contact` variant, not `account`.
  dynamicResult.data.values.email;
}
// @ts-expect-error: only declared configuration keys are valid discriminants.
if (dynamicResult.data.configuration === "nonexistent") {
  /* unreachable */
}

dynamicObjectInput({
  label: "Bad",
  // @ts-expect-error: factory disallows callers from setting `type`.
  type: "string",
  configurations: {
    contact: {
      label: "Contact",
      inputs: { email: input({ type: "string", label: "Email" }) },
    },
  },
});

dynamicObjectInput({
  label: "Outer",
  configurations: {
    contact: {
      label: "Contact",
      inputs: {
        // @ts-expect-error: dynamicObject configurations cannot contain a nested dynamicObject.
        nested: dynamicObjectInput({
          label: "Inner",
          configurations: {
            x: { label: "X", inputs: { y: input({ type: "string", label: "Y" }) } },
          },
        }),
      },
    },
  },
});

structuredObjectInput({
  label: "Parent",
  inputs: {
    // @ts-expect-error: structuredObject children cannot be a dynamicObject.
    bad: dynamicObjectInput({
      label: "Inner Dynamic",
      configurations: {
        x: { label: "X", inputs: { y: input({ type: "string", label: "Y" }) } },
      },
    }),
  },
});

structuredObjectInput({
  label: "Parent",
  inputs: {
    // @ts-expect-error: structuredObject children cannot be a connection.
    cred: input({ type: "connection", key: "cred", label: "Credentials" }),
    // @ts-expect-error: structuredObject children cannot be a connection template.
    tmpl: input({
      type: "template",
      key: "tmpl",
      label: "Template",
      templateValue: "",
    }),
  },
});

dynamicObjectInput({
  label: "Target",
  configurations: {
    salesforce: {
      label: "Salesforce",
      inputs: {
        // @ts-expect-error: dynamicObject configurations cannot contain a connection child.
        cred: input({ type: "connection", key: "cred", label: "Credentials" }),
        // @ts-expect-error: dynamicObject configurations cannot contain a connection template child.
        tmpl: input({
          type: "template",
          key: "tmpl",
          label: "Template",
          templateValue: "",
        }),
      },
    },
  },
});

// Positive-compile probes for the depth-2 position: a structuredObject
// living inside a dynamicObject configuration, whose leaves must still
// accept ordinary scalar and conditional inputs. If
// `LeafInputFieldDefinition` ever over-narrows, these factory calls
// fail to satisfy the SO factory's generic constraint and the
// regression surfaces here. Paired with the rejection directives above
// so each directive is provably load-bearing on its precise position.
dynamicObjectInput({
  label: "Target",
  configurations: {
    contact: {
      label: "Contact",
      inputs: {
        name: structuredObjectInput({
          label: "Name",
          inputs: {
            first: input({ type: "string", label: "First" }),
            count: input({ type: "string", label: "Count", collection: "valuelist" }),
            cond: input({ type: "conditional", label: "Cond", collection: "valuelist" }),
          },
        }),
      },
    },
  },
});

dynamicObjectInput({
  label: "Target",
  configurations: {
    contact: {
      label: "Contact",
      inputs: {
        name: structuredObjectInput({
          label: "Name",
          inputs: {
            // @ts-expect-error: connection rejected at depth 2 (structuredObject inside dynamicObject configuration).
            cred: input({ type: "connection", key: "cred", label: "Credentials" }),
          },
        }),
      },
    },
  },
});
