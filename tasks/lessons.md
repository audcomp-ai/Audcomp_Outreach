# Lessons Learned

Format:
```
## [Date] — [Short title]
**Mistake:** What went wrong
**Rule:** The specific rule going forward
**Trigger:** When this rule applies
```

> Claude: Read this file at the start of every session before touching any code. If the same mistake recurs, the rule was too vague — rewrite it to be more specific.

---

## 2026-06-08 — Skip means remove, not stub

**Mistake:** Created a `teams.ts` stub when user said to skip Teams integration. Added dead code instead of deleting the import.
**Rule:** When user says "skip" or "we don't need X", find all references to X in the codebase and delete them. Never create a no-op wrapper.
**Trigger:** Any time an imported module, service, or feature is marked as not needed.

---

## 2026-06-08 — Don't assume Phase N delivery method from earlier planning

**Mistake:** Documented Phase 2 as "Outlook Graph API" based on earlier planning conversation. User corrected to in-portal email sending. The plan had changed but I used the stale version.
**Rule:** Before writing any Phase 2+ implementation detail into docs or code, explicitly confirm the current approach with the user. Earlier conversations and planning docs can be superseded at any time.
**Trigger:** Any time you are about to commit a specific third-party service integration (email, CRM, payments) into documentation or code for a future phase.
