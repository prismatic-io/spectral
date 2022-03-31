import { myAction } from "./actions";
import { myTrigger } from "./triggers";
import { myConnection } from "./connections";
import {
  invoke,
  invokeTrigger,
  defaultTriggerPayload,
  createConnection,
} from "@prismatic-io/spectral/dist/testing";

describe("test my action", () => {
  test("verify the return value of my action", async () => {
    const { result } = await invoke(myAction, {
      connection: createConnection(myConnection, {
        username: process.env.MY_APP_USERNAME, // A username saved as an environment variable
        password: process.env.MY_APP_PASSWORD, // A password saved as an environment variable
      }),
      myInput: "some input",
    });
    expect(result.data).toBe("Hello, some input");
  });
});

describe("test my trigger", () => {
  test("verify the return value of my trigger", async () => {
    const expectedPayload = defaultTriggerPayload();
    const {
      result: { payload },
    } = await invokeTrigger(myTrigger, {}, defaultTriggerPayload());
    expect(payload).toStrictEqual(expectedPayload);
  });
});
