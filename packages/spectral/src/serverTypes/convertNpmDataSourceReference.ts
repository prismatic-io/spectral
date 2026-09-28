import type { ActionContext, ComponentReference, ComponentRegistry } from "../types";
import type { AnyDataSource, DataSourceContext, DataSourcePerformFunction } from ".";
import { runWithContext } from "./asyncContext";
import { isNpmDataSourceReference, type NpmDataSourceReference } from "./callableDataSource";
import { createCNIContext } from "./context";
import { convertReferenceValues } from "./convertIntegration";
import type { Input as ServerInput } from "./integration";

export type ConvertedNpmDataSourceReference = NpmDataSourceReference<AnyDataSource>;

export const asNpmDataSourceReference = (
  ref: unknown,
): ConvertedNpmDataSourceReference | undefined =>
  isNpmDataSourceReference(ref) ? (ref as ConvertedNpmDataSourceReference) : undefined;

export const convertNpmDataSourceReferenceInputs = (
  npmDataSourceReference: ConvertedNpmDataSourceReference,
): Record<string, ServerInput> => {
  const inputsByKey = Object.fromEntries(
    npmDataSourceReference.dataSource.inputs.map((input) => [input.key, input]),
  );
  return convertReferenceValues(
    inputsByKey,
    npmDataSourceReference.values as ComponentReference["values"],
  );
};

export const createNpmDataSourcePerform = (
  npmDataSource: AnyDataSource,
  componentRegistry: ComponentRegistry,
): DataSourcePerformFunction => {
  return async (context, params) => {
    const cniContext = createCNIContext(context as unknown as ActionContext, componentRegistry);
    return await runWithContext(cniContext, () =>
      npmDataSource.perform(cniContext as unknown as DataSourceContext, params),
    );
  };
};
