import { myAction } from "./actions";
import { myTrigger } from "./triggers";
import { myDataSource } from "./dataSource";
import { myConnection } from "./connections";
import {
  invoke,
  invokeTrigger,
  invokeDataSource,
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

describe("test my data source", () => {
  test("verify the return value of my data source", async () => {
    const { result } = await invokeDataSource(myDataSource, {
      connection: createConnection(myConnection, {
        username: process.env.MY_APP_USERNAME, // A username saved as an environment variable
        password: process.env.MY_APP_PASSWORD, // A password saved as an environment variable
      }),
      myInput: "some input",
    });
    expect(result.result).toBe("Hello, some input");
  });
});
