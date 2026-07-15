import type { IFileSystem } from "../interfaces";

/**
 * In-memory {@link IFileSystem} for tests and demos. Exported from the
 * package (not test-only) so downstream packages can reuse it in their
 * own tests.
 */
export class InMemoryFileSystem implements IFileSystem {
  private readonly files: Map<string, string>;

  constructor(files: Record<string, string> = {}) {
    this.files = new Map(Object.entries(files));
  }

  async readFile(path: string): Promise<string | undefined> {
    return this.files.get(path);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }
}
