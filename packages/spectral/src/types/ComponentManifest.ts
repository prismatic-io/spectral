import { CollectionType, InputFieldType } from ".";

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
  perform: (values: any) => Promise<unknown>;
  inputs: Record<string, BaseInput>;
}

export interface ComponentManifestTrigger {
  perform: (values: any) => Promise<unknown>;
  inputs: Record<string, BaseInput>;
}

export interface ComponentManifestDataSource {
  perform: (values: any) => Promise<unknown>;
  inputs: Record<string, BaseInput>;
}
export interface ComponentManifestConnection {
  perform: (values: any) => Promise<unknown>;
  onPremAvailable?: boolean;
  inputs: Record<string, BaseInput & { onPremControlled?: boolean }>;
}
