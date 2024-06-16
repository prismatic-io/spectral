export interface ComponentManifest {
  key: string;
  public: boolean;
  actions: Record<string, ComponentManifestAction>;
  triggers: Record<string, ComponentManifestTrigger>;
  dataSources: Record<string, ComponentManifestDataSource>;
  connections: Record<string, ComponentManifestConnection>;
}

export type ComponentManifestAction = <TValues extends Record<string, unknown>>(
  values: TValues
) => Promise<unknown>;

export type ComponentManifestTrigger = <
  TValues extends Record<string, unknown>
>(
  values: TValues
) => Promise<unknown>;

export type ComponentManifestDataSource = <
  TValues extends Record<string, unknown>
>(
  values: TValues
) => Promise<unknown>;

export type ComponentManifestConnection = <
  TValues extends Record<string, unknown>
>(
  values: TValues
) => Promise<unknown>;
