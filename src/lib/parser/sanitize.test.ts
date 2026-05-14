import { sanitizeParsedSave } from "@/lib/parser/sanitize";

describe("sanitizeParsedSave", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("is a no-op on a benign tree", () => {
    const save = {
      header: { saveVersion: 42 },
      levels: [{ objects: [{ properties: { mFoo: { value: 1 } } }] }],
    };
    sanitizeParsedSave(save);
    expect(warnSpy).not.toHaveBeenCalled();
    expect(save.levels[0].objects[0].properties.mFoo.value).toBe(1);
  });

  it("resets a poisoned prototype on a properties map", () => {
    // Simulate the PropertiesList.ParseList outcome when a save contains a
    // property literally named '__proto__': the parser does
    // `properties[name] = parsedProperty`, which triggers the __proto__
    // setter and changes the prototype of `properties` to `parsedProperty`.
    const malicious = { mNumTotalInventorySlots: { value: 9999 } };
    const props: Record<string, unknown> = {};
    (props as { __proto__: unknown }).__proto__ = malicious;

    // Sanity: before sanitize, the literal-key lookup resolves through the
    // poisoned prototype to attacker-controlled data.
    expect(
      (props as { mNumTotalInventorySlots?: { value: number } })
        .mNumTotalInventorySlots?.value
    ).toBe(9999);

    const save = { levels: [{ objects: [{ properties: props }] }] };
    sanitizeParsedSave(save);

    expect(warnSpy).toHaveBeenCalled();
    expect(Object.getPrototypeOf(props)).toBe(Object.prototype);
    expect(
      (props as { mNumTotalInventorySlots?: { value: number } })
        .mNumTotalInventorySlots?.value
    ).toBeUndefined();
  });

  it("strips a malicious own 'constructor' key", () => {
    const props: Record<string, unknown> = {
      mFoo: { value: 1 },
      constructor: { value: "attacker" },
    };
    sanitizeParsedSave({ levels: [{ objects: [{ properties: props }] }] });

    expect(warnSpy).toHaveBeenCalled();
    expect(Object.prototype.hasOwnProperty.call(props, "constructor")).toBe(
      false
    );
    expect(props.constructor).toBe(Object);
  });

  it("does not loop on cycles", () => {
    const a: Record<string, unknown> = {};
    const b: Record<string, unknown> = { a };
    a.b = b;
    expect(() => sanitizeParsedSave(a)).not.toThrow();
  });

  it("does not touch typed arrays", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const save = { rawBytes: bytes };
    sanitizeParsedSave(save);
    expect(Object.getPrototypeOf(bytes)).toBe(Uint8Array.prototype);
  });

  it("sanitizes nested struct property maps", () => {
    const nested: Record<string, unknown> = {};
    (nested as { __proto__: unknown }).__proto__ = { stolen: true };
    const save = {
      levels: [
        {
          objects: [
            {
              properties: {
                mStruct: {
                  type: "StructProperty",
                  value: { properties: nested },
                },
              },
            },
          ],
        },
      ],
    };
    sanitizeParsedSave(save);
    expect(Object.getPrototypeOf(nested)).toBe(Object.prototype);
  });
});
