import { Connection } from "@prismatic-io/spectral";

export const createClient = (connection: Connection) => {
  // Create a client using the provided Connection for the
  // service you're consuming from this Component.
  return {
    call: async (name: unknown) =>
      Promise.resolve(`Hello, ${name} using connection ${connection.key}`),
  };
};
