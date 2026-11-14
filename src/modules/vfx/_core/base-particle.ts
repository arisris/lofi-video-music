// Shared numeric-setting guard for the VFX definitions.

/** Numeric setting with a fallback — corrupt/NaN project values must never
 * poison particle state permanently (NaN propagates and the guard
 * `y > h` never fires again). */
export function finiteSetting(
  settings: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const v = settings[key];
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
