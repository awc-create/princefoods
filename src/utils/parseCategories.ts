export type CategoryMap = Record<string, string[]>;

export function parseCategories(collections: string[]): CategoryMap {
  const map: CategoryMap = {};

  for (const entry of collections) {
    const [parent, child] = entry.split(';').map(x => x.trim());
    if (!parent) continue;
    if (!map[parent]) map[parent] = [];

    if (child && !map[parent].includes(child)) {
      map[parent].push(child);
    }
  }

  return map;
}
