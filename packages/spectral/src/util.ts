/**
 * The `util` module provides a set of functions commonly needed to author custom components.
 * Many functions in the `util` module are used to coerce data into a particular type, and can be accessed through `util.types`.
 * For example, `util.types.toInt("5.5")` will return an integer, `5`.
 */

import { fromUnixTime } from "date-fns/fromUnixTime";
import { isDate as dateIsDate } from "date-fns/isDate";
import { isValid as dateIsValid } from "date-fns/isValid";
import { parseISO as parseISODate } from "date-fns/parseISO";
import omitBy from "lodash/omitBy";
import { configure } from "safe-stable-stringify";
import { isWebUri } from "valid-url";
import {
  ConnectionDefinition,
  DataPayload,
  Element,
  JSONForm,
  KeyValuePair,
  ObjectFieldMap,
  ObjectSelection,
} from "./types";

export const isObjectWithOneTruthyKey = (value: unknown, keys: string[]): boolean => {
  return (
    value !== null &&
    typeof value === "object" &&
    keys.some((key) => key in value && Boolean((value as Record<string, unknown>)?.[key]))
  );
};

export const isObjectWithTruthyKeys = (value: unknown, keys: string[]): boolean => {
  return (
    value !== null &&
    typeof value === "object" &&
    keys.every((key) => key in value && Boolean((value as Record<string, unknown>)?.[key]))
  );
};

/**
 * This function checks if value is an Element.
 *
 * @param value The variable to test.
 * @returns This function returns true or false, depending on if `value` is an Element.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.isElement({ key: "foo" }); // true
 * util.types.isElement({ key: "foo", label: "Foo" }); // true
 * util.types.isElement("foo"); // false
 * util.types.isElement({}); // false
 */
const isElement = (value: unknown): value is Element => isObjectWithTruthyKeys(value, ["key"]);

/**
 * Checks if a value is a valid ObjectSelection (an array of objects each with an `object` property).
 *
 * @param value The value to test
 * @returns This function returns true if the type of `value` is an ObjectSelection, or false otherwise.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.isObjectSelection([{ object: { key: "account" } }]); // true
 * util.types.isObjectSelection("not an object selection"); // false
 */
const isObjectSelection = (value: unknown): value is ObjectSelection => {
  if (typeof value === "string" && isJSON(value)) {
    return isObjectSelection(JSON.parse(value));
  }

  return Array.isArray(value) && value.every((item) => isObjectWithTruthyKeys(item, ["object"]));
};

/**
 * This function coerces a provided value into an ObjectSelection if possible.
 * If the value is a JSON string it will be parsed first. Throws an error if
 * the value cannot be coerced.
 *
 * @param value The value to coerce to ObjectSelection.
 * @returns This function returns the value as an ObjectSelection if possible.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * const selection = util.types.toObjectSelection([
 *   { object: { key: "account", label: "Account" }, fields: [{ key: "name" }] },
 * ]);
 *
 * // Also accepts a JSON string representation
 * const fromString = util.types.toObjectSelection(
 *   '[{"object":{"key":"account"}}]'
 * );
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
    }' cannot be coerced to ObjectSelection.`,
  );
};

/**
 * Checks if a value is a valid ObjectFieldMap (an object with a `fields` array,
 * where each field has a `field` property that is an Element).
 *
 * @param value The value to test
 * @returns This function returns true if the type of `value` is an ObjectFieldMap, or false otherwise.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.isObjectFieldMap({
 *   fields: [{ field: { key: "name", label: "Name" } }],
 * }); // true
 * util.types.isObjectFieldMap("not a field map"); // false
 */
const isObjectFieldMap = (value: unknown): value is ObjectFieldMap => {
  if (typeof value === "string" && isJSON(value)) {
    return isObjectFieldMap(JSON.parse(value));
  }

  if (value && typeof value === "object") {
    const { fields } = value as Record<string, unknown>;
    return (
      Array.isArray(fields) &&
      fields.every(
        (item) =>
          isObjectWithTruthyKeys(item, ["field"]) &&
          isElement((item as Record<string, unknown>)?.field),
      )
    );
  }

  return false;
};

/**
 * This function coerces a provided value into an ObjectFieldMap if possible.
 * If the value is a JSON string it will be parsed first. Throws an error if
 * the value cannot be coerced.
 *
 * @param value The value to coerce to ObjectFieldMap.
 * @returns This function returns the value as an ObjectFieldMap if possible.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * const fieldMap = util.types.toObjectFieldMap({
 *   fields: [
 *     { field: { key: "email", label: "Email" }, mappedField: { key: "contact_email" } },
 *   ],
 * });
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
    }' cannot be coerced to ObjectFieldMap.`,
  );
};

/**
 * Checks if a value is a valid JSONForm (an object with `schema`, `uiSchema`, and `data` properties).
 *
 * @param value The value to test
 * @returns This function returns true if the type of `value` is a JSONForm, or false otherwise.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.isJSONForm({
 *   schema: { type: "object", properties: { name: { type: "string" } } },
 *   uiSchema: { type: "VerticalLayout", elements: [] },
 *   data: { name: "Example" },
 * }); // true
 * util.types.isJSONForm({ schema: {} }); // false (missing uiSchema and data)
 */
const isJSONForm = (value: unknown): value is JSONForm => {
  if (typeof value === "string" && isJSON(value)) {
    return isJSONForm(JSON.parse(value));
  }

  return isObjectWithTruthyKeys(value, ["schema", "uiSchema", "data"]);
};

/**
 * This function coerces a provided value into a JSONForm if possible.
 * If the value is a JSON string it will be parsed first. Throws an error if
 * the value cannot be coerced.
 *
 * @param value The value to coerce to JSONForm.
 * @returns This function returns the value as a JSONForm if possible.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * const form = util.types.toJSONForm({
 *   schema: { type: "object", properties: { name: { type: "string" } } },
 *   uiSchema: { type: "VerticalLayout", elements: [] },
 *   data: { name: "Default Name" },
 * });
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
    }' cannot be coerced to JSONForm.`,
  );
};

/**
 * Determine if a variable is a boolean (true or false).
 *
 * @param value The variable to test.
 * @returns True if the value is a boolean, or false otherwise.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.isBool(false); // true
 * util.types.isBool(true); // true
 * util.types.isBool("Hello"); // false
 * util.types.isBool(0); // false
 */
const isBool = (value: unknown): value is boolean => value === true || value === false;

/**
 * Convert truthy (true, "t", "true", "y", "yes") values to boolean `true`,
 * and falsy (false, "f", "false", "n", "no") values to boolean `false`.
 * Truthy/falsy checks are case-insensitive.
 *
 * In the event that `value` is undefined or an empty string, a default value can be provided.
 *
 * @param value The value to convert to a boolean.
 * @param defaultValue The value to return if `value` is undefined or an empty string.
 * @returns The boolean equivalent of the truthy or falsy `value`.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.toBool("true"); // true
 * util.types.toBool("YES"); // true
 * util.types.toBool("f"); // false
 * util.types.toBool("no"); // false
 * util.types.toBool("", true); // true (uses default)
 * util.types.toBool(undefined, false); // false (uses default)
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
 *
 * @param value The variable to test.
 * @returns This function returns true or false, depending on if `value` is an integer.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.isInt(5); // true
 * util.types.isInt(-3); // true
 * util.types.isInt("5"); // false (string, not a number)
 * util.types.isInt(5.5); // false (float, not an integer)
 */
const isInt = (value: unknown): value is number => Number.isInteger(value);

/**
 * This function converts a variable to an integer if possible.
 * Floats are truncated (not rounded). Throws an error if `value`
 * cannot be coerced and no `defaultValue` is provided.
 *
 * @param value The value to convert to an integer.
 * @param defaultValue The value to return if `value` is undefined, an empty string, or not able to be coerced.
 * @returns This function returns an integer if possible.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.toInt(5.5); // 5
 * util.types.toInt("20.3"); // 20
 * util.types.toInt("", 1); // 1 (uses default)
 * util.types.toInt(undefined, 42); // 42 (uses default)
 * util.types.toInt("abc"); // throws Error
 */
const toInt = (value: unknown, defaultValue?: number): number => {
  if (isInt(value)) return value;

  // Turn a float into an int
  if (typeof value === "number") {
    return ~~value;
  }

  if (typeof value === "string") {
    const intValue = Number.parseInt(value, 10);
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
 * @param value The variable to test.
 * @returns This function returns true if `value` can easily be coerced into a number, and false otherwise.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.isNumber(3.21); // true
 * util.types.isNumber("5.5"); // true (string is numeric)
 * util.types.isNumber("Hello"); // false
 */
const isNumber = (value: unknown): boolean => !Number.isNaN(Number(value));

/**
 * This function coerces a value (number or string) into a number.
 * In the event that `value` is undefined, null, or an empty string, a `defaultValue` can be provided, or zero will be returned.
 * If `value` is not able to be coerced into a number but is defined, an error will be thrown.
 *
 * @param value The value to turn into a number.
 * @param defaultValue The value to return if `value` is undefined, null, or an empty string.
 * @returns This function returns the numerical version of `value` if possible, or the `defaultValue` if `value` is undefined or an empty string.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.toNumber("3.22"); // 3.22
 * util.types.toNumber("", 5.5); // 5.5 (uses default)
 * util.types.toNumber(null, 5.5); // 5.5 (uses default)
 * util.types.toNumber(undefined); // 0 (no default given)
 * util.types.toNumber("Hello"); // throws Error
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
 * Checks if a value is a bigint.
 *
 * @param value The value to test
 * @returns This function returns true if the type of `value` is a bigint, or false otherwise.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.isBigInt(3n); // true
 * util.types.isBigInt(3); // false (number, not bigint)
 * util.types.isBigInt("3"); // false
 */
const isBigInt = (value: unknown): value is bigint => typeof value === "bigint";

/**
 * This function coerces a provided value into a bigint if possible.
 * The provided `value` must be a bigint, integer, string representing an integer, or a boolean.
 * Throws an error if the value cannot be coerced.
 *
 * @param value The value to coerce to bigint.
 * @returns This function returns the bigint representation of `value`.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.toBigInt(3); // 3n
 * util.types.toBigInt("-5"); // -5n
 * util.types.toBigInt(true); // 1n
 * util.types.toBigInt(false); // 0n
 * util.types.toBigInt("5.5"); // throws Error (not an integer)
 */
const toBigInt = (value: unknown): bigint => {
  if (isBigInt(value)) {
    return value;
  }

  try {
    return BigInt(toString(value));
  } catch (_error) {
    throw new Error(`Value '${value}' cannot be coerced to bigint.`);
  }
};

/**
 * This function returns true if `value` is a variable of type `Date`, and false otherwise.
 *
 * @param value The variable to test.
 * @returns True if value is a Date object, false otherwise.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.isDate(new Date()); // true
 * util.types.isDate("2021-03-20"); // false (string, not Date)
 * util.types.isDate(1616198400); // false (number, not Date)
 */
const isDate = (value: unknown): value is Date => dateIsDate(value);

/**
 * This function parses an ISO date string or UNIX epoch timestamp if possible,
 * or throws an error if the value provided cannot be coerced into a Date object.
 *
 * @param value The value to turn into a date. Accepts a Date object, ISO date string, or UNIX epoch timestamp (seconds).
 * @returns The date equivalent of `value`.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * // Pass through an existing Date object
 * util.types.toDate(new Date("1995-12-17T03:24:00"));
 *
 * // Parse an ISO date string
 * util.types.toDate("2021-03-20"); // Date object for 2021-03-20
 *
 * // Parse a UNIX epoch timestamp (in seconds)
 * util.types.toDate(1616198400); // Date object for 2021-03-20
 *
 * // Invalid input throws an error
 * util.types.toDate("not-a-date"); // throws Error
 */
const toDate = (value: unknown): Date => {
  if (isDate(value)) {
    return value;
  }

  if (isNumber(value) && toNumber(value)) {
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
 * @param value The URL to test.
 * @returns This function returns true if `value` is a valid URL, and false otherwise.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.isUrl("https://prismatic.io"); // true
 * util.types.isUrl("http://example.com/path?q=1"); // true
 * util.types.isUrl("https:://prismatic.io"); // false (malformed)
 * util.types.isUrl("not a url"); // false
 */
const isUrl = (value: string): boolean => isWebUri(value) !== undefined;

/**
 * This function checks if value is a valid picklist. A picklist is an array
 * of strings or an array of Element objects (objects with a `key` property).
 *
 * @param value The variable to test.
 * @returns This function returns true if `value` is a valid picklist.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.isPicklist(["option1", "option2"]); // true
 * util.types.isPicklist([{ key: "a", label: "Option A" }]); // true
 * util.types.isPicklist("not a picklist"); // false
 * util.types.isPicklist([1, 2, 3]); // false
 */
const isPicklist = (value: unknown): boolean =>
  Array.isArray(value) && (value.every(isString) || value.every(isElement));

/**
 * This function checks if value is a valid schedule (an object with a truthy `value` property).
 *
 * @param value The variable to test.
 * @returns This function returns true if `value` is a valid schedule.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.isSchedule({ value: "00 00 * * 2,3" }); // true
 * util.types.isSchedule({
 *   value: "00 00 * * 2,3",
 *   schedule_type: "week",
 *   time_zone: "America/Chicago",
 * }); // true
 * util.types.isSchedule("not a schedule"); // false
 */
const isSchedule = (value: unknown): boolean => isObjectWithTruthyKeys(value, ["value"]);

/**
 * This function helps to transform key-value lists to objects.
 * This is useful for transforming inputs that use the `keyvaluelist` collection type
 * into plain objects.
 *
 * @param kvpList An array of objects with `key` and `value` properties.
 * @param valueConverter Optional function to call for each `value`.
 * @returns A plain object with keys and values from the input array.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * const headers = [
 *   { key: "Content-Type", value: "application/json" },
 *   { key: "Authorization", value: "Bearer abc123" },
 * ];
 * util.types.keyValPairListToObject(headers);
 * // { "Content-Type": "application/json", "Authorization": "Bearer abc123" }
 *
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * // With a value converter
 * const params = [
 *   { key: "limit", value: "10" },
 *   { key: "offset", value: "0" },
 * ];
 * util.types.keyValPairListToObject(params, (v) => Number(v));
 * // { limit: 10, offset: 0 }
 */
const keyValPairListToObject = <TValue = unknown>(
  kvpList: KeyValuePair<unknown>[],
  valueConverter?: (value: unknown) => TValue,
): Record<string, TValue> => {
  return (kvpList || []).reduce(
    (result, { key, value }) => ({
      ...result,
      [key]: valueConverter ? valueConverter(value) : value,
    }),
    {},
  );
};

/**
 * This function tests if the object provided is a Prismatic `DataPayload` object.
 * A `DataPayload` object is an object with a `data` attribute that is a Buffer, and optional `contentType` attribute.
 *
 * @param value The value to test
 * @returns This function returns true if `value` is a DataPayload object, and false otherwise.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.isBufferDataPayload({
 *   data: Buffer.from("hello"),
 *   contentType: "text/plain",
 * }); // true
 * util.types.isBufferDataPayload("hello"); // false
 * util.types.isBufferDataPayload({ data: "not a buffer" }); // false
 */
const isBufferDataPayload = (value: unknown): value is DataPayload =>
  value instanceof Object && "data" in value && Buffer.isBuffer(value.data);

/**
 * Many libraries for third-party APIs that handle binary files expect `Buffer` objects.
 * This function helps to convert strings, Uint8Arrays, objects, and arrays to a
 * `DataPayload` structure that has a Buffer and a string representing `contentType`.
 *
 * Throws an error if `value` cannot be converted to a Buffer.
 *
 * @param value The string, Buffer, Uint8Array, object, or Array to convert to a Buffer.
 * @returns An object with two keys: `data` (a `Buffer`) and `contentType` (a string).
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * // Convert a string (becomes text/plain)
 * const { data, contentType } = util.types.toBufferDataPayload("Hello, world!");
 * // data: Buffer, contentType: "text/plain"
 *
 * // Convert an object (becomes application/json)
 * const jsonPayload = util.types.toBufferDataPayload({ key: "value" });
 * // jsonPayload.contentType === "application/json"
 *
 * // Pass through an existing DataPayload
 * const existing = { data: Buffer.from("binary"), contentType: "application/octet-stream" };
 * util.types.toBufferDataPayload(existing); // returns as-is
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
 *
 * @param value The variable to test.
 * @returns This function returns true or false, depending on if `value` is a string.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.isString("value"); // true
 * util.types.isString(new String("value")); // true
 * util.types.isString(123); // false
 * util.types.isString(null); // false
 */
const isString = (value: unknown): value is string =>
  typeof value === "string" || value instanceof String;

/**
 * This function converts a `value` to a string.
 * If `value` is undefined or null, an optional `defaultValue` is returned (defaults to `""`).
 *
 * @param value The value to convert to a string.
 * @param defaultValue A default value to return if `value` is undefined or null. Defaults to `""`.
 * @returns The stringified version of `value`, or `defaultValue` if `value` is undefined or null.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.toString("Hello"); // "Hello"
 * util.types.toString(5.5); // "5.5"
 * util.types.toString("", "Some default"); // ""
 * util.types.toString(undefined); // ""
 * util.types.toString(null, "fallback"); // "fallback"
 */
const toString = (value: unknown, defaultValue = ""): string => `${value ?? defaultValue}`;

/**
 * This function checks if value is a valid connection object (has `key`, `label`,
 * and `inputs` properties, with appropriate OAuth 2.0 fields if applicable).
 *
 * @param value The variable to test.
 * @returns This function returns true or false, depending on if `value` is a valid connection.
 * @see {@link https://prismatic.io/docs/custom-connectors/connections/ | Writing Custom Connections}
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.isConnection({
 *   key: "apiKey",
 *   label: "API Key",
 *   inputs: { apiKey: { type: "password" } },
 * }); // true
 * util.types.isConnection("not a connection"); // false
 */
const isConnection = (value: unknown): value is ConnectionDefinition => {
  if (typeof value === "string" && isJSON(value)) {
    return isConnection(JSON.parse(value));
  }

  if (value && typeof value === "object") {
    const { inputs } = value as Record<string, unknown>;

    if (isObjectWithTruthyKeys(value, ["key", "label", "oauth2Type"])) {
      return (
        isObjectWithTruthyKeys(inputs, ["authorizeUrl", "tokenUrl", "clientId", "clientSecret"]) ||
        isObjectWithTruthyKeys(inputs, ["tokenUrl", "clientId", "clientSecret"])
      );
    }

    return isObjectWithTruthyKeys(value, ["key", "label"]) && typeof inputs === "object";
  }

  return false;
};

/**
 * This function returns true if `value` can be parsed as JSON, and false otherwise.
 *
 * @param value The value to test against.
 * @returns True if `value` can be parsed by `JSON.parse()`, false otherwise.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.isJSON('{"name":"John","age":30}'); // true
 * util.types.isJSON("5"); // true
 * util.types.isJSON("true"); // true
 * util.types.isJSON(""); // false
 * util.types.isJSON("not json"); // false
 */
const isJSON = (value: string): boolean => {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
};

/**
 * This function accepts an arbitrary object/value and safely serializes it to JSON.
 * Unlike `JSON.stringify`, it handles cyclic references without throwing.
 *
 * @param value Arbitrary object/value to serialize.
 * @param prettyPrint When true, convert to pretty printed JSON with 2 spaces and newlines. When false, JSON is compact. Defaults to `true`.
 * @param retainKeyOrder When true, the order of keys in the JSON output will be the same as the order in the input object. Defaults to `false`.
 * @returns JSON serialized text that can be safely logged.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * // Pretty-printed (default)
 * util.types.toJSON({ name: "Acme", count: 42 });
 * // '{\n  "count": 42,\n  "name": "Acme"\n}'
 *
 * // Compact output
 * util.types.toJSON({ name: "Acme", count: 42 }, false);
 * // '{"count":42,"name":"Acme"}'
 *
 * // Retain original key order
 * util.types.toJSON({ name: "Acme", count: 42 }, true, true);
 * // '{\n  "name": "Acme",\n  "count": 42\n}'
 */
const toJSON = (value: unknown, prettyPrint = true, retainKeyOrder = false): string => {
  const stringify = configure({
    circularValue: undefined,
    deterministic: !retainKeyOrder,
  });
  const result = prettyPrint ? stringify(value, null, 2) : stringify(value);
  return result ?? "";
};

/**
 * This function returns a version of the headers object where all header
 * names (keys) are lower-cased. Header values are left unchanged.
 *
 * @param headers The headers to convert to lower case.
 * @returns A new header object with lower-cased keys.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.lowerCaseHeaders({ "Content-Type": "application/json" });
 * // { "content-type": "application/json" }
 *
 * util.types.lowerCaseHeaders({
 *   "Cache-Control": "max-age=604800",
 *   "Accept-Language": "en-us",
 * });
 * // { "cache-control": "max-age=604800", "accept-language": "en-us" }
 */
export const lowerCaseHeaders = (headers: Record<string, string>): Record<string, string> =>
  Object.entries(headers).reduce((result, [key, val]) => {
    return { ...result, [key.toLowerCase()]: val };
  }, {});

/**
 * This function parses a JSON string and returns the resulting object,
 * or returns the value as-is if it is already an object.
 *
 * @param value The JSON string or object to convert.
 * @returns An object, parsing JSON as necessary.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * util.types.toObject('{"foo":"bar","baz":123}');
 * // { foo: "bar", baz: 123 }
 *
 * util.types.toObject({ foo: "bar", baz: 123 });
 * // { foo: "bar", baz: 123 } (returned as-is)
 */
export const toObject = (value: unknown): object => {
  if (typeof value === "string" && isJSON(value)) {
    return JSON.parse(value);
  } else {
    return value as object;
  }
};

/**
 * This function removes any properties of an object that match a certain predicate.
 * By default, properties with values of `undefined`, `null`, and `""` are removed.
 * Useful for cleaning up request bodies before sending to an API.
 *
 * @param obj A key-value object to remove properties from.
 * @param predicate A function that returns true for properties to remove. Defaults to removing properties with `undefined`, `null`, and `""` values.
 * @returns A new object with matching properties removed.
 * @example
 * import { util } from "@prismatic-io/spectral";
 *
 * // Remove undefined, null, and empty string values (default)
 * util.types.cleanObject({ foo: undefined, bar: "abc", baz: null, buz: "" });
 * // { bar: "abc" }
 *
 * // Custom predicate: remove even numbers
 * util.types.cleanObject({ foo: 1, bar: 2, baz: 3 }, (v) => v % 2 === 0);
 * // { foo: 1, baz: 3 }
 */
const cleanObject = (
  obj: Record<string, unknown>,
  predicate?: (v: any) => boolean,
): Record<string, unknown> => {
  const defaultPredicate = (v: any) => v === undefined || v === null || v === "";
  return omitBy(obj, predicate || defaultPredicate);
};

export * from "./conditionalLogic";
export * from "./errors";

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
    cleanObject,
  },
};
