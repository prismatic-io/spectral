import fc from "fast-check";
import util from "./util";

describe("util", () => {
  const bufferArbitrary = fc
    .base64String()
    .map((v) => Buffer.from(v, "base64"));
  const uint8ArrayArbitrary = bufferArbitrary.map((b) => new Uint8Array(b));
  const unknowns = (): fc.Arbitrary<unknown> => fc.constantFrom(undefined);
  const emptyStrings = (): fc.Arbitrary<string> => fc.constantFrom("");

  describe("boolean", () => {
    type TruthyValue = true | "true" | "t" | "T" | "yes" | "y" | "Y";
    type FalsyValue = false | "false" | "f" | "F" | "no" | "n" | "N" | "";

    const booleanStringValues = {
      truthy: ["true", "t", "T", "yes", "y", "Y"],
      falsy: ["false", "f", "F", "no", "n", "N", ""],
    };

    const truthy = (): fc.Arbitrary<TruthyValue> =>
      fc.constantFrom<TruthyValue[]>(
        true,
        ...(booleanStringValues.truthy as TruthyValue[])
      );
    const falsy = (): fc.Arbitrary<fc.FalsyValue | FalsyValue> =>
      fc.constantFrom<FalsyValue[]>(
        false,
        ...(booleanStringValues.falsy as FalsyValue[])
      );

    const invalidValues = fc.oneof(
      fc.integer(),
      fc
        .string()
        .filter(
          (v) =>
            !booleanStringValues.truthy.includes(v) &&
            !booleanStringValues.falsy.includes(v)
        ),
      fc.float(),
      fc.double()
    );

    it("detects boolean value", () => {
      fc.assert(
        fc.property(fc.boolean(), (v) =>
          expect(util.types.isBool(v)).toStrictEqual(true)
        )
      );
    });

    it("detects non-boolean value", () => {
      fc.assert(
        fc.property(invalidValues, (v) =>
          expect(util.types.isBool(v)).toStrictEqual(false)
        )
      );
    });

    it("coerces truthy values to true", () => {
      fc.assert(
        fc.property(truthy(), (v) =>
          expect(util.types.toBool(v)).toStrictEqual(true)
        )
      );
    });

    it("coerces falsy values to false", () => {
      fc.assert(
        fc.property(falsy(), (v) =>
          expect(util.types.toBool(v)).toStrictEqual(false)
        )
      );
    });

    it("allows for boolean default to false for undefined inputs and undefined default", () => {
      fc.assert(
        fc.property(unknowns(), (v) =>
          expect(util.types.toBool(v)).toStrictEqual(false)
        )
      );
    });

    it("allows for boolean default of false for undefined inputs", () => {
      fc.assert(
        fc.property(unknowns(), (v) =>
          expect(util.types.toBool(v, false)).toStrictEqual(false)
        )
      );
    });

    it("allows for boolean default of true for undefined inputs", () => {
      fc.assert(
        fc.property(unknowns(), (v) =>
          expect(util.types.toBool(v, true)).toStrictEqual(true)
        )
      );
    });

    it("allows for boolean default to false for empty string inputs and undefined default", () => {
      fc.assert(
        fc.property(emptyStrings(), (v) =>
          expect(util.types.toBool(v)).toStrictEqual(false)
        )
      );
    });

    it("allows for boolean default of false for empty string inputs", () => {
      fc.assert(
        fc.property(emptyStrings(), (v) =>
          expect(util.types.toBool(v, false)).toStrictEqual(false)
        )
      );
    });

    it("allows for boolean default of true for empty string inputs", () => {
      fc.assert(
        fc.property(emptyStrings(), (v) =>
          expect(util.types.toBool(v, true)).toStrictEqual(true)
        )
      );
    });
  });

  describe("integer", () => {
    const invalidValues = fc.oneof(
      fc.string().filter((v) => Number.isNaN(Number.parseInt(v)) && v !== "")
    );

    it("detects integer value", () => {
      fc.assert(
        fc.property(fc.integer(), (v) =>
          expect(util.types.isInt(v)).toStrictEqual(true)
        )
      );
    });

    it("detects non-integer value", () => {
      fc.assert(
        fc.property(invalidValues, (v) =>
          expect(util.types.isInt(v)).toStrictEqual(false)
        )
      );
    });

    it("coerces integer values", () => {
      fc.assert(
        fc.property(fc.integer(), (v) =>
          expect(util.types.toInt(v.toString())).toStrictEqual(v)
        )
      );
    });

    it("coerces a float to an int", () => {
      fc.assert(
        fc.property(fc.float(), (v) =>
          expect(util.types.toInt(v)).toStrictEqual(~~v)
        )
      );
    });

    it("throws when coercing non-integer values", () => {
      fc.assert(
        fc.property(invalidValues, (v) =>
          expect(() => util.types.toInt(v)).toThrow("cannot be coerced to int")
        )
      );
    });

    it("Allows for default value of 0 when value is undefined", () => {
      fc.assert(
        fc.property(unknowns(), (v) =>
          expect(util.types.toInt(v)).toStrictEqual(0)
        )
      );
    });

    it("Allows for default values when value is undefined", () => {
      fc.assert(
        fc.property(unknowns(), (v) =>
          expect(util.types.toInt(v, 20)).toStrictEqual(20)
        )
      );
    });

    it("Allows for default value of 0 when value is empty string", () => {
      fc.assert(
        fc.property(emptyStrings(), (v) =>
          expect(util.types.toInt(v)).toStrictEqual(0)
        )
      );
    });

    it("Allows for default values when value is empty string", () => {
      fc.assert(
        fc.property(emptyStrings(), (v) =>
          expect(util.types.toInt(v, 20)).toStrictEqual(20)
        )
      );
    });
  });

  describe("number", () => {
    const validValues = fc.string().filter((v) => !Number.isNaN(Number(v)));
    const invalidValues = fc.string().filter((v) => Number.isNaN(Number(v)));

    it("detects things that can be cast to a number", () => {
      fc.assert(
        fc.property(validValues, (v) =>
          expect(util.types.isNumber(v)).toStrictEqual(true)
        )
      );
    });

    it("detects things that cannot be cast to a number", () => {
      fc.assert(
        fc.property(invalidValues, (v) =>
          expect(util.types.isNumber(v)).toStrictEqual(false)
        )
      );
    });

    it("returns a number when given a number", () => {
      fc.assert(
        fc.property(fc.float(), (v) =>
          expect(util.types.toNumber(v)).toStrictEqual(v)
        )
      );
    });

    it("returns a number when given something that can be cast to number", () => {
      fc.assert(
        fc.property(validValues, (v) =>
          expect(util.types.toNumber(v)).toStrictEqual(Number(v))
        )
      );
    });

    it("throws when coercing non-number values", () => {
      fc.assert(
        fc.property(invalidValues, (v) =>
          expect(() => util.types.toNumber(v)).toThrow(
            "cannot be coerced to a number"
          )
        )
      );
    });

    it("returns the default value when a value is missing", () => {
      fc.assert(
        fc.property(unknowns(), (v) =>
          expect(util.types.toNumber(v, 5.5)).toStrictEqual(5.5)
        )
      );
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

    it("detects bigint value", () => {
      fc.assert(
        fc.property(fc.bigInt(), (v) =>
          expect(util.types.isBigInt(v)).toStrictEqual(true)
        )
      );
    });

    it("detects non-bigint value", () => {
      fc.assert(
        fc.property(invalidValues, (v) =>
          expect(util.types.isBigInt(v)).toStrictEqual(false)
        )
      );
    });

    it("coerces bigint values", () => {
      fc.assert(
        fc.property(fc.bigInt(), (v) =>
          expect(util.types.toBigInt(v.toString())).toStrictEqual(v)
        )
      );
    });

    it("throws when coercing non-bigint values", () => {
      fc.assert(
        fc.property(invalidValues, (v) =>
          expect(() => util.types.toBigInt(v)).toThrow(
            "cannot be coerced to bigint"
          )
        )
      );
    });
  });

  describe("date", () => {
    const invalidValues = fc.oneof(
      // Filter out numerical strings as many of those are valid enough for ISO
      // TODO: Figure out if this is fine or if we should only accept specific formats
      fc.string().filter((v) => !Number.parseInt(v))
    );

    it("detects date value", () => {
      fc.assert(
        fc.property(fc.date(), (v) =>
          expect(util.types.isDate(v)).toStrictEqual(true)
        )
      );
    });

    it("detects non-date value", () => {
      fc.assert(
        fc.property(invalidValues, (v) =>
          expect(util.types.isDate(v)).toStrictEqual(false)
        )
      );
    });

    it("coerces date values", () => {
      fc.assert(
        fc.property(fc.date(), (v) =>
          expect(util.types.toDate(v.toISOString())).toStrictEqual(v)
        )
      );
    });

    it("throws when coercing non-date values", () => {
      fc.assert(
        fc.property(invalidValues, (v) =>
          expect(() => util.types.toDate(v)).toThrow(
            "cannot be coerced to date"
          )
        )
      );
    });
  });

  describe("url", () => {
    const invalidValues = fc.oneof(fc.string());

    it("detects url value", () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.webUrl(),
            fc.domain().map((v) => `https://${v}`)
          ),
          (v) => expect(util.types.isUrl(v)).toStrictEqual(true)
        )
      );
    });

    it("detects non-url value", () => {
      fc.assert(
        fc.property(invalidValues, (v) =>
          expect(util.types.isUrl(v)).toStrictEqual(false)
        )
      );
    });
  });

  describe("buffer data payload", () => {
    it("detects buffer data payload", () => {
      const payloadTypes = fc.record({
        data: bufferArbitrary,
        contentType: fc.string(),
      });
      fc.assert(
        fc.property(payloadTypes, (v) => {
          expect(util.types.isBufferDataPayload(v)).toStrictEqual(true);
        })
      );
    });

    it("coerces string to plain text buffer", () => {
      fc.assert(
        fc.property(fc.string(), (v) => {
          expect(util.types.toBufferDataPayload(v)).toMatchObject({
            data: Buffer.from(v, "utf-8"),
            contentType: "text/plain",
          });
        })
      );
    });

    it("serializes data to JSON and coerces to json text buffer", () => {
      const jsonTypes = fc.oneof(fc.array(fc.anything()), fc.object());
      fc.assert(
        fc.property(jsonTypes, (v) =>
          expect(util.types.toBufferDataPayload(v)).toMatchObject({
            data: Buffer.from(JSON.stringify(v), "utf-8"),
            contentType: "application/json",
          })
        )
      );
    });

    it("directly returns DataPayload", () => {
      const payloadTypes = fc.record({
        data: bufferArbitrary,
        contentType: fc.string(),
        suggestedExtension: fc.oneof(fc.constant(undefined), fc.string()),
      });
      fc.assert(
        fc.property(payloadTypes, (v) =>
          expect(util.types.toBufferDataPayload(v)).toStrictEqual(v)
        )
      );
    });

    it("returns buffer with unknown content type", () => {
      fc.assert(
        fc.property(bufferArbitrary, (v) =>
          expect(util.types.toBufferDataPayload(v)).toMatchObject({
            data: v,
            contentType: "application/octet-stream",
          })
        )
      );
    });

    it("handles Uint8Array as a Buffer", () => {
      fc.assert(
        fc.property(uint8ArrayArbitrary, (v) =>
          expect(util.types.toBufferDataPayload(v)).toMatchObject({
            data: Buffer.from(v),
            contentType: "application/octet-stream",
          })
        )
      );
    });
  });

  describe("data", () => {
    it("detects data payload", () => {
      const payloadTypes = fc.record({
        data: bufferArbitrary,
        contentType: fc.string(),
      });
      fc.assert(
        fc.property(payloadTypes, (v) => {
          expect(util.types.isData(v)).toStrictEqual(true);
        })
      );
    });

    it("coerces string to plain text buffer", () => {
      fc.assert(
        fc.property(fc.string(), (v) => {
          expect(util.types.toData(v)).toMatchObject({
            data: Buffer.from(v, "utf-8"),
            contentType: "text/plain",
          });
        })
      );
    });

    it("serializes data to JSON and coerces to json text buffer", () => {
      const jsonTypes = fc.oneof(fc.array(fc.anything()), fc.object());
      fc.assert(
        fc.property(jsonTypes, (v) =>
          expect(util.types.toData(v)).toMatchObject({
            data: Buffer.from(JSON.stringify(v), "utf-8"),
            contentType: "application/json",
          })
        )
      );
    });

    it("directly returns DataPayload", () => {
      const payloadTypes = fc.record({
        data: bufferArbitrary,
        contentType: fc.string(),
        suggestedExtension: fc.oneof(fc.constant(undefined), fc.string()),
      });
      fc.assert(
        fc.property(payloadTypes, (v) =>
          expect(util.types.toData(v)).toStrictEqual(v)
        )
      );
    });

    it("returns buffer with unknown content type", () => {
      fc.assert(
        fc.property(bufferArbitrary, (v) =>
          expect(util.types.toData(v)).toMatchObject({
            data: v,
            contentType: "application/octet-stream",
          })
        )
      );
    });

    it("handles Uint8Array as a Buffer", () => {
      fc.assert(
        fc.property(uint8ArrayArbitrary, (v) =>
          expect(util.types.toData(v)).toMatchObject({
            data: Buffer.from(v),
            contentType: "application/octet-stream",
          })
        )
      );
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

    it("coerces plain text buffer to string", () => {
      fc.assert(
        fc.property(bufferArbitrary, (v) => {
          expect(util.types.toString(v)).toStrictEqual(v.toString());
        })
      );
    });

    it("coerces unknown value to empty string", () => {
      fc.assert(
        fc.property(unknowns(), (v) => {
          expect(util.types.toString(v)).toStrictEqual("");
        })
      );
    });

    it("coerces unknown value to given default string", () => {
      fc.assert(
        fc.property(unknowns(), (v) => {
          expect(util.types.toString(v, "hello, world")).toStrictEqual(
            "hello, world"
          );
        })
      );
    });
  });

  //TODO add an arbitrary for KeyValueList to test unique values
  describe("KeyValueList", () => {
    it("coerces KeyValueList to object", () => {
      fc.assert(
        fc.property(bufferArbitrary, () => {
          const fakeData = [
            { key: "foo", value: "bar" },
            { key: "myKey", value: "myValue" },
          ];
          const expectedData = { foo: "bar", myKey: "myValue" };
          expect(util.types.keyValPairListToObject(fakeData)).toStrictEqual(
            expectedData
          );
        })
      );
    });

    it.each([undefined, null, ""])("handles invalid values", (value) => {
      expect(
        util.types.keyValPairListToObject(value as unknown as any)
      ).toStrictEqual({});
    });
  });

  const validJSON = fc.jsonObject().map((x) => JSON.stringify(x));
  const invalidJSON = fc.constantFrom(
    "",
    "['']",
    "someString",
    null,
    undefined
  );
  describe("JSON", () => {
    it("returns true in the case of actual JSON", () => {
      fc.assert(
        fc.property(validJSON, (v) => {
          expect(util.types.isJSON(v)).toStrictEqual(true);
        })
      );
    });

    it("returns false in the case of invalid JSON", () => {
      fc.assert(
        fc.property(invalidJSON, (v) => {
          expect(util.types.isJSON(util.types.toString(v))).toStrictEqual(
            false
          );
        })
      );
    });

    it("serializes JSON", () => {
      fc.assert(
        fc.property(validJSON, (v) => {
          expect(() => util.types.toJSON(v)).not.toThrow();
        })
      );
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
      expect(
        util.types.lowerCaseHeaders({ "Content-Type": "Application/Json" })
      ).toStrictEqual({ "content-type": "Application/Json" });
    });
  });

  describe("objectSelection", () => {
    it("detects valid values", () => {
      const v = [{ object: "foo" }];
      expect(util.types.isObjectSelection(v)).toStrictEqual(true);
      expect(util.types.isObjectSelection(JSON.stringify(v))).toStrictEqual(
        true
      );
    });

    it("detects invalid values", () => {
      const v = [{ missingObjectKey: "foo" }];
      expect(util.types.isObjectSelection(v)).toStrictEqual(false);
      expect(util.types.isObjectSelection(JSON.stringify(v))).toStrictEqual(
        false
      );
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
      expect(() => util.types.toObjectSelection(JSON.stringify(v))).toThrow(
        error
      );
    });
  });

  describe("objectFieldMap", () => {
    it("detects valid values", () => {
      const v = { fields: [{ field: { key: "foo" } }] };
      expect(util.types.isObjectFieldMap(v)).toStrictEqual(true);
      expect(util.types.isObjectFieldMap(JSON.stringify(v))).toStrictEqual(
        true
      );
    });

    it("detects invalid values", () => {
      const v1 = { missingFields: [{ field: { key: "foo" } }] };
      const v2 = { fields: [{ missingField: { key: "foo" } }] };
      const v3 = { fields: [{ field: { missingKey: "foo" } }] };
      expect(util.types.isObjectFieldMap(v1)).toStrictEqual(false);
      expect(util.types.isObjectFieldMap(JSON.stringify(v1))).toStrictEqual(
        false
      );
      expect(util.types.isObjectFieldMap(v2)).toStrictEqual(false);
      expect(util.types.isObjectFieldMap(JSON.stringify(v2))).toStrictEqual(
        false
      );
      expect(util.types.isObjectFieldMap(v3)).toStrictEqual(false);
      expect(util.types.isObjectFieldMap(JSON.stringify(v3))).toStrictEqual(
        false
      );
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
      expect(() => util.types.toObjectFieldMap(JSON.stringify(v1))).toThrow(
        error
      );
      expect(() => util.types.toObjectFieldMap(v2)).toThrow(error);
      expect(() => util.types.toObjectFieldMap(JSON.stringify(v2))).toThrow(
        error
      );
      expect(() => util.types.toObjectFieldMap(v3)).toThrow(error);
      expect(() => util.types.toObjectFieldMap(JSON.stringify(v3))).toThrow(
        error
      );
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
      expect(util.types.isPicklist(v1)).toStrictEqual(true);
      expect(util.types.isPicklist(v2)).toStrictEqual(true);
    });

    it("detects non-picklist value", () => {
      const v1 = "value";
      const v2 = ["value", 4];
      expect(util.types.isPicklist(v1)).toStrictEqual(false);
      expect(util.types.isPicklist(v2)).toStrictEqual(false);
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
});
