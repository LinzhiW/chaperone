// Phase 2 · Batch 3 — Empty / pre-interaction states.
// One "before user touches anything" state per major user-journey node.
// These slot in at the START of each section in the canvas, so the journey reads:
//   empty state → first interaction → loaded state → outcome state

// ─────────────────────────────────────────────────────────────────────────────
// Helper · big centered hero card used by most empty states
function EmptyHero({ icon, title, sub, ctas, footer, accent = "var(--pm)" }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--paper-2)", padding: 24, minHeight: 0 }}>
      <div className="box" style={{
        background: "var(--paper)", borderColor: "var(--rule)", borderRadius: 6,
        padding: "26px 30px", maxWidth: 540, width: "100%",
        display: "flex", flexDirection: "column", gap: 14, alignItems: "stretch",
        position: "relative"
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 12,
          background: accent + "18", color: accent,
          border: `1.5px dashed ${accent}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22, fontWeight: 700, alignSelf: "flex-start"
        }}>{icon}</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.25 }}>{title}</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.55, marginTop: 6 }}>{sub}</div>
        </div>
        {ctas && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{ctas}</div>}
        {footer && <div style={{ borderTop: "1px dashed var(--rule-soft)", paddingTop: 10, fontFamily: "var(--hand)", fontSize: 13, color: "var(--ink-3)" }}>{footer}</div>}
      </div>
    </div>);

}

function EmptyPrimaryBtn({ children }) {
  return <button className="btn" style={{ fontSize: 12, padding: "7px 14px", background: "var(--ink)", color: "var(--paper)", border: "1.5px solid var(--ink)", borderRadius: 4, fontWeight: 600, cursor: "pointer" }}>{children}</button>;
}
function EmptyGhostBtn({ children }) {
  return <button className="btn" style={{ fontSize: 12, padding: "7px 14px", background: "var(--paper)", color: "var(--ink-2)", border: "1.5px solid var(--rule-soft)", borderRadius: 4, cursor: "pointer" }}>{children}</button>;
}

// ─────────────────────────────────────────────────────────────────────────────
// §2 EMPTY — PM Chat just opened, fresh project, zero history.
// Onboarding is done; PM has memory but you haven't briefed anything yet.
function PM_Chat_Empty() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>◌ 3.1 · PM Chat · first open · empty thread · ready to interact</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="PM · Project Orchestrator" pending={0} />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar active="mission:dark-mode" />
          <PMShell activeTab="chat" runningMission={null} memoryOverride="no memory yet · starts building on first brief" hideDocs>
            <div className="wf-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "20px 18px 0", display: "flex", flexDirection: "column" }} data-comment-anchor="0c853e7f94-div-74-17">
              <div style={{ maxWidth: 560, margin: "auto", width: "100%", display: "flex", flexDirection: "column", gap: 16, alignItems: "center", textAlign: "center", padding: "40px 0" }}>

                {/* Start-from-scratch hero · no memory recap */}
                <div style={{
                  width: 60, height: 60, borderRadius: 14,
                  background: "var(--pm-soft)", border: "1.5px dashed var(--pm)", color: "var(--pm)",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700
                }}>PM</div>

                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>Starting fresh.</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6, marginTop: 6, maxWidth: 460 }}>
                    No history, no docs, no missions — just you and me. Tell me what to build, fix, or refactor and I'll draft a plan. Everything I learn from here on goes into PRD / SOP / Dev log.
                  </div>
                </div>

                <div style={{ fontFamily: "var(--hand)", fontSize: 14, color: "var(--ink-3)" }}>
                  ↓ start typing below — first brief is also first memory
                </div>

              </div>
            </div>

            {/* Composer + suggestion chips */}
            <div style={{ padding: "10px 18px 14px", borderTop: "1.5px solid var(--rule)", background: "var(--paper-2)" }}>
              <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="composer" style={{ padding: "12px 14px", fontSize: 13 }}>
                  <span style={{ color: "var(--ink-3)" }}>What's our first mission?</span>
                  <span className="send">↵</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--hand)", fontSize: 13, color: "var(--ink-3)", marginRight: 4 }}>quick starts:</span>
                  <span className="branch-chip" style={{ cursor: "pointer", background: "var(--pm-soft)", borderColor: "var(--pm)", color: "var(--pm)" }}>Plan a feature</span>
                  <span className="branch-chip" style={{ cursor: "pointer" }}>Plan a refactor</span>
                  <span className="branch-chip" style={{ cursor: "pointer" }}>Audit the codebase</span>
                  <span className="branch-chip" style={{ cursor: "pointer" }}>Set up CI / SOP</span>
                </div>
              </div>
            </div>
          </PMShell>
        </div>
        <BottomBar extra="PM panel · idle · awaiting your first brief" />
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────────────────────
// §3 EMPTY — Mission just dispatched. PM has exited; workers are spinning up
// their context. No tool calls have streamed yet. This is the moment between
// "▶ Dispatch" and the first agent line.
function Mission_Dashboard_Empty() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>◌ 3.2 · Mission dashboard · just dispatched · workers booting · ready to interact</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar pending={0} branches={4} />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar active="mission:dark-mode" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--paper-2)" }}>
            <MissionStrip name="Dark mode mission" status="running" workers={4} hitl={0} />

            <div style={{ flex: 1, padding: 14, display: "flex", flexDirection: "column", gap: 12, minHeight: 0, overflow: "hidden" }}>

              {/* Just-dispatched banner */}
              <div className="box" style={{ padding: "10px 14px", background: "var(--review-soft)", borderColor: "var(--review)", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 16 }}>▶</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--review)" }}>Mission dispatched · 4 workers spinning up</div>
                  <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 2 }}>
                    PM has exited the room. Workers are pulling skills + reading their assignment briefs. First tool call HITL will arrive in a few seconds.
                  </div>
                </div>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" }}>14:24:02</span>
              </div>

              {/* 2×2 grid · all idle / booting */}
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 12, minHeight: 0 }}>
                {WF_DATA.workers.map((w, i) =>
                <BootingTile key={w.id} w={w} stage={["pulling skills", "reading PRD", "pulling skills", "queued"][i]} />
                )}
              </div>

              {/* hand-drawn pointer */}
              <div style={{ fontFamily: "var(--hand)", fontSize: 14, color: "var(--ink-3)", textAlign: "center" }}>
                empty grid is the natural starting state · streams fill in top-down as each worker thinks
              </div>
            </div>
          </div>
        </div>
        <BottomBar extra="mission dispatched · 0 commits · 0 HITL · waiting for first tool call" />
      </div>
    </div>);

}

function BootingTile({ w, stage }) {
  const isQueued = stage === "queued";
  return (
    <div className="worker-tile" style={{ opacity: isQueued ? 0.6 : 1 }}>
      <div className="wt-head">
        <span className="swatch" style={{ background: w.color }} />
        <span className="wt-name">{w.id} · {w.name}</span>
        <span className="wt-branch">{w.branch}</span>
        <span className="wt-status" style={{
          background: isQueued ? "var(--paper-2)" : "#f8e8b8",
          borderColor: isQueued ? "var(--rule-soft)" : "var(--review)",
          color: isQueued ? "var(--ink-3)" : "var(--review)"
        }}>{isQueued ? "◌ queued" : "◐ booting"}</span>
      </div>
      <div className="wt-body" style={{ alignItems: "center", justifyContent: "center", textAlign: "center", gap: 10 }}>
        {!isQueued &&
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ display: "flex", gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: 99, background: w.color, opacity: 0.4 }} />
              <span style={{ width: 6, height: 6, borderRadius: 99, background: w.color, opacity: 0.7 }} />
              <span style={{ width: 6, height: 6, borderRadius: 99, background: w.color, opacity: 1 }} />
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-2)", fontFamily: "var(--mono)" }}>{stage}…</div>
            <div style={{ fontSize: 10, color: "var(--ink-3)" }}>{w.role}</div>
          </div>
        }
        {isQueued &&
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ fontSize: 18, color: "var(--ink-3)" }}>◌</div>
            <div style={{ fontSize: 11, color: "var(--ink-3)" }}>will start when slot opens</div>
          </div>
        }
      </div>
      <div className="wt-composer">
        <span className="ph" style={{ opacity: 0.5 }}>{isQueued ? "nudge before start…" : "talk to " + w.id + "…"}</span>
        <span className="send" style={{ opacity: 0.4 }}>↵</span>
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────────────────────
// §3 EMPTY · Worker chat — single worker deep-dive, just opened, empty stream.
// Same shell as the eventual Worker_Chat page; the body is "about to start".
function Worker_Chat_Empty() {
  const w = WF_DATA.workers[0];
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>◌ 3.3 · Worker chat · just opened · empty stream · ready to interact</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title={`Worker · ${w.id} · ${w.name}`} pending={0} branches={4} />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar active="mission:dark-mode" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--paper-2)" }}>
            <MissionStrip name="Dark mode mission" status="running" workers={4} hitl={0} />

            <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

              {/* Main: empty stream */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, borderRight: "1.5px solid var(--rule)" }}>
                <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--rule-soft)", background: "var(--paper)", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 99, background: w.color }} />
                  <strong style={{ fontSize: 13 }}>{w.id} · {w.name}</strong>
                  <span className="branch-chip">{w.branch}</span>
                  <span style={{ marginLeft: "auto", fontSize: 10, padding: "2px 6px", borderRadius: 3, background: "#f8e8b8", color: "var(--review)", border: "1px solid var(--review)" }}>◐ booting</span>
                </div>

                <div className="wf-scroll" style={{ flex: 1, overflow: "auto", padding: "30px 18px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 10, alignItems: "center", maxWidth: 420 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 14,
                      background: w.color + "18", border: `1.5px dashed ${w.color}`, color: w.color,
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700
                    }}>{w.id}</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Stream is empty</div>
                    <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.55 }}>
                      {w.id} has pulled its skills and is reading the assignment brief. The first agent line and tool call HITL will appear here. You can nudge or rewrite the plan before it starts.
                    </div>
                    <div style={{ fontFamily: "var(--hand)", fontSize: 13, color: "var(--ink-3)" }}>
                      ↓ talk to {w.id} below — guide it before the first move
                    </div>
                  </div>
                </div>

                <div style={{ padding: "10px 14px", borderTop: "1.5px solid var(--rule)", background: "var(--paper-2)" }}>
                  <div className="composer" style={{ padding: "10px 12px" }}>
                    <span>Tell {w.id} where to start — e.g. "use CSS variables, no styled-components"…</span>
                    <span className="send">↵</span>
                  </div>
                </div>
              </div>

              {/* Right rail — worker state · all empty */}
              <div style={{ flex: "0 0 240px", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 14, background: "var(--paper)" }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>Loadout · 2 skills</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {w.skills.map((s) => <span key={s} className="branch-chip" style={{ background: w.color + "18", borderColor: w.color, color: w.color }}>{s}</span>)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>Files touched</div>
                  <div style={{ fontSize: 11, color: "var(--ink-3)", fontStyle: "italic" }}>none yet</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>Commits</div>
                  <div style={{ fontSize: 11, color: "var(--ink-3)", fontStyle: "italic" }}>0 · branch is at main</div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>Assignment brief</div>
                  <div style={{ fontSize: 11, color: "var(--ink-2)", lineHeight: 1.5, fontStyle: "italic" }}>
                    "ThemeContext via CSS variables. Refactor 12 components to consume theme tokens."
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <BottomBar extra={`worker · ${w.id} · 0 lines · awaiting first action`} />
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────────────────────
// §4 EMPTY · Reviewer just summoned. Branches are being scanned, no annotations yet.
function Mission_Reviewer_Empty() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>◌ 3.4 · Reviewer · just summoned · scanning branches · ready to interact</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="Reviewer · scanning W1…" pending={0} />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar active="mission:dark-mode" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--paper-2)" }}>
            <MissionStrip name="Dark mode mission" status="review" workers={4} hitl={0} />

            <div style={{ flex: 1, padding: 14, display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>

              {/* Branch ribbon · sequential — one active, rest queued */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                {WF_DATA.workers.map((w, i) => {
                  const state = i === 0 ? "scanning" : i === 1 ? "next" : "queued";
                  const dim = state === "queued";
                  return (
                    <div key={w.id} className="box" style={{
                      padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4,
                      borderLeft: `4px solid ${w.color}`, background: "var(--paper)",
                      opacity: dim ? 0.55 : 1
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <strong style={{ fontSize: 12 }}>{w.id} · {w.name}</strong>
                        <span style={{
                          marginLeft: "auto", fontSize: 10, fontFamily: "var(--mono)",
                          color: state === "scanning" ? "var(--review)" : state === "next" ? "var(--ink-2)" : "var(--ink-3)"
                        }}>{state === "scanning" ? "● scanning…" : state === "next" ? "○ next" : "◌ queued"}</span>
                      </div>
                      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" }}>⎇ {w.branch}</div>
                      <div style={{ display: "flex", gap: 8, fontFamily: "var(--mono)", fontSize: 10 }}>
                        <span style={{ color: "var(--approve)" }}>+{[124, 68, 156, 42][i]}</span>
                        <span style={{ color: "var(--warn)" }}>−{[18, 12, 33, 4][i]}</span>
                        <span style={{ color: "var(--ink-3)" }}>· {[6, 3, 4, 5][i]} files</span>
                      </div>
                    </div>);
                })}
              </div>

              {/* Big empty hero · explains what reviewer is doing */}
              <div className="box" style={{
                flex: 1, background: "var(--paper)", display: "flex", alignItems: "center", justifyContent: "center",
                padding: 30, minHeight: 0
              }} data-comment-anchor="761eb93bed-div-332-15">
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, maxWidth: 500, textAlign: "center" }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: 14,
                    background: "var(--review-soft)", border: "1.5px dashed var(--review)", color: "var(--review)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 700
                  }}>R</div>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>Reviewer is reading branches · one at a time</div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
                    Sequential read — single reviewer context, branch-by-branch. On each branch it pulls the diff, checks SOP rules, and classifies findings into <span style={{ color: ANN.bug.text, fontWeight: 600 }}>🐛 Bug</span> · <span style={{ color: ANN.note.text, fontWeight: 600 }}>ℹ Note</span> · <span style={{ color: ANN.bloat.text, fontWeight: 600 }}>🧹 Bloat</span> · <span style={{ color: ANN.missing.text, fontWeight: 600 }}>❓ Missing</span>. Annotations stream in as each branch finishes.
                  </div>

                  {/* Sequential queue — one active row, rest queued */}
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
                    {WF_DATA.workers.map((w, i) => {
                      const state = i === 0 ? "active" : i === 1 ? "next" : "queued";
                      const pct = state === "active" ? 60 : 0;
                      return (
                        <div key={w.id} style={{ display: "flex", alignItems: "center", gap: 8, opacity: state === "queued" ? 0.5 : 1 }}>
                          <span style={{ width: 60, fontSize: 10, fontFamily: "var(--mono)", color: "var(--ink-3)", textAlign: "left" }}>{w.id}</span>
                          <div style={{ flex: 1, height: 6, background: "var(--paper-2)", borderRadius: 3, overflow: "hidden", border: "1px solid var(--rule-soft)" }}>
                            <div style={{ width: pct + "%", height: "100%", background: w.color, borderRadius: 3 }} />
                          </div>
                          <span style={{ width: 64, fontSize: 10, fontFamily: "var(--mono)", textAlign: "right",
                            color: state === "active" ? "var(--review)" : state === "next" ? "var(--ink-2)" : "var(--ink-3)"
                          }}>{state === "active" ? `● ${pct}%` : state === "next" ? "○ next" : "◌ queued"}</span>
                        </div>);

                    })}
                  </div>

                  <div style={{ fontFamily: "var(--hand)", fontSize: 13, color: "var(--ink-3)" }}>
                    one at a time keeps the reviewer's context clean · ~30s per branch · ~2 min total
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <EmptyGhostBtn>← Cancel · back to dashboard</EmptyGhostBtn>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <BottomBar extra="reviewer · scanning W1 (1 of 4) · ~30s per branch" />
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────────────────────
// §5 EMPTY · Dev log empty — fresh project, no missions archived yet.
function PM_DevLog_Empty() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>◌ 3.5 · Dev log · empty · no archives yet · ready to interact</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="PM · Dev log.md" pending={0} />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar active="mission:dark-mode" />
          <PMShell activeTab="devlog" runningMission={null} memoryOverride="3 docs · 0 missions">
            <div style={{ flex: 1, minHeight: 0, display: "flex" }}>

              {/* Left rail · empty entries */}
              <div style={{ flex: "0 0 220px", borderRight: "1.5px solid var(--rule)", display: "flex", flexDirection: "column", background: "var(--paper-2)" }}>
                <div style={{ padding: "10px 12px 6px", fontSize: 10, color: "var(--ink-3)", letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>
                  Entries · 0
                </div>
                <div style={{ flex: 1, padding: "16px 14px", display: "flex", flexDirection: "column", gap: 8, color: "var(--ink-3)" }}>
                  <div style={{ fontSize: 11, fontStyle: "italic" }}>no entries yet</div>
                  <div style={{ fontSize: 10, lineHeight: 1.5 }}>archived reviewer reports appear here, newest first.</div>
                </div>
              </div>

              {/* Doc body · empty hero */}
              <EmptyHero
                icon="📜"
                title="Dev log is empty"
                accent="var(--pm)"
                sub={
                <>
                    Nothing's been archived yet. Each time you finish a mission and click <strong>"✓ Archive to PM's dev log"</strong> in the Reviewer panel, an entry lands here with the report summary, branches, decisions, and resolved annotations.
                    <br /><br />
                    PM uses this log to maintain <span className="mono" style={{ fontSize: 11 }}>PRD.md</span> and <span className="mono" style={{ fontSize: 11 }}>SOP.md</span> — your project's long-term memory grows from this file.
                  </>
                }
                ctas={
                <>
                    <EmptyPrimaryBtn>Brief your first mission →</EmptyPrimaryBtn>
                    <EmptyGhostBtn>Open PRD.md</EmptyGhostBtn>
                  </>
                }
                footer="first archive = first entry · usually it's a small win like 'set up CI'" />

            </div>
          </PMShell>
        </div>
        <BottomBar extra="dev log · 0 entries · ready to record" />
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────────────────────
// §6 EMPTY · Skill library — fresh install, no skills loaded.
function Skills_Library_Empty() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>◌ 4.1 · Skills library · empty · fresh install · ready to interact</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="Skills · Library" pending={0} />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

          {/* Trimmed sidebar · no categories yet */}
          <div className="wf-side" style={{ width: 220 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 1.4, color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 700, marginBottom: 6, padding: "0 2px" }}>Workspace</div>
              <div className="box" style={{ padding: "6px 8px", display: "flex", alignItems: "center", gap: 6, background: "var(--paper)" }}>
                <span style={{ color: "var(--ink-3)", fontSize: 11 }}>📁</span>
                <span className="mono" style={{ fontSize: 11, flex: 1 }}>~/todo-app</span>
              </div>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, padding: "0 2px" }}>
                <span style={{ color: "var(--ink-3)", fontSize: 9 }}>▾</span>
                <span style={{ fontSize: 10, letterSpacing: 1.4, color: "var(--ink)", textTransform: "uppercase", fontWeight: 700 }}>Skills</span>
                <span style={{ marginLeft: "auto", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--approve)", border: "1px solid var(--approve)", borderRadius: 3, fontSize: 11, fontWeight: 700 }}>＋</span>
              </div>
              <div style={{ padding: "8px 10px", color: "var(--ink-3)", fontSize: 11, fontStyle: "italic", border: "1px dashed var(--rule-soft)", borderRadius: 3 }}>
                no skills · no categories · no sets
              </div>
              <div style={{ fontFamily: "var(--hand)", fontSize: 12, color: "var(--ink-3)", padding: "8px 4px 0", lineHeight: 1.3 }}>
                add a few skills · then organize them with categories
              </div>
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--paper-2)" }}>
            <div style={{ padding: "12px 18px", borderBottom: "1.5px solid var(--rule)", background: "var(--paper)", display: "flex", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Skill library</div>
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>0 skills · nothing equipped · nothing imported</div>
              </div>
              <div className="composer" style={{ padding: "8px 12px", flex: 1, maxWidth: 360, marginLeft: "auto", opacity: 0.55 }}>
                <span style={{ fontSize: 12 }}>🔍 (search will activate once you have skills)</span>
              </div>
            </div>

            <EmptyHero
              icon="🛠"
              accent="var(--approve)"
              title="Build your skill library"
              sub={
              <>
                  Skills are <span className="mono" style={{ fontSize: 11 }}>.md</span> files that get injected into a worker's system prompt — TDD rules, OWASP checklists, a11y guides, your team's house style. They're <strong>per-project</strong> by default and <strong>composable</strong> into sets.
                  <br /><br />
                  Start with the 3 built-ins or import your own.
                </>
              }
              ctas={
              <>
                  <EmptyPrimaryBtn>＋ New skill (upload / paste / GitHub)</EmptyPrimaryBtn>
                  <EmptyGhostBtn>Install 3 built-ins</EmptyGhostBtn>
                  <EmptyGhostBtn>Browse Skill community ⨉ <span style={{ marginLeft: 4, fontSize: 9, color: "var(--ink-3)" }}>soon</span></EmptyGhostBtn>
                </>
              }
              footer="suggested starters: TDD-Expert · Conventional-Commits · a11y-audit" />

          </div>
        </div>
        <BottomBar extra="skills · 0 in library · 0 workers equipped" />
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────────────────────
// §6 EMPTY · Loadout — worker just hired (or hired with Skip · do it later).
// No skills equipped. Library on the right ready to drag from.
function Skills_Loadout_Empty() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>◌ 2.1 · Loadout · worker just hired · 0 skills equipped · ready to interact</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="W5 · api-worker · Loadout" pending={0} />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar active="team:api-worker" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--paper-2)" }}>

            <div style={{ padding: "10px 16px", borderBottom: "1.5px solid var(--rule)", background: "var(--paper-2)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: "var(--w2)" }} />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--ink-3)" }}>
                  <span className="mono">Team</span><span>›</span>
                  <span className="mono">Backend Dept</span><span>›</span>
                  <span className="mono">W5 · api-worker</span><span>›</span>
                  <span style={{ color: "var(--ink-2)", fontWeight: 600 }}>Loadout</span>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 1 }}>W5 · Auth & Sessions <span style={{ fontWeight: 400, color: "var(--ink-3)", fontSize: 11, marginLeft: 4 }}>api-worker · ⎇ feat/api- · ○ idle · just hired</span></div>
              </div>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-3)" }}>
                Equip skills before briefing — or hire bare and add later.
              </span>
            </div>

            <div className="wf-scroll" style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 14, minHeight: 0, overflow: "auto" }}>

              {/* Empty equipped frame */}
              <section style={{
                background: "var(--paper-2)",
                border: "1.5px dashed var(--rule)",
                borderRadius: 10,
                padding: "20px 14px",
                display: "flex", flexDirection: "column", gap: 10
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)", letterSpacing: 0.4, textTransform: "uppercase" }}>Equipped</span>
                  <span style={{ fontSize: 11, color: "var(--ink-3)" }}>0 skills · this worker has nothing equipped yet</span>
                  <span style={{ marginLeft: "auto", display: "inline-flex", gap: 8 }}>
                    <button className="btn" style={{ fontSize: 11, padding: "5px 12px", borderRadius: 4, background: "var(--paper)", color: "var(--ink-2)", border: "1.5px solid var(--rule-soft)" }} disabled>↶ Discard</button>
                    <button className="btn" style={{ fontSize: 12, padding: "5px 14px", borderRadius: 4, background: "var(--paper)", color: "var(--ink-3)", border: "1.5px solid var(--rule-soft)", fontWeight: 600 }} disabled>✓ Save · nothing to save</button>
                  </span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "20px 12px", color: "var(--ink-3)" }}>
                  <div style={{ fontSize: 28 }}>⬇</div>
                  <div style={{ fontSize: 12 }}>Drag a skill from the library below, or apply a saved set:</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                    {SAVED_SETS.map((set) =>
                    <span key={set.id} className="branch-chip" style={{
                      cursor: "pointer", padding: "4px 10px",
                      background: "var(--pm-soft)", borderColor: "var(--pm)", color: "var(--pm)", fontWeight: 600
                    }}>⊞ {set.label}</span>
                    )}
                  </div>
                  <div style={{ fontFamily: "var(--hand)", fontSize: 13, color: "var(--ink-3)" }}>
                    or hire bare — you can equip later from this page
                  </div>
                </div>
              </section>

              {/* Library — full, ready to drag */}
              <section className="box" style={{ background: "var(--paper)", display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div style={{ padding: "8px 12px", borderBottom: "1.5px solid var(--rule)", background: "var(--paper-2)", fontSize: 12, fontWeight: 600 }}>
                  Library · 10 skills <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>· drag a card up into Equipped</span>
                </div>
                <div className="wf-scroll" style={{ overflow: "auto", padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 8 }}>
                  {SKILL_LIB.map((s) => <SkillCard key={s.id} skill={s} draggable />)}
                </div>
              </section>

            </div>
          </div>
        </div>
        <BottomBar extra="loadout · W5 · 0 equipped · nothing to save" />
      </div>
    </div>);

}

Object.assign(window, {
  EmptyHero, EmptyPrimaryBtn, EmptyGhostBtn, BootingTile,
  PM_Chat_Empty,
  Mission_Dashboard_Empty,
  Worker_Chat_Empty,
  Mission_Reviewer_Empty,
  PM_DevLog_Empty,
  Skills_Library_Empty,
  Skills_Loadout_Empty
});