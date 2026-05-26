# Working Guide

- After adding any code or functionality, write thorough unit tests and check coverage.
- After making any changes always execute `pnpm run check` to verify
- After completing a task and the check verification, run `pnpm cli verify-json samples/`. Make no further changes based on this output (unless explicitly asked) but report any changes to the user.
- Fix any pnpm format issues (even if they are unrelated)
- Whenever there is any confusion or errors, automatically add a guideline to AGENTS.md
- When verification fails on unrelated dirty-worktree changes, report the exact failing command and failures instead of modifying unrelated code.
- When you are investigating a bug or analyzing PDFs, use or write helper scripts in .debug/
- When trying to understand PDF content, use pdfplumber (uvx tool) and the poppler family of cli utils (ask the user to install if not present)
- When debugging PDF extraction, generate a source evidence bundle with `pnpm run source:inspect -- <pdf>` and cite the source artifacts (`poppler.layout.txt`, `unpdf.items.json`, `pdfplumber.words.json`, `parser-lines.json`, or `overlay.html`) instead of treating parser JSON as the source of truth.
- Use `.debug/` for ad hoc investigation scripts and per-PDF source evidence bundles; use `.debug-dist/` for reproducible generated outputs from repository scripts.
- Use the section-aware sample coverage audit (`pnpm run samples:audit-coverage -- --samples samples/`) to find unmatched source segments and untraced output values, but treat its findings as review prompts because source-section inference is heuristic.

# TypeScript

- **Type everything**: params, returns, config objects, and external integrations; avoid `any`
- **Use interfaces**: for complex types and objects, including ports and DTOs
- **Make Illegal States Unrepresentable**: If something should never happen, encode that rule in the type system instead of comments or runtime checks.
  - Discriminated unions instead of flags + nullable fields
  - Narrowed constructors / factory functions
- **Avoid using bare string types** - prefer Branded domain types instead of primitives
  - Brand types especially for strings e.g. phone, email, ID
  - e.g. NormalizedEmail, UserId, ChatId
- **Avoid Type Assertions (as)**: Every as is a potential runtime crash hidden from the compiler.
  - Replace with: Narrowing functions or Exhaustive pattern matching or Refined input types
- **Prefer Union Types Over Boolean Flags**: Boolean flags destroy invariants.
- **Separate Pure Logic from Side Effects**: Functions that return void hide meaning from the compiler.
  - Prefer Pure functions with explicit inputs/outputs.
- **Use a single params object for a function argument when there are optional arguments or arguments of the same type**: this enables safe, name-based destructuring.
- **Add comments to tricky parts of code (no need for obvious comments)**: ensure comments on tricky code capture intent
- **Prefer undefined over null** - except at outer boundaries where it's necessary to communicate absence of a value.
- **Avoid uninformative method names** - don't use words like "handle" or "process" in names, use descriptive verbs
- **Avoid type guard functions** - prefer Zod (e.g. for cache policy `isValue`)
- **Avoid creating duplicative types** - prefer to use typescript's `Pick` or `Omit` (if using Zod use `.extend`)
