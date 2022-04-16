import { expectAssignable } from "tsd";
import { Component } from "../serverTypes";
import { component } from "..";

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
    category: "a-category",
  },
  documentationUrl: "https://example.com/docs",
});
expectAssignable<Component>(publicDefinition);
