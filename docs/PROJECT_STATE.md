# Project State: Agent Company (Functional Engine)

## Current Architecture: "The Brain & The Hands"
- **The Brain (Cloud)**: Google Gemini 1.5 Pro (via API Key).
- **The Body (Frontend)**: React 18 SPA on port 5174.
- **The Hands (Local)**: Node.js Express server on port 3001 with system access permissions.

## Key Logic Flow
1. **CEO Chat**: User -> Frontend -> Backend -> Gemini (with File Context) -> Proposed Tasks.
2. **Mission Execution**: User clicks `START MISSION` -> SSE Connection -> Backend initializes Agent loop.
3. **Approval Loop**: Agent requests Tool -> Backend pauses & emits `require_approval` -> User clicks `Approve` in web terminal -> Backend executes local shell/file command -> Result fed back to Gemini.

## Persistent Environment
- **Local Storage**: Sessions, Skills, UI states, and project paths.
- **Local File System**: Actual project code is read/written by agents in real-time.
- **Credentials**: Local `.env` stores API keys; inherits local `gcloud`/`git` auth via Shell execution.

## Strict Directives for Future Agents
- **User Sovereignty**: NO autonomous execution. Every command must be approved.
- **UI Integrity**: Do not modify the three-column layout or middle column grouping without explicit user request.
- **Context Awareness**: Always fetch the latest file list before discussing strategy with the CEO.
