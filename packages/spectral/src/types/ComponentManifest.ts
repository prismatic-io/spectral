export interface ComponentManifest {
  key: string;
  public: boolean;
  actions: Record<string, ComponentManifestAction>;
  triggers: Record<string, ComponentManifestTrigger>;
  dataSources: Record<string, ComponentManifestDataSource>;
  connections: Record<string, ComponentManifestConnection>;
}

export interface ComponentManifestAction {
  inputs: Record<string, unknown>;
}

export interface ComponentManifestTrigger {
  inputs: Record<string, unknown>;
}

export interface ComponentManifestDataSource {
  inputs: Record<string, unknown>;
}

export interface ComponentManifestConnection {
  inputs: Record<string, unknown>;
}
