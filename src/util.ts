/**
 * The `util` module provides a set of functions commonly needed to author custom components.
 * Many functions in the `util` module are used to coerce data into a particular type, and can be accessed through `util.types`.
 * For example, `util.types.toInt("5.5")` will return an integer, `5`.
 */

/** */
import parseISODate from "date-fns/parseISO";
import dateIsValid from "date-fns/isValid";
import dateIsDate from "date-fns/isDate";
import { isWebUri } from "valid-url";
import { DataPayload } from "./types/server-types";
import { KeyValuePair } from "./types";

/**
 * Determine if a variable is a boolean (true or false).
 *
 * - `util.types.isBool(false)` will return `true`, since `false` is a boolean.
 * - `util.types.isBool("Hello")` will return `false`, since `"Hello"` is not a boolean.
 *
 * @param value The variable to test.
 * @returns True if the value is a boolean, or false otherwise.
 */
const isBool = (value: unknown): value is boolean =>
  value === true || value === false;

/**
 * Convert truthey (true, "t", "true", "y", "yes") values to boolean `true`,
 * and falsey (false, "f", "false", "n", "no") values to boolean `false`.
 * Truthy/falsey checks are case-insensitive.
 *
 * In the event that `value` is undefined or an empty string, a default value can be provided.
 * For example, `util.types.toBool('', true)` will return `true`.
 *
 * @param value The value to convert to a boolean.
 * @param defaultValue The value to return if `value` is undefined or an empty string.
 * @returns The boolean equivalent of the truthey or falsey `value`.
 */
const toBool = (value: unknown, defaultValue?: boolean): boolean => {
  if (isBool(value)) {
    return value;
  }

  if (typeof value === "string") {
    const lowerValue = value.toLowerCase();
    if (["t", "true", "y", "yes"].includes(lowerValue)) {
      return true;
    } else if (["f", "false", "n", "no"].includes(lowerValue)) {
      return false;
    }
  }

  return Boolean(value || defaultValue);
};

/**
 * This function checks if value is an integer.
 * `util.types.isInt(5)` returns true, while `util.types.isInt("5")` or `util.types.isInt(5.5)` returns false.
 * @param value The variable to test.
 * @returns This function returns true or false, depending on if `value` is an integer.
 */
const isInt = (value: unknown): value is number => Number.isInteger(value);

/**
 * This function converts a variable to an integer if possible.
 * `util.types.toInt(5.5)` will return `5`.  `util.types.toInt("20.3")` will return `20`.
 *
 * In the event that `value` is undefined or an empty string, a default value can be provided.
 * For example, `util.types.toInt('', 1)` will return `1`.
 *
 * This function will throw an exception if `value` cannot be coerced to an integer.
 * @param value The value to convert to an integer.
 * @param defaultValue The value to return if `value` is undefined, an empty string, or not able to be coerced.
 * @returns This function returns an integer if possible.
 */
const toInt = (value: unknown, defaultValue?: number): number => {
  if (isInt(value)) return value;

  // Turn a float into an int
  if (typeof value === "number") {
    return ~~value;
  }

  if (typeof value === "string") {
    const intValue = Number.parseInt(value);
    if (!Number.isNaN(intValue)) {
      return intValue;
    }
  }

  if (typeof value === "undefined" || value === "") {
    return defaultValue || 0;
  }

  if (defaultValue) {
    return defaultValue;
  }

  throw new Error(`Value '${value}' cannot be coerced to int.`);
};

/**
 * Determine if a variable is a number, or can easily be coerced into a number.
 *
 * - `util.types.isNumber(3.21)` will return `true`, since `3.21` is a number.
 * - `util.types.isBool("5.5")` will return `true`, since the string `"5.5"` can easily be coerced into a number.
 * - `util.types.isBool("Hello")` will return `false`, since `"Hello"` is not a number.
 *
 * @param value The varible to test.
 * @returns This function returns true if `value` can easily be coerced into a number, and false otherwise.
 */
const isNumber = (value: unknown): boolean => !Number.isNaN(Number(value));

/**
 * This function coerces a value (number or string) into a number.
 * In the event that `value` is undefined or an empty string, a `defaultValue` can be provided, or zero will be returned.
 * If `value` is not able to be coerced into a number but is defined, an error will be thrown.
 *
 * - `util.types.toNumber("3.22")` will return the number `3.22`.
 * - `util.types.toNumber("", 5.5)` will return the default value `5.5`, since `value` was an empty string.
 * - `util.types.toNumber(undefined)` will return `0`, since `value` was undefined and no `defaultValue` was given.
 * - `util.types.toNumber("Hello")` will throw an error, since the string `"Hello"` cannot be coerced into a number.
 * @param value The value to turn into a number.
 * @param defaultValue The value to return if `value` is undefined or an empty string.
 * @returns This function returns the numerical version of `value` if possible, or the `defaultValue` if `value` is undefined or an empty string.
 */
const toNumber = (value: unknown, defaultValue?: number): number => {
  if (isNumber(value)) {
    return Number(value);
  }

  if (typeof value === "undefined" || value === "") {
    return defaultValue || 0;
  }

  throw new Error(`Value '${value}' cannot be coerced to a number.`);
};

/**
 * @param value The value to test
 * @returns This function returns true if the type of `value` is a bigint, or false otherwise.
 */
const isBigInt = (value: unknown): value is bigint => typeof value === "bigint";

/**
 * This function coerces a provided value into a bigint if possible.
 * The provided `value` must be a bigint, integer, string representing an integer, or a boolean.
 *
 * - `util.types.toBigInt(3)` will return `3n`.
 * - `util.types.toBigInt("-5")` will return `-5n`.
 * - `util.types.toBigInt(true)` will return `1n` (and `false` will return `0n`).
 * - `util.types.toBigInt("5.5")` will throw an error, as `5.5` is not an integer.
 * @param value The value to coerce to bigint.
 * @returns This function returns the bigint representation of `value`.
 */
const toBigInt = (value: unknown): BigInt => {
  if (isBigInt(value)) {
    return value;
  }

  try {
    return BigInt(toString(value));
  } catch (error) {
    throw new Error(`Value '${value}' cannot be coerced to bigint.`);
  }
};

/** This function returns true if `value` is a variable of type `Date`, and false otherwise. */
const isDate = (value: unknown): value is Date => dateIsDate(value);

/**
 * This function parses an ISO date if possible, or throws an error if the value provided
 * cannot be coerced into a Date object.
 *
 * - `util.types.toDate(new Date('1995-12-17T03:24:00'))` will return `Date('1995-12-17T09:24:00.000Z')` since a `Date` object was passed in.
 * - `util.types.toDate('2021-03-20')` will return `Date('2021-03-20T05:00:00.000Z')` since a valid ISO date was passed in.
 * - `parseISODate('2021-03-20-05')` will throw an error since `value` was not a valid ISO date.
 * @param value The value to turn into a date.
 * @returns The date equivalent of `value`.
 */
const toDate = (value: unknown): Date => {
  if (isDate(value)) {
    return value;
  }

  if (typeof value === "string") {
    const dt = parseISODate(value);
    if (dateIsValid(dt)) {
      return dt;
    }
  }

  throw new Error(`Value '${value}' cannot be coerced to date.`);
};

/**
 * This function tests if the string provided is a valid URL, and returns `true` if the URL is valid.
 * Note: this function only tests that the string is a syntactically correct URL; it does not check
 * if the URL is web accessible.
 *
 * - `util.types.isUrl('https://prismatic.io')` will return true.
 * - `util.types.isUrl('https:://prismatic.io')` will return false due to the extraneous `:` symbol.
 * @param value The URL to test.
 * @returns This function returns true if `value` is a valid URL, and false otherwise.
 */
const isUrl = (value: string): boolean => isWebUri(value) !== undefined;

/**
 * This function helps to transform key-value lists to objects.
 * This is useful for transforming inputs that are key-value collections into objects.
 *
 * For example, an input that is a collection might return `[{key: "foo", value: "bar"},{key: "baz", value: 5}]`.
 * If that array were passed into `util.types.keyValPairListToObject()`, an object would be returned of the form
 * `{foo: "bar", baz: 5}`.
 * @param kvpList An array of objects with `key` and `value` properties.
 */
const keyValPairListToObject = (
  kvpList: KeyValuePair<unknown>[] = []
): Record<string, unknown> => {
  return kvpList.reduce(
    (result, { key, value }) => ({ ...result, [key]: value }),
    {}
  );
};

/**
 * This function tests if the object provided is a Prismatic `DataPayload` object.
 * A `DataPayload` object is an object with a `data` attribute, and optional `contentType` attribute.
 *
 * @param value The value to test
 * @returns This function returns true if `value` is a DataPayload object, and false otherwise.
 */
const isData = (value: unknown): boolean => {
  return value instanceof Object && "data" in value;
};

/**
 * Many libraries for third-party API that handle binary files expect `Buffer` objects.
 * This function helps to convert strings, Uint8Arrays, and Arrays to a data structure
 * that has a Buffer and a string representing `contentType`.
 *
 * You can access the buffer like this:
 *  `const { data, contentType } = util.types.toData(someData);`
 *
 * If `value` cannot be converted to a Buffer, an error will be thrown.
 * @param value The string, Buffer, Uint8Array, or Array to convert to a Buffer.
 * @returns This function returns an object with two keys: `data`, which is a `Buffer`, and `contentType`, which is a string.
 */
const toData = (value: unknown): DataPayload => {
  if (isData(value)) {
    return value as DataPayload;
  }

  if (typeof value === "string") {
    return {
      data: Buffer.from(value, "utf-8"),
      contentType: "text/plain",
    };
  }

  if (value instanceof Buffer) {
    return {
      data: value,
      contentType: "application/octet-stream",
    };
  }

  if (value instanceof Uint8Array) {
    return {
      data: Buffer.from(value),
      contentType: "application/octet-stream",
    };
  }

  if (value instanceof Object || Array.isArray(value)) {
    const json = JSON.stringify(value);
    return {
      data: Buffer.from(json, "utf-8"),
      contentType: "application/json",
    };
  }

  throw new Error(`Value '${value}' cannot be converted to a Buffer.`);
};

/**
 * This function helps to format JSON examples for documentation.
 * @param input An object to be JSONified.
 * @returns This function returns a code block that can be used for documentation.
 */
const formatJsonExample = (input: unknown): string =>
  ["```json", JSON.stringify(input, undefined, 2), "```"].join("\n");

/**
 * This function converts a `value` to a string.
 * If `value` is undefined or an empty string, an optional `defaultValue` can be returned.
 *
 * - `util.types.toString("Hello")` will return `"Hello"`.
 * - `util.types.toString(5.5)` will return `"5.5"`.
 * - `util.types.toString("", "Some default")` will return `"Some Default"`.
 * - `util.types.toString(undefined)` will return `""`.
 * @param value The value to convert to a string.
 * @param defaultValue A default value to return if `value` is undefined or an empty string.
 * @returns This function returns the stringified version fo `value`, or `defaultValue` in the case that `value` is undefined or an empty string.
 */
const toString = (value: unknown, defaultValue = ""): string =>
  `${value ?? defaultValue}`;

export default {
  types: {
    isBool,
    toBool,
    isInt,
    toInt,
    isNumber,
    toNumber,
    isBigInt,
    toBigInt,
    isDate,
    toDate,
    isUrl,
    isData,
    toData,
    toString,
    keyValPairListToObject,
  },
  docs: {
    formatJsonExample,
  },
};
