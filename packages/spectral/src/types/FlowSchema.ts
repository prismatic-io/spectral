export interface FlowSchema {
  title: string;
  $comment?: string;
  type: string;
  properties: Record<string, Record<string, unknown>>;
}

export interface FlowSchemas {
  invoke: FlowSchema;
  [key: string]: FlowSchema;
}
