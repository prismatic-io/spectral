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

### Using a component package from a code-native integration

A component built with `component(...)` can be installed from npm and used directly from a
code-native integration through `componentClient`:

```typescript
import { componentClient } from "@prismatic-io/spectral";
import slack from "@acme/slack-component";

const client = componentClient(slack);

export const slackFlow = flow({
  name: "Slack events",
  stableKey: "slack-events",
  onTrigger: client.triggers.webhook({
    slackConnection: { configVar: "Slack Connection" },
  }),
  onExecution: async (context, params) => ({
    data: await client.actions.postMessage({ channel: "#general", message: "hi" }),
  }),
});
```

Actions run in the integration's own process. A trigger binds its inputs and becomes the
flow's trigger; config-var bindings resolve from each invocation's context, other inputs accept
ordinary pre-clean values or `{ value: rawValue }`, and defaults and cleaners run inside the
component call. The bound trigger carries the component trigger's lifecycle handlers, polling
behavior, batch defaults, pagination resolvers and initial-sync handler onto the integration's
generated trigger, so no manifest or supplemental component is needed. A polling flow still
needs a `schedule`, and a flow that also defines lifecycle handlers runs the component's handler
first and merges its own returned state over it. Data sources are callable from a flow or a
configuration callback, and `client.dataSources.x.configVar({ ... })` declares a config var
backed by one. Connections reference the published component, so a connection config var stays
shared with low-code integrations; Prism publishes the component and pins the version when the
integration is imported.

Keep `@prismatic-io/spectral` a peer dependency of the component package and externalize it when
bundling the package, so the integration and the component share one execution context.

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
