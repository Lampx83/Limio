/** Bài liền trước và liền sau trong khoá, theo đúng thứ tự học viên thấy (đã bỏ bài và chương bị ẩn). */
export type NeighbourModule = { id: string; title: string; lessons: { id: string; title: string; locked?: boolean }[] };
export type Neighbour = { id: string; title: string; moduleTitle: string; locked: boolean; newModule: boolean };

export function lessonNeighbours(modules: NeighbourModule[], currentId: string): { prev: Neighbour | null; next: Neighbour | null; position: number; total: number } {
  const flat = modules.flatMap((m) => m.lessons.map((l) => ({ id: l.id, title: l.title, moduleId: m.id, moduleTitle: m.title, locked: !!l.locked })));
  const i = flat.findIndex((l) => l.id === currentId);
  if (i < 0) return { prev: null, next: null, position: 0, total: flat.length };
  const cur = flat[i]!;
  const pick = (l: (typeof flat)[number] | undefined): Neighbour | null =>
    l ? { id: l.id, title: l.title, moduleTitle: l.moduleTitle, locked: l.locked, newModule: l.moduleId !== cur.moduleId } : null;
  return { prev: pick(flat[i - 1]), next: pick(flat[i + 1]), position: i + 1, total: flat.length };
}
