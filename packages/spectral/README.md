<div align="center">
  <img src="https://prismatic.io/favicon-48x48.png" />
  <h1>@prismatic-io/spectral</h1>
</div>

This repository contains code for Prismatic's TypeScript library, `spectral`, which is used to build custom Prismatic connectors and code-native integrations.

## Using Spectral

To install spectral, run:

```bash
npm install @prismatic-io/spectral
```

Please see our [documentation](https://prismatic.io/docs/custom-connectors/) on writing and publishing custom connectors for Prismatic's platform.

### Bundled component triggers (prototype)

A component package exposing `callableComponent(componentDefinition)` from its npm entry can
be used directly as a CNI flow trigger:

```typescript
import slack from "@prismatic-io/slack";
import { flow } from "@prismatic-io/spectral";

export const slackFlow = flow({
  name: "Slack events",
  stableKey: "slack-events",
  onTrigger: slack.triggers.webhook({
    slackConnection: { configVar: "Org Slack Connection" },
  }),
  onExecution: async (context, params) => ({ data: params.onTrigger.results }),
});
```

Config-var references resolve from each invocation's context, including reusable connections.
Other inputs accept ordinary pre-clean values or `{ value: rawValue }`. Use the latter for a
literal object containing a `configVar` or `value` property. Defaults and cleaners run inside
the component call.

Binding a trigger carries its lifecycle handlers, polling behavior, batch defaults, pagination
resolvers, and initial-sync handler into the CNI's generated trigger. A polling flow still
needs a `schedule`. For a component with a `triggerResolver`, set
`runInitialSyncOnDeploy: true` to enable its initial sync; platform dispatch requires batching.
If the flow also defines lifecycle handlers, the component handler runs first and the flow's
returned state merges over it. The bound trigger needs no manifest or supplemental component.

Keep Spectral as a peer dependency of the component's npm library and externalize it when
building that library, so the final CNI bundle supplies the shared execution context. Keep
the conventional `component(...)` export in the component's platform entry for Prism publishing.

### Connection and data-source config vars (prototype)

Connection factories declare an integration-specific slot backed by the published component's
connection definition. They do not copy the connection into the CNI wrapper. The component must
already be published; import resolves `LATEST` to a published version, or pass `version: 2` to
select one explicitly. Reusable credentials remain available through the existing scoped
connection helpers and can be passed to the same bundled actions and triggers.

```typescript
import slack from "@prismatic-io/slack";
import { configPage } from "@prismatic-io/spectral";

export const configPages = {
  Credentials: configPage({
    elements: {
      "Slack Connection": slack.connections.oauth({ stableKey: "slack-connection" }),
    },
  }),
  Channels: configPage({
    elements: {
      Channel: slack.dataSources.selectChannels({
        stableKey: "slack-channel",
        values: { connection: { configVar: "Slack Connection" } },
      }),
    },
  }),
};
```

Data-source factories infer the config-var type and bundle the data source and its
`detailDataSource`, including selection inputs. Input defaults and cleaning run inside the
call. Dependencies are emitted as platform expressions, so put their config vars on an earlier
page. These callbacks require no published data source or supplemental component.

For an in-process call, use `slack.dataSources.selectChannels.perform({ connection })`. Direct
calls with raw inputs also remain supported; `.perform` is unambiguous when a data source itself
has inputs named `stableKey` and `values`.

## What is Prismatic?

Prismatic is the leading embedded iPaaS, enabling B2B SaaS teams to ship product integrations faster and with less dev time. The only embedded iPaaS that empowers both developers and non-developers with tools for the complete integration lifecycle, Prismatic includes low-code and code-native building options, deployment and management tooling, and self-serve customer tools.

Prismatic's unparalleled versatility lets teams deliver any integration from simple to complex in one powerful platform. SaaS companies worldwide, from startups to Fortune 500s, trust Prismatic to help connect their products to the other products their customers use.

With Prismatic, you can:

- Build [integrations](https://prismatic.io/docs/integrations/) using our [intuitive low-code designer](https://prismatic.io/docs/integrations/low-code-integration-designer/) or [code-native](https://prismatic.io/docs/integrations/code-native/) approach in your preferred IDE
- Leverage pre-built [connectors](https://prismatic.io/docs/components/) for common integration tasks, or develop custom connectors using our TypeScript SDK
- Embed a native [integration marketplace](https://prismatic.io/docs/embed/) in your product for customer self-service
- Configure and deploy customer-specific integration instances with powerful configuration tools
- Support customers efficiently with comprehensive [logging, monitoring, and alerting](https://prismatic.io/docs/monitor-instances/)
- Run integrations in a secure, scalable infrastructure designed for B2B SaaS
- Customize the platform to fit your product, industry, and development workflows

## Who uses Prismatic?

Prismatic is built for B2B software companies that need to provide integrations to their customers. Whether you're a growing SaaS startup or an established enterprise, Prismatic's platform scales with your integration needs.

Our platform is particularly powerful for teams serving specialized vertical markets. We provide the flexibility and tools to build exactly the integrations your customers need, regardless of the systems you're connecting to or how unique your integration requirements may be.

## What kind of integrations can you build using Prismatic?

Prismatic supports integrations of any complexity - from simple data syncs to sophisticated, industry-specific solutions. Teams use it to build integrations between any type of system, whether modern SaaS or legacy with standard or custom protocols. Here are some example use cases:

- Connect your product with customers' ERPs, CRMs, and other business systems
- Process data from multiple sources with customer-specific transformation requirements
- Automate workflows with customizable triggers, actions, and schedules
- Handle complex authentication flows and data mapping scenarios

For information on the Prismatic platform, check out our [website](https://prismatic.io/) and [docs](https://prismatic.io/docs/).

## License

This repository is MIT licensed.
