/**
 * The `util` module provides a set of functions commonly needed to author custom components.
 * Many functions in the `util` module are used to coerce data into a particular type, and can be accessed through `util.types`.
 * For example, `util.types.toInt("5.5")` will return an integer, `5`.
 */

/** */
import parseISODate from "date-fns/parseISO";
import dateIsValid from "date-fns/isValid";
import dateIsDate from "date-fns/isDate";
import fromUnixTime from "date-fns/fromUnixTime";
import { configure } from "safe-stable-stringify";
import { isWebUri } from "valid-url";
import {
  KeyValuePair,
  DataPayload,
  ObjectSelection,
  ObjectFieldMap,
  JSONForm,
  ConnectionDefinition,
  Element,
} from "./types";

const isObjectWithTruthyKeys = (value: unknown, keys: string[]): boolean => {
  return (
    value !== null &&
    typeof value === "object" &&
    keys.every(
      (key) =>
        key in value && Boolean((value as Record<string, unknown>)?.[key])
    )
  );
};

/**
 * This function checks if value is an Element.
 * `util.types.isElement({key: "foo"})` and `util.types.isElement({key: "foo", label: "Foo"})` return true.
 * @param value The variable to test.
 * @returns This function returns true or false, depending on if `value` is an Element.
 */
const isElement = (value: unknown): value is Element =>
  isObjectWithTruthyKeys(value, ["key"]);

/**
 * @param value The value to test
 * @returns This function returns true if the type of `value` is an ObjectSelection, or false otherwise.
 */
const isObjectSelection = (value: unknown): value is ObjectSelection => {
  if (typeof value === "string" && isJSON(value)) {
    return isObjectSelection(JSON.parse(value));
  }

  return (
    Array.isArray(value) &&
    value.every((item) => isObjectWithTruthyKeys(item, ["object"]))
  );
};

/**
 * This function coerces a provided value into an ObjectSelection if possible.
 * @param value The value to coerce to ObjectSelection.
 * @returns This function returns the the value as an ObjectSelection if possible.
 */
const toObjectSelection = (value: unknown): ObjectSelection => {
  if (typeof value === "string" && isJSON(value)) {
    return toObjectSelection(JSON.parse(value));
  }

  if (isObjectSelection(value)) {
    return value;
  }

  throw new Error(
    `Value '${
      typeof value === "string" ? value : JSON.stringify(value)
    }' cannot be coerced to ObjectSelection.`
  );
};

/**
 * @param value The value to test
 * @returns This function returns true if the type of `value` is an ObjectFieldMap, or false otherwise.
 */
const isObjectFieldMap = (value: unknown): value is ObjectFieldMap => {
  if (typeof value === "string" && isJSON(value)) {
    return isObjectFieldMap(JSON.parse(value));
  }

  if (Boolean(value) && typeof value === "object") {
    const { fields } = value as Record<string, unknown>;
    return (
      Array.isArray(fields) &&
      fields.every(
        (item) =>
          isObjectWithTruthyKeys(item, ["field"]) &&
          isElement((item as Record<string, unknown>)?.field)
      )
    );
  }

  return false;
};

/**
 * This function coerces a provided value into an ObjectFieldMap if possible.
 * @param value The value to coerce to ObjectFieldMap.
 * @returns This function returns the the value as an ObjectFieldMap if possible.
 */
const toObjectFieldMap = (value: unknown): ObjectFieldMap => {
  if (typeof value === "string" && isJSON(value)) {
    return toObjectFieldMap(JSON.parse(value));
  }

  if (isObjectFieldMap(value)) {
    return value;
  }

  throw new Error(
    `Value '${
      typeof value === "string" ? value : JSON.stringify(value)
    }' cannot be coerced to ObjectFieldMap.`
  );
};

/**
 * @param value The value to test
 * @returns This function returns true if the type of `value` is a JSONForm, or false otherwise.
 */
const isJSONForm = (value: unknown): value is JSONForm => {
  if (typeof value === "string" && isJSON(value)) {
    return isJSONForm(JSON.parse(value));
  }

  return isObjectWithTruthyKeys(value, ["schema", "uiSchema", "data"]);
};

/**
 * This function coerces a provided value into a JSONForm if possible.
 * @param value The value to coerce to JSONForm.
 * @returns This function returns the the value as a JSONForm if possible.
 */
const toJSONForm = (value: unknown): JSONForm => {
  if (typeof value === "string" && isJSON(value)) {
    return toJSONForm(JSON.parse(value));
  }

  if (isJSONForm(value)) {
    return value;
  }

  throw new Error(
    `Value '${
      typeof value === "string" ? value : JSON.stringify(value)
    }' cannot be coerced to JSONForm.`
  );
};

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
 * Convert truthy (true, "t", "true", "y", "yes") values to boolean `true`,
 * and falsy (false, "f", "false", "n", "no") values to boolean `false`.
 * Truthy/falsy checks are case-insensitive.
 *
 * In the event that `value` is undefined or an empty string, a default value can be provided.
 * For example, `util.types.toBool('', true)` will return `true`.
 *
 * @param value The value to convert to a boolean.
 * @param defaultValue The value to return if `value` is undefined or an empty string.
 * @returns The boolean equivalent of the truthy or falsy `value`.
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
 * @param value The variable to test.
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
 * - `util.types.toNumber(null, 5.5)` will return the default value `5.5`, since `value` was `null`.
 * - `util.types.toNumber(undefined)` will return `0`, since `value` was undefined and no `defaultValue` was given.
 * - `util.types.toNumber("Hello")` will throw an error, since the string `"Hello"` cannot be coerced into a number.
 * @param value The value to turn into a number.
 * @param defaultValue The value to return if `value` is undefined or an empty string.
 * @returns This function returns the numerical version of `value` if possible, or the `defaultValue` if `value` is undefined or an empty string.
 */
const toNumber = (value: unknown, defaultValue?: number): number => {
  if (typeof value === "undefined" || value === "" || value === null) {
    return defaultValue || 0;
  }

  if (isNumber(value)) {
    return Number(value);
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
 * This function parses an ISO date or UNIX epoch timestamp if possible, or throws an error if the value provided
 * cannot be coerced into a Date object.
 *
 * - `util.types.toDate(new Date('1995-12-17T03:24:00'))` will return `Date('1995-12-17T09:24:00.000Z')` since a `Date` object was passed in.
 * - `util.types.toDate('2021-03-20')` will return `Date('2021-03-20T05:00:00.000Z')` since a valid ISO date was passed in.
 * - `util.types.toDate(1616198400) will return `Date('2021-03-20T00:00:00.000Z')` since a UNIX epoch timestamp was passed in.
 * - `parseISODate('2021-03-20-05')` will throw an error since `value` was not a valid ISO date.
 * @param value The value to turn into a date.
 * @returns The date equivalent of `value`.
 */
const toDate = (value: unknown): Date => {
  if (isDate(value)) {
    return value;
  }

  if (value && isNumber(value)) {
    return fromUnixTime(toNumber(value));
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
 * This function checks if value is a valid picklist.
 *
 * - `util.types.isPicklist(["value", new String("value")])` will return `true`.
 *
 * @param value The variable to test.
 * @returns This function returns true if `value` is a valid picklist.
 */
const isPicklist = (value: unknown): boolean =>
  Array.isArray(value) && (value.every(isString) || value.every(isElement));

/**
 * This function checks if value is a valid schedule.
 *
 * - `util.types.isSchedule({value: "00 00 * * 2,3"})` will return `true`.
 * - `util.types.isSchedule({value: "00 00 * * 2,3", scheduleType: "week", timeZone: "America/Chicago"})` will return `true`.
 *
 * @param value The variable to test.
 * @returns This function returns true if `value` is a valid schedule.
 */
const isSchedule = (value: unknown): boolean =>
  isObjectWithTruthyKeys(value, ["value"]);

/**
 * This function helps to transform key-value lists to objects.
 * This is useful for transforming inputs that are key-value collections into objects.
 *
 * For example, an input that is a collection might return `[{key: "foo", value: "bar"},{key: "baz", value: 5}]`.
 * If that array were passed into `util.types.keyValPairListToObject()`, an object would be returned of the form
 * `{foo: "bar", baz: 5}`.
 * @param kvpList An array of objects with `key` and `value` properties.
 * @param valueConverter Optional function to call for each `value`.
 */
const keyValPairListToObject = <TValue = unknown>(
  kvpList: KeyValuePair<unknown>[],
  valueConverter?: (value: unknown) => TValue
): Record<string, TValue> => {
  return (kvpList || []).reduce(
    (result, { key, value }) => ({
      ...result,
      [key]: valueConverter ? valueConverter(value) : value,
    }),
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
const isBufferDataPayload = (value: unknown): value is DataPayload => {
  return value instanceof Object && "data" in value;
};

/**
 * Many libraries for third-party API that handle binary files expect `Buffer` objects.
 * This function helps to convert strings, Uint8Arrays, and Arrays to a data structure
 * that has a Buffer and a string representing `contentType`.
 *
 * You can access the buffer like this:
 *  `const { data, contentType } = util.types.toBufferDataPayload(someData);`
 *
 * If `value` cannot be converted to a Buffer, an error will be thrown.
 * @param value The string, Buffer, Uint8Array, or Array to convert to a Buffer.
 * @returns This function returns an object with two keys: `data`, which is a `Buffer`, and `contentType`, which is a string.
 */
const toBufferDataPayload = (value: unknown): DataPayload => {
  if (isBufferDataPayload(value)) {
    return value;
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
 * @deprecated This function tests if the object provided is a Prismatic `DataPayload` object.
 * A `DataPayload` object is an object with a `data` attribute, and optional `contentType` attribute.
 *
 * @param value The value to test
 * @returns This function returns true if `value` is a DataPayload object, and false otherwise.
 */
const isData = (value: unknown): boolean => isBufferDataPayload(value);

/**
 * @deprecated Many libraries for third-party API that handle binary files expect `Buffer` objects.
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
const toData = (value: unknown): DataPayload => toBufferDataPayload(value);

/**
 * This function checks if value is a string.
 * `util.types.isString("value")` and `util.types.isString(new String("value"))` return true.
 * @param value The variable to test.
 * @returns This function returns true or false, depending on if `value` is a string.
 */
const isString = (value: unknown): value is string =>
  typeof value === "string" || value instanceof String;

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

/**
 * This function checks if value is a valid connection.
 * @param value The variable to test.
 * @returns This function returns true or false, depending on if `value` is a valid connection.
 */
const isConnection = (value: unknown): value is ConnectionDefinition => {
  if (typeof value === "string" && isJSON(value)) {
    return isConnection(JSON.parse(value));
  }

  if (Boolean(value) && typeof value === "object") {
    const { inputs } = value as Record<string, unknown>;

    if (isObjectWithTruthyKeys(value, ["key", "label", "oauth2Type"])) {
      return (
        isObjectWithTruthyKeys(inputs, [
          "authorizeUrl",
          "tokenUrl",
          "clientId",
          "clientSecret",
        ]) ||
        isObjectWithTruthyKeys(inputs, ["tokenUrl", "clientId", "clientSecret"])
      );
    }

    return (
      isObjectWithTruthyKeys(value, ["key", "label"]) &&
      typeof inputs === "object"
    );
  }

  return false;
};

/**
 * This function returns true if `value` resembles the shape of JSON, and false otherwise.
 *
 * - `isJSON(undefined) will return `false`
 * - `isJSON(null) will return `true`
 * - `isJSON("") will return `false`
 * - `isJSON(5) will return `true`
 * - `isJSON('{"name":"John", "age":30, "car":null}') will return `true`
 * @param value The value to test against
 * @returns This function returns a boolean, dependant on whether `value` can be parsed to JSON.
 * */
const isJSON = (value: string): boolean => {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * This function accepts an arbitrary object/value and safely serializes it (handles cyclic references).
 *
 * @param value Arbitrary object/value to serialize.
 * @returns JSON serialized text that can be safely logged.
 */
const toJSON = (value: unknown): string => {
  const stringify = configure({ circularValue: undefined });
  return stringify(value, null, 2);
};

/**
 * This function returns a lower cased version of the headers passed to it.
 *
 * - `lowerCaseHeaders({"Content-Type": "Application/JSON"})` will return `{"content-type": "Application/JSON"}`
 * - `lowerCaseHeaders({"Cache-Control": "max-age=604800"})` will return `{"cache-control": "max-age=604800"}`
 * - `lowerCaseHeaders({"Accept-Language": "en-us"})` will return `{"accept-language": "en-us"}`
 * @param headers The headers to convert to lower case
 * @returns This function returns a header object
 * */
export const lowerCaseHeaders = (
  headers: Record<string, string>
): Record<string, string> =>
  Object.entries(headers).reduce((result, [key, val]) => {
    return { ...result, [key.toLowerCase()]: val };
  }, {});

/**
 * This function parses a JSON string (if JSON) and returns an object, or returns the object.
 *
 * - `toObject('{"foo":"bar","baz":123}')` will return object `{foo: "bar", baz: 123}`
 * - `toObject({foo:"bar",baz:123})` will return object `{foo: "bar", baz: 123}`
 *
 * @param value The JSON string or object to convert
 * @returns This function returns an object, parsing JSON as necessary
 */
export const toObject = (value: unknown): object => {
  if (typeof value === "string" && isJSON(value)) {
    return JSON.parse(value);
  } else {
    return value as object;
  }
};

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
    isBufferDataPayload,
    toBufferDataPayload,
    isData,
    toData,
    isString,
    toString,
    keyValPairListToObject,
    isJSON,
    toJSON,
    lowerCaseHeaders,
    isObjectSelection,
    toObjectSelection,
    isObjectFieldMap,
    toObjectFieldMap,
    isJSONForm,
    toJSONForm,
    isPicklist,
    isSchedule,
    isConnection,
    isElement,
    toObject,
  },
};
