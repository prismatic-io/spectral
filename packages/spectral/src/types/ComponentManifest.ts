export interface ComponentManifest {
  key: string;
  public: boolean;
  signature: string | null;
  actions: Record<string, ComponentManifestAction>;
  triggers: Record<string, ComponentManifestTrigger>;
  dataSources: Record<string, ComponentManifestDataSource>;
  connections: Record<string, ComponentManifestConnection>;
}

export interface ComponentManifestAction {
  perform: (values: any) => Promise<unknown>;
  inputs: Record<
    string,
    {
      inputType: string;
      collection: "keyvaluelist" | "valuelist" | null;
    }
  >;
}

export interface ComponentManifestTrigger {
  perform: (values: any) => Promise<unknown>;
  inputs: Record<
    string,
    {
      inputType: string;
      collection: "keyvaluelist" | "valuelist" | null;
    }
  >;
}

export interface ComponentManifestDataSource {
  perform: (values: any) => Promise<unknown>;
  inputs: Record<
    string,
    {
      inputType: string;
      collection: "keyvaluelist" | "valuelist" | null;
    }
  >;
}
export interface ComponentManifestConnection {
  perform: (values: any) => Promise<unknown>;
  inputs: Record<
    string,
    {
      inputType: string;
      collection: "keyvaluelist" | "valuelist" | null;
    }
  >;
}
