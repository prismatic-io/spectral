import { component } from "@prismatic-io/spectral";
import actions from "./actions";
import triggers from "./triggers";
import dataSources from "./dataSources";
import connections from "./connections";

export default component({
  key: "<%= component.key %>",
  public: false,
  display: {
    label: "<%= component.name %>",
    description: "<%= component.description %>",
    iconPath: "icon.png",
  },
  actions,
  triggers,
  dataSources,
  connections,
});
