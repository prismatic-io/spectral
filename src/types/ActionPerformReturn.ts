/** Used to represent a binary or serialized data return as content type must be specified */
export interface ActionPerformDataReturn<ReturnData> {
  /** Data payload containing data of the specified contentType */
  data: ReturnData;
  /** The Content Type of the payload data */
  contentType?: string;
  /** The HTTP Status code that will be used if this terminates a synchronous invocation  */
  statusCode?: number;
  /** An optional object, the keys and values of which will be persisted in the instanceState and available for subsequent actions and executions */
  state?: Record<string, unknown>;
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
  AllowsBranching extends boolean,
  ReturnData extends unknown
> =
  | (AllowsBranching extends true
      ? ActionPerformBranchingDataReturn<ReturnData>
      : ActionPerformDataReturn<ReturnData>)
  | void;
