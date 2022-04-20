import { expectType } from "tsd";
import {
  input,
  Connection,
  ActionInputParameters,
  ConditionalExpression,
} from "..";
import util from "../util";

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
