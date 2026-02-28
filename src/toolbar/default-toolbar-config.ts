import { type ToolbarConfig } from "../types/toolbar";

const dryAndReuseReviewPrompt = [
  "Проведи ревью текущего кодбейса или diff со строгим фокусом на DRY.",
  "Найди дублированную логику, повторяющиеся ветвления, скопированные типы или тесты и места, где поведение можно централизовать без ущерба для читаемости.",
  "Верни замечания, отсортированные по критичности, с указанием файлов.",
  "Затем предложи конкретные рефакторинги с шагами миграции с минимальным риском и необходимыми обновлениями тестов."
].join(" ");

const codeHygieneReviewPrompt = [
  "Проведи ревью гигиены кода.",
  "Найди мертвый код, неиспользуемые импорты или переменные, устаревшие TODO/FIXME, закомментированные фрагменты, переусложненные обертки, вводящие в заблуждение имена и временные хаки.",
  "Для каждого замечания объясни, почему это вредно, безопасно ли удалить это сейчас, какие возможны побочные эффекты и какой минимальный патч очистки нужен."
].join(" ");

const performanceReviewPrompt = [
  "Проведи ревью производительности с фокусом на реальных узких местах.",
  "Проверь алгоритмическую сложность, лишние перерисовки или перерасчеты, выделения памяти на горячих путях, блокирующий I/O и дорогие обращения к сети или базе данных.",
  "Приоритизируй проблемы с максимальным влиянием, оцени ожидаемый эффект и предложи измеримые исправления с шагами профилирования или бенчмарков."
].join(" ");

const securityReviewPrompt = [
  "Проведи ревью безопасности с мышлением атакующего.",
  "Проверь валидацию входных данных, границы auth/authz, векторы command/code injection, path traversal, XSS/CSRF, утечки секретов, небезопасные настройки по умолчанию, риски зависимостей и раскрытие чувствительных данных в логах.",
  "Перечисли уязвимости по критичности, добавь реалистичные сценарии эксплуатации и предложи конкретные меры устранения."
].join(" ");

const engineeringPracticesReviewPrompt = [
  "Проведи ревью инженерных практик и долгосрочной поддерживаемости.",
  "Оцени границы архитектуры, обработку ошибок, дисциплину типизации, качество тестов, наблюдаемость, ясность имен или API и соответствие соглашениям фреймворка.",
  "Выдели отклонения, объясни компромиссы и предложи практичные улучшения, ранжированные по влиянию."
].join(" ");

const decompositionReviewPrompt = [
  "Проведи ревью декомпозиции кода и размера модулей.",
  "Найди крупные файлы и перегруженные функции, где смешаны ответственности, высокая связность, глубокая вложенность и длинные ветвления.",
  "Для каждого замечания укажи риск для поддерживаемости и предложи конкретный план разбиения на модули и функции с минимальным риском регрессий."
].join(" ");

export const defaultToolbarConfig: ToolbarConfig = {
  elements: [
    {
      label: "\u0410\u0433\u0435\u043d\u0442\u044b",
      color: "#f28b8b",
      items: [
        {
          label: "Claude Code",
          value: "claude",
          type: "command"
        },
        {
          label: "Codex CLI",
          value: "codex",
          type: "command"
        },
        {
          label: "Gemini CLI",
          value: "gemini",
          type: "command"
        },
        {
          label: "GLM-5",
          value: "powershell -NoProfile -ExecutionPolicy Bypass -Command \"$f='.ide\\.env'; if(-not(Test-Path $f)){Write-Host '>>> Ошибка: Секреты не настроены. Нажмите кнопку [Секреты] в верхней панели.' -ForegroundColor Red; exit 1}; $k=(Get-Content $f | ConvertFrom-StringData).GLM_API_KEY; if(-not $k){Write-Host '>>> Ошибка: GLM_API_KEY не найден в .ide\\.env. Настройте его через меню [Секреты].' -ForegroundColor Red; exit 1}; $env:ANTHROPIC_BASE_URL='https://api.z.ai/api/anthropic'; $env:ANTHROPIC_AUTH_TOKEN=$k; $env:ANTHROPIC_DEFAULT_SONNET_MODEL='glm-5'; claude /resume\"",
          type: "command"
        }
      ]
    },
    {
      label: "\u0420\u0435\u0432\u044c\u044e",
      color: "#f2b56b",
      items: [
        {
          label: "DRY \u0438 \u043f\u0435\u0440\u0435\u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u0435",
          value: dryAndReuseReviewPrompt,
          type: "prompt"
        },
        {
          label: "\u0427\u0438\u0441\u0442\u043e\u0442\u0430 \u0438 \u043c\u0435\u0440\u0442\u0432\u044b\u0439 \u043a\u043e\u0434",
          value: codeHygieneReviewPrompt,
          type: "prompt"
        },
        {
          label: "\u041f\u0440\u043e\u0438\u0437\u0432\u043e\u0434\u0438\u0442\u0435\u043b\u044c\u043d\u043e\u0441\u0442\u044c",
          value: performanceReviewPrompt,
          type: "prompt"
        },
        {
          label: "\u0411\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u044c",
          value: securityReviewPrompt,
          type: "prompt"
        },
        {
          label: "\u0418\u043d\u0436\u0435\u043d\u0435\u0440\u043d\u044b\u0435 \u043f\u0440\u0430\u043a\u0442\u0438\u043a\u0438",
          value: engineeringPracticesReviewPrompt,
          type: "prompt"
        },
        {
          label: "\u0414\u0435\u043a\u043e\u043c\u043f\u043e\u0437\u0438\u0446\u0438\u044f \u0438 \u043a\u0440\u0443\u043f\u043d\u044b\u0435 \u0444\u0430\u0439\u043b\u044b",
          value: decompositionReviewPrompt,
          type: "prompt"
        }
      ]
    },
    {
      label: "Ctrl+C",
      value: "\u0003",
      type: "raw-input",
      color: "#f2db6b"
    },
    {
      label: "/resume",
      value: "/resume",
      type: "command",
      color: "#7dd490"
    },
    {
      label: "/new",
      value: "/new",
      type: "command",
      color: "#7bc8e8"
    },
    {
      label: "\u041a\u043e\u043c\u043c\u0438\u0442 \u043f\u0443\u0448",
      value: "\u043a\u043e\u043c\u043c\u0438\u0442 \u043f\u0443\u0448",
      type: "prompt",
      color: "#b08be8"
    },
    {
      label: "Обнови доку",
      value: "Изучи проект и обнови документацию, если нужно",
      type: "prompt",
      color: "#e88bbb"
    }
  ]
};
