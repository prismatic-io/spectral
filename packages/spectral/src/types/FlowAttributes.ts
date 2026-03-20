/** Contains attributes of the Flow that is being executed. */
export interface FlowAttributes {
  /** The ID of the currently running flow. */
  id: string;
  /** The name of the currently running flow. */
  name: string;
  /** The stable ID of the currently running flow. */
  stableId?: string;
}
