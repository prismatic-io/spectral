import parseISODate from "date-fns/parseISO";
import dateIsValid from "date-fns/isValid";
import dateIsDate from "date-fns/isDate";
import { isWebUri } from "valid-url";
import { DataPayload } from "./server-types";
import { ConditionalExpression, TermOperatorPhrase } from "./types";

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

  if (typeof value === "undefined") {
    return Boolean(defaultValue);
  }

  throw new Error(`Value '${value}' cannot be coerced to bool.`);
};

const isInt = (value: unknown): value is number => Number.isInteger(value);

const toInt = (value: unknown, defaultValue?: number) => {
  if (isInt(value)) return value;

  if (typeof value === "string") {
    const intValue = Number.parseInt(value);
    if (!Number.isNaN(intValue)) {
      return intValue;
    }
  }

  if (typeof value === "undefined") {
    return defaultValue || 0;
  }

  throw new Error(`Value '${value}' cannot be coerced to int.`);
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

const isConditionalExpression = (
  value: unknown
): value is ConditionalExpression<string> => {
  if (!Array.isArray(value)) {
    return false;
  }

  /**
   * BooleanExpression
   */
  if (value[0] === "and" || value[0] === "or") {
    const [, ...expressions] = value;

    return expressions.length === 0
      ? false
      : expressions.every(isConditionalExpression);
  }

  /**
   * TermExpression
   */
  const [predicate, term1, term2] = value;

  return (
    predicate in TermOperatorPhrase &&
    typeof term1 === "string" &&
    typeof term2 === "string"
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

const toString = (value: unknown, defaultValue?: string): string => {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "undefined" || value === null) {
    return defaultValue || "";
  }

  if (typeof value === "object" && value !== null) {
    return value.toString();
  }

  throw new Error(`Value '${value}' cannot be converted to a String.`);
};

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
    isConditionalExpression,
    isUrl,
    toData,
    toString,
  },
  docs: {
    formatJsonExample,
  },
};
