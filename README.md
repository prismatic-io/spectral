# @prismatic-io/spectral

This repository contains code for Prismatic's TypeScript library, `spectral`, which is used to build custom Prismatic components.

## Using Spectral

To install spectral, run:

```bash
npm install @prismatic-io/spectral
```

Please see our [documentation](https://prismatic.io/docs/custom-components/writing-custom-components) on writing and publishing custom components for Prismatic's platform.

## What is Prismatic?

Prismatic is the embedded integration platform for B2B software companies. It's the easiest way to build integrations and provide a first-class integration experience to your customers.

Prismatic reduces integration effort and empowers every role with exactly what they need, so you can spend less time on integrations and more time on core product innovation.

With Prismatic, you can:

- Build reusable [integrations](https://prismatic.io/docs/integrations) in an intuitive low-code integration designer
- Easily deploy customer-specific integration [instances](https://prismatic.io/docs/instances) with unique configurations and credentials
- Run your integrations in a purpose-built environment
- Provide better support with built-in [logging](https://prismatic.io/docs/logging) and [alerting](https://prismatic.io/docs/monitoring-and-alerting)
- Embed a white-labeled customer integration portal with an integration app store and customer self-service tools
- Mold the platform to your product, industry, and the way you build software

## Who uses Prismatic?

Prismatic is for B2B (business-to-business) software companies, meaning software companies that provide applications used by businesses. It's a good fit for products/teams at any stage, including early stage SaaS, established SaaS, and legacy or on-prem systems.

Many B2B software teams serve customers in niche vertical markets, and we designed Prismatic with that in mind. We provide powerful and flexible tools so you can build exactly the integrations your customers need, no matter who your customers are, no matter what systems you need to connect to, no matter how "non-standard" your integration scenario.

## What kind of integrations can you build using Prismatic?

Prismatic supports integrations ranging from simple and standard to complex, bespoke, and vertical-specific.
Teams use it to build integrations between applications of all kinds, SaaS or legacy, with or without a modern API, regardless of protocol or data format.
Here are some example use cases:

- Use job data from your system to create invoices in your customers' ERP.
- Import and process data from third-party forms that vary significantly from customer to customer.
- Email activity summary reports with parameters and intervals defined on a per-customer basis.

For information on the Prismatic platform, check out our [website](https://prismatic.io) and [docs](https://prismatic.io/docs).

## Building Spectral Locally

To build spectral locally, you'll need `yarn` and `node` installed.
Run `yarn build` to build the package, or `yarn pack` to build a tarball that can be used in custom components for testing changes to spectral.

## License

This repository is [MIT licensed](./LICENSE).
