/**
 * Defensive shim against prototype pollution from malicious .sav files.
 *
 * `PropertiesList.ParseList` in @etothepii/satisfactory-file-parser builds
 * its property map with `properties[parsedProperty.name] = parsedProperty`
 * on a plain `{}`. If a save contains a property named `__proto__`, the
 * assignment invokes the prototype setter instead of creating an own key —
 * the map's prototype becomes the attacker-controlled Property, and later
 * literal-key lookups (e.g. `properties["mNodePuritySettings"]`) may resolve
 * through that prototype to attacker-controlled data.
 *
 * Mitigation here is a one-pass walk over the parsed save: any object whose
 * prototype is not Object.prototype gets reset, and any own `constructor`
 * key (which can shadow inherited `constructor`) is deleted. We log when we
 * find either — a benign save never trips this.
 */

const SAFE_PROTOTYPE = Object.prototype;

export function sanitizeParsedSave(root: unknown): void {
  const seen = new WeakSet<object>();
  const stack: unknown[] = [root];
  let poisonedPrototypes = 0;
  let poisonedConstructors = 0;

  while (stack.length > 0) {
    const value = stack.pop();
    if (value === null || typeof value !== "object") continue;
    if (seen.has(value as object)) continue;
    seen.add(value as object);

    if (Array.isArray(value)) {
      for (const item of value) stack.push(item);
      continue;
    }

    // ArrayBuffer / typed array views appear in some Property payloads
    // (rawBytes-style fields); skip them — they can't carry pollution.
    if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) continue;

    const proto = Object.getPrototypeOf(value);
    if (proto !== SAFE_PROTOTYPE && proto !== null) {
      Object.setPrototypeOf(value, SAFE_PROTOTYPE);
      poisonedPrototypes++;
    }
    if (Object.prototype.hasOwnProperty.call(value, "constructor")) {
      delete (value as Record<string, unknown>).constructor;
      poisonedConstructors++;
    }

    for (const key of Object.keys(value as object)) {
      stack.push((value as Record<string, unknown>)[key]);
    }
  }

  if (poisonedPrototypes > 0 || poisonedConstructors > 0) {
    console.warn(
      `[sanitizeParsedSave] neutralized ${poisonedPrototypes} poisoned ` +
        `prototype(s) and ${poisonedConstructors} suspicious 'constructor' ` +
        `key(s) — the loaded save may be crafted or corrupt.`
    );
  }
}
