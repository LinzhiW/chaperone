# Design Spec: Chaperone - Human-in-the-Loop Multi-Agent Platform

**Date:** 2026-04-26
**Topic:** Core Architecture and Workflow Design
**Status:** Draft (Pending User Review)

## 1. Objective
To build a lightweight, English-UI, bilingual-communication multi-agent orchestration platform. The system strictly enforces a "Human-in-the-Loop" workflow via a specialized Dashboard to ensure safety, token efficiency, and project transparency.

## 2. Core Principles
- **Strict Approval (Human-in-the-Loop):** No agent moves from proposal to execution without explicit user approval.
- **Event-Driven Hibernation:** Agents "sleep" while awaiting approval to save resources and tokens.
- **Branch-Based Isolation:** Every task is executed on a unique Git branch.
- **English UI, Bilingual Chat:** The interface is in English; however, all agent communication (input/output/markdown) supports both English and Chinese.

## 3. UI/UX Architecture (Final V2.4)
The UI consists of a persistent three-column layout:
1. **Left Rail (Discord-style):** Navigation for switching between different project companies.
2. **Middle Column (Functional Sidebar):**
   - **Top (SESSIONS):** Threaded sessions for context isolation and history management.
   - **Middle (DEPARTMENTS):** Hierarchical view of departments and assigned agents.
   - **Bottom (DOCS & SKILLS):** 
     - **Skills Library:** Interface for uploading local `.md` skills, pasting URLs, or selecting presets.
     - **Ops Monitor:** API usage, session cost tracking, and doc browser.
3. **Right Area (DASHBOARD):**
   - **Sticky Top:** Global CEO/PM Chat for high-level orchestration and department negotiation.
   - **Main Area (Process Kanban):** Columns for task lifecycle (Proposed, Executing, Review).
   - **Interactive Cards:** Each task card features an embedded mini-chat for direct worker communication and a manual [START MISSION] trigger.

## 4. Skill Management & Presets
- **Source Flexibility:** Agents can be governed by skills provided via local file upload, URL reference, or a library of global presets.
- **Persistence:** Commonly used skills can be saved as presets for use across other projects.
- **Control:** The user decides which skills are active for the current session.

## 4. Agent Roles & Interaction Loop
1. **PM Agent (The Orchestrator):** 
   - Receives user requests.
   - Breaks them into subtasks.
   - Proposes worker assignments.
   - *State:* Suspends execution after presenting the plan.
2. **Worker Agent (The Executor):**
   - **Pre-execution:** Waits for approval.
   - **Execution:** Once approved, automatically creates a new Git branch (e.g., `task/fix-nav-bar`) and performs the work.
   - **Post-execution:** Submits a structured report.
3. **Review/Test Agent (The Validator):**
   - Checks the Worker's branch.
   - Runs tests or validates code quality.
   - Proposes a merge to `main` only after validation.

## 5. Technical Implementation (Phase 1)
- **Frontend:** React (Vite) + Tailwind CSS for a fast, responsive Discord-like UI.
- **Backend/Orchestrator:** Node.js (TypeScript) acting as a State Machine.
- **State Persistence:** Simple JSON-based database to store task statuses and approval tokens.
- **Git Integration:** Automated branch management via `simple-git` or similar library.

## 6. Workflow Safety (State Machine)
- **State: `AWAIT_APPROVAL`**: The backend marks the task as locked. The Agent's process context is serialized/saved.
- **Action: `USER_APPROVE`**: The UI sends an "Approval Token". The backend deserializes the Agent's context and triggers the next lifecycle step.

## 7. Success Criteria
- [ ] User can switch projects via the sidebar.
- [ ] User can see all agents and their statuses in a split view.
- [ ] User can communicate with agents in both Chinese and English.
- [ ] No worker agent starts coding until the [Approve] button is clicked.
- [ ] Every worker task results in a separate Git branch.
