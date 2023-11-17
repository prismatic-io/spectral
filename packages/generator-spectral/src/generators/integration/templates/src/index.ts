import {
  integration,
  configPage,
  ConfigPageElementType,
} from "@prismatic-io/spectral";
import flows from "./flows";
import { configVars } from "./configVars";

export default integration({
  name: "<%= integration.name %>",
  description: "<%= integration.description %>",
  iconPath: "icon.png",
  flows,
  configVars,
  configPages: [
    configPage({
      name: "Config Page 1",
      tagline: "This is the first Config Page",
      elements: [
        {
          type: ConfigPageElementType.ConfigVar,
          value: "<%= configVar.key %>" as const,
        },
      ],
    }),
  ],
});
