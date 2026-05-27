# Working Guide

- After adding any code or functionality, write thorough unit tests and check coverage.
- After making any changes always execute `pnpm run check` to verify
- After completing a task and the check verification, run `pnpm run samples:verify`. Make no further changes based on this output (unless explicitly asked) but report any changes to the user.
- Following any call to `pnpm run samples:verify` that fails, report should include use of the `.agents/skills/debug-linkedin-sample-pdfs` skill to inform the user whether the changes are (a) a strict improvement or (b) a regression or (c) ambiguous. 
- `samples/` is local and gitignored, so sample verification is intentionally separate from `pnpm run check`.
- Fix any pnpm format issues (even if they are unrelated)
- When confusion or errors reveal a reusable project workflow rule, add a concise guideline to AGENTS.md.
- When verification fails on unrelated dirty-worktree changes, report the exact failing command and failures instead of modifying unrelated code.
- When debugging sample PDF extraction, use the repo-local skill at `.agents/skills/debug-linkedin-sample-pdfs`.
- Sample coverage strictness must include field-level misclassification checks, not only section-level source traceability.
- NEVER edit, delete, overwrite, or otherwise modify anything in the samples/ directory.
- Avoid one-off parser hacks such as adding domain cue words or narrow regular expressions for a single sample. Prefer generalizable extraction strategies: canonical block parsing, visual hierarchy/layout evidence, scored confidence signals, and penalties for ambiguous cues (for example person-shaped organization names) instead of hard vetoes.

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
