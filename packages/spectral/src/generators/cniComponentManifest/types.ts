import type { Action, Component, DataSource, Trigger, TriggerPayload } from "../../serverTypes";
import type { ConfigVarResultCollection, Inputs } from "../../types";
import type { TriggerResult } from "../../types/TriggerResult";

export interface ComponentNode {
  id: string;
  label: string;
  description: string;
  signature: string;
  key: string;
  public: boolean;
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

export type FormattedAction = Pick<
  Action,
  | "key"
  | "display"
  | "inputs"
  | "examplePayload"
  | "experimentalExamplePerformSupport"
  | "experimentalPerformSupport"
> & {
  /** Emitted verbatim into the generated manifest; shape mirrors `examplePayload`. */
  outputSchema?: unknown;
};
export type FormattedTrigger<
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload> = TriggerResult<
    TAllowsBranching,
    TPayload
  >,
> = Pick<
  Trigger<TInputs, TActionInputs, TConfigVars, TPayload, TAllowsBranching, TResult>,
  "key" | "display" | "inputs"
>;
export type FormattedDataSource = Pick<
  DataSource,
  "key" | "display" | "inputs" | "dataSourceType" | "examplePayload"
>;

export type ComponentForManifest<
  TInputs extends Inputs,
  TActionInputs extends Inputs,
  TConfigVars extends ConfigVarResultCollection = ConfigVarResultCollection,
  TPayload extends TriggerPayload = TriggerPayload,
  TAllowsBranching extends boolean = boolean,
  TResult extends TriggerResult<TAllowsBranching, TPayload> = TriggerResult<
    TAllowsBranching,
    TPayload
  >,
> = Pick<
  Component<TInputs, TActionInputs, TConfigVars, TPayload, TAllowsBranching, TResult>,
  "key" | "public" | "display" | "connections"
> & {
  actions: Record<string, Action | FormattedAction>;
  triggers: Record<
    string,
    | Trigger<TInputs, TActionInputs, TConfigVars, TPayload, TAllowsBranching, TResult>
    | FormattedTrigger<TInputs, TActionInputs, TConfigVars, TPayload, TAllowsBranching, TResult>
  >;
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
