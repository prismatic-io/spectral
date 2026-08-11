import {
  configPage,
  connectionConfigVar,
  customerActivatedConnection,
  organizationActivatedConnection,
  userActivatedConnection,
  userLevelConfigPage,
} from "@prismatic-io/spectral";
import { expectError, expectType } from "tsd";

/**
 * A connection each person activates for themselves is only meaningful on a user
 * level config page. On any other page it is emitted as an ordinary shared
 * connection, byte for byte what a non-user-scoped declaration produces – so the
 * mistake would cost the author the feature with no error anywhere.
 *
 * Two things catch it, and these assertions are the earlier: this fails while the
 * integration is still being written, and `convertConfigPages` throws when it is
 * built. The emitted payload records neither the page nor the scope, so the server
 * cannot check placement – see the note in `convertConfigVar`.
 */

const userConnection = userActivatedConnection({
  stableKey: "user-slack-connection",
});

expectType<"userScopedConnection">(userConnection.dataType);

userLevelConfigPage({
  tagline: "Connect the account you want this integration to act as",
  elements: {
    "Slack Connection": userConnection,
  },
});

expectError(
  configPage({
    tagline: "Set up your connections",
    elements: {
      "Slack Connection": userActivatedConnection({
        stableKey: "user-slack-connection",
      }),
    },
  }),
);

/** The kinds an ordinary page has always accepted keep working. Both are asserted,
 * because `Exclude` removes union members by assignability and all three scoped kinds
 * were structurally identical until the discriminator was added. */
configPage({
  tagline: "Set up your connections",
  elements: {
    "Org Slack": organizationActivatedConnection({
      stableKey: "org-slack-connection",
    }),
    "Customer Slack": customerActivatedConnection({
      stableKey: "customer-slack-connection",
    }),
    "Acme Connection": connectionConfigVar({
      stableKey: "acme-connection",
      dataType: "connection",
      inputs: {
        apiKey: { label: "API Key", type: "password", required: true },
      },
    }),
    "Some Copy": "<h1>Hello</h1>",
  },
});

/** A user level page accepts them too, so a mixed page stays expressible. */
userLevelConfigPage({
  tagline: "Connect your account",
  elements: {
    "Org Slack": organizationActivatedConnection({
      stableKey: "org-slack-connection",
    }),
    "User Slack": userActivatedConnection({
      stableKey: "user-slack-connection",
    }),
  },
});
