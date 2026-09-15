import type { ActionContext } from "@prismatic-io/spectral";
import { expectNotAssignable, expectType } from "tsd";

/**
 * `configuration` and `connections` reach a flow only behind the
 * `integrationConfiguration` flag. Augmenting `Experimental` is global to a
 * compilation, so the enabled branch is asserted where the other type tests
 * declare their own augmentations.
 */
type Keys = keyof ActionContext;

expectNotAssignable<Keys>("configuration");
expectNotAssignable<Keys>("connections");
expectType<"configVars">(null as unknown as Extract<Keys, "configVars">);
