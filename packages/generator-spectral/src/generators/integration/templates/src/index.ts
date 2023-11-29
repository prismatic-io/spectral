import {
  integration,
  configPage,
  ConfigPageElementType,
} from "@prismatic-io/spectral";
import flows from "./flows";
import connections from "./connections";

export default integration({
  name: "<%= integration.name %>",
  description: "<%= integration.description %>",
  iconPath: "icon.png",
  flows,
  configVars: [
    {
      key: "<%= connection.key %>",
      dataType: "connection",
      connection: "<%= connection.key %>",
    },
  ],
  configPages: [
    configPage({
      name: "Config Page 1",
      tagline: "This is the first Config Page",
      elements: [
        {
          type: ConfigPageElementType.ConfigVar,
          value: "<%= connection.key %>",
        },
      ],
    }),
  ],
  connections,
});
