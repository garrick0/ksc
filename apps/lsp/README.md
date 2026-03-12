# KindScript for VS Code

Architectural enforcement for TypeScript — inline diagnostics and quick fixes.

KindScript analyzes your TypeScript codebase for architectural violations using an
attribute grammar system. This extension surfaces violations as editor squiggles with
one-click fixes.

## Features

- **Inline diagnostics** — kind-checking violations and protobuf getter enforcement
  appear as squiggles in the editor and entries in the Problems panel
- **Quick fixes** — lightbulb code actions for protobuf getter violations
  (`user.name` → `user.getName()`, `user.name = x` → `user.setName(x)`)
- **Live feedback** — re-analyzes on save with 500ms debounce
- **Config-driven** — reads `ksc.config.ts` for project-specific settings

## Getting Started

1. Install the extension
2. Open a TypeScript project that uses KindScript
3. Violations appear automatically in the Problems panel

### Configuration

The extension reads your project's `ksc.config.ts` (or `kindscript.config.ts`).
You can also configure behavior via VS Code settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `kindscript.enable` | `true` | Enable/disable KindScript diagnostics |
| `kindscript.severity` | `"warning"` | Severity level: `error`, `warning`, `information`, `hint` |

### Protobuf Getter Enforcement

Enable in `ksc.config.ts`:

```typescript
import { defineConfig } from 'kindscript';

export default defineConfig({
  protobuf: { enabled: true },
});
```

Direct field access on protobuf-generated classes (`user.name`) is flagged with a
quick-fix to use the getter (`user.getName()`).

## Requirements

- VS Code 1.82.0+
- TypeScript project with `tsconfig.json`

## Non-VS Code Editors

The language server works with any LSP-compatible editor via stdio:

```bash
npx kindscript-lsp --stdio
```

See the [KindScript documentation](https://github.com/kindscript/kindscript) for
Neovim, Emacs, and Helix setup instructions.
