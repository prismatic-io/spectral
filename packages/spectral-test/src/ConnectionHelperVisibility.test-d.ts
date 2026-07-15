import type { ConfigVarExpression, ConfigVarVisibility } from "@prismatic-io/spectral";
import { expectAssignable } from "tsd";

/**
 * The generated connection-helper functions (e.g. `slackOauth2`)
 * accept the same value-bag union as the direct `connectionConfigVar`
 * path. The union — visibility-only OR (value|configVar) & visibility —
 * is emitted inline by `connection.ts.ejs`. These tests mirror that
 * inline shape so the helper's parameter type is exercised in
 * isolation from the generator.
 *
 * The shape pinned here is also pinned literally by
 * `createConnections.test.ts`'s inline snapshot — the snapshot guards
 * the template's textual output; this file guards what that text
 * means to the type system.
 */

type ValueBag<TValue> =
  | (({ value: TValue } | ConfigVarExpression) & ConfigVarVisibility & { writeOnly?: true })
  | (ConfigVarVisibility & { writeOnly?: true });

type SlackOauth2Values = {
  // Required-no-default input: the whole property is required, but
  // the value bag is still the widened union.
  clientId: ValueBag<string>;
  // Required-with-default OR non-required: the generator marks the
  // whole property optional. The value-bag union is identical to the
  // required case — required-ness is enforced at the property level,
  // not at the bag level.
  authorizeUrl?: ValueBag<string>;
};

// Visibility-only bag on a defaulted input: hides it from the org
// deployer with no `value`.
expectAssignable<SlackOauth2Values>({
  clientId: { value: "my-client-id" },
  authorizeUrl: {
    permissionAndVisibilityType: "organization",
    visibleToOrgDeployer: false,
  },
});

// Visibility-only bag is also valid on a required-no-default input;
// required-ness is enforced at the property level, not the bag level,
// so the runtime falls back to the component's declared default.
expectAssignable<SlackOauth2Values>({
  clientId: {
    permissionAndVisibilityType: "organization",
    visibleToOrgDeployer: false,
  },
  authorizeUrl: { value: "https://slack.com/oauth/v2/authorize" },
});

// Non-visibility-only bags: value, configVar, and value-with-visibility.

// `{ value }` alone.
expectAssignable<SlackOauth2Values>({
  clientId: { value: "my-client-id" },
  authorizeUrl: { value: "https://slack.com/oauth/v2/authorize" },
});

// `{ configVar }`.
expectAssignable<SlackOauth2Values>({
  clientId: { configVar: "Client ID" },
});

// `{ value, visibility }`.
expectAssignable<SlackOauth2Values>({
  clientId: {
    value: "my-client-id",
    permissionAndVisibilityType: "organization",
    visibleToOrgDeployer: false,
  },
});

// The optional `authorizeUrl` can be omitted entirely.
expectAssignable<SlackOauth2Values>({
  clientId: { value: "my-client-id" },
});

// A bag that satisfies none of value / configVar / visibility is
// rejected.
const _typeCheck: SlackOauth2Values = {
  clientId: {
    // @ts-expect-error — not a ValueExpression, ConfigVarExpression,
    // or ConfigVarVisibility.
    somethingElse: "nope",
  },
};
void _typeCheck;
