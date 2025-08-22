/**
 * This module contains functions to help developers create integrations
 * that can run on the Prismatic platform.
 */

// Re-export integration-related functions from index
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
