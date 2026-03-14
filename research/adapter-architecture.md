# Research: Plugin & Adapter Architectures for KindScript (KSC)

This document explores options for allowing users to extend KindScript with their own adapters (Grammar, Analysis Specs, and Runtime Projections).

## 1. Current State of KSC Architecture
KSC uses a **Ports and Adapters** (Hexagonal) architecture.
- **Ports**: Defined in `libs/behavior` and `libs/grammar` (e.g., `Grammar`, `AnalysisDecl`, `CodegenTarget`).
- **Adapters**: Concrete implementations (e.g., `ts-ast` grammar, `ts-kind-checking` analysis).
- **Wiring**: Currently hardcoded in `apps/cli/wiring/`.
- **Codegen**: The `ksc codegen` command reads `allTargets` from the wiring and generates `dispatch.ts`, `projections.ts`, etc.
- **Evaluation**: The `ksc check` command uses wired `CheckDeps` to run the analysis.

## 2. Common Design Patterns in the Ecosystem

### A. Named Package Plugins (ESLint / Babel)
Users install plugins as npm packages (e.g., `npm install ksc-plugin-regex`).
- **Config**: `"plugins": ["regex"]` or `"plugins": ["@scope/ksc-plugin-X"]`.
- **Loading**: KSC resolves the package and imports its entry point.
- **Pros**: Versioned, easy to share, standardized naming.
- **Cons**: Overhead of publishing to npm; harder for local-only "one-off" analyses.

### B. Configuration-Driven Targets (Vite / Webpack / Tailwind)
Users provide the adapter logic directly in a configuration file (e.g., `ksc.config.ts`).
- **Config**:
  ```typescript
  import { myAnalysis } from './my-analysis/spec';
  export default defineConfig({
    targets: [{
      name: 'my-custom-check',
      decl: myAnalysis,
      grammar: tsGrammar,
      outputDir: './gen'
    }]
  });
  ```
- **Pros**: Fully type-safe (TypeScript config), no publishing required, explicit control.
- **Cons**: Config file can become complex/large.

### C. File-System Discovery (Prisma / Next.js)
KSC looks for specific file patterns in the project (e.g., `src/**/*.ksc-spec.ts`).
- **Discovery**: Automatically identifies and processes all matching files.
- **Pros**: Zero-config for simple cases, "just works" as you add files.
- **Cons**: "Magic" behavior can be confusing; harder to control execution order or options.

## 3. Options for KSC

### Option 1: The "External Target" Pattern (Recommended)
Allow `ksc.config.ts` to export an array of `targets`. Each target can be a local file or an installed package.

**Flow:**
1.  **User defines spec**: Creates `my-analysis/spec.ts`.
2.  **User wires in config**:
    ```typescript
    // ksc.config.ts
    export default defineConfig({
      adapters: [
        {
          name: 'my-custom-rule',
          spec: './my-analysis/spec.ts',
          grammar: '@ksc/grammar/ts-ast',
          outDir: '.ksc/generated/my-rule'
        }
      ]
    });
    ```
3.  **KSC Codegen**: Runs for both built-in and user-defined targets.
4.  **KSC Check**: Loads all configured adapters and merges their diagnostics.

### Option 2: The "Plugin Package" Pattern
Standardize a `KSCPlugin` interface that encapsulates both Codegen and Runtime requirements.

```typescript
export interface KSCPlugin {
  name: string;
  codegen: CodegenTarget;
  runtime: CheckDeps;
}
```

### Option 3: "In-Place" User Adapters
Assume a standard directory structure:
- `ksc/analyses/<name>/spec.ts`
- `ksc/analyses/<name>/equations.ts`
KSC automatically handles the rest.

## 4. Key Considerations

### Codegen vs. Runtime
KSC is unique because it has a **build step** (codegen). User-added adapters must participate in both:
- **Codegen**: Must provide `Grammar` and `AnalysisDecl`.
- **Runtime**: Must provide the generated `Evaluator` and `Projections`.

### Output Location
Where should generated code for user adapters go?
- **User Source**: (e.g., `src/generated/`) - Visible, checkable into Git, easy to debug.
- **Hidden Cache**: (e.g., `.ksc/cache/`) - Cleaner, but harder to reference the generated types in user code.

### Type Safety
How do users get type-safe access to their custom attributes?
- If KSC generates code into a user-specified folder, users can simply `import { isPure } from './generated/projections'`. This is a strong argument for **Option 1**.

## 5. Recommendation

I recommend **Option 1 (Configuration-Driven Targets)** with support for both **Local Paths** and **Package Names**.

1.  **Extend `KindScriptConfig`** to support an `adapters` array.
2.  **Enhance `ksc codegen`** to read this config and process user targets alongside built-in ones.
3.  **Enhance `ksc check`** to load the runtime components (evaluators) from the generated paths specified in the config.
4.  **Standardize an `Adapter` interface** that makes it easy for users to provide the necessary metadata.

This provides the best balance of flexibility, type-safety, and explicitness.
