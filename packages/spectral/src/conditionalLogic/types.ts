// GraphQL-derived enums use the same name as the constant for the value,
// but depending on how things shake out, we may be able to combine with the phrases below.
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
  isEmpty = "isEmpty",
  isNotEmpty = "isNotEmpty",
}

export const UnaryOperatorPhrase = {
  [UnaryOperator.isTrue]: "is true",
  [UnaryOperator.isFalse]: "is false",
  [UnaryOperator.doesNotExist]: "does not exist",
  [UnaryOperator.exists]: "exists",
  [UnaryOperator.isEmpty]: "is empty",
  [UnaryOperator.isNotEmpty]: "is not empty",
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
  [BinaryOperator.equal]: "equals",
  [BinaryOperator.exactlyMatches]: "exactly matches",
  [BinaryOperator.notEqual]: "does not equal",
  [BinaryOperator.doesNotExactlyMatch]: "does not exactly match",
  [BinaryOperator.greaterThan]: "is greater than",
  [BinaryOperator.greaterThanOrEqual]: "is greater than or equal to",
  [BinaryOperator.lessThan]: "is less than",
  [BinaryOperator.lessThanOrEqual]: "is less than or equal to",
  [BinaryOperator.in]: "contained in",
  [BinaryOperator.notIn]: "not contained in",
  [BinaryOperator.startsWith]: "starts the string",
  [BinaryOperator.doesNotStartWith]: "does not start the string",
  [BinaryOperator.endsWith]: "ends the string",
  [BinaryOperator.doesNotEndWith]: "does not end the string",
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
  ...ConditionalExpression[],
];

export type ConditionalExpression = TermExpression | BooleanExpression;

export const OPERATOR_PHRASE_TO_EXPRESSION: {
  [clause: string]: {
    expression: string;
    includes?: Array<string>;
  };
} = {
  [BinaryOperator.equal]: {
    expression: "isEqual($LEFT_TERM, $RIGHT_TERM)",
    includes: ["isEqual"],
  },
  [BinaryOperator.exactlyMatches]: {
    expression: "$LEFT_TERM === $RIGHT_TERM || isDeepEqual($LEFT_TERM, $RIGHT_TERM)",
    includes: ["isDeepEqual"],
  },
  [BinaryOperator.notEqual]: {
    expression: "!(isEqual($LEFT_TERM, $RIGHT_TERM))",
    includes: ["isEqual"],
  },
  [BinaryOperator.doesNotExactlyMatch]: {
    expression: "!($LEFT_TERM === $RIGHT_TERM || isDeepEqual($LEFT_TERM, $RIGHT_TERM))",
    includes: ["isDeepEqual"],
  },
  [BinaryOperator.greaterThan]: {
    expression: "$LEFT_TERM > $RIGHT_TERM",
  },
  [BinaryOperator.greaterThanOrEqual]: {
    expression: "$LEFT_TERM >= $RIGHT_TERM",
  },
  [BinaryOperator.lessThan]: {
    expression: "$LEFT_TERM < $RIGHT_TERM",
  },
  [BinaryOperator.lessThanOrEqual]: {
    expression: "$LEFT_TERM <= $RIGHT_TERM",
  },
  [BinaryOperator.in]: {
    expression: "contains($RIGHT_TERM, $LEFT_TERM)",
    includes: ["contains"],
  },
  [BinaryOperator.notIn]: {
    expression: "!contains($RIGHT_TERM, $LEFT_TERM)",
    includes: ["contains"],
  },
  [BinaryOperator.startsWith]: {
    expression: "$RIGHT_TERM.startsWith($LEFT_TERM)",
  },
  [BinaryOperator.doesNotStartWith]: {
    expression: "!$RIGHT_TERM.startsWith($LEFT_TERM)",
  },
  [BinaryOperator.endsWith]: {
    expression: "$RIGHT_TERM.endsWith($LEFT_TERM)",
  },
  [BinaryOperator.doesNotEndWith]: {
    expression: "!$RIGHT_TERM.endsWith($LEFT_TERM)",
  },
  [BinaryOperator.dateTimeAfter]: {
    expression: "dateIsAfter($LEFT_TERM, $RIGHT_TERM)",
    includes: ["dateIsAfter"],
  },
  [BinaryOperator.dateTimeBefore]: {
    expression: "dateIsBefore($LEFT_TERM, $RIGHT_TERM)",
    includes: ["dateIsBefore"],
  },
  [BinaryOperator.dateTimeSame]: {
    expression: "dateIsEqual($LEFT_TERM, $RIGHT_TERM)",
    includes: ["dateIsEqual"],
  },
  [BooleanOperator.and]: {
    expression: "$LEFT_TERM && $RIGHT_TERM",
  },
  [BooleanOperator.or]: {
    expression: "$LEFT_TERM || $RIGHT_TERM",
  },
  [UnaryOperator.isTrue]: {
    expression: "evaluatesTrue($LEFT_TERM)",
    includes: ["evaluatesTrue"],
  },
  [UnaryOperator.isFalse]: {
    expression: "evaluatesFalse($LEFT_TERM)",
    includes: ["evaluatesFalse"],
  },
  [UnaryOperator.doesNotExist]: {
    expression: "evaluatesNull($LEFT_TERM)",
    includes: ["evaluatesNull"],
  },
  [UnaryOperator.exists]: {
    expression: "!evaluatesNull($LEFT_TERM)",
    includes: ["evaluatesNull"],
  },
  [UnaryOperator.isEmpty]: {
    expression: "evaluatesEmpty($LEFT_TERM)",
    includes: ["evaluatesEmpty"],
  },
  [UnaryOperator.isNotEmpty]: {
    expression: "!evaluatesNull($LEFT_TERM)",
    includes: ["evaluatesNull"],
  },
};
