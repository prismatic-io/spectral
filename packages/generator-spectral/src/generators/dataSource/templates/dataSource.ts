import { dataSource, input } from "@prismatic-io/spectral";
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

export const <%= dataSource.key %> = dataSource({
  display: {
    label: "<%= dataSource.label %>",
    description: "<%= dataSource.description %>",
  },
  perform: async (context, { connection, myInput }) => {
    const client = createClient(connection);
    return {
      result: await client.call(myInput),
    };
  },
  inputs: {
    connection: myConnectionField,
    myInput: myInputField,
  },
  dataSourceType: "string",
});

export default { <%= dataSource.key %> };
