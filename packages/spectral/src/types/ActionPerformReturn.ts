/** Used to represent a binary or serialized data return as content type must be specified */
export interface ActionPerformDataReturn<ReturnData> {
  /** Data payload containing data of the specified contentType */
  data: ReturnData;
  /** The Content Type of the payload data */
  contentType?: string;
  /** The HTTP Status code that will be used if this terminates a synchronous invocation  */
  statusCode?: number;
  /** The HTTP headers that will be sent back if this terminates a synchronous invocation */
  headers?: Record<string, string>;
  /** An optional object, the keys and values of which will be persisted in the flow-specific instanceState and available for subsequent actions and executions */
  instanceState?: Record<string, unknown>;
  /** An optional object, the keys and values of which will be persisted in the crossFlowState and available in any flow for subsequent actions and executions */
  crossFlowState?: Record<string, unknown>;
  /** An optional object, the keys and values of which will be persisted in the executionState and available for the duration of the execution */
  executionState?: Record<string, unknown>;
  /** An optional object, the keys and values of which will be persisted in the integrationState and available in any flow of an Instance for any version of an Integration for subsequent actions and executions */
  integrationState?: Record<string, unknown>;
  /** A field populated by the Prismatic platform which indicates whether the action failed with an error during execution. */
  failed?: boolean;
  /** A field populated by the Prismatic platform which may refer to an object that contains data about any error that resulted in failure. */
  error?: Record<string, unknown>;
}

/** Used to represent a branching return of conventional data and does not require content type to be specified */

/** Used to represent a binary or serialized data branching return as content type must be specified */
export interface ActionPerformBranchingDataReturn<ReturnData>
  extends ActionPerformDataReturn<ReturnData> {
  /** Name of the Branch to take. */
  branch: string;
}

/** Required return type of all action perform functions */
export type ActionPerformReturn<
  AllowsBranching extends boolean | undefined,
  ReturnData
> =
  | (AllowsBranching extends true
      ? ActionPerformBranchingDataReturn<ReturnData>
      : ActionPerformDataReturn<ReturnData>)
  | undefined;
