import { configPage, connectionConfigVar } from "@prismatic-io/spectral";

export const configPages = {
  Connections: configPage({
    elements: {
      "<%= configVar.key %>": connectionConfigVar({
        stableKey: "<%= configVar.stableKey %>",
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
      }),
    },
  }),
};

export type ConfigPages = typeof configPages;
