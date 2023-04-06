import fc from "fast-check";
import {
  ConditionalExpression,
  BooleanExpression,
  BooleanOperator,
  BinaryOperator,
  UnaryOperator,
  TermOperatorPhrase,
} from "./types";
import dayjs from "dayjs";

import { evaluate, contains } from "./index";

// Look for leading and trailing braces, square brackets, or quotes.
const jsonLikeRegex = new RegExp(/^[[{"].*[\]}"]$/);

const isJsonLike = (value: string): boolean => jsonLikeRegex.test(value.trim());

describe("evaluate", () => {
  const nonIntegerString = fc
    .string()
    // Ignore the JSON.parse edge cases (matching double quotes get stripped etc).
    .filter((v) => !isJsonLike(v))
    .filter((v) => Number.isNaN(Number.parseInt(v)));
  const integerOnlyString = fc
    .string()
    .filter((v) => !Number.isNaN(Number.parseInt(v)));

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
          ]
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
          ]
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
          ]
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
          ]
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
          ]
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
          ]
        ),
      // in
      fc
        .tuple(nonIntegerString, nonIntegerString)
        // Filter out whitespace only strings.
        .filter(([left]) => left !== left.trim())
        .map(([left, right]) => [left, `${left}${right}`])
        // Need to re-test `right` since it may have become JSON-like.
        .filter(([left, right]) => !isJsonLike(left) && !isJsonLike(right))
        .map(
          ([left, right]): ConditionalExpression => [
            BinaryOperator.in,
            left,
            right,
          ]
        ),
      // notIn
      fc
        .tuple(nonIntegerString, nonIntegerString)
        .filter(([left, right]) => !right.includes(left))
        .map(
          ([left, right]): ConditionalExpression => [
            BinaryOperator.notIn,
            left,
            right,
          ]
        ),
      // exactlyMatches
      fc
        .tuple(nonIntegerString, nonIntegerString)
        .filter(([left, right]) => right === left)
        .map(
          ([left, right]): ConditionalExpression => [
            BinaryOperator.exactlyMatches,
            left,
            right,
          ]
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
          ]
        ),
      fc
        .tuple(nonIntegerString, nonIntegerString)
        .filter(([left, right]) => right.startsWith(left))
        .map(
          ([left, right]): ConditionalExpression => [
            BinaryOperator.startsWith,
            left,
            right,
          ]
        ),
      fc
        .tuple(nonIntegerString, nonIntegerString)
        .filter(([left, right]) => !right.startsWith(left))
        .map(
          ([left, right]): ConditionalExpression => [
            BinaryOperator.doesNotStartWith,
            left,
            right,
          ]
        ),
      fc
        .tuple(nonIntegerString, nonIntegerString)
        .filter(([left, right]) => right.endsWith(left))
        .map(
          ([left, right]): ConditionalExpression => [
            BinaryOperator.endsWith,
            left,
            right,
          ]
        ),
      fc
        .tuple(nonIntegerString, nonIntegerString)
        .filter(([left, right]) => !right.endsWith(left))
        .map(
          ([left, right]): ConditionalExpression => [
            BinaryOperator.doesNotEndWith,
            left,
            right,
          ]
        ),
      nonIntegerString
        .filter((left) => Boolean(left) === true)
        .filter(
          (left) => !["f", "false", "n", "no"].includes(left.toLowerCase())
        )
        .map((left): ConditionalExpression => [UnaryOperator.isTrue, left]),
      fc
        .falsy()
        .filter((left) => Boolean(left) === false)
        .map((left): ConditionalExpression => [UnaryOperator.isFalse, left]),
      fc
        .falsy()
        .map(
          (left): ConditionalExpression => [UnaryOperator.doesNotExist, left]
        ),
      fc
        .tuple(fc.date(), fc.date())
        .filter(([left, right]) => dayjs(left).isAfter(dayjs(right)))
        .map(
          ([left, right]): ConditionalExpression => [
            BinaryOperator.dateTimeAfter,
            left,
            right,
          ]
        ),
      fc
        .tuple(fc.date(), fc.date())
        .filter(([left, right]) => dayjs(left).isBefore(dayjs(right)))
        .map(
          ([left, right]): ConditionalExpression => [
            BinaryOperator.dateTimeBefore,
            left,
            right,
          ]
        ),
      fc
        .date()
        .map(
          (left): ConditionalExpression => [
            BinaryOperator.dateTimeSame,
            left,
            left,
          ]
        )
    );

    const andExpressions = fc
      .tuple(simpleTrueExpression, simpleTrueExpression)
      .map(
        ([left, right]): BooleanExpression => [BooleanOperator.and, left, right]
      );

    const orExpressions = fc
      .tuple(simpleTrueExpression, simpleTrueExpression)
      .map(
        ([left, right]): BooleanExpression => [BooleanOperator.or, left, right]
      );

    const trueExpressions = fc.oneof(
      simpleTrueExpression,
      andExpressions,
      orExpressions
    );

    it("should evaluate expressions", () => {
      fc.assert(
        fc.property(trueExpressions, (expression) =>
          expect(evaluate(expression)).toStrictEqual(true)
        )
      );
    });

    it("should deep compare equality while attempting to convert types", () => {
      expect(
        evaluate([BinaryOperator.equal, { a: "" }, { a: false }])
      ).toStrictEqual(true);
    });

    it("should strictly deep compare equality", () => {
      expect(
        evaluate([BinaryOperator.exactlyMatches, { a: "" }, { a: false }])
      ).toStrictEqual(false);
    });

    it("should deep compare inequality while attempting to convert types", () => {
      expect(
        evaluate([BinaryOperator.notEqual, { a: "" }, { a: false }])
      ).toStrictEqual(false);
    });

    it("should strictly deep compare inequality", () => {
      expect(
        evaluate([BinaryOperator.doesNotExactlyMatch, { a: "" }, { a: false }])
      ).toStrictEqual(true);
    });
  });

  // TODO: Add more coverage for false evaluations.
  // describe("false expressions", () => {});

  describe("validate", () => {
    const invalidExpressions = fc.tuple(
      fc.string().filter((v) => !Object.keys(TermOperatorPhrase).includes(v)),
      fc.string(),
      fc.string()
    );

    it("should throw error on invalid expression", () => {
      fc.assert(
        fc.property(invalidExpressions, (expression) =>
          expect(() => evaluate(expression as any)).toThrow()
        )
      );
    });

    it("Expect isEmpty to Validate correctly", () => {
      fc.assert(
        fc.property(invalidExpressions, () => {
          const res = evaluate([UnaryOperator.isEmpty, []]);
          expect(res).toBe(true);
        })
      );
      expect(evaluate([UnaryOperator.isEmpty, ""])).toStrictEqual(true);
      expect(evaluate([UnaryOperator.isEmpty, "abc"])).toStrictEqual(false);
      fc.assert(
        fc.property(invalidExpressions, () => {
          const res = evaluate([UnaryOperator.isEmpty, ["Hello ", "World"]]);
          expect(res).toBe(false);
        })
      );
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
      expect(
        contains([{ foo: null, bar: null }], { foo: null, bar: null })
      ).toStrictEqual(false);
    });
    test("test 'set' contains when item in 'set'", () => {
      expect(contains({ foo: null, bar: null }, "bar")).toStrictEqual(true);
    });
    test("test 'set' contains when item not in 'set'", () => {
      expect(contains({ foo: null, bar: null }, "baz")).toStrictEqual(false);
    });
    test("test 'set' contains subset", () => {
      expect(
        contains({ key: { foo: null, bar: null } }, { foo: null, bar: null })
      ).toStrictEqual(false);
    });
  });
});
