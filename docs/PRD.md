# Product Requirements Document (PRD) - Agent Company

## 1. Product Vision
A lightweight, bilingual multi-agent orchestration platform that prioritizes user control (Human-in-the-Loop) and resource efficiency.

## 2. Core Features

### 2.1 Mission Control (Dashboard)
- **CEO Chat**: High-level strategic negotiation with the orchestrator agent.
- **Process Kanban**: Visual lifecycle management of agent tasks.
- **Manual Trigger**: The `[START MISSION]` button is the only way to move from proposal to execution.

### 2.2 Context Management (Sessions)
- Users can create, archive, and switch between sessions to isolate task history and context.

### 2.3 Skill Management
- **Skill Sources**: Local file uploads, URL references, and global presets.
- **Governing Logic**: Skills define the behavior and constraints of assigned worker agents.

### 2.4 Safety & Transparency
- **Git Branch Isolation**: Every execution happens on a new branch.
- **Activity Logs**: Detailed system-level logging for every agent action.
- **Cost Monitor**: Real-time tracking of API usage and session costs.

## 3. User Interface Standard
- **Design System**: Discord-inspired dark mode.
- **Language**: English UI interface; Bilingual (CN/EN) communication support.
- **Layout**: Fixed three-column grid with a scrollable Kanban area.

## 4. Success Metrics
- 0% unauthorized agent executions.
- Successful automated branch creation for 100% of approved tasks.
- Seamless project switching via the sidebar rail.
