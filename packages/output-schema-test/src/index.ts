import { component } from "@prismatic-io/spectral";
import actions from "./actions";

export default component({
  key: "output-schema-test",
  public: false,
  display: {
    label: "Output Schema Test",
    description: "Test component for ActionOutputSchemaDefinition — actionOutput and branchingOutput.",
    iconPath: "icon.png",
  },
  actions,
});
