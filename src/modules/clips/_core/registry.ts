// Single generic registry for clips, vfx, and visualizers.
// Clips and VFX key on `type`; visualizers key on `id` (same shape, different
// key field). Pass an explicit key extractor when the entry uses `id`.
// Replaces the 3 parallel per-domain Map implementations.
export type RegistryKey = string;

export function createRegistry<T>(getKey?: (entry: T) => string) {
  const keyOf =
    getKey ??
    ((e: T) =>
      (e as { type?: string; id?: string }).type ??
      (e as { id?: string }).id ??
      "");
  const items: T[] = [];
  return {
    register(entry: T) {
      const key = keyOf(entry);
      const i = items.findIndex((e) => keyOf(e) === key);
      if (i >= 0) items[i] = entry;
      else items.push(entry);
    },
    get(key: string): T | undefined {
      return items.find((e) => keyOf(e) === key);
    },
    list(): T[] {
      return [...items];
    },
    clear() {
      items.length = 0;
    },
  };
}
