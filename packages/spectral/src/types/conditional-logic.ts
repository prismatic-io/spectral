/**
 * This file contains types to help define conditional logic for the Prismatic
 * branch component, https://prismatic.io/docs/components/branch/
 */

/** @ignore */
export enum BooleanOperator {
  and = "and",
  or = "or",
}

export const BooleanOperatorPhrase = Object.keys(BooleanOperator);

export enum UnaryOperator {
  isTrue = "isTrue",
  isFalse = "isFalse",
  doesNotExist = "doesNotExist",
  exists = "exists",
}

export const UnaryOperatorPhrase = {
  [UnaryOperator.isTrue]: "is true",
  [UnaryOperator.isFalse]: "is false",
  [UnaryOperator.doesNotExist]: "does not exist",
  [UnaryOperator.exists]: "exists",
};

export enum BinaryOperator {
  equal = "equal",
  notEqual = "notEqual",
  greaterThan = "greaterThan",
  greaterThanOrEqual = "greaterThanOrEqual",
  lessThan = "lessThan",
  lessThanOrEqual = "lessThanOrEqual",
  in = "in",
  notIn = "notIn",
  exactlyMatches = "exactlyMatches",
  doesNotExactlyMatch = "doesNotExactlyMatch",
  startsWith = "startsWith",
  doesNotStartWith = "doesNotStartWith",
  endsWith = "endsWith",
  doesNotEndWith = "doesNotEndWith",
  dateTimeAfter = "dateTimeAfter",
  dateTimeBefore = "dateTimeBefore",
  dateTimeSame = "dateTimeSame",
}

export const BinaryOperatorPhrase = {
  [BinaryOperator.equal]: "equal",
  [BinaryOperator.notEqual]: "does not equal",
  [BinaryOperator.greaterThan]: "is greater than",
  [BinaryOperator.greaterThanOrEqual]: "is greater than or equal to",
  [BinaryOperator.lessThan]: "is less than",
  [BinaryOperator.lessThanOrEqual]: "is less than or equal to",
  [BinaryOperator.in]: "contained in",
  [BinaryOperator.notIn]: "not contained in",
  [BinaryOperator.exactlyMatches]: "exactly matches",
  [BinaryOperator.doesNotExactlyMatch]: "does not exactly match",
  [BinaryOperator.startsWith]: "starts with",
  [BinaryOperator.doesNotStartWith]: "does not start with",
  [BinaryOperator.endsWith]: "ends with",
  [BinaryOperator.doesNotEndWith]: "does not end with",
  [BinaryOperator.dateTimeAfter]: "is after (date/time)",
  [BinaryOperator.dateTimeBefore]: "is before (date/time)",
  [BinaryOperator.dateTimeSame]: "is the same (date/time)",
};

export type TermOperator = UnaryOperator | BinaryOperator;
export const TermOperatorPhrase = {
  ...UnaryOperatorPhrase,
  ...BinaryOperatorPhrase,
};
export type Term = unknown;
export type TermExpression = [TermOperator, Term, Term?];

export type BooleanExpression = [
  BooleanOperator.and | BooleanOperator.or,
  ...ConditionalExpression[]
];

export type ConditionalExpression = TermExpression | BooleanExpression;
