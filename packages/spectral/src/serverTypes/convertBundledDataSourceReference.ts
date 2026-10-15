import type { ActionContext, ComponentReference, ComponentRegistry } from "../types";
import type {
  AnyDataSource,
  DataSourceContext,
  DataSourcePerformFunction,
  DataSource as ServerDataSource,
} from ".";
import { runWithContext } from "./asyncContext";
import { type BundledDataSourceReference, isBundledDataSourceReference } from "./bundledDataSource";
import { createCNIContext } from "./context";
import { convertReferenceValues } from "./convertIntegration";
import type { Input as ServerInput } from "./integration";

export type ConvertedBundledDataSourceReference = BundledDataSourceReference<AnyDataSource>;

export const asBundledDataSourceReference = (
  ref: unknown,
): ConvertedBundledDataSourceReference | undefined =>
  isBundledDataSourceReference(ref) ? (ref as ConvertedBundledDataSourceReference) : undefined;

export const convertBundledDataSourceReferenceInputs = (
  bundledDataSourceReference: ConvertedBundledDataSourceReference,
): Record<string, ServerInput> => {
  const inputsByKey = Object.fromEntries(
    bundledDataSourceReference.dataSource.inputs.map((input) => [input.key, input]),
  );
  return convertReferenceValues(
    inputsByKey,
    bundledDataSourceReference.values as ComponentReference["values"],
  );
};

export const createBundledDataSourcePerform = (
  bundledDataSource: AnyDataSource,
  componentRegistry: ComponentRegistry,
): DataSourcePerformFunction => {
  return async (context, params) => {
    const cniContext = createCNIContext(context as unknown as ActionContext, componentRegistry);
    return await runWithContext(cniContext, () =>
      bundledDataSource.perform(cniContext as unknown as DataSourceContext, params),
    );
  };
};

/**
 * A data source copied out of an npm component can name *sibling* data sources on that same
 * component — via `detailDataSource` or an input's `dataSource` — which don't exist on the CNI's
 * own wrapper component. This copies `dataSource` into `hoisted` under `hoistedKey` and does the
 * same, recursively, for every sibling it depends on (keyed `${keyPrefix}_${siblingKey}`, so
 * flows/config vars can't collide), rewriting each reference to the wrapper-owned key.
 */
export const hoistBundledDataSource = ({
  dataSource,
  hoistedKey,
  keyPrefix,
  siblings,
  componentRegistry,
  hoisted,
}: {
  dataSource: AnyDataSource;
  hoistedKey: string;
  keyPrefix: string;
  siblings: Record<string, AnyDataSource>;
  componentRegistry: ComponentRegistry;
  hoisted: Record<string, ServerDataSource>;
}): void => {
  // Reserve the key before recursing so a dependency cycle terminates.
  hoisted[hoistedKey] = { ...dataSource, key: hoistedKey };

  const hoistSibling = (siblingKey: string): string => {
    const sibling = siblings[siblingKey];
    if (!sibling) {
      return siblingKey;
    }
    const siblingHoistedKey = `${keyPrefix}_${siblingKey}`;
    if (!(siblingHoistedKey in hoisted)) {
      hoistBundledDataSource({
        dataSource: sibling,
        hoistedKey: siblingHoistedKey,
        keyPrefix,
        siblings,
        componentRegistry,
        hoisted,
      });
    }
    return siblingHoistedKey;
  };

  hoisted[hoistedKey] = {
    ...dataSource,
    key: hoistedKey,
    perform: createBundledDataSourcePerform(dataSource, componentRegistry),
    inputs: dataSource.inputs.map((input) =>
      input.dataSource ? { ...input, dataSource: hoistSibling(input.dataSource) } : input,
    ),
    ...(dataSource.detailDataSource
      ? { detailDataSource: hoistSibling(dataSource.detailDataSource) }
      : {}),
  };
};
