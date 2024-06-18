export interface ComponentManifest {
  key: string;
  public: boolean;
  actions: Record<string, ComponentManifestAction>;
  triggers: Record<string, ComponentManifestTrigger>;
  dataSources: Record<string, ComponentManifestDataSource>;
  connections: Record<string, ComponentManifestConnection>;
}

export type ComponentManifestAction = (values: any) => Promise<unknown>;

export type ComponentManifestTrigger = (values: any) => Promise<unknown>;

export type ComponentManifestDataSource = (values: any) => Promise<unknown>;

export type ComponentManifestConnection = (values: any) => Promise<unknown>;
