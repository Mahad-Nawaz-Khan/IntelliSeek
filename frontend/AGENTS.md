<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Code Quality & Static Analysis Guardrails (Learned from GitRoll / SonarQube)

When writing or refactoring TypeScript, React, or CSS in `frontend/`, enforce these rules on every change so regressions never re-enter the codebase:

- **CSS & Theming**: Do not add unknown CSS at-rules such as `@custom-variant` in `app/globals.css`. IntelliSeek uses `document.documentElement.dataset.theme` (`"dark"` / `"light"`) — write standard CSS selectors (`:root[data-theme="dark"] .class` / `:root[data-theme="light"] .class`) instead of `dark:` utilities with `@custom-variant`.
- **Native HTML Semantics & Accessibility**: Prefer native elements over ARIA roles — use `<output>` (not `role="status"`), `<dialog>` (not `role="dialog"`), `<input type="checkbox">` (not `role="checkbox"`), `<input type="radio">` (not `role="radio"`), and `<select>`/`<datalist>`/`<option>` (not `role="listbox"`/`"option"`). Never attach `onClick` handlers directly to static `<div>`/`<span>` elements; use `<button type="button">` or `<dialog>`.
- **No Boolean Selector Parameters**: Do not write helper functions or callbacks that accept a `boolean` (or string selector) purely to branch between two outputs/actions (`return flag ? a : b` or `if (flag) doA() else doB()`). Provide separate dedicated functions (e.g. `onStart` / `onEnd`), `Record<UnionMode, Value>` lookup maps (e.g. `KnowledgeBaseScopeMode`, `AnswerPromptMode`), or select inline at the call site.
- **Complexity, Nesting & Ternaries**:
  - Keep function and hook cognitive complexity `<= 15` and function callback nesting depth `<= 4`. Extract pure state transitions and event helpers to module scope instead of nesting multi-branch logic inside `useCallback`/`useEffect`.
  - Never nest ternaries (`a ? (b ? c : d) : e` or chained `a ? b : c ? d : e`); extract helper functions with early `if` returns.
- **TypeScript Idioms & Strict Hygiene**:
  - Prefer nullish coalescing (`const base = current ?? fallback` or `base ??= fallback`) over `if (base === null) base = fallback`.
  - Avoid redundant type assertions (`x as T` when `x` already has type `T`); narrow parsed JSON from `unknown` using `typeof` / runtime guards.
  - Keep zero unused imports, unused locals, or redundant assignments (`npx tsc --noEmit --noUnusedLocals`).
- **Regex & React Lists**:
  - Keep regex complexity `<= 20` (split alternations with optional quantifiers into simpler patterns), use character classes `[...]` over single-character alternations, and prefer `RegExp.prototype.exec()` over `.match()` for single non-global matches.
  - Never use array index as React `key`; avoid ambiguous whitespace adjacent to inline JSX elements.
