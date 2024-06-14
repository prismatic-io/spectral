import { component } from "@prismatic-io/spectral";
import { Component } from "@prismatic-io/spectral/dist/serverTypes";
import { expectAssignable } from "tsd";

const privateDefinition = component({
  key: "private-definition",
  display: { label: "Private", description: "Private", iconPath: "icon.png" },
});
expectAssignable<Component>(privateDefinition);

const publicDefinition = component({
  key: "public-definition",
  public: true,
  display: {
    label: "Public",
    description: "Public",
    iconPath: "icon.png",
    category: "Application Connectors",
  },
  documentationUrl: "https://prismatic.io/docs/components/public-definition/",
});
expectAssignable<Component>(publicDefinition);
