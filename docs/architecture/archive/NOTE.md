# Archive Notice

These documents are historical and may reference outdated architecture:

- **`evaluator.ts`** — The evaluator is no longer generated. It is now hand-written in `evaluator/engine.ts`. Codegen only produces `dispatch.ts` (per-attribute dispatch functions).
- **`KSCDNode`** — Replaced by `AGNode` (internal to `evaluator/engine.ts`). External API uses `AGNodeInterface` / `TypedAGNode<M>`.
- **`EvaluatorSetup`** — Eliminated. Replaced by `typeImports` and `setup` fields on `AnalysisSpec`.
- **`buildKSCTree`** — Replaced by `evaluator.buildTree()` from `createEvaluator()`.

See `docs/architecture/evaluator-separation-analysis.md` for the full analysis and implementation status.
