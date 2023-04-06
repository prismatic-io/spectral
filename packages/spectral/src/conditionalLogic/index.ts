import {
  ConditionalExpression,
  BooleanOperator,
  TermExpression,
  BooleanExpression,
  UnaryOperator,
  BinaryOperator,
} from "./types";
import dayjs from "dayjs";
import _ from "lodash";

export type ValidationResult = [boolean] | [boolean, string];

export const validate = (
  expression: ConditionalExpression
): ValidationResult => {
  if (!(expression instanceof Array)) {
    return [false, `Invalid expression syntax: '${expression}'`];
  }
  const [operator] = expression;

  if (operator in BooleanOperator) {
    if (operator === BooleanOperator.and || operator === BooleanOperator.or) {
      const [, ...predicates] = expression as BooleanExpression;

      return predicates.reduce(
        (previous, current) => {
          const [valid, error] = validate(current);

          if (!valid) {
            return [valid, [previous[1], error].filter(Boolean).join(", ")];
          }

          return previous;
        },
        [true] as ValidationResult
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
      return container.includes(containee);
    }
    // Object attribute check (set membership).
    return Object.prototype.hasOwnProperty.call(container, containee);
  }

  throw new Error("Invalid arguments set to 'contains'.");
};

const parseDateTimeValue = (
  value: string | number | Date,
  parsingOptions: string[]
) => {
  const parsed = dayjs(value, parsingOptions);
  if (!parsed.isValid()) {
    throw new Error("Unable to parse argument");
  }
  return parsed;
};

export const parseDateTime = (value: unknown) => {
  let options: string[] = ["YYYY", "YYYY-MM-DD", "YYYY-MM-DDTHH:mm:ssZ[Z]"];
  if (typeof value === "number") {
    options = ["x", "X"];
    return parseDateTimeValue(value, options);
  } else if (value instanceof Date || typeof value === "string") {
    return parseDateTimeValue(value, options);
  } else {
    throw new Error("Invalid argument type");
  }
};

const isEqual = (left, right) =>
  left == right ||
  _.isEqualWith(left, right, (objectA, objectB) => {
    if (typeof objectA === "object" || typeof objectB === "object") {
      /**
       * `undefined` will fall back to the default isEqual behavior.
       * @see -> (https://lodash.com/docs/4.17.15#isEqualWith)
       */
      return undefined;
    }

    return objectA == objectB;
  });

export const evaluate = (expression: ConditionalExpression): boolean => {
  const [valid, message] = validate(expression);
  if (!valid) {
    throw new Error(message);
  }

  const [operator] = expression;

  if (operator in BooleanOperator) {
    const predicates = expression.slice(1) as ConditionalExpression[];
    const results = predicates.map(evaluate);

    switch (operator) {
      case BooleanOperator.and:
        return results.reduce((previous, current) => previous && current, true);
      case BooleanOperator.or:
        return results.reduce(
          (previous, current) => previous || current,
          false
        );
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
            if (["t", "true", "y", "yes"].includes(lowerValue)) {
              return true;
            } else if (["f", "false", "n", "no"].includes(lowerValue)) {
              return false;
            }
          }
          return !!left;
        case UnaryOperator.isFalse:
          if (typeof left === "string") {
            const lowerValue = left.toLowerCase();
            if (["t", "true", "y", "yes"].includes(lowerValue)) {
              return false;
            } else if (["f", "false", "n", "no"].includes(lowerValue)) {
              return true;
            }
          }
          return !left;
        case UnaryOperator.doesNotExist:
          return [undefined, null, 0, NaN, false, ""].includes(left);
        case UnaryOperator.exists:
          return ![undefined, null, 0, NaN, false, ""].includes(left);
        case UnaryOperator.isEmpty:
          if (Array.isArray(left)) {
            return left.length === 0;
          }
          // leftTerm is used here, since "123" would be cast to 123 and would not be a string
          if (typeof leftTerm === "string") {
            return leftTerm.length === 0;
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
      [
        BinaryOperator.dateTimeAfter,
        BinaryOperator.dateTimeBefore,
        BinaryOperator.dateTimeSame,
      ]
    ) {
      left = parseDateTime(leftTerm);
      right = parseDateTime(rightTerm);
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
          return contains(right, left);
        case BinaryOperator.notIn:
          return !contains(right, left);
        case BinaryOperator.exactlyMatches:
          return left === right || _.isEqual(left, right);
        case BinaryOperator.doesNotExactlyMatch:
          return !(left === right || _.isEqual(left, right));
        case BinaryOperator.startsWith:
          return right.toString().startsWith(left.toString());
        case BinaryOperator.doesNotStartWith:
          return !right.toString().startsWith(left.toString());
        case BinaryOperator.endsWith:
          return right.toString().endsWith(left.toString());
        case BinaryOperator.doesNotEndWith:
          return !right.toString().endsWith(left.toString());
        case BinaryOperator.dateTimeAfter:
          return dayjs(left).isAfter(dayjs(right));
        case BinaryOperator.dateTimeBefore:
          return dayjs(left).isBefore(dayjs(right));
        case BinaryOperator.dateTimeSame:
          return dayjs(left).isSame(dayjs(right));
        default:
          throw new Error(`Invalid operator: '${operator}'`);
      }
    } catch (error) {
      throw new Error(`Incompatible comparison arguments, ${error}`);
    }
  }
};

export * from "./types";
