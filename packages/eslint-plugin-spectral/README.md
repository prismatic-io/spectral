<div align="center">
  <img src="https://prismatic.io/favicon-48x48.png" />
  <h1>@prismatic-io/eslint-plugin-spectral</h1>
</div>

This package contains [ESLint](https://eslint.org/) rules for building Prismatic connectors and
code-native integrations.

Most developers should not install this package directly — it is enabled for you by
[`@prismatic-io/eslint-config-spectral`](../eslint-config-spectral), which is what
`prism integrations:init` scaffolds into new projects.

## Rules

A code-native flow can group its logs into sections:

```ts
const label = "Sync customers";
logger.section(label);
const customers = await fetchCustomers();
logger.sectionEnd({ label, data: { count: customers.length } });
```

The runtime is forgiving about misuse — a nested section, an unmatched label, or a section left
open produces a warning in the execution log and the section data is dropped rather than shown in
the execution details. That is easy to miss, so these rules report the same mistakes at lint time.

### `no-nested-section`

Sections cannot be nested. A `section()` opened while another section is still open is ignored at
runtime, and its logs are collated under the already-open section instead.

```ts
logger.section("orders");
logger.section("line items"); // reported
```

### `no-unclosed-section`

Every `section()` should be closed by a `sectionEnd()` in the same function. Also reports a
`sectionEnd()` with no open section to close.

```ts
logger.section("orders");
await syncOrders(); // reported: "orders" is never closed
```

An early `return` between the pair is fine — the runtime closes an abandoned section when the
function returns or throws — so only a missing `sectionEnd()` is reported.

### `section-label-match`

A `sectionEnd()` whose label does not match the open section is ignored at runtime, leaving the
section open.

```ts
logger.section("orders");
logger.sectionEnd({ label: "order" }); // reported
```

### `no-section-outside-flow`

Sections belong in a flow's `onExecution` handler, the only handler whose logger exposes the
section methods. A section opened inside a helper function nests inside its caller's section
without either author being able to see it.

```ts
const syncCustomers = async (logger) => {
  logger.section("customers"); // reported
};
```

Inline callbacks within a handler are fine, since they are still visible in the flow body:

```ts
onExecution: async (context) => {
  for (const record of records) {
    logger.section(record.id); // allowed by this rule
    logger.sectionEnd({ label: record.id });
  }
},
```

A section opened in a loop is still subject to the section limit, which `section-in-loop`
reports separately.

Note that this rule only ever applies to code-native integrations. Connector `perform`
functions receive a plain `ActionLogger` with no `section` methods at all, so there is nothing
for it to report there.

### `section-in-loop`

Advisory. A flow execution records at most 1000 sections. A `section()` opened in a loop creates
one section per iteration, so a loop over a collection that grows with a customer's data can
exhaust the limit. Past it the logs are still written, but are no longer grouped into sections.
The runtime warns in the execution log when an execution reaches the limit; this rule reports the
loop that gets you there before you deploy.

```ts
for (const record of records) {
  logger.section(record.id); // reported
  logger.sectionEnd({ label: record.id });
}
```

Prefer one section per batch over one per record:

```ts
logger.section(`page ${page}`);
for (const record of records) {
  logger.info(record.id);
}
logger.sectionEnd({ label: `page ${page}` });
```

Array iteration methods count as loops too — `forEach`, `map`, `flatMap`, `filter`, `reduce`,
`reduceRight`, `some`, and `every`.

This is the one rule the recommended config sets to `warn` rather than `error`. It cannot know how
many times a loop will run, so it reports every section opened in a loop, including loops that stay
well under the limit. A loop over a handful of records is fine, and silencing the warning with
`// eslint-disable-next-line` is a reasonable response.

## Limitations

Each function body is analyzed on its own, in source order. That keeps the rules free of false
positives on ordinary code, at the cost of two blind spots:

- A section opened in one function and closed in another is not tracked. Keep a section's start and
  end in the same function.
- Loop iteration counts are unknown, so `section-in-loop` cannot tell a loop over ten records
  from a loop over a million. It reports both.
- Concurrency is not modeled. Two helpers that each open a section, run under `Promise.all`, will
  interleave at runtime; no lint rule can see that. Sections are designed for a linear, top-level
  flow body.

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
