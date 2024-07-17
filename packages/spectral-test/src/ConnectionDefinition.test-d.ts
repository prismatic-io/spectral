import { onPremConnection, OnPremConnectionDefinition } from "@prismatic-io/spectral";
import { expectAssignable, expectNotAssignable } from "tsd";

const valid = onPremConnection({
  key: "basic",
  label: "Basic Connection",
  inputs: {
    host: {
      label: "Host",
      placeholder: "Host",
      type: "string",
      required: true,
      shown: true,
      onPremControlled: true,
      example: "192.168.0.1",
    },
    port: {
      label: "Port",
      placeholder: "Port",
      type: "string",
      required: true,
      shown: true,
      onPremControlled: true,
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
});
expectAssignable<OnPremConnectionDefinition>(valid);

const invalid = {
  key: "basic",
  label: "Basic Connection",
  inputs: {
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
};
expectNotAssignable<OnPremConnectionDefinition>(invalid);
