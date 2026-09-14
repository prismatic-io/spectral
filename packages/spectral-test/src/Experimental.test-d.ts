import type { Experimental, WithExperimentalFlag } from "@prismatic-io/spectral";
import { expectNotAssignable, expectType } from "tsd";

/**
 * The gate resolves through declaration merging, which is global to a
 * compilation, so an opted-in `Experimental` cannot be declared here without
 * reaching the rest of the suite. The enabled branch is asserted against a
 * local stand-in that resolves the same way.
 */
type Resolve<TFlags, TFlag extends string, TEnabled, TDisabled = {}> = TFlag extends keyof TFlags
  ? TFlags[TFlag] extends true
    ? TEnabled
    : TDisabled
  : TDisabled;

interface OptedIn {
  someFlag: true;
}

type Context = { always: string } & WithExperimentalFlag<"someFlag", { gated: number }>;

// `keyof` rather than a property read: excess-property checking does not fire
// through an intersection, so a leaked `gated` would go unnoticed.
expectType<"always">(null as unknown as keyof Context);
expectNotAssignable<Context>({ always: "here", gated: 1 });

expectType<string>(null as unknown as WithExperimentalFlag<"someFlag", number, string>);

expectType<{ gated: number }>(null as unknown as Resolve<OptedIn, "someFlag", { gated: number }>);
expectType<string>(null as unknown as Resolve<OptedIn, "missingFlag", number, string>);

expectType<never>(null as unknown as keyof Experimental);
