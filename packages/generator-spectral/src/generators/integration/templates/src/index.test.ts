import { flow1 } from "./flows";
import { invokeFlow } from "@prismatic-io/spectral/dist/testing";

describe("test my flow", () => {
  test("verify the return value of my flow", async () => {
    const { result } = await invokeFlow(flow1, {
      connection1: {
        fields: {
          username: process.env.MY_APP_USERNAME, // A username saved as an environment variable
          password: process.env.MY_APP_PASSWORD, // A password saved as an environment variable
        },
      },
    });
    expect(result?.data).toBe(
      "Hello, <%= flow.name %> using connection connection1"
    );
  });
});
