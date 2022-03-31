import { action, input } from "@prismatic-io/spectral";
import { createClient } from "./client";

const myConnectionField = input({
  label: "Connection",
  type: "connection",
  required: true,
});

const myInputField = input({
  label: "My Input",
  type: "string",
  required: true,
});

export const <%= action.key %> = action({
  display: {
    label: "<%= action.label %>",
    description: "<%= action.description %>",
  },
  perform: async (context, { connection, myInput }) => {
    const client = createClient(connection);
    return {
      data: await client.call(myInput),
    };
  },
  inputs: {
    connection: myConnectionField,
    myInput: myInputField,
  },
});

export default { <%= action.key %> };
