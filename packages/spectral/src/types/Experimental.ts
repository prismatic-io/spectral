/**
 * Root Experimental type exposed for augmentation.
 *
 * The expected interface when augmenting is:
 *
 * ```ts
 * interface Experimental {
 *   [flag: string]: true
 * }
 * ```
 *
 */
export interface Experimental {}

/**
 * Resolves to `TEnabled` when the flag is augmented to `true`.
 *
 * `TDisabled` defaults to `{}`, the identity for intersection, so a gated
 * property is absent rather than optional when the flag is off. Pass it
 * explicitly anywhere the result is not intersected.
 *
 * A misspelled flag in the augmentation stays disabled: an augmented interface
 * is not excess-property checked. A union `TFlag` distributes, yielding both
 * branches.
 */
export type WithExperimentalFlag<
  TFlag extends string,
  TEnabled,
  // biome-ignore lint/complexity/noBannedTypes: identity for intersection, so a gated property is absent rather than optional
  TDisabled = {},
> = TFlag extends keyof Experimental
  ? Experimental[TFlag] extends true
    ? TEnabled
    : TDisabled
  : TDisabled;
