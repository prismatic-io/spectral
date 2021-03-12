import parseISODate from "date-fns/parseISO";
import dateIsValid from "date-fns/isValid";
import dateIsDate from "date-fns/isDate";
import { isWebUri } from "valid-url";
import { DataPayload } from "./types";

const isBool = (value: unknown): boolean => value === true || value === false;

const toBool = (value: unknown): boolean => {
  if (isBool(value)) return value as boolean;

  if (typeof value === "string") {
    const lowerValue = value.toLowerCase();
    if (["t", "true", "y", "yes"].includes(lowerValue)) {
      return true;
    } else if (["f", "false", "n", "no"].includes(lowerValue)) {
      return false;
    }
  }

  throw new Error(`Value '${value}' cannot be coerced to bool.`);
};

const isInt = (value: unknown): boolean => Number.isInteger(value);

const toInt = (value: unknown): number => {
  if (isInt(value)) return value as number;

  if (typeof value === "string") {
    const intValue = Number.parseInt(value);
    if (!Number.isNaN(intValue)) {
      return intValue;
    }
  }

  throw new Error(`Value '${value}' cannot be coerced to int.`);
};

const isBigInt = (value: unknown): boolean => typeof value === "bigint";

const toBigInt = (value: unknown): bigint => {
  if (isBigInt(value)) return value as bigint;

  try {
    return BigInt(value);
  } catch (error) {
    throw new Error(`Value '${value}' cannot be coerced to bigint.`);
  }
};

const isDate = (value: unknown): boolean => dateIsDate(value);

const toDate = (value: unknown): Date => {
  if (isDate(value)) return value as Date;

  if (typeof value === "string") {
    const dt = parseISODate(value);
    if (dateIsValid(dt)) {
      return dt;
    }
  }

  throw new Error(`Value '${value}' cannot be coerced to date.`);
};

const isUrl = (value: string): boolean => isWebUri(value) !== undefined;

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

export default {
  types: {
    isBool,
    toBool,
    isInt,
    toInt,
    isBigInt,
    toBigInt,
    isDate,
    toDate,
    isUrl,
    toData,
  },
  docs: {
    formatJsonExample,
  },
};
