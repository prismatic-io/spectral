import fc from "fast-check";
import util from "./util";

describe("util", () => {
  const bufferArbitrary = fc
    .base64String()
    .map((v) => Buffer.from(v, "base64"));
  const uint8ArrayArbitrary = bufferArbitrary.map((b) => new Uint8Array(b));
  const unknowns = (): fc.Arbitrary<unknown> => fc.constantFrom(undefined);

  describe("boolean", () => {
    type TruthyValue = true | "true" | "t" | "T" | "yes" | "y" | "Y";
    type FalsyValue = false | "false" | "f" | "F" | "no" | "n" | "N";

    const booleanStringValues = {
      truthy: ["true", "t", "T", "yes", "y", "Y"],
      falsy: ["false", "f", "F", "no", "n", "N"],
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

    it("throws when coercing non-boolean values", () => {
      fc.assert(
        fc.property(invalidValues, (v) =>
          expect(() => util.types.toBool(v)).toThrow(
            "cannot be coerced to bool"
          )
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
  });

  describe("integer", () => {
    const invalidValues = fc.oneof(
      fc.string().filter((v) => Number.isNaN(Number.parseInt(v)))
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

  describe("data", () => {
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
});
