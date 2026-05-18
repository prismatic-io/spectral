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
      contact: structuredObjectInput({
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
      }),
      account: structuredObjectInput({
        label: "Account",
        inputs: {
          companyName: input({ type: "string", label: "Company Name", required: true }),
        },
      }),
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
  expectType<unknown>(dynamicResult.data.values.name.last);
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
    contact: structuredObjectInput({
      label: "Contact",
      inputs: { email: input({ type: "string", label: "Email" }) },
    }),
  },
});

dynamicObjectInput({
  label: "Outer",
  configurations: {
    contact: structuredObjectInput({
      label: "Contact",
      inputs: {
        // @ts-expect-error: configuration children cannot be a dynamicObject.
        nested: dynamicObjectInput({
          label: "Inner",
          configurations: {
            x: structuredObjectInput({
              label: "X",
              inputs: { y: input({ type: "string", label: "Y" }) },
            }),
          },
        }),
      },
    }),
  },
});

structuredObjectInput({
  label: "Parent",
  inputs: {
    // @ts-expect-error: structuredObject children cannot be a dynamicObject.
    bad: dynamicObjectInput({
      label: "Inner Dynamic",
      configurations: {
        x: structuredObjectInput({
          label: "X",
          inputs: { y: input({ type: "string", label: "Y" }) },
        }),
      },
    }),
  },
});

structuredObjectInput({
  label: "Parent",
  inputs: {
    nested: structuredObjectInput({
      label: "Inner Structured",
      inputs: { y: input({ type: "string", label: "Y" }) },
    }),
  },
});
