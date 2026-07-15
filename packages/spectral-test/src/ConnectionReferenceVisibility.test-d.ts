import { connectionConfigVar } from "@prismatic-io/spectral";
import { expectAssignable } from "tsd";

/**
 * A connection-reference value-bag may be visibility-only —
 * `value` and `configVar` are both omitted, and only
 * `permissionAndVisibilityType` / `visibleToOrgDeployer` are supplied.
 * The runtime falls back to the referenced component's declared default
 * for that input, so integration authors don't need to look up and
 * restate the default just to hide an input from the org deployer.
 *
 * The registry used by these assertions is declared in
 * `testData.test-d.ts` and wired in via the module augmentation in
 * `spectral.test-d.ts`. Connections there include `slack.slackOAuth`,
 * whose `perform` declares `clientId: string`, `clientSecret: string`,
 * and `signingSecret: string` as inputs.
 */

// Visibility-only bag: hides a connection input from the org
// deployer with no `value`.
expectAssignable(
  connectionConfigVar({
    dataType: "connection",
    stableKey: "slack-oauth-hidden-secret",
    connection: {
      component: "slack",
      key: "slackOAuth",
      values: {
        clientId: { value: "my-client-id" },
        clientSecret: {
          permissionAndVisibilityType: "organization",
          visibleToOrgDeployer: false,
        },
        signingSecret: { value: "my-signing-secret" },
      },
    },
  }),
);

// Visibility-only is allowed even without `visibleToOrgDeployer`.
expectAssignable(
  connectionConfigVar({
    dataType: "connection",
    stableKey: "slack-oauth-visibility-only",
    connection: {
      component: "slack",
      key: "slackOAuth",
      values: {
        clientId: { value: "my-client-id" },
        clientSecret: { value: "secret" },
        signingSecret: { permissionAndVisibilityType: "embedded" },
      },
    },
  }),
);

// Non-visibility-only bags: value, configVar, and value-with-visibility.

// `{ value }` alone.
expectAssignable(
  connectionConfigVar({
    dataType: "connection",
    stableKey: "slack-oauth-value-only",
    connection: {
      component: "slack",
      key: "slackOAuth",
      values: {
        clientId: { value: "my-client-id" },
        clientSecret: { value: "secret" },
        signingSecret: { value: "signing" },
      },
    },
  }),
);

// `{ configVar }`: references another config var.
expectAssignable(
  connectionConfigVar({
    dataType: "connection",
    stableKey: "slack-oauth-config-var-ref",
    connection: {
      component: "slack",
      key: "slackOAuth",
      values: {
        clientId: { configVar: "Slack Client ID" },
        clientSecret: { configVar: "Slack Client Secret" },
        signingSecret: { configVar: "Slack Signing Secret" },
      },
    },
  }),
);

// `{ value }` combined with visibility.
expectAssignable(
  connectionConfigVar({
    dataType: "connection",
    stableKey: "slack-oauth-value-and-visibility",
    connection: {
      component: "slack",
      key: "slackOAuth",
      values: {
        clientId: { value: "my-client-id" },
        clientSecret: {
          value: "secret",
          permissionAndVisibilityType: "organization",
          visibleToOrgDeployer: false,
        },
        signingSecret: { value: "signing" },
      },
    },
  }),
);

// The generated connection helper (e.g. `slackOauth2`) forwards its
// `values` argument straight through to this `connectionConfigVar`
// call site. If the helper's parameter type ever drifts from the
// registry's value-bag union, the helper body's forwarding stops
// type-checking. This call exercises that exact integration point
// with the visibility-only bag — proving the registry
// side accepts what the helper template emits.
expectAssignable(
  connectionConfigVar({
    dataType: "connection",
    stableKey: "slack-oauth-via-helper-forwarding",
    connection: {
      component: "slack",
      key: "slackOAuth",
      values: {
        clientId: { value: "my-client-id" },
        clientSecret: {
          permissionAndVisibilityType: "organization",
          visibleToOrgDeployer: false,
        },
        signingSecret: { value: "signing" },
      },
    },
  }),
);

// A bag with neither `value`, `configVar`, nor any visibility field
// does not satisfy the value-bag union.
connectionConfigVar({
  dataType: "connection",
  stableKey: "slack-oauth-bogus",
  connection: {
    component: "slack",
    key: "slackOAuth",
    values: {
      // @ts-expect-error — not a ValueExpression, ConfigVarExpression,
      // TemplateExpression, or ConfigVarVisibility.
      clientId: { somethingElse: "nope" },
      clientSecret: { value: "secret" },
      signingSecret: { value: "signing" },
    },
  },
});
