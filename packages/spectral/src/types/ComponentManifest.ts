import type { ExperimentalPerformSupport } from "./ActionDefinition";
import type { CollectionType } from "./ConfigVars";
import type { DataSourceType } from "./DataSourceResult";
import type { InputFieldType } from "./Inputs";
import type { OutputSchema } from "./OutputSchema";

export interface ComponentManifest {
  key: string;
  public: boolean;
  signature: string | null;
  actions: Record<string, ComponentManifestAction>;
  triggers: Record<string, ComponentManifestTrigger>;
  dataSources: Record<string, ComponentManifestDataSource>;
  connections: Record<string, ComponentManifestConnection>;
}

interface BaseInput {
  inputType: InputFieldType;
  collection?: CollectionType | undefined;
  required?: boolean;
  default?: unknown;
}

export interface ComponentManifestAction {
  key?: string;
  perform: (values: any) => Promise<unknown>;
  /**
   * Present only on manifests whose source carries an example perform. The generated
   * manifest does not synthesize a delegating stub for it (there is no runtime
   * `context.components` channel to delegate to, unlike `perform`); the example perform
   * is invoked via the published server action. The `*Support` flags are the part the
   * frontend reads from the manifest.
   */
  experimentalExamplePerform?: (values: any) => Promise<unknown>;
  experimentalExamplePerformSupport?: ExperimentalPerformSupport;
  experimentalPerformSupport?: ExperimentalPerformSupport;
  inputs: Record<string, BaseInput>;
  examplePayload?: unknown;
  /** Declares the shape of this action's output `data` as a JSON Schema (discriminated union: actionOutput | branchingOutput). */
  outputSchema?: OutputSchema;
}

export interface ComponentManifestTrigger {
  key?: string;
  perform: (values: any) => Promise<unknown>;
  inputs: Record<string, BaseInput>;
}

export interface ComponentManifestDataSource {
  key?: string;
  perform: (values: any) => Promise<unknown>;
  dataSourceType: DataSourceType;
  inputs: Record<string, BaseInput>;
}

export interface ComponentManifestConnection {
  key?: string;
  perform: (values: any) => Promise<unknown>;
  onPremAvailable?: boolean;
  inputs: Record<string, BaseInput & { onPremControlled?: boolean }>;
}
