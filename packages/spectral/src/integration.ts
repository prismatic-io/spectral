/**
 * This module contains functions to help developers create integrations
 * that can run on the Prismatic platform.
 */

// Export integration-related functions from their explicit sources
export {
  integration,
  flow,
  configVar,
  dataSourceConfigVar,
  connectionConfigVar,
  customerActivatedConnection,
  organizationActivatedConnection,
  componentManifest,
  componentManifests,
  onPremConnection,
  oauth2Connection,
} from "./index";

export * from "./types/typeExportIntegration";
export * from "./errors";
