# SDK + PTY Fallback Migration Plan

## Goal

Migrate agent control from terminal UI parsing to SDK-based control, while preserving the current PTY flow as a stable fallback.

## Non-Goals

- No immediate removal of PTY mode.
- No in-place transport switching inside an active session.
- No forced rollout to all users at once.

## Core Approach

Implement a transport abstraction with two concrete backends:

- `PtyTransport` (current behavior, baseline reliability)
- `SdkTransport` (new behavior, preferred when healthy)

Use a routing strategy:

- `auto`: try SDK first, fail over to PTY
- `sdk`: SDK only
- `pty`: PTY only

## Architecture

### 1) Transport Contract

Define a shared interface for both transports:

- `startSession(options)`
- `sendInput(data)`
- `sendCommand(command)`
- `onOutput(listener)`
- `onExit(listener)`
- `healthCheck()`
- `stopSession()`

### 2) Transport Router

Create `AgentTransportRouter`:

- Reads configured mode (`auto | sdk | pty`)
- Runs SDK preflight in `auto`
- Falls back to PTY on startup failures
- Emits reason codes for fallback (`sdk_unavailable`, `protocol_error`, `timeout`, `runtime_error`)

### 3) Circuit Breaker for SDK

Add a lightweight circuit breaker:

- Track consecutive SDK failures
- Open circuit after threshold (example: 3 failures)
- Keep SDK disabled for cooldown (example: 10 minutes)
- During open state, route all new sessions to PTY

### 4) Session Safety Rules

- Never switch transport mid-session.
- If SDK session fails, terminate that session and start a new PTY session.
- Preserve user draft input/history across restart.

## Rollout Plan

### Phase 1: Internal Opt-In

- Add transport abstraction and PTY adapter first.
- Keep behavior unchanged with default `pty`.
- Add SDK adapter behind feature flag.

### Phase 2: Auto Mode Canary

- Enable `auto` for local/internal testing.
- Log startup decisions and fallback reasons.
- Validate command reliability (slash commands, multiline, interrupts).

### Phase 3: Controlled Expansion

- Gradually move default from `pty` to `auto`.
- Keep manual override in UI or config (`Force PTY` / `Force SDK`).

### Phase 4: Steady State

- Keep PTY fallback permanently.
- Revisit default mode only after error-rate targets are met.

## Observability

Capture structured metrics/events:

- Session start mode (`sdk`, `pty`, `auto->sdk`, `auto->pty`)
- Fallback reason code
- Time to first output
- Command success/failure by transport
- SDK breaker state changes

## Validation Checklist

- Slash commands behave consistently in both transports.
- `Ctrl+C` interrupt works in both transports.
- Multiline input and history navigation remain unchanged.
- Recovery from SDK failure restarts cleanly into PTY.
- No data loss of unsent textarea draft.

## Risk Controls

- Pin SDK versions.
- Add compatibility guard at startup (`healthCheck` + smoke command).
- Keep PTY path fully tested in CI smoke checks.

## Exit Criteria

- SDK path stable in canary over agreed period.
- Fallback works automatically and is user-transparent.
- PTY-only mode remains available as hard override.
