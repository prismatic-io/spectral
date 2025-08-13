import { Action, Component, DataSource, Trigger } from "../../serverTypes";

export interface ComponentNode {
  id: string;
  label: string;
  description: string;
  signature: string;
  key: string;
  actions: {
    nodes: ActionNode[];
  };
  connections: {
    nodes: ConnectionNode[];
  };
}

export interface ActionNode {
  isDataSource: boolean;
  isDetailDataSource: boolean;
  dataSourceType: string | null;
  isTrigger: boolean;
  isCommonTrigger: boolean;
  key: string;
  label: string;
  description: string;
  inputs: {
    nodes: InputNode[];
  };
  examplePayload: string | null;
}

export interface ConnectionNode {
  key: string;
  label: string;
  comments: string;
  inputs: {
    nodes: InputNode[];
  };
}

export interface InputNode {
  key: string;
  label: string;
  type: string;
  required: boolean;
  default: any;
  collection: string;
  shown: boolean;
  onPremiseControlled: boolean;
}

export type FormattedAction = Pick<Action, "key" | "display" | "inputs">;
export type FormattedTrigger = Pick<Trigger, "key" | "display" | "inputs">;
export type FormattedDataSource = Pick<
  DataSource,
  "key" | "display" | "inputs" | "dataSourceType" | "examplePayload"
>;

export type ComponentForManifest = Pick<Component, "key" | "public" | "display" | "connections"> & {
  actions: Record<string, Action | FormattedAction>;
  triggers: Record<string, Trigger | FormattedTrigger>;
  dataSources: Record<string, DataSource | FormattedDataSource>;
};

export type ComponentActionsQueryResponse = {
  data: {
    data: {
      actions: {
        nodes: Array<ActionNode>;
        pageInfo: { hasNextPage: boolean; endCursor: string };
      };
    };
  };
};
