# Dependency Graph

Built by `DependencyGraphBuilder` (BFS over imports) and enriched by `CallResolver` (symbol-level edges), both in `packages/context-engine/src/intelligence/`.

## Shape

```jsonc
{
  "rootFile": "app/main.py",
  "files": ["app/main.py", "app/db.py", "app/models/base.py"],
  "nodes": [{ "id": "app/main.py", "filePath": "app/main.py", "kind": "file" }, ...],
  "edges": [
    { "from": "app/main.py", "to": "app/db.py",          "type": "import"   },
    { "from": "app/main.py", "to": "app/db.py",          "type": "call"     },
    { "from": "app/main.py", "to": "app/models/base.py", "type": "inherits" }
  ],
  "maxDepth": 2,
  "truncated": false,
  "hasCycles": true
}
```

- **Edge types**: `import` (file imports file, from BFS), `call` (root file calls a function resolved to that file), `inherits` (root file's class extends an imported class), `uses` (reserved). Absent `type` means `import` (v1 graphs).
- **Nodes** are file-granular; `kind` reserves room for symbol-level nodes. `id` = workspace-relative path, matching `edges.from/to`, so the graph is directly renderable by any node-link visualizer.
- **`hasCycles`** is computed by an iterative three-color DFS (`hasCycle` in `graphBuilder.ts`); a cycle also emits a `cyclic-dependency` warning. Traversal itself is cycle-safe via a visited set.
- **`truncated`** is true only when a frontier file at `maxDepth` imports something unvisited — reaching maxDepth with nothing left to discover is a complete graph.

## Resolution semantics

`PythonModuleResolver` handles: absolute imports from configurable source roots (`""`, `"src"`), relative imports (any dot level), packages (`__init__.py`), `from pkg import submodule`, **namespace packages** (PEP 420 — `ns/pkg/mod.py` resolves without any `__init__.py`), and missing/third-party imports (resolve to nothing, by design). Unreadable or unparseable files become leaf nodes, never errors.
