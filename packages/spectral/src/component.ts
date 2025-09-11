/**
 * This module contains functions to help developers create custom components
 * to run on the Prismatic platform.
 */

export {
  component,
  action,
  trigger,
  pollingTrigger,
  dataSource,
  input,
  connection,
  onPremConnection,
  oauth2Connection,
} from "./index";

export { default as util } from "./util";
export * from "./types/typeExportComponent";
export * from "./errors";
