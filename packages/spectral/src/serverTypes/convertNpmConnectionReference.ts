import type { ComponentReference } from "../types";
import type { AnyConnection } from ".";
import { isNpmConnectionReference, type NpmConnectionReference } from "./callableConnection";
import { convertReferenceValues } from "./convertIntegration";
import type { Input as ServerInput } from "./integration";

export type ConvertedNpmConnectionReference = NpmConnectionReference<AnyConnection>;

export const asNpmConnectionReference = (
  ref: unknown,
): ConvertedNpmConnectionReference | undefined =>
  isNpmConnectionReference(ref) ? (ref as ConvertedNpmConnectionReference) : undefined;

export const convertNpmConnectionReferenceInputs = (
  npmConnectionReference: ConvertedNpmConnectionReference,
): Record<string, ServerInput> => {
  const inputsByKey = Object.fromEntries(
    npmConnectionReference.connection.inputs.map((input) => [input.key, input]),
  );
  return convertReferenceValues(
    inputsByKey,
    npmConnectionReference.values as ComponentReference["values"],
  );
};
