# AGENTS.md

## Project
AI-first IDE for planning, generating, reviewing, fixing, and validating code with minimal manual typing.

## Product Goal
Build an IDE where the default flow is:
1. Describe intent.
2. Generate implementation.
3. Run multi-analyzer checks (lint, tests, security, architecture, AI review).
4. Auto-fix issues when allowed.
5. Produce commit message + change summary.
6. Offer alternative implementations and pick the best via measurable score.

## Core Principles
- `Quality over raw speed`: every generated change must be evaluated.
- `Traceable automation`: each auto-action leaves artifacts (logs, rationale, diff links).
- `Safe autonomy`: destructive actions require explicit confirmation.
- `Promptability`: common expert tasks are one-click reusable prompts.
- `Human override`: user can stop, edit, or downgrade autonomy at any step.

## Agent Roles

### 1) Planner Agent
- Converts task description into executable plan.
- Selects task severity profile (`fast`, `balanced`, `deep`).
- Defines acceptance criteria and verification scope.

### 2) Implementation Agent
- Produces code changes in small verifiable commits.
- Keeps compatibility constraints explicit.
- Avoids unrelated refactors unless requested.

### 3) Review Agent
- Generates commit title/body suggestions.
- Produces risk report: bugs, regressions, missing tests, security concerns.
- Runs "alternative solution" exploration when requested.

### 4) Fix Agent
- Applies auto-fixes from analyzers (lint, static analysis, test failures).
- Supports toggle: `auto_fix=true|false`.
- Re-runs verification after each fix batch.

### 5) Merge Guard Agent
- Blocks finalization when severity-dependent gates fail.
- Publishes final scorecard and recommends go/no-go.

## Severity Slider Behavior

### `fast`
- Optimize for turnaround.
- Run minimal checks: build + smoke tests + lightweight lint.
- Allow higher risk tolerance.

### `balanced`
- Default mode.
- Run unit tests + standard lint + security quick scan + AI review.

### `deep`
- Max confidence mode.
- Run full test suite, strict static analysis, dependency/security scan, mutation or extended checks when available.
- Require stronger evidence before merge recommendation.

## One-Click Prompt Actions
- `security_review`: "Perform threat-focused review and propose fixes."
- `performance_review`: "Find performance bottlenecks and optimize critical paths."
- `refactor_safely`: "Refactor for clarity with behavior preservation evidence."
- `write_tests`: "Add/repair tests for changed behavior and edge cases."
- `alt_solution`: "Produce at least one different implementation strategy."

## Commit Intelligence
- Always propose:
  - Conventional-style commit title.
  - 3-7 bullet change summary.
  - Risk notes and rollback hints.
- If confidence is low, include `needs-human-review` tag.

## Alternative Battle Mode
- Generate N candidate patches (default `N=2`).
- Evaluate each with same gates and score:
  - correctness
  - test pass rate
  - complexity impact
  - security findings
  - performance impact
- Pick winner automatically only if score delta exceeds threshold; otherwise ask user.

## Quality Gates
- Build succeeds.
- Tests required by active severity profile pass.
- No unresolved critical/high security findings.
- No unexplained analyzer regressions.
- Change log and commit proposal generated.

## Required Artifacts Per Task
- `plan.md` (short task plan + chosen severity)
- `review.md` (findings, risks, confidence)
- `fixes.md` (what was auto-fixed)
- `commit-proposal.md` (title/body + rationale)

## Operational Rules
- Never silently skip failed checks.
- Never auto-merge with failing required gates.
- Never modify files outside scope without explicit note.
- Always report what was changed and why.

## MVP Implementation Notes
- Start with integrations:
  - Git (diff/commit metadata)
  - Test runner + linter
  - Security scanner (SAST/dependency)
  - AI reviewer endpoint
- Build UI controls for:
  - Severity slider
  - Auto-fix toggle
  - Prompt action buttons
  - Alternative battle run

## Non-Goals (MVP)
- Full autonomous release management.
- Replacing all manual code review immediately.
- Perfect analyzer consensus across all languages/frameworks.


