import { connection } from "@prismatic-io/spectral";

export const <%= connection.key %> = connection({
  key: "<%= connection.key %>",
  label: "<%= connection.label %>",
  comments: "<%= connection.comments %>",
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

export default [<%= connection.key %>];
