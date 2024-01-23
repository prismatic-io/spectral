import { integration } from "@prismatic-io/spectral";
import flows from "./flows";
import { configPages } from "./configPages";

export default integration({
  name: "<%= integration.name %>",
  description: "<%= integration.description %>",
  iconPath: "icon.png",
  flows,
  configPages,
});
