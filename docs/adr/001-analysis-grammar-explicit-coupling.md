# ADR-001: Analysis adapters explicitly depend on their grammar adapter

**Status:** ACCEPTED

## Context

Each analysis adapter (e.g., `ts-kind-checking`) is bound to exactly one grammar (e.g., `Grammar<TSNodeKind>`). The prior architecture mixed direct coupling (equation functions import concrete node types via `KindCtx<KSIdentifier>`) with generic abstraction (domain types use `node: unknown`, predicates use `Set<string>`). This created a gradient where some layers had full type safety and others didn't.

The Expression Problem analysis shows that when analysis rules are scoped to one grammar, the data dimension is fixed. A generic abstraction layer over the grammar has cost (lost type safety, no exhaustiveness checking, no refactoring safety) but no payoff (the analysis is never reused across grammars).

## Decision

Analysis adapters **explicitly and directly depend** on their grammar adapter at every layer:

- **(6B)** The adapter barrel re-exports grammar types (`grammar`, `TSNodeKind`, `KSNode`, `KindToNode`)
- **(1C)** Domain types use concrete node types (`KindDefinition.node: KSTypeAliasDeclaration`, `Diagnostic.node: KSNode`)
- **(2C)** Predicate constants are typed with the grammar's kind union (`ReadonlySet<TSNodeKind>`)
- **(5B)** Helpers use grammar-typed parameters where they access node fields; generic helpers (like `diag`) that only use `ASTNode` fields stay generic

## Consequences

- Analysis adapters become non-portable across grammars (intentionally)
- Domain types like `KindDefinition` and `Diagnostic` gain concrete node types, making downstream consumers grammar-aware
- New analysis adapters for the same grammar can import grammar types directly
- New analysis adapters for a different grammar must define their own domain types
- TypeScript provides exhaustiveness checking on kind-based switches, type narrowing on node fields, and refactoring safety when grammar schemas change
