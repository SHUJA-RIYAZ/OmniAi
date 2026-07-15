/**
 * Minimal pure path helpers for workspace-relative, forward-slash paths.
 * Kept dependency-free so the intelligence subsystem can also run in
 * non-Node hosts (browser extension) later.
 */

export function dirname(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx === -1 ? "" : path.slice(0, idx);
}

/** Joins segments, dropping empties and normalizing separators. */
export function join(...segments: string[]): string {
  return segments
    .filter((s) => s.length > 0)
    .join("/")
    .replace(/\/+/g, "/");
}

/** Ascends `levels` directories from `dir` (never above the workspace root). */
export function ascend(dir: string, levels: number): string {
  let current = dir;
  for (let i = 0; i < levels; i++) {
    current = dirname(current);
  }
  return current;
}
