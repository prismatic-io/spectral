import camelCase from "lodash/camelCase";
import snakeCase from "lodash/snakeCase";
import type { PerformSafety } from "../types";
import type { PerformSafety as ServerPerformSafety } from ".";

export const toServerPerformSafety = (value: PerformSafety): ServerPerformSafety =>
  snakeCase(value).toUpperCase() as ServerPerformSafety;

export const fromServerPerformSafety = (value: ServerPerformSafety): PerformSafety =>
  camelCase(value) as PerformSafety;
