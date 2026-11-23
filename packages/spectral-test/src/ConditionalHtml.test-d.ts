import type {
  ConfigPageElement,
  HtmlElement,
  UserLevelConfigPageElement,
} from "@prismatic-io/spectral";
import { BinaryOperator } from "@prismatic-io/spectral";
import { expectAssignable, expectNotAssignable } from "tsd";
import type { ConfigPageElement as ServerConfigPageElement } from "../../spectral/dist/serverTypes/integration";

const html: HtmlElement = {
  type: "htmlElement",
  value: "<p>EU settings</p>",
  activeIf: [
    BinaryOperator.equal,
    { type: "configVar", value: "Region" },
    { type: "value", value: "EU" },
  ],
};
expectAssignable<ConfigPageElement>(html);
expectAssignable<UserLevelConfigPageElement>(html);
expectAssignable<HtmlElement>({ type: "htmlElement", value: "<p>Always</p>" });
expectNotAssignable<HtmlElement>({ type: "htmlElement", value: "", activeIf: null });
expectNotAssignable<HtmlElement>({ type: "htmlElement", value: "", activeIf: ["xor"] });
expectAssignable<ConfigPageElement>({
  dataType: "htmlElement",
  stableKey: "legacy",
  activeIf: html.activeIf,
});
expectAssignable<ServerConfigPageElement>(html);
expectAssignable<ServerConfigPageElement>({ type: "configVar", value: "Region" });
expectAssignable<ServerConfigPageElement>({ type: "jsonForm", value: "Form" });
expectNotAssignable<ServerConfigPageElement>({
  type: "configVar",
  value: "Region",
  activeIf: html.activeIf,
});
expectNotAssignable<ServerConfigPageElement>({
  type: "jsonForm",
  value: "Form",
  activeIf: html.activeIf,
});
