import { componentRegistry, configPages } from "./testData.test-d";

type TConfigPages = typeof configPages;
type TComponentRegistry = typeof componentRegistry;

declare module "@prismatic-io/spectral" {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface IntegrationDefinitionConfigPages extends TConfigPages {}

  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface IntegrationDefinitionComponentRegistry extends TComponentRegistry {}
}
