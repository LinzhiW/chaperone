# Change Log - Agent Company

## [2026-04-26] - Phase 3 & 4 Milestone: Tool-Using Agents

### Added
- **Gemini Integration**: Backend now uses `@google/generative-ai` with Gemini 1.5 Pro.
- **Function Calling**: Agents now have "hands" via `run_shell`, `read_file`, and `write_file` tools.
- **SSE Terminal**: Real-time streaming logs from backend to frontend terminal UI.
- **Human-in-the-Loop (HITL)**: Action-level approval system. Every tool call pauses for user permission.
- **CEO Orchestrator**: Functional chat interface that can perceive local project files and propose tasks.
- **UI Collapsibility**: All sections in the middle column (Files, Sessions, Depts, Skills) are now collapsible.

### Changed
- **Local-First Architecture**: Moved from static mockups to a functional system that inherits local terminal authentication (OAuth/gcloud/git).
- **Workspace Logic**: Moved Workspace path selection to the top of the middle column for better IDE experience.
- **Security**: Implemented B-Plan security: API keys are saved to local `.env` via backend API, excluded from Git.

### Fixed
- Fixed multiple React styling syntax errors (camelCase conversion).
- Fixed UTF-8 encoding for specialized icons.
