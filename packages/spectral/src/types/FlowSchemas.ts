interface FlowSchemaProperty {
  description: string;
  type: string;
}

export const DEFAULT_JSON_SCHEMA_VERSION = "https://json-schema.org/draft/2020-12/schema";

/** Flow definition schemas require fewer fields than the actual FlowSchema
 *  type, since they can be populated in the convert layer. */
export type FlowDefinitionFlowSchema = {
  title?: string;
  description?: string;
  properties: Record<string, FlowSchemaProperty>;
  jsonSchemaVersion?: string;
};

export interface FlowSchema {
  title: string;
  $comment?: string;
  $schema: string;
  type: string;
  properties: Record<string, FlowSchemaProperty>;
}

export interface FlowSchemas {
  [key: string]: {
    invoke: FlowSchema;
    [key: string]: FlowSchema;
  };
}
