<div align="center">
  <img src="https://prismatic.io/favicon-48x48.png" />
  <h1>@prismatic-io/eslint-config-spectral</h1>
</div>

This package contains a recommended [ESLint](https://eslint.org/) configuration to aid in developing custom Prismatic components.

## Using the Config

To install, run:

```bash
npm install @prismatic-io/eslint-config-spectral --save-dev
```

You will need to update your [ESLint configuration](https://eslint.org/docs/user-guide/configuring/) to reference the config in this package. The easiest way is to add an `eslintConfig` block to your `package.json` file:

```jsonc
"eslintConfig": {
  "root": true,
  "extends": ["@prismatic-io/eslint-config-spectral"]
}
```

Note that you do not need to install the plugin packages as peer dependencies as resolution of those packages is handled with [Microsoft's ESLint patch](https://www.npmjs.com/package/@rushstack/eslint-patch). There are still a handful of peer dependencies you will need to install - use `npm info "@prismatic-io/eslint-config-spectral@latest" peerDependencies` to list them or use `npx install-peerdeps --dev @prismatic-io/eslint-config-spectral` to install them automatically.

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
