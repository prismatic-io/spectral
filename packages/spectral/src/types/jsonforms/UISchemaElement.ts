/**
 * Common base interface for any UI schema element.
 */
export interface UISchemaElement {
  /**
   * The type of this UI schema element.
   */
  type: string;
  /**
   * An optional rule.
   */
  rule?: Rule;
  /**
   * Any additional options.
   */
  options?: {
    [key: string]: any;
  };
}

/**
 * A rule that may be attached to any UI schema element.
 */
interface Rule {
  /**
   * The effect of the rule
   */
  effect: RuleEffect;
  /**
   * The condition of the rule that must evaluate to true in order
   * to trigger the effect.
   */
  condition: Condition;
}

/**
 * The different rule effects.
 */
enum RuleEffect {
  /**
   * Effect that hides the associated element.
   */
  HIDE = "HIDE",
  /**
   * Effect that shows the associated element.
   */
  SHOW = "SHOW",
  /**
   * Effect that enables the associated element.
   */
  ENABLE = "ENABLE",
  /**
   * Effect that disables the associated element.
   */
  DISABLE = "DISABLE",
}

/**
 * Represents a condition to be evaluated.
 */
interface Condition {
  /**
   * The type of condition.
   */
  readonly type?: string;
}
