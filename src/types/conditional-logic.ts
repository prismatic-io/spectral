/**
 * This file contains types to help define conditional logic for the Prismatic
 * branch component, https://prismatic.io/docs/components/branch
 */

/** @ignore */
enum BooleanOperator {
  and = "and",
  or = "or",
}

export const TermOperatorPhrase = {
  equal: "equals",
  notEqual: "does not equal",
  greaterThan: "is greater than",
  greaterThanOrEqual: "is greater than or equal to",
  lessThan: "is less than",
  lessThanOrEqual: "is less than or equal to",
  in: "contained in",
  notIn: "not contained in",
};

type TermOperator = keyof typeof TermOperatorPhrase;

type Term<T> = T;
type TermExpression<T> = [TermOperator, Term<T>, Term<T>];
type BooleanExpression<T> = [
  BooleanOperator.and | BooleanOperator.or,
  ...ConditionalExpression<T>[]
];

export type ConditionalExpression<T = unknown> =
  | TermExpression<T>
  | BooleanExpression<T>;
