/**
 * How the flow this execution belongs to dispatches its trigger's items.
 *
 * Discriminated on `enabled` - a flow that is not using batching has no batch
 * size to report.
 */
export type BatchInfo =
  | {
      /** This flow dispatches its trigger's items one execution at a time. */
      enabled: false;
    }
  | {
      /** This flow dispatches its trigger's items as batches. */
      enabled: true;
      /** Items dispatched per batch. */
      batchSize: number;
    };
