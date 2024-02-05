import { expectAssignable } from "tsd";
import { connection, KeyValuePair } from "..";

const onPremiseConnectionDef = connection({
  key: "basic",
  label: "Basic Connection",
  inputs: {
    host: {
      label: "Host",
      placeholder: "Host",
      type: "string",
      required: true,
      shown: true,
      example: "192.168.0.1",
    },
    port: {
      label: "Port",
      placeholder: "Port",
      type: "string",
      required: true,
      shown: true,
      default: "1433",
    },
    username: {
      label: "Username",
      placeholder: "Username",
      type: "string",
      required: false,
      shown: true,
    },
    password: {
      label: "Password",
      placeholder: "Password",
      type: "password",
      required: false,
      shown: true,
    },
  },
  onPremiseConfig: {
    replacesInputs: ["host", "port"],
    transform: (opc, inputConfig) => {
      return {
        ...inputConfig,
        host: opc.host,
        port: opc.port,
      };
    },
  },
});
type ExpectedInputValueType =
  | string
  | string[]
  | KeyValuePair<string>[]
  | undefined;
type ExpectedConfigType = { [key: string]: ExpectedInputValueType };
type ExpectedOnPrem = { host: string; port: string };
type ExpectedFunc = (
  opc: ExpectedOnPrem,
  inp: ExpectedConfigType
) => ExpectedConfigType;
expectAssignable<ExpectedFunc | undefined>(
  onPremiseConnectionDef.onPremiseConfig?.transform
);
