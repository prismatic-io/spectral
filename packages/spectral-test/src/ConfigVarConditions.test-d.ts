import {
  type ConfigVar,
  type ConfigVarConditions,
  configVar,
  customerActivatedConnection,
  type HtmlElement,
  organizationActivatedConnection,
  UnaryOperator,
  userActivatedConnection,
} from "@prismatic-io/spectral";
import { expectAssignable, expectError, expectNotAssignable } from "tsd";

const conditions: ConfigVarConditions = {
  required: false,
  activeIf: [UnaryOperator.isTrue, { type: "configVar", value: "Enabled" }],
};

expectAssignable<ConfigVar>(
  configVar({
    stableKey: "setting",
    dataType: "string",
    ...conditions,
  }),
);
expectAssignable<ConfigVar>(organizationActivatedConnection({ stableKey: "org", ...conditions }));
expectAssignable<ConfigVar>(customerActivatedConnection({ stableKey: "customer", ...conditions }));
expectAssignable<ConfigVar>(userActivatedConnection({ stableKey: "user", ...conditions }));
expectError(organizationActivatedConnection({ stableKey: "org", required: "false" }));
expectError(customerActivatedConnection({ stableKey: "customer", activeIf: null }));
expectError(userActivatedConnection({ stableKey: "user", required: null }));
expectNotAssignable<ConfigVar>({ stableKey: "setting", dataType: "string", required: "false" });
expectNotAssignable<ConfigVar>({ stableKey: "setting", dataType: "string", required: null });
expectNotAssignable<ConfigVar>({ stableKey: "setting", dataType: "string", activeIf: null });
expectNotAssignable<HtmlElement>({ type: "htmlElement", value: "", required: false });
expectNotAssignable<ConfigVar>({
  stableKey: "html",
  dataType: "htmlElement",
  required: false,
});
