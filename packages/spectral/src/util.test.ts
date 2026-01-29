import { describe, expect } from "vitest";
import { test as it, fc } from "@fast-check/vitest";
import util from "./util";

describe("util", () => {
  const bufferArbitrary = fc.base64String().map((v) => Buffer.from(v, "base64"));
  const uint8ArrayArbitrary = bufferArbitrary.map((b) => new Uint8Array(b));
  const unknowns = (): fc.Arbitrary<unknown> => fc.constantFrom(undefined);
  const emptyStrings = (): fc.Arbitrary<string> => fc.constantFrom("");
  const nulls = (): fc.Arbitrary<null> => fc.constantFrom(null);

  describe("boolean", () => {
    type TruthyValue = true | "true" | "t" | "T" | "yes" | "y" | "Y";
    type FalsyValue = false | "false" | "f" | "F" | "no" | "n" | "N" | "";

    const booleanStringValues = {
      truthy: ["true", "t", "T", "yes", "y", "Y"],
      falsy: ["false", "f", "F", "no", "n", "N", ""],
    };

    const truthy = (): fc.Arbitrary<TruthyValue> =>
      fc.constantFrom<TruthyValue[]>(true, ...(booleanStringValues.truthy as TruthyValue[]));
    const falsy = (): fc.Arbitrary<fc.FalsyValue | FalsyValue> =>
      fc.constantFrom<FalsyValue[]>(false, ...(booleanStringValues.falsy as FalsyValue[]));

    const invalidValues = fc.oneof(
      fc.integer(),
      fc
        .string()
        .filter(
          (v) => !booleanStringValues.truthy.includes(v) && !booleanStringValues.falsy.includes(v),
        ),
      fc.float(),
      fc.double(),
    );

    it.prop([fc.boolean()])("detects boolean value", (v) => {
      expect(util.types.isBool(v)).toBe(true);
    });

    it.prop([invalidValues])("detects non-boolean value", (v) => {
      expect(util.types.isBool(v)).toBe(false);
    });

    it.prop([truthy()])("coerces truthy values to true", (v) => {
      expect(util.types.toBool(v)).toBe(true);
    });

    it.prop([falsy()])("coerces falsy values to false", (v) => {
      expect(util.types.toBool(v)).toBe(false);
    });

    it.prop([unknowns()])(
      "allows for boolean default to false for undefined inputs and undefined default",
      (v) => {
        expect(util.types.toBool(v)).toBe(false);
      },
    );

    it.prop([unknowns()])("allows for boolean default of false for undefined inputs", (v) => {
      expect(util.types.toBool(v, false)).toBe(false);
    });

    it.prop([unknowns()])("allows for boolean default of true for undefined inputs", (v) => {
      expect(util.types.toBool(v, true)).toBe(true);
    });

    it.prop([emptyStrings()])(
      "allows for boolean default to false for empty string inputs and undefined default",
      (v) => {
        expect(util.types.toBool(v)).toBe(false);
      },
    );

    it.prop([emptyStrings()])(
      "allows for boolean default of false for empty string inputs",
      (v) => {
        expect(util.types.toBool(v, false)).toBe(false);
      },
    );

    it.prop([emptyStrings()])("allows for boolean default of true for empty string inputs", (v) => {
      expect(util.types.toBool(v, true)).toBe(true);
    });
  });

  describe("integer", () => {
    const invalidValues = fc.oneof(
      fc.string().filter((v) => Number.isNaN(Number.parseInt(v)) && v !== ""),
    );

    it.prop([fc.integer()])("detects integer value", (v) => {
      expect(util.types.isInt(v)).toBe(true);
    });

    it.prop([invalidValues])("detects non-integer value", (v) => {
      expect(util.types.isInt(v)).toBe(false);
    });

    it.prop([fc.integer()])("coerces integer values", (v) => {
      expect(util.types.toInt(v.toString())).toBe(v);
    });

    it.prop([fc.float({ noNaN: true }).filter((v) => !Number.isInteger(v) && Number.isFinite(v))])(
      "coerces a float to an int",
      (v) => {
        expect(util.types.toInt(v)).toBe(~~v);
      },
    );

    it.prop([invalidValues])("throws when coercing non-integer values", (v) => {
      expect(() => util.types.toInt(v)).toThrow("cannot be coerced to int");
    });

    it.prop([unknowns()])("Allows for default value of 0 when value is undefined", (v) => {
      expect(util.types.toInt(v)).toBe(0);
    });

    it.prop([unknowns()])("Allows for default values when value is undefined", (v) => {
      expect(util.types.toInt(v, 20)).toBe(20);
    });

    it.prop([emptyStrings()])("Allows for default value of 0 when value is empty string", (v) => {
      expect(util.types.toInt(v)).toBe(0);
    });

    it.prop([emptyStrings()])("Allows for default values when value is empty string", (v) => {
      expect(util.types.toInt(v, 20)).toBe(20);
    });
  });

  describe("number", () => {
    const validValues = fc.string().filter((v) => !Number.isNaN(Number(v)));
    const invalidValues = fc.string().filter((v) => Number.isNaN(Number(v)));

    it.prop([validValues])("detects things that can be cast to a number", (v) => {
      expect(util.types.isNumber(v)).toBe(true);
    });

    it.prop([invalidValues])("detects things that cannot be cast to a number", (v) => {
      expect(util.types.isNumber(v)).toBe(false);
    });

    it.prop([fc.float({ noNaN: true }).filter((v) => Number.isFinite(v))])(
      "returns a number when given a number",
      (v) => {
        expect(util.types.toNumber(v)).toBe(v);
      },
    );

    it.prop([validValues])(
      "returns a number when given something that can be cast to number",
      (v) => {
        expect(util.types.toNumber(v)).toBe(Number(v));
      },
    );

    it.prop([invalidValues])("throws when coercing non-number values", (v) => {
      expect(() => util.types.toNumber(v)).toThrow("cannot be coerced to a number");
    });

    it.prop([unknowns()])("returns the default value when a value is undefined", (v) => {
      expect(util.types.toNumber(v, 5.5)).toBe(5.5);
    });

    it.prop([emptyStrings()])("returns the default value when a value is empty string", (v) => {
      expect(util.types.toNumber(v, 5.5)).toBe(5.5);
    });

    it.prop([nulls()])("returns the default value when a value is null", (v) => {
      expect(util.types.toNumber(v, 5.5)).toBe(5.5);
    });
  });

  describe("bigint", () => {
    const invalidValues = fc.string().filter((v) => {
      try {
        BigInt(v);
        return false;
      } catch (error) {
        return true;
      }
    });

    it.prop([fc.bigInt()])("detects bigint value", (v) => {
      expect(util.types.isBigInt(v)).toBe(true);
    });

    it.prop([invalidValues])("detects non-bigint value", (v) => {
      expect(util.types.isBigInt(v)).toBe(false);
    });

    it.prop([fc.bigInt()])("coerces bigint values", (v) => {
      expect(util.types.toBigInt(v.toString())).toBe(v);
    });

    it.prop([invalidValues])("throws when coercing non-bigint values", (v) => {
      expect(() => util.types.toBigInt(v)).toThrow("cannot be coerced to bigint");
    });
  });

  describe("date", () => {
    const invalidValues = fc.oneof(
      // Filter out numerical strings as many of those are valid enough for ISO
      // TODO: Figure out if this is fine or if we should only accept specific formats
      fc
        .string()
        .filter((v) => !Number.parseInt(v)),
    );

    it.prop([fc.date({ noInvalidDate: true })])("detects date value", (v) => {
      expect(util.types.isDate(v)).toBe(true);
    });

    it.prop([invalidValues])("detects non-date value", (v) => {
      expect(util.types.isDate(v)).toBe(false);
    });

    it.prop([fc.date({ noInvalidDate: true })])("coerces date values", (v) => {
      const result = util.types.toDate(v.toISOString());
      expect(result.toISOString()).toBe(v.toISOString());
    });

    it.prop([invalidValues])("throws when coercing non-date values", (v) => {
      expect(() => util.types.toDate(v)).toThrow("cannot be coerced to date");
    });
  });

  describe("url", () => {
    const invalidValues = fc.oneof(fc.string());

    it.prop([
      fc.oneof(
        fc.webUrl(),
        fc.domain().map((v) => `https://${v}`),
      ),
    ])("detects url value", (v) => {
      expect(util.types.isUrl(v)).toBe(true);
    });

    it.prop([invalidValues])("detects non-url value", (v) => {
      expect(util.types.isUrl(v)).toBe(false);
    });
  });

  describe("buffer data payload", () => {
    it.prop([
      fc.record(
        {
          data: bufferArbitrary,
          contentType: fc.string(),
        },
        { noNullPrototype: true },
      ),
    ])("detects buffer data payload", (v) => {
      expect(util.types.isBufferDataPayload(v)).toBe(true);
    });

    it.prop([fc.record({ data: bufferArbitrary }, { noNullPrototype: true })])(
      "detects buffer data payload missing optional content type",
      (v) => {
        expect(util.types.isBufferDataPayload(v)).toBe(true);
      },
    );

    it.prop([
      fc.record(
        {
          data: fc.oneof(fc.string(), fc.object()),
        },
        { noNullPrototype: true },
      ),
    ])("does not detect non-buffers as buffer data payloads", (v) => {
      expect(util.types.isBufferDataPayload(v)).toBe(false);
    });

    it.prop([fc.string()])("coerces string to plain text buffer", (v) => {
      const result = util.types.toBufferDataPayload(v);
      expect(result.contentType).toBe("text/plain");
      expect(Buffer.isBuffer(result.data)).toBe(true);
      expect(result.data.equals(Buffer.from(v, "utf-8"))).toBe(true);
    });

    it.prop([fc.oneof(fc.array(fc.anything()), fc.object())])(
      "serializes data to JSON and coerces to json text buffer",
      (v) => {
        const result = util.types.toBufferDataPayload(v);
        expect(result.contentType).toBe("application/json");
        expect(Buffer.isBuffer(result.data)).toBe(true);
        expect(result.data.equals(Buffer.from(JSON.stringify(v), "utf-8"))).toBe(true);
      },
    );

    it.prop([
      fc.record(
        {
          data: bufferArbitrary,
          contentType: fc.string(),
          suggestedExtension: fc.oneof(fc.constant(undefined), fc.string()),
        },
        { noNullPrototype: true },
      ),
    ])("directly returns DataPayload", (v) => {
      const result = util.types.toBufferDataPayload(v);
      expect(result.contentType).toBe(v.contentType);
      expect(result.suggestedExtension).toBe(v.suggestedExtension);
      expect(Buffer.isBuffer(result.data)).toBe(true);
      expect(result.data.equals(v.data)).toBe(true);
    });

    it.prop([bufferArbitrary])("returns buffer with unknown content type", (v) => {
      const result = util.types.toBufferDataPayload(v);
      expect(result.contentType).toBe("application/octet-stream");
      expect(Buffer.isBuffer(result.data)).toBe(true);
      expect(result.data.equals(v)).toBe(true);
    });

    it.prop([uint8ArrayArbitrary])("handles Uint8Array as a Buffer", (v) => {
      const result = util.types.toBufferDataPayload(v);
      expect(result.contentType).toBe("application/octet-stream");
      expect(Buffer.isBuffer(result.data)).toBe(true);
      expect(result.data.equals(Buffer.from(v))).toBe(true);
    });
  });

  describe("data", () => {
    it.prop([
      fc.record(
        {
          data: bufferArbitrary,
          contentType: fc.string(),
        },
        { noNullPrototype: true },
      ),
    ])("detects data payload", (v) => {
      expect(util.types.isData(v)).toBe(true);
    });

    it.prop([fc.string()])("coerces string to plain text buffer", (v) => {
      const result = util.types.toData(v);
      expect(result.contentType).toBe("text/plain");
      expect(Buffer.isBuffer(result.data)).toBe(true);
      expect(result.data.equals(Buffer.from(v, "utf-8"))).toBe(true);
    });

    it.prop([fc.oneof(fc.array(fc.anything()), fc.object())])(
      "serializes data to JSON and coerces to json text buffer",
      (v) => {
        const result = util.types.toData(v);
        expect(result.contentType).toBe("application/json");
        expect(Buffer.isBuffer(result.data)).toBe(true);
        expect(result.data.equals(Buffer.from(JSON.stringify(v), "utf-8"))).toBe(true);
      },
    );

    it.prop([
      fc.record(
        {
          data: bufferArbitrary,
          contentType: fc.string(),
          suggestedExtension: fc.oneof(fc.constant(undefined), fc.string()),
        },
        { noNullPrototype: true },
      ),
    ])("directly returns DataPayload", (v) => {
      const result = util.types.toData(v);
      expect(result.contentType).toBe(v.contentType);
      expect(result.suggestedExtension).toBe(v.suggestedExtension);
      expect(Buffer.isBuffer(result.data)).toBe(true);
      expect(result.data.equals(v.data)).toBe(true);
    });

    it.prop([bufferArbitrary])("returns buffer with unknown content type", (v) => {
      const result = util.types.toData(v);
      expect(result.contentType).toBe("application/octet-stream");
      expect(Buffer.isBuffer(result.data)).toBe(true);
      expect(result.data.equals(v)).toBe(true);
    });

    it.prop([uint8ArrayArbitrary])("handles Uint8Array as a Buffer", (v) => {
      const result = util.types.toData(v);
      expect(result.contentType).toBe("application/octet-stream");
      expect(Buffer.isBuffer(result.data)).toBe(true);
      expect(result.data.equals(Buffer.from(v))).toBe(true);
    });
  });

  describe("string", () => {
    it("detects a string value", () => {
      expect(util.types.isString("value")).toStrictEqual(true);
      expect(util.types.isString(new String("value"))).toStrictEqual(true);
    });

    it("detects a non-string value", () => {
      expect(util.types.isString(["value"])).toStrictEqual(false);
      expect(util.types.isString(4)).toStrictEqual(false);
    });

    it.prop([bufferArbitrary])("coerces plain text buffer to string", (v) => {
      expect(util.types.toString(v)).toBe(v.toString());
    });

    it.prop([unknowns()])("coerces unknown value to empty string", (v) => {
      expect(util.types.toString(v)).toBe("");
    });

    it.prop([unknowns()])("coerces unknown value to given default string", (v) => {
      expect(util.types.toString(v, "hello, world")).toBe("hello, world");
    });
  });

  //TODO add an arbitrary for KeyValueList to test unique values
  describe("KeyValueList", () => {
    it.prop([bufferArbitrary])("coerces KeyValueList to object", () => {
      const fakeData = [
        { key: "foo", value: "bar" },
        { key: "myKey", value: "myValue" },
      ];
      const expectedData = { foo: "bar", myKey: "myValue" };
      expect(util.types.keyValPairListToObject(fakeData)).toStrictEqual(expectedData);
    });

    it.each([undefined, null, ""])("handles invalid values", (value) => {
      expect(util.types.keyValPairListToObject(value as unknown as any)).toStrictEqual({});
    });
  });

  const validJSON = fc.jsonValue().map((x) => JSON.stringify(x));
  const invalidJSON = fc.constantFrom("", "['']", "someString", null, undefined);
  describe("JSON", () => {
    it.prop([validJSON])("returns true in the case of actual JSON", (v) => {
      expect(util.types.isJSON(v)).toBe(true);
    });

    it.prop([invalidJSON])("returns false in the case of invalid JSON", (v) => {
      expect(util.types.isJSON(util.types.toString(v))).toBe(false);
    });

    it.prop([validJSON])("serializes JSON", (v) => {
      expect(() => util.types.toJSON(v)).not.toThrow();
    });

    it("serialize JSON with default options", () => {
      const payload = { foo: "bar", baz: "buz" };
      expect(util.types.toJSON(payload)).toStrictEqual(`{\n  "baz": "buz",\n  "foo": "bar"\n}`);
    });

    it("serialize JSON with pretty print and retain key order", () => {
      const payload = { foo: "bar", baz: "buz" };
      expect(util.types.toJSON(payload, true, true)).toStrictEqual(
        `{\n  "foo": "bar",\n  "baz": "buz"\n}`,
      );
    });

    it("serialize JSON without pretty print and retain key order", () => {
      const payload = { foo: "bar", baz: "buz" };
      expect(util.types.toJSON(payload, false, true)).toStrictEqual('{"foo":"bar","baz":"buz"}');
    });

    it("serialize JSON with pretty print and don't retain key order", () => {
      const payload = { foo: "bar", baz: "buz" };
      expect(util.types.toJSON(payload, true, false)).toStrictEqual(
        `{\n  "baz": "buz",\n  "foo": "bar"\n}`,
      );
    });

    it("serialize JSON without pretty print and don't retain key order", () => {
      const payload = { foo: "bar", baz: "buz" };
      expect(util.types.toJSON(payload, false, false)).toStrictEqual('{"baz":"buz","foo":"bar"}');
    });

    it("removes functions", () => {
      const value = {
        foo: () => {
          return;
        },
      };
      expect(util.types.toJSON(value)).toStrictEqual("{}");
    });

    it("removes cyclic data", () => {
      const value: Record<string, unknown> = {};
      value.value = value;
      expect(util.types.toJSON(value)).toStrictEqual("{}");
    });
  });

  describe("headers", () => {
    it("lowercase headers", () => {
      expect(util.types.lowerCaseHeaders({ "Content-Type": "Application/Json" })).toStrictEqual({
        "content-type": "Application/Json",
      });
    });
  });

  describe("objectSelection", () => {
    it("detects valid values", () => {
      const v = [{ object: "foo" }];
      expect(util.types.isObjectSelection(v)).toStrictEqual(true);
      expect(util.types.isObjectSelection(JSON.stringify(v))).toStrictEqual(true);
    });

    it("detects invalid values", () => {
      const v = [{ missingObjectKey: "foo" }];
      expect(util.types.isObjectSelection(v)).toStrictEqual(false);
      expect(util.types.isObjectSelection(JSON.stringify(v))).toStrictEqual(false);
    });

    it("coerces valid values", () => {
      const v = [{ object: "foo" }];
      expect(util.types.toObjectSelection(v)).toStrictEqual(v);
      expect(util.types.toObjectSelection(JSON.stringify(v))).toStrictEqual(v);
    });

    it("throws on invalid values", () => {
      const v = [{ missingObjectKey: "foo" }];
      const error = "cannot be coerced to ObjectSelection";
      expect(() => util.types.toObjectSelection(v)).toThrow(error);
      expect(() => util.types.toObjectSelection(JSON.stringify(v))).toThrow(error);
    });
  });

  describe("objectFieldMap", () => {
    it("detects valid values", () => {
      const v = { fields: [{ field: { key: "foo" } }] };
      expect(util.types.isObjectFieldMap(v)).toStrictEqual(true);
      expect(util.types.isObjectFieldMap(JSON.stringify(v))).toStrictEqual(true);
    });

    it("detects invalid values", () => {
      const v1 = { missingFields: [{ field: { key: "foo" } }] };
      const v2 = { fields: [{ missingField: { key: "foo" } }] };
      const v3 = { fields: [{ field: { missingKey: "foo" } }] };
      expect(util.types.isObjectFieldMap(v1)).toStrictEqual(false);
      expect(util.types.isObjectFieldMap(JSON.stringify(v1))).toStrictEqual(false);
      expect(util.types.isObjectFieldMap(v2)).toStrictEqual(false);
      expect(util.types.isObjectFieldMap(JSON.stringify(v2))).toStrictEqual(false);
      expect(util.types.isObjectFieldMap(v3)).toStrictEqual(false);
      expect(util.types.isObjectFieldMap(JSON.stringify(v3))).toStrictEqual(false);
    });

    it("coerces valid values", () => {
      const v = { fields: [{ field: { key: "foo" } }] };
      expect(util.types.toObjectFieldMap(v)).toStrictEqual(v);
      expect(util.types.toObjectFieldMap(JSON.stringify(v))).toStrictEqual(v);
    });

    it("throws on invalid values", () => {
      const v1 = { missingFields: [{ field: { key: "foo" } }] };
      const v2 = { fields: [{ missingField: { key: "foo" } }] };
      const v3 = { fields: [{ field: { missingKey: "foo" } }] };
      const error = "cannot be coerced to ObjectFieldMap";
      expect(() => util.types.toObjectFieldMap(v1)).toThrow(error);
      expect(() => util.types.toObjectFieldMap(JSON.stringify(v1))).toThrow(error);
      expect(() => util.types.toObjectFieldMap(v2)).toThrow(error);
      expect(() => util.types.toObjectFieldMap(JSON.stringify(v2))).toThrow(error);
      expect(() => util.types.toObjectFieldMap(v3)).toThrow(error);
      expect(() => util.types.toObjectFieldMap(JSON.stringify(v3))).toThrow(error);
    });
  });

  describe("jsonForm", () => {
    it("detects valid values", () => {
      const v = { schema: {}, uiSchema: {}, data: {} };
      expect(util.types.isJSONForm(v)).toStrictEqual(true);
      expect(util.types.isJSONForm(JSON.stringify(v))).toStrictEqual(true);
    });

    it("detects invalid values", () => {
      const v1 = { missingSchema: {}, uiSchema: {}, data: {} };
      const v2 = { schema: {}, missingUiSchema: {}, data: {} };
      const v3 = { schema: {}, uiSchema: {}, missingData: {} };
      expect(util.types.isJSONForm(v1)).toStrictEqual(false);
      expect(util.types.isJSONForm(JSON.stringify(v1))).toStrictEqual(false);
      expect(util.types.isJSONForm(v2)).toStrictEqual(false);
      expect(util.types.isJSONForm(JSON.stringify(v2))).toStrictEqual(false);
      expect(util.types.isJSONForm(v3)).toStrictEqual(false);
      expect(util.types.isJSONForm(JSON.stringify(v3))).toStrictEqual(false);
    });

    it("coerces valid values", () => {
      const v = { schema: {}, uiSchema: {}, data: {} };
      expect(util.types.toJSONForm(v)).toStrictEqual(v);
      expect(util.types.toJSONForm(JSON.stringify(v))).toStrictEqual(v);
    });

    it("throws on invalid values", () => {
      const v1 = { missingSchema: {}, uiSchema: {}, data: {} };
      const v2 = { schema: {}, missingUiSchema: {}, data: {} };
      const v3 = { schema: {}, uiSchema: {}, missingData: {} };
      const error = "cannot be coerced to JSONForm";
      expect(() => util.types.toJSONForm(v1)).toThrow(error);
      expect(() => util.types.toJSONForm(JSON.stringify(v1))).toThrow(error);
      expect(() => util.types.toJSONForm(v2)).toThrow(error);
      expect(() => util.types.toJSONForm(JSON.stringify(v2))).toThrow(error);
      expect(() => util.types.toJSONForm(v3)).toThrow(error);
      expect(() => util.types.toJSONForm(JSON.stringify(v3))).toThrow(error);
    });
  });

  describe("picklist", () => {
    it("detects picklist value", () => {
      const v1 = ["value", new String("value")];
      const v2: unknown = [];
      const v3 = [{ key: "foo" }, { key: "foo", label: "Foo" }];
      expect(util.types.isPicklist(v1)).toStrictEqual(true);
      expect(util.types.isPicklist(v2)).toStrictEqual(true);
      expect(util.types.isPicklist(v3)).toStrictEqual(true);
    });

    it("detects non-picklist value", () => {
      const v1 = "value";
      const v2 = ["value", 4];
      const v3 = [{ missingKey: "foo" }];
      expect(util.types.isPicklist(v1)).toStrictEqual(false);
      expect(util.types.isPicklist(v2)).toStrictEqual(false);
      expect(util.types.isPicklist(v3)).toStrictEqual(false);
    });
  });

  describe("schedule", () => {
    it("detects schedule value", () => {
      const v1 = { value: "00 00 * * 2,3" };
      const v2 = {
        value: "00 00 * * 2,3",
        timeZone: "America/Chicago",
        scheduleType: "week",
      };
      expect(util.types.isSchedule(v1)).toStrictEqual(true);
      expect(util.types.isSchedule(v2)).toStrictEqual(true);
    });

    it("detects non-schedule value", () => {
      const v = {
        missingValue: "00 00 * * 2,3",
        timeZone: "America/Chicago",
        scheduleType: "week",
      };
      expect(util.types.isSchedule(v)).toStrictEqual(false);
    });
  });

  describe("connection", () => {
    const baseConnection = {
      key: "connection",
      label: "My connection",
    };

    it("detects valid connection", () => {
      const v1 = {
        ...baseConnection,
        oauth2Type: "authorization_code",
        inputs: {
          authorizeUrl: "https://example.com",
          tokenUrl: "https://example.com",
          scopes: ["scope_one"],
          clientId: "1234",
          clientSecret: "asdf",
        },
      };

      const v2 = {
        ...v1,
        inputs: {
          authorizeUrl: "https://example.com",
          tokenUrl: "https://example.com",
          clientId: "1234",
          clientSecret: "asdf",
        },
      };

      const v3 = {
        ...baseConnection,
        oauth2Type: "authorization_code",
        inputs: {
          tokenUrl: "https://example.com",
          scopes: ["scope_one"],
          clientId: "1234",
          clientSecret: "asdf",
        },
      };
      expect(util.types.isConnection(v1)).toStrictEqual(true);
      expect(util.types.isConnection(v2)).toStrictEqual(true);
      expect(util.types.isConnection(v3)).toStrictEqual(true);
    });

    it("detects invalid connection", () => {
      const v1 = {
        ...baseConnection,
        oauth2Type: "authorization_code",
        inputs: {
          authorizeUrl: "https://example.com",
          tokenUrl: "https://example.com",
          clientId: "1234",
        },
      };

      const v2 = {
        ...baseConnection,
        oauth2Type: "authorization_code",
        inputs: {
          scopes: ["scope_one"],
          clientId: "1234",
          clientSecret: "asdf",
        },
      };

      const v3 = baseConnection;

      expect(util.types.isConnection(v1)).toStrictEqual(false);
      expect(util.types.isConnection(v2)).toStrictEqual(false);
      expect(util.types.isConnection(v3)).toStrictEqual(false);
    });
  });

  describe("toObject", () => {
    it("parses JSON correctly", () => {
      const value = '{"foo":"bar","baz":123,"buz":false}';
      const expectedResult = { foo: "bar", baz: 123, buz: false };
      expect(util.types.toObject(value)).toStrictEqual(expectedResult);
    });
    it("objects remain objects", () => {
      const value = { foo: "bar", baz: 123, buz: false };
      expect(util.types.toObject(value)).toStrictEqual(value);
    });
  });

  describe("cleanObject", () => {
    it('removes undefined, null and "" by default', () => {
      const input = {
        foo: "bar",
        bar: undefined,
        baz: null,
        buz: false,
        biz: "",
      };
      const expectedResult = { foo: "bar", buz: false };
      expect(util.types.cleanObject(input)).toStrictEqual(expectedResult);
    });

    it("allows for custom predicates to be defined", () => {
      const input = { foo: 1, bar: 2, baz: 3 };
      const predicate = (v: number) => v % 2 === 0;
      const expectedResult = { foo: 1, baz: 3 };
      const result = util.types.cleanObject(input, predicate);
      expect(result).toStrictEqual(expectedResult);
    });
  });
});
