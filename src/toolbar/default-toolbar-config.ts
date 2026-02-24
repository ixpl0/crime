import { type ToolbarConfig } from "../types/toolbar";

const dryAndReuseReviewPrompt = [
  "Review the current codebase or diff with a strict DRY lens.",
  "Identify duplicated logic, repeated branching, copy-pasted types or tests, and places where behavior can be centralized without hurting readability.",
  "Return findings ordered by severity with file references.",
  "Then propose concrete refactors with minimal-risk migration steps and required test updates."
].join(" ");

const codeHygieneReviewPrompt = [
  "Run a code hygiene review.",
  "Find dead code, unused imports or variables, stale TODO/FIXME notes, commented-out fragments, over-engineered wrappers, misleading names, and temporary hacks.",
  "For each finding explain why it is harmful, whether it is safe to remove now, potential side effects, and the smallest cleanup patch."
].join(" ");

const performanceReviewPrompt = [
  "Perform a performance review focused on real bottlenecks.",
  "Inspect algorithmic complexity, unnecessary re-renders or recomputations, hot-path allocations, blocking I/O, and expensive network or database usage.",
  "Prioritize high-impact issues, estimate expected gains, and suggest measurable fixes with profiling or benchmark steps."
].join(" ");

const securityReviewPrompt = [
  "Perform a security review with an attacker mindset.",
  "Check input validation, auth or authz boundaries, command or code injection vectors, path traversal, XSS or CSRF, secret leakage, insecure defaults, dependency risks, and sensitive data exposure in logs.",
  "List vulnerabilities by severity, include realistic exploitation scenarios, and provide concrete remediations."
].join(" ");

const engineeringPracticesReviewPrompt = [
  "Review for engineering best practices and long-term maintainability.",
  "Evaluate architecture boundaries, error handling, typing discipline, test quality, observability, naming or API clarity, and consistency with framework conventions.",
  "Highlight deviations, explain trade-offs, and propose actionable improvements ranked by impact."
].join(" ");

export const defaultToolbarConfig: ToolbarConfig = {
  elements: [
    {
      type: "dropdown",
      label: "\u0410\u0433\u0435\u043d\u0442\u044b",
      items: [
        {
          label: "Claude Code",
          command: "claude",
        },
        {
          label: "Codex CLI",
          command: "codex",
        },
        {
          label: "Aider",
          command: "aider",
        },
      ],
    },
    {
      type: "dropdown",
      label: "\u0420\u0435\u0432\u044c\u044e",
      items: [
        {
          label: "DRY \u0438 \u043f\u0435\u0440\u0435\u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u0435",
          command: dryAndReuseReviewPrompt,
        },
        {
          label: "\u0427\u0438\u0441\u0442\u043e\u0442\u0430 \u0438 \u043c\u0435\u0440\u0442\u0432\u044b\u0439 \u043a\u043e\u0434",
          command: codeHygieneReviewPrompt,
        },
        {
          label: "\u041f\u0440\u043e\u0438\u0437\u0432\u043e\u0434\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c",
          command: performanceReviewPrompt,
        },
        {
          label: "\u0411\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u044c",
          command: securityReviewPrompt,
        },
        {
          label: "\u0418\u043d\u0436\u0435\u043d\u0435\u0440\u043d\u044b\u0435 \u043f\u0440\u0430\u043a\u0442\u0438\u043a\u0438",
          command: engineeringPracticesReviewPrompt,
        },
      ],
    },
    {
      type: "button",
      label: "Ctrl+C",
      rawInput: "\u0003",
    },
    {
      type: "button",
      label: "/resume",
      command: "/resume",
    },
    {
      type: "button",
      label: "/new",
      command: "/new",
    },
    {
      type: "button",
      label: "\u041a\u043e\u043c\u043c\u0438\u0442 \u043f\u0443\u0448",
      command: "\u043a\u043e\u043c\u043c\u0438\u0442 \u043f\u0443\u0448",
    },
  ],
};
