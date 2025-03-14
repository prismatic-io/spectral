import {
  ConditionalExpression,
  BooleanOperator,
  TermExpression,
  UnaryOperator,
  BinaryOperator,
} from "./types";
import { isBefore, isAfter, parse, parseISO, isValid, isEqual as isDateEqual } from "date-fns";
import _isEqualWith from "lodash/isEqualWith";
import _isEqual from "lodash/isEqual";
import util from "../util";

export type ValidationResult = [boolean] | [boolean, string];

export const validate = (expression: ConditionalExpression): ValidationResult => {
  if (!Array.isArray(expression)) {
    return [false, `Invalid expression syntax: '${expression}'`];
  }
  const [operator] = expression;

  if (operator in BooleanOperator) {
    if (operator === BooleanOperator.and || operator === BooleanOperator.or) {
      const [, ...predicates] = expression;

      return predicates.reduce(
        (previous, current) => {
          const [valid, error] = validate(current);

          if (!valid) {
            return [valid, [previous[1], error].filter(Boolean).join(", ")];
          }

          return previous;
        },
        [true] as ValidationResult,
      );
    }

    return [false, `Invalid expression syntax: '${expression}'`];
  } else if (operator in UnaryOperator || operator in BinaryOperator) {
    return [true];
  }

  return [false, `Invalid expression syntax: '${expression}'`];
};

/** Convert stringified objects/values back to their native value, all other
 *  values just pass through unaltered. */
export const parseValue = (value: unknown) => {
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return value;
  }
};

export const contains = (container: unknown, containee: unknown): boolean => {
  if (typeof container === "string") {
    // Substring check.
    // NOTE: JS is real fast and loose with types here, happily returning true
    // for things like "123".includes(1), but we have to lie to TS.
    return container.includes(`${containee}`);
  }
  if (typeof container === "object" && container !== null) {
    if (Array.isArray(container)) {
      // Array member check.
      return container.includes(containee) || container.includes(parseValue(containee));
    }
    // Object attribute check (set membership).
    return Object.prototype.hasOwnProperty.call(container, `${containee}`);
  }

  throw new Error("Invalid arguments set to 'contains'.");
};

export const parseDate = (value: unknown): Date => {
  if (value instanceof Date && isValid(value)) {
    return value;
  }

  if (typeof value === "number") {
    return new Date(value);
  }

  if (typeof value === "string") {
    const dateFormats = ["yyyy", "yyyy-MM-dd"];
    for (const format of dateFormats) {
      const parsed = parse(value, format, 0);
      if (isValid(parsed)) {
        return parsed;
      }
    }

    const isoParsed = parseISO(value);
    if (isValid(isoParsed)) {
      return isoParsed;
    }
  }

  throw new Error("Invalid argument type");
};

export const isEqual = (left: unknown, right: unknown): boolean =>
  left == right ||
  _isEqualWith(left, right, (objectA, objectB) => {
    if (typeof objectA === "object" || typeof objectB === "object") {
      /**
       * `undefined` will fall back to the default isEqual behavior.
       * @see -> (https://lodash.com/docs/4.17.15#isEqualWith)
       */
      return undefined;
    }

    return objectA == objectB;
  });

export const isDeepEqual = (left: unknown, right: unknown): boolean => {
  return _isEqual(left, right);
};

export const evaluatesTrue = (value: string | boolean): boolean => {
  return typeof value === "string" ? ["t", "true", "y", "yes"].includes(value) : value;
};

export const evaluatesFalse = (value: string | boolean): boolean => {
  return typeof value === "string" ? ["f", "false", "n", "no"].includes(value) : value;
};

export const evaluatesNull = (value: unknown): boolean => {
  const nullValues: Array<unknown> = [undefined, null, 0, Number.NaN, false, ""];
  return nullValues.includes(value);
};

export const evaluatesEmpty = (value: string | Array<unknown>): boolean => {
  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === "string") {
    return value.length === 0;
  }

  throw new Error("Please provide an array or string");
};

export const evaluatesNotEmpty = (value: string | Array<unknown>): boolean => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "string") {
    return value.length > 0;
  }

  throw new Error("Please provide an array or string");
};

export const dateIsAfter = (left: unknown, right: unknown): boolean => {
  return isAfter(util.types.toDate(left), util.types.toDate(right));
};

export const dateIsBefore = (left: unknown, right: unknown): boolean => {
  return isBefore(util.types.toDate(left), util.types.toDate(right));
};

export const dateIsEqual = (left: unknown, right: unknown): boolean => {
  return isDateEqual(util.types.toDate(left), util.types.toDate(right));
};

export const evaluate = (expression: ConditionalExpression): boolean => {
  const [valid, message] = validate(expression);
  if (!valid) {
    throw new Error(message);
  }

  const [operator] = expression;

  if (operator in BooleanOperator) {
    const predicates = expression.slice(1) as ConditionalExpression[];

    switch (operator) {
      case BooleanOperator.and:
        for (const predicate of predicates) {
          if (!evaluate(predicate)) return false;
        }
        return true;
      case BooleanOperator.or:
        for (const predicate of predicates) {
          if (evaluate(predicate)) return true;
        }
        return false;
      default:
        throw new Error(`Invalid operator: '${operator}'`);
    }
  } else if (operator in UnaryOperator) {
    const [, leftTerm] = expression as TermExpression;
    const left = parseValue(leftTerm);
    // attempt to compare
    try {
      switch (operator) {
        case UnaryOperator.isTrue:
          if (typeof left === "string") {
            const lowerValue = left.toLowerCase();
            if (evaluatesTrue(lowerValue)) {
              return true;
            } else if (evaluatesFalse(lowerValue)) {
              return false;
            }
          }
          return !!left;
        case UnaryOperator.isFalse:
          if (typeof left === "string") {
            const lowerValue = left.toLowerCase();
            if (evaluatesTrue(lowerValue)) {
              return false;
            } else if (evaluatesFalse(lowerValue)) {
              return true;
            }
          }
          return !left;
        case UnaryOperator.doesNotExist:
          return evaluatesNull(left);
        case UnaryOperator.exists:
          return !evaluatesNull(left);
        case UnaryOperator.isEmpty:
          if (Array.isArray(left)) {
            return evaluatesEmpty(left);
          }

          // leftTerm is used here, since "123" would be cast to 123 and would not be a string
          if (typeof leftTerm === "string") {
            return evaluatesEmpty(leftTerm);
          }

          throw new Error("Please provide an array or string");
        case UnaryOperator.isNotEmpty:
          if (Array.isArray(left)) {
            return left.length > 0;
          }
          if (typeof leftTerm === "string") {
            return leftTerm.length > 0;
          }
          throw new Error("Please provide an array or string");
        default:
          throw new Error(`Invalid operator: '${operator}'`);
      }
    } catch (error) {
      throw new Error(`Incompatible comparison arguments, ${error}`);
    }
  } else {
    const [, leftTerm, rightTerm] = expression as TermExpression;
    let left: any = null;
    let right: any = null;
    // attempt to convert numeric, array, or object strings as json to native objects,
    // otherwise fall back to original value
    if (
      operator in
      [BinaryOperator.dateTimeAfter, BinaryOperator.dateTimeBefore, BinaryOperator.dateTimeSame]
    ) {
      left = parseDate(leftTerm);
      right = parseDate(rightTerm);
    } else {
      left = parseValue(leftTerm);
      right = parseValue(rightTerm);
    }

    // attempt to compare
    try {
      switch (operator) {
        case BinaryOperator.equal:
          return isEqual(left, right);
        case BinaryOperator.notEqual:
          return !isEqual(left, right);
        case BinaryOperator.greaterThan:
          return left > right;
        case BinaryOperator.greaterThanOrEqual:
          return left >= right;
        case BinaryOperator.lessThan:
          return left < right;
        case BinaryOperator.lessThanOrEqual:
          return left <= right;
        case BinaryOperator.in:
          return contains(right, leftTerm);
        case BinaryOperator.notIn:
          return !contains(right, leftTerm);
        case BinaryOperator.exactlyMatches:
          return left === right || isDeepEqual(left, right);
        case BinaryOperator.doesNotExactlyMatch:
          return !(left === right || isDeepEqual(left, right));
        case BinaryOperator.startsWith:
          return `${right}`.startsWith(`${left}`);
        case BinaryOperator.doesNotStartWith:
          return !`${right}`.startsWith(`${left}`);
        case BinaryOperator.endsWith:
          return `${right}`.endsWith(`${left}`);
        case BinaryOperator.doesNotEndWith:
          return !`${right}`.endsWith(`${left}`);
        case BinaryOperator.dateTimeAfter:
          return dateIsAfter(util.types.toDate(left), util.types.toDate(right));
        case BinaryOperator.dateTimeBefore:
          return dateIsBefore(util.types.toDate(left), util.types.toDate(right));
        case BinaryOperator.dateTimeSame:
          return dateIsEqual(util.types.toDate(left), util.types.toDate(right));
        default:
          throw new Error(`Invalid operator: '${operator}'`);
      }
    } catch (error) {
      throw new Error(`Incompatible comparison arguments, ${error}`);
    }
  }
};

export * from "./types";
