import { connection } from "..";
import { convertConnection } from "./convertComponent";

describe("convertConnection", () => {
  const label = "My Basic Connection";
  const description = "This is a basic connection.";

  const basicConnection = connection({
    key: "my-basic-connection",
    display: {
      label,
      description,
    },
    inputs: {},
  });

  it("correctly converts the display block", async () => {
    const convertedConnection = convertConnection(basicConnection);
    expect(convertedConnection.label).toBe(label);
    expect(convertedConnection.comments).toBe(description);
  });
});
