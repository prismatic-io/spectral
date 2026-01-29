import { describe, expect } from "vitest";
import { test, fc } from "@fast-check/vitest";
import {
  ConditionalExpression,
  BooleanExpression,
  BooleanOperator,
  BinaryOperator,
  UnaryOperator,
  TermOperatorPhrase,
} from "./types";
import { isBefore, isAfter } from "date-fns";

import { evaluate, contains, parseDate } from "./index";

// Look for leading and trailing braces, square brackets, or quotes.
const jsonLikeRegex = new RegExp(/^[[{"].*[\]}"]$/);

const isJsonLike = (value: string): boolean => jsonLikeRegex.test(value.trim());

type DateLike = string | number | Date;

// Handle string and number datetime values
const pastDates = (): fc.Arbitrary<DateLike> =>
  fc.constantFrom(
    "2021-03-20",
    "2021-03-20T12:50:30.105Z",
    1631568050,
    "1631568051",
    new Date("2021-03-20T12:50:30.105Z"),
  );

const futureDates = (): fc.Arbitrary<DateLike> =>
  fc.constantFrom(
    "2030-03-20",
    "2030-03-20T12:50:30.105Z",
    1905784188,
    "1905784189",
    new Date("2030-03-20T12:50:30.105Z"),
  );

const equivalentDates = (): fc.Arbitrary<DateLike> =>
  fc.constantFrom(
    "2021-03-20T00:00:00.000Z",
    "1616198400",
    1616198400,
    new Date("2021-03-20T00:00:00.000Z"),
  );

describe("evaluate", () => {
  const nonIntegerString = fc
    .string()
    // Ignore the JSON.parse edge cases (matching double quotes get stripped etc).
    .filter((v) => !isJsonLike(v))
    .filter((v) => Number.isNaN(Number.parseInt(v)));
  const integerOnlyString = fc.string().filter((v) => !Number.isNaN(Number.parseInt(v)));

  describe("true expressions", () => {
    const simpleTrueExpression = fc.oneof(
      // equal
      fc
        .tuple(fc.integer(), fc.integer())
        .filter(([left, right]) => left === right)
        .map(
          ([left, right]): ConditionalExpression => [
            BinaryOperator.equal,
            left.toString(),
            right.toString(),
          ],
        ),
      // notEqual
      fc
        .tuple(fc.integer(), fc.integer())
        .filter(([left, right]) => left !== right)
        .map(
          ([left, right]): ConditionalExpression => [
            BinaryOperator.notEqual,
            left.toString(),
            right.toString(),
          ],
        ),
      // greaterThan
      fc
        .tuple(fc.integer(), fc.integer())
        .filter(([left, right]) => left > right)
        .map(
          ([left, right]): ConditionalExpression => [
            BinaryOperator.greaterThan,
            left.toString(),
            right.toString(),
          ],
        ),
      // greaterThanEqual
      fc
        .tuple(fc.integer(), fc.integer())
        .filter(([left, right]) => left >= right)
        .map(
          ([left, right]): ConditionalExpression => [
            BinaryOperator.greaterThanOrEqual,
            left.toString(),
            right.toString(),
          ],
        ),
      // lessThan
      fc
        .tuple(fc.integer(), fc.integer())
        .filter(([left, right]) => left < right)
        .map(
          ([left, right]): ConditionalExpression => [
            BinaryOperator.lessThan,
            left.toString(),
            right.toString(),
          ],
        ),
      // lessThanEqual
      fc
        .tuple(fc.integer(), fc.integer())
        .filter(([left, right]) => left <= right)
        .map(
          ([left, right]): ConditionalExpression => [
            BinaryOperator.lessThanOrEqual,
            left.toString(),
            right.toString(),
          ],
        ),
      // in
      fc
        .tuple(nonIntegerString, nonIntegerString)
        // Filter out whitespace only strings.
        .filter(([left]) => left !== left.trim())
        .map(([left, right]) => [left, `${left}${right}`])
        // Need to re-test `right` since it may have become JSON-like.
        .filter(([left, right]) => !isJsonLike(left) && !isJsonLike(right))
        .map(([left, right]): ConditionalExpression => [BinaryOperator.in, left, right]),
      // notIn
      fc
        .tuple(nonIntegerString, nonIntegerString)
        .filter(([left, right]) => !right.includes(left))
        .map(([left, right]): ConditionalExpression => [BinaryOperator.notIn, left, right]),
      // exactlyMatches
      fc
        .tuple(nonIntegerString, nonIntegerString)
        .filter(([left, right]) => right === left)
        .map(
          ([left, right]): ConditionalExpression => [BinaryOperator.exactlyMatches, left, right],
        ),
      // doesNotExactlyMatch
      fc
        .tuple(fc.integer(), integerOnlyString)
        // Our JSON.parse method will convert string numbers into numbers. Avoid asserting against that situation.
        .filter(([left, right]) => `${left}` !== right.trim())
        .map(
          ([left, right]): ConditionalExpression => [
            BinaryOperator.doesNotExactlyMatch,
            left,
            right,
          ],
        ),
      // startsWith
      fc
        .tuple(nonIntegerString, nonIntegerString)
        .filter(([left, right]) => right.startsWith(left))
        .map(([left, right]): ConditionalExpression => [BinaryOperator.startsWith, left, right]),
      // doesNotStartWith
      fc
        .tuple(nonIntegerString, nonIntegerString)
        .filter(([left, right]) => !right.startsWith(left))
        .map(
          ([left, right]): ConditionalExpression => [BinaryOperator.doesNotStartWith, left, right],
        ),
      // endsWith
      fc
        .tuple(nonIntegerString, nonIntegerString)
        .filter(([left, right]) => right.endsWith(left))
        .map(([left, right]): ConditionalExpression => [BinaryOperator.endsWith, left, right]),
      // doesNotEndWith
      fc
        .tuple(nonIntegerString, nonIntegerString)
        .filter(([left, right]) => !right.endsWith(left))
        .map(
          ([left, right]): ConditionalExpression => [BinaryOperator.doesNotEndWith, left, right],
        ),
      // isTrue
      nonIntegerString
        .filter((left) => Boolean(left) === true)
        .filter((left) => !["f", "false", "n", "no"].includes(left.toLowerCase()))
        .map((left): ConditionalExpression => [UnaryOperator.isTrue, left]),
      // isFalse
      fc
        .falsy()
        .filter((left) => Boolean(left) === false)
        .map((left): ConditionalExpression => [UnaryOperator.isFalse, left]),
      // doesNotExist
      fc
        .falsy()
        .map((left): ConditionalExpression => [UnaryOperator.doesNotExist, left]),
      // dateTimeAfter
      fc
        .tuple(fc.date(), fc.date())
        .filter(([left, right]) => isAfter(left, right))
        .map(([left, right]): ConditionalExpression => [BinaryOperator.dateTimeAfter, left, right]),
      fc
        .tuple(futureDates(), pastDates())
        .map(([left, right]): ConditionalExpression => [BinaryOperator.dateTimeAfter, left, right]),
      // dateTimeBefore
      fc
        .tuple(fc.date(), fc.date())
        .filter(([left, right]) => isBefore(left, right))
        .map(
          ([left, right]): ConditionalExpression => [BinaryOperator.dateTimeBefore, left, right],
        ),
      fc
        .tuple(pastDates(), futureDates())
        .map(
          ([left, right]): ConditionalExpression => [BinaryOperator.dateTimeBefore, left, right],
        ),
      // dateTimeSame
      fc
        .date()
        .map((left): ConditionalExpression => [BinaryOperator.dateTimeSame, left, left]),
      fc
        .tuple(equivalentDates(), equivalentDates())
        .map(([left, right]): ConditionalExpression => [BinaryOperator.dateTimeSame, left, right]),
    );

    const simpleFalseExpression = fc
      .tuple(fc.integer(), fc.integer())
      .filter(([left, right]) => left !== right)
      .map(
        ([left, right]): ConditionalExpression => [
          BinaryOperator.equal,
          left.toString(),
          right.toString(),
        ],
      );

    const andTrueExpressions = fc
      .tuple(simpleTrueExpression, simpleTrueExpression, simpleTrueExpression)
      .map((predicates): BooleanExpression => [BooleanOperator.and, ...predicates]);

    const andFalseExpressions = fc
      .tuple(simpleTrueExpression, simpleTrueExpression, simpleFalseExpression)
      .map((predicates): BooleanExpression => [BooleanOperator.and, ...predicates]);

    const orTrueExpressions = fc
      .tuple(simpleFalseExpression, simpleFalseExpression, simpleTrueExpression)
      .map((predicates): BooleanExpression => [BooleanOperator.or, ...predicates]);

    const orFalseExpressions = fc
      .tuple(simpleFalseExpression, simpleFalseExpression, simpleFalseExpression)
      .map((predicates): BooleanExpression => [BooleanOperator.or, ...predicates]);

    const trueExpressions = fc.oneof(simpleTrueExpression, andTrueExpressions, orTrueExpressions);

    const falseExpressions = fc.oneof(
      simpleFalseExpression,
      andFalseExpressions,
      orFalseExpressions,
    );

    test.prop([trueExpressions])("should evaluate expressions", (expression) => {
      expect(evaluate(expression)).toBe(true);
    });

    test.prop([falseExpressions])("should evaluate false expressions", (expression) => {
      expect(evaluate(expression)).toBe(false);
    });

    test("should deep compare equality while attempting to convert types", () => {
      expect(evaluate([BinaryOperator.equal, { a: "" }, { a: false }])).toStrictEqual(true);
    });

    test("should strictly deep compare equality", () => {
      expect(evaluate([BinaryOperator.exactlyMatches, { a: "" }, { a: false }])).toStrictEqual(
        false,
      );
    });

    test("should deep compare inequality while attempting to convert types", () => {
      expect(evaluate([BinaryOperator.notEqual, { a: "" }, { a: false }])).toStrictEqual(false);
    });

    test("should strictly deep compare inequality", () => {
      expect(evaluate([BinaryOperator.doesNotExactlyMatch, { a: "" }, { a: false }])).toStrictEqual(
        true,
      );
    });
  });

  test("evaluate BinaryOperator.in with array of numbers and value that is a number", () => {
    expect(evaluate([BinaryOperator.in, 2, [1, 2, 3]])).toStrictEqual(true);
  });

  test("evaluate BinaryOperator.in with array of numbers and value that is a stringified number", () => {
    expect(evaluate([BinaryOperator.in, "2", [1, 2, 3]])).toStrictEqual(true);
  });

  test("evaluate BinaryOperator.in with array of stringified numbers and value that is a stringified number", () => {
    expect(evaluate([BinaryOperator.in, "2", ["1", "2", "3"]])).toStrictEqual(true);
  });

  test("evaluate BinaryOperator.in with array of numbers including zero and value that is a stringified false", () => {
    expect(evaluate([BinaryOperator.in, "false", [0, 1, 2]])).toStrictEqual(false);
  });

  test("evaluate BinaryOperator.in with array of numbers including zero and value that is a false", () => {
    expect(evaluate([BinaryOperator.in, false, [0, 1, 2]])).toStrictEqual(false);
  });

  // TODO: Add more coverage for false evaluations.
  // describe("false expressions", () => {});

  describe("validate", () => {
    const invalidExpressions = fc.tuple(
      fc.string().filter((v) => !Object.keys(TermOperatorPhrase).includes(v)),
      fc.string(),
      fc.string(),
    );

    test.prop([invalidExpressions])("should throw error on invalid expression", (expression) => {
      expect(() => evaluate(expression as any)).toThrow();
    });

    test("Expect isEmpty to Validate correctly", () => {
      expect(evaluate([UnaryOperator.isEmpty, []])).toStrictEqual(true);
      expect(evaluate([UnaryOperator.isEmpty, ""])).toStrictEqual(true);
      expect(evaluate([UnaryOperator.isEmpty, "abc"])).toStrictEqual(false);
      expect(evaluate([UnaryOperator.isEmpty, ["Hello ", "World"]])).toStrictEqual(false);
    });
  });

  describe("test contains", () => {
    test("test string contains with two strings", () => {
      expect(contains("foo", "oo")).toStrictEqual(true);
    });
    test("test string contains with a numeric string and a number", () => {
      expect(contains("123", 2)).toStrictEqual(true);
    });
    test("test string contains with a non-numeric string a number", () => {
      expect(contains("foo", 2)).toStrictEqual(false);
    });
    test("test array contains when item in array", () => {
      expect(contains([1, 2, 3], 2)).toStrictEqual(true);
    });
    test("test array contains when subarray in array", () => {
      expect(contains([1, 2, 3, [4, 5]], [4, 5])).toStrictEqual(false);
    });
    test("test array contains when item not in array", () => {
      expect(contains([1, 2, 3], 9)).toStrictEqual(false);
    });
    test("test 'array' contains when item in 'set'", () => {
      expect(contains([{ foo: null, bar: null }], { foo: null, bar: null })).toStrictEqual(false);
    });
    test("test 'set' contains when item in 'set'", () => {
      expect(contains({ foo: null, bar: null }, "bar")).toStrictEqual(true);
    });
    test("test 'set' contains when item not in 'set'", () => {
      expect(contains({ foo: null, bar: null }, "baz")).toStrictEqual(false);
    });
    test("test 'set' contains subset", () => {
      expect(contains({ key: { foo: null, bar: null } }, { foo: null, bar: null })).toStrictEqual(
        false,
      );
    });
  });

  describe("parseDate", () => {
    test.each([
      // String formats
      { value: "2018", expected: new Date(2018, 0) },
      { value: "2018-3-6", expected: new Date(2018, 2, 6) },
      { value: "2018-03-06", expected: new Date(2018, 2, 6) },
      {
        value: "2018-03-06T12:36:36",
        expected: new Date(2018, 2, 6, 12, 36, 36, 0),
      },
      {
        value: "2018-03-06T12:36:36Z",
        expected: new Date("2018-03-06T12:36:36Z"),
      },
      // Unix timestamp formats
      { value: 1318781876, expected: new Date("1970-01-16T06:19:41.876Z") }, // seconds
      { value: 1318781876406, expected: new Date("2011-10-16T16:17:56.406Z") }, // milliseconds
      // Arbitrary numbers
      { value: 1, expected: new Date("1970-01-01T00:00:00.001Z") },
    ])("parses types into dates", ({ value, expected }) => {
      const result = parseDate(value);
      expect(result).toStrictEqual(expected);
    });
  });
});
