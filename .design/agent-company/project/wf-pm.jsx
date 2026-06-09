// PM Panel screens — Phase 1.
// PM lives in the TEAM section. Its panel has tabs: Chat / PRD.md / SOP.md / Dev log.md
// "Mission Plan" is a STATE of the Chat tab where PM has drafted a plan inline.

// Reusable PM panel shell: tab strip + mission banner + slot for tab body.
function PMShell({ activeTab = "chat", children, runningMissions = 2 }) {
  const tabs = [
  { id: "chat", label: "Chat", hint: "talk to PM" },
  { id: "prd", label: "PRD.md", hint: "product requirements" },
  { id: "sop", label: "SOP.md", hint: "agreed standard practices" },
  { id: "devlog", label: "Dev log.md", hint: "reviewer reports + decisions", badge: "1 new" }];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--paper-2)" }}>
      {/* Identity bar */}
      <div style={{ padding: "10px 18px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 6, background: "var(--pm)", color: "var(--paper)",
          display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 11, letterSpacing: 0.5
        }}>PM</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Project Orchestrator</div>
          <div style={{ fontSize: 11, color: "var(--ink-3)" }}>plans · tracks · never executes</div>
        </div>
        <span style={{ fontSize: 11, color: "var(--ink-3)" }}>memory: 12 missions · 4 decisions</span>
      </div>

      {/* Tab strip */}
      <div style={{ padding: "10px 18px 0", display: "flex", gap: 4, borderBottom: "1.5px solid var(--rule)" }}>
        {tabs.map((t) =>
        <div key={t.id} style={{
          padding: "8px 14px 9px",
          background: t.id === activeTab ? "var(--paper)" : "transparent",
          borderRadius: "4px 4px 0 0",
          border: t.id === activeTab ? "1.5px solid var(--rule)" : "1.5px solid transparent",
          borderBottom: t.id === activeTab ? "1.5px solid var(--paper)" : "1.5px solid transparent",
          marginBottom: -1.5,
          fontSize: 12,
          fontWeight: t.id === activeTab ? 600 : 500,
          color: t.id === activeTab ? "var(--ink)" : "var(--ink-3)",
          display: "flex", alignItems: "center", gap: 6,
          cursor: "pointer",
          fontFamily: t.id.endsWith("md") || t.label.endsWith(".md") ? "var(--mono)" : "var(--sans)"
        }}>
            {t.label}
            {t.badge &&
          <span style={{
            background: "var(--review)", color: "var(--paper)", fontSize: 9, fontWeight: 700,
            padding: "1px 5px", borderRadius: 99, letterSpacing: 0.4
          }}>{t.badge}</span>
          }
          </div>
        )}
      </div>

      {/* Mission running banner */}
      {runningMissions > 0 &&
      <div style={{
        margin: "12px 18px 0", padding: "8px 12px", display: "flex", alignItems: "center", gap: 10,
        background: "var(--approve-soft)", border: "1px solid var(--approve)", borderRadius: 4
      }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--approve)" }} />
          <span style={{ fontSize: 12, color: "var(--approve)" }}><strong>{runningMissions}</strong> missions are running while you talk to me — PM doesn't intervene unless you ask.</span>
          <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <span className="branch-chip" style={{ cursor: "pointer", background: "var(--paper)" }}>Dark mode mission ›</span>
            <span className="branch-chip" style={{ cursor: "pointer", background: "var(--paper)" }}>JSON parser refactor ›</span>
          </span>
        </div>
      }

      {/* Tab body — pages own their own layout (scroll + composer pinning) */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>);

}

// PM · Chat tab — open conversation, no plan being drafted right now.
function PM_Chat() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>1 · PM panel · Chat tab</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="PM · Project Orchestrator" />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar active="pm" />
          <PMShell activeTab="chat">
            {/* Scrollable chat area */}
            <div className="wf-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "14px 18px 14px" }}>
              <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>

                {/* PM role intro card — explains what PM does + when + benefits */}
                <div className="box" style={{ padding: "14px 18px", background: "#fffaec", borderColor: "var(--pm)", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="pm-tag">PM</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "var(--pm)" }}>What I do in this project</span>
                    <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--ink-3)", cursor: "pointer" }}>dismiss ×</span>
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.6, color: "var(--ink-2)" }}>
                    <strong>My job:</strong> I keep the project's <em>memory</em>. I read your codebase, write & maintain <span className="mono" style={{ fontSize: 11 }}>PRD.md</span>, <span className="mono" style={{ fontSize: 11 }}>SOP.md</span> and <span className="mono" style={{ fontSize: 11 }}>Dev log.md</span>, then turn your goals into mission plans for workers to execute.<br />
                    <strong>My limits:</strong> I never run code, never approve tool calls, never enter a running mission. The work happens with workers — I just plan and remember.
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 2 }}>
                    <div className="box-soft" style={{ padding: "6px 8px", background: "var(--paper)" }}>
                      <div style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>Come find me when</div>
                      <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 4 }}>you want to plan a new mission, update PRD, or read the dev log</div>
                    </div>
                    <div className="box-soft" style={{ padding: "6px 8px", background: "var(--paper)" }}>
                      <div style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>Not me when</div>
                      <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 4 }}>you need to debug a worker — talk to the worker directly</div>
                    </div>
                    <div className="box-soft" style={{ padding: "6px 8px", background: "var(--paper)" }}>
                      <div style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700 }}>Why this split</div>
                      <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 4 }}>PM stays calm context-wise; workers stay focused; you stay in control</div>
                    </div>
                  </div>
                </div>

                {/* Chat history */}
                <div style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center" }}>14:08 · session start</div>

                <div className="box" style={{ padding: "10px 14px", background: "var(--paper)", maxWidth: 540 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pm)", marginBottom: 4 }}>PM</div>
                  <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                    Welcome back. I've read the PRD and dev log — 1 mission still running (<em>Dark mode</em>, 2 HITL pending). Anything you want to brief me on, plan, or review?
                  </div>
                </div>

                <div className="box" style={{ padding: "10px 14px", background: "var(--paper-2)", alignSelf: "flex-end", maxWidth: 540 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)", marginBottom: 4 }}>You</div>
                  <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                    Add JSON export + keyboard shortcuts to the same React TODO. Plan it.
                  </div>
                </div>

                <div className="box" style={{ padding: "12px 14px", background: "var(--paper)", maxWidth: 540 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pm)", marginBottom: 4 }}>PM</div>
                  <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                    On it. Reading current store + Header to figure out where the export hook fits, then I'll draft a mission plan.
                  </div>
                  <div className="box-soft" style={{ marginTop: 8, padding: "8px 10px", fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)" }}>
                    ⛏ read_file <span style={{ color: "var(--pm)" }}>src/store/todos.ts</span><br />
                    ⛏ read_file <span style={{ color: "var(--pm)" }}>src/components/Header.jsx</span><br />
                    <span style={{ color: "var(--approve)" }}>✓ context built · drafting plan…</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky composer at bottom */}
            <div style={{ padding: "10px 18px 14px", borderTop: "1.5px solid var(--rule)", background: "var(--paper-2)" }}>
              <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="composer" style={{ padding: "10px 12px" }} data-comment-anchor="3f4c68e2a0-div-124-15">
                  <span>Ask PM to plan a mission, refine PRD, or summarize what's been done…</span>
                  <span className="send">↵</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span
                    title="Have PM enumerate every screen this project needs and flag which are new design vs. derivable from existing patterns — ready to hand off to Claude Design"
                    className="branch-chip"
                    style={{
                      cursor: "pointer",
                      background: "var(--pm-soft)",
                      borderColor: "var(--pm)",
                      color: "var(--pm)",
                      fontWeight: 600,
                      fontFamily: "var(--sans)",
                      fontSize: 11,
                      padding: "4px 9px"
                    }}>✎ Scope screens for design 

                  </span>
                  <span className="branch-chip" style={{ cursor: "pointer" }}>Update PRD</span>
                  <span className="branch-chip" style={{ cursor: "pointer" }}>Summarize dev log</span>
                  <span className="branch-chip" style={{ cursor: "pointer" }}>Plan a new mission</span>
                  <span className="branch-chip" style={{ cursor: "pointer" }}>Audit current missions</span>
                </div>
              </div>
            </div>
          </PMShell>
        </div>
        <BottomBar extra="PM panel · 1 mission running · 2 hitl pending" />
      </div>
    </div>);

}

// PM · Chat tab · Mission Plan drafted — PM produced a plan card, awaiting user approval.
// Layout: doc on the left (scrollable, visible scrollbar) + sticky comments gutter on the right,
// composer fixed at the bottom.
function PM_MissionPlan() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>2 · PM panel · drafting mission plan</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="PM · drafting Mission Plan" />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar active="pm" />
          <PMShell activeTab="chat">

            {/* Doc + comments gutter (scroll area) */}
            <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 14, padding: "14px 18px 0", overflow: "hidden" }}>

              {/* Doc area, scrollable with visible scrollbar */}
              <div style={{ flex: "1 1 680px", minWidth: 0, overflow: "auto", paddingRight: 6, scrollbarWidth: "auto", position: "relative" }} className="pm-doc-scroll">
                <div className="pm-doc" style={{ maxWidth: 700 }}>
                  <div className="doc-head">
                    <span className="pm-tag">PLAN</span>
                    <span className="doc-title">Add JSON Export + Keyboard Shortcuts</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-3)" }}>v1 · just drafted</span>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--ink-2)" }}>
                    Splitting into 3 parallel assignments. Each gets its own branch + skill loadout. Universal TDD-Expert on all.
                  </p>
                  <h3>Assignments</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {WF_DATA.workers.slice(0, 3).map((w) =>
                    <div key={w.id} className="task-card">
                        <div className="row1">
                          <span className="id">{w.id}</span>
                          <span className="role">{w.role}</span>
                          <span className="name">{w.name}</span>
                          <span className="branch">⎇ {w.branch}</span>
                        </div>
                        <div className="desc">
                          {w.id === "W1" && "ThemeContext via CSS variables. Refactor 12 components to consume theme tokens."}
                          {w.id === "W2" && "Export menu in Header; JSON serialize + import round-trip; skip archived."}
                          {w.id === "W3" && "useHotkeys hook (cmd+n / cmd+f / cmd+/) + visible cheatsheet modal."}
                        </div>
                        <div className="skills">
                          {w.skills.map((s) => <span key={s} className="skill">{s}</span>)}
                          <span className="skill-add">+ skill</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <h3 style={{ marginTop: 12 }} data-comment-anchor="28d6b20e03-h3-226-19">Confirm before dispatch</h3>
                  <div style={{
                    padding: "12px 14px",
                    background: "var(--review-soft)",
                    border: "1.5px solid var(--review)",
                    borderRadius: 5,
                    display: "flex",
                    alignItems: "center",
                    gap: 12
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Dispatch this assignment plan?</div>
                      <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 2 }}>3 workers will be briefed on their branches. Each tool call still needs your approval.</div>
                    </div>
                    <button className="btn" style={{
                      fontSize: 12, padding: "8px 18px",
                      background: "var(--review)", color: "var(--paper)",
                      border: "1.5px solid var(--review)", borderRadius: 4,
                      fontWeight: 700, whiteSpace: "nowrap"
                    }}>▶ Dispatch</button>
                  </div>

                  <div style={{ marginTop: 10, fontSize: 11, color: "var(--ink-3)", textAlign: "center" }}>
                    Once dispatched, PM steps out — workers run it.
                  </div>
                </div>
              </div>

              {/* Sticky comments gutter */}
              <div className="wf-scroll" style={{ flex: "0 0 280px", overflow: "auto", paddingBottom: 8, display: "flex", flexDirection: "column" }} data-comment-anchor="33cdb55800-div-247-15">
                {/* Gutter head: batch send-to-PM */}
                <div className="box" style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6, background: "var(--paper)", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span className="hand" style={{ fontSize: 13, color: "var(--ink-2)" }}>3 open comments</span>
                    <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--ink-3)" }}>1 resolved</span>
                  </div>
                  <button className="btn" style={{ fontSize: 11, padding: "5px 10px", background: "var(--pm)", color: "var(--paper)", border: "1.5px solid var(--pm)", borderRadius: 3, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                    ✉ Send all to PM — revise plan
                  </button>
                  <div style={{ fontSize: 10, color: "var(--ink-3)", textAlign: "center" }}>PM will batch-update the plan in one pass</div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="sticky" style={{ position: "relative" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span className="who" style={{ flex: 1 }}>you · on W1</span>
                      <input type="checkbox" style={{ accentColor: "var(--pm)", margin: 0 }} defaultChecked title="include in batch" />
                    </div>
                    use CSS variables, not styled-components
                  </div>
                  <div className="sticky" style={{ position: "relative", transform: "rotate(-0.6deg)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span className="who" style={{ flex: 1 }}>you · on W2</span>
                      <input type="checkbox" style={{ accentColor: "var(--pm)", margin: 0 }} defaultChecked title="include in batch" />
                    </div>
                    add an "import" button too, same menu
                  </div>
                  <div className="sticky" style={{ position: "relative", transform: "rotate(0.4deg)", opacity: 0.6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span className="who" style={{ flex: 1 }}>PM · reply (resolved)</span>
                      <span style={{ fontSize: 10, color: "var(--approve)" }}>✓</span>
                    </div>
                    ✓ noted, updating W2 scope to include import
                  </div>
                  <div className="sticky" style={{ position: "relative" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span className="who" style={{ flex: 1 }}>you · on Confirm list</span>
                      <input type="checkbox" style={{ accentColor: "var(--pm)", margin: 0 }} defaultChecked title="include in batch" />
                    </div>
                    split W3 in two if hotkey + cheatsheet feels too much
                  </div>
                  <div className="composer" style={{ padding: "6px 8px", fontSize: 11 }}>
                    <span style={{ fontSize: 11 }}>Comment on selection…</span>
                    <span className="send">↵</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky composer at bottom (talk to PM about the plan) */}
            <div style={{ padding: "10px 18px 14px", borderTop: "1.5px solid var(--rule)", background: "var(--paper-2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 10, letterSpacing: 1.2, color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 700 }}>Talk to PM</span>
                <div className="composer" style={{ padding: "10px 12px", flex: 1 }}>
                  <span>Split a task, change skills, answer an open question…</span>
                  <span className="send">↵</span>
                </div>
              </div>
            </div>

          </PMShell>
        </div>
        <BottomBar extra="plan v1 · 3 comments · awaiting your approval" />
      </div>
    </div>);

}

Object.assign(window, { PMShell, PM_Chat, PM_MissionPlan });