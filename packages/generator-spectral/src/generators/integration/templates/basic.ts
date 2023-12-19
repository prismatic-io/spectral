import { connectionConfigVar } from "@prismatic-io/spectral";

export const <%= configVar.key %> = connectionConfigVar({
  key: "<%= configVar.key %>",
  label: "<%= configVar.label %>",
  inputs: {
    username: {
      label: "Username",
      placeholder: "Username",
      type: "string",
      required: true,
      comments: "Username for my Connection",
    },
    password: {
      label: "Password",
      placeholder: "Password",
      type: "password",
      required: true,
      comments: "Password for my Connection",
    },
  },
});

export const configVars = { <%= configVar.key %> };
export type ConfigVars = typeof configVars;
