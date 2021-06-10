import parseISODate from "date-fns/parseISO";
import dateIsValid from "date-fns/isValid";
import dateIsDate from "date-fns/isDate";
import { isWebUri } from "valid-url";
import { DataPayload } from "./server-types";
import { KeyValuePair } from "./types";

const isBool = (value: unknown): value is boolean =>
  value === true || value === false;

const toBool = (value: unknown, defaultValue?: boolean) => {
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

const isInt = (value: unknown): value is number => Number.isInteger(value);

const toInt = (value: unknown, defaultValue?: number) => {
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

  throw new Error(`Value '${value}' cannot be coerced to int.`);
};

const isNumber = (value: unknown) => !Number.isNaN(Number(value));

const toNumber = (value: unknown, defaultValue?: number) => {
  if (isNumber(value)) {
    return Number(value);
  }

  if (typeof value === "undefined" || value === "") {
    return defaultValue || 0;
  }

  throw new Error(`Value '${value}' cannot be coerced to a number.`);
};

const isBigInt = (value: unknown): value is bigint => typeof value === "bigint";

const toBigInt = (value: unknown) => {
  if (isBigInt(value)) {
    return value;
  }

  try {
    return BigInt(value);
  } catch (error) {
    throw new Error(`Value '${value}' cannot be coerced to bigint.`);
  }
};

const isDate = (value: unknown): value is Date => dateIsDate(value);

const toDate = (value: unknown) => {
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

const isUrl = (value: string) => isWebUri(value) !== undefined;

const keyValPairListToObject = (
  kvpList: KeyValuePair<unknown>[] = []
): Record<string, unknown> => {
  return kvpList.reduce(
    (result, { key, value }) => ({ ...result, [key]: value }),
    {}
  );
};

const toData = (value: unknown): DataPayload => {
  if (value instanceof Object && "data" in value) {
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

const formatJsonExample = (input: unknown) =>
  ["```json", JSON.stringify(input, undefined, 2), "```"].join("\n");

const toString = (value: unknown, defaultValue = "") =>
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
    toData,
    toString,
    keyValPairListToObject,
  },
  docs: {
    formatJsonExample,
  },
};
