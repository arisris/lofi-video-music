// Single generic registry for clips, vfx, and visualizers.
// Replaces the 3 parallel registries in src_old:
// lib/clips/registry.ts, lib/vfx/index.ts, lib/gl-viz/registry.ts
export interface RegistryEntry {
  type: string;
}

export function createRegistry<T extends RegistryEntry>() {
  const items: T[] = [];
  return {
    register(entry: T) {
      const i = items.findIndex((e) => e.type === entry.type);
      if (i >= 0) items[i] = entry;
      else items.push(entry);
    },
    get(type: string): T | undefined {
      return items.find((e) => e.type === type);
    },
    list(): T[] {
      return [...items];
    },
    clear() {
      items.length = 0;
    },
  };
}
