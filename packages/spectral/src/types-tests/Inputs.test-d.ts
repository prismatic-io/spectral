import { expectType } from "tsd";
import { Connection, input, InputCleanFunction } from "..";
import { ConditionalExpression } from "../types/conditional-logic";

const omittedCollectionInput = input({
  label: "Omitted Collection",
  type: "string",
  clean: (value) => value,
});
expectType<InputCleanFunction<unknown, unknown>>(omittedCollectionInput.clean);

const nonCollectionInput = input({
  label: "Non-collection",
  type: "string",
  collection: undefined,
  clean: (value) => value,
});
expectType<InputCleanFunction<unknown, unknown>>(nonCollectionInput.clean);

const connectionInput = input({
  label: "Connection",
  type: "connection",
  clean: (value) => value,
});
expectType<InputCleanFunction<Connection | null | undefined>>(
  connectionInput.clean
);

const listCollectionInput = input({
  label: "List Collection",
  type: "string",
  collection: "valuelist",
  clean: (value) => value,
});
expectType<InputCleanFunction<unknown, unknown>>(listCollectionInput.clean);

const conditionalInput = input({
  label: "Conditional",
  type: "conditional",
  collection: "valuelist",
  clean: (value) => value,
});
expectType<InputCleanFunction<ConditionalExpression | null | undefined>>(
  conditionalInput.clean
);

const mapCollectionInput = input({
  label: "Map Collection",
  type: "string",
  collection: "keyvaluelist",
  clean: (value) => value,
});
expectType<InputCleanFunction<unknown, unknown>>(mapCollectionInput.clean);
