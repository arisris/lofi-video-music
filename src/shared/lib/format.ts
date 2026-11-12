export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Parses rgb()/rgba() functional notation, accepting channels as 0-255 ints
 * or 0-1 floats. ColorInput's swatch emits rgba() strings, so anything that
 * resolves a stored colour to shader floats must understand them — otherwise
 * every swatch-picked colour silently falls back to the default.
 */
function parseCssRgb(input: string): [number, number, number, number] | null {
  const m = input
    .trim()
    .match(
      /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i,
    );
  if (!m) return null;
  const channel = (v: string): number | null => {
    const n = parseFloat(v);
    if (!Number.isFinite(n)) return null;
    // 0-255 ints vs 0-1 floats: a bare "1" is ambiguous, but CSS clamps
    // integer channels, so treat values in (1, 255] as 0-255 and keep
    // fractional values as 0-1. Non-integers above 1 are invalid.
    if (n > 1) {
      if (!Number.isInteger(n) || n > 255) return null;
      return n / 255;
    }
    return n;
  };
  const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
  const r = channel(m[1]);
  const g = channel(m[2]);
  const b = channel(m[3]);
  if (r === null || g === null || b === null) return null;
  const a =
    m[4] === undefined || !Number.isFinite(parseFloat(m[4]))
      ? 1
      : parseFloat(m[4]);
  return [clamp01(r), clamp01(g), clamp01(b), clamp01(a)];
}

export function hexToRGB(hex: string): [number, number, number] {
  const css = parseCssRgb(hex || "");
  if (css) return [css[0], css[1], css[2]];
  let h = (hex || "").replace(/^#/, "");
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-f]{6}$/i.test(h)) return [0.23, 0.51, 0.96];
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

export function hexToRGBA(hex: string): [number, number, number, number] {
  const css = parseCssRgb(hex || "");
  if (css) return css;
  let h = (hex || "").replace(/^#/, "");
  if (h.length === 3 || h.length === 4) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) return [0, 0, 0, 0];
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
    h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
  ];
}
