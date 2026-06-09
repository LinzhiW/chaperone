// Mission screens — Phase 1.
// Inside a mission, PM is NOT here. The Workers run the show; the user iterates with them
// until satisfied, calls the Reviewer, decides if it's good, then archives the report to
// PM's dev log.

// Mission identity strip — shows what mission you're in + a way back to PM
function MissionStrip({ name, status = "running", workers = 4, hitl = 2 }) {
  return (
    <div className="box" style={{
      padding: "10px 14px", display: "flex", alignItems: "center", gap: 12,
      background: "var(--paper-2)", borderBottom: "1.5px solid var(--rule)",
      borderRadius: 0, border: "none", borderBottomLeftRadius: 0
    }}>
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: status === "running" ? "var(--approve)" : "var(--review)" }} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{name}</div>
        <div style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 0.5 }}>
          {status === "running" ? "● Running" : "◐ Awaiting your review"} · {workers} workers · {hitl} HITL pending
        </div>
      </div>
      <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--ink-3)" }}>started 14:24 · branch base: main</span>
        <button className="btn" style={{ fontSize: 11, padding: "4px 10px", border: "1px solid var(--rule)", background: "var(--paper)", borderRadius: 3, color: "var(--ink-2)" }}>Pause mission</button>
        <button className="btn" style={{ fontSize: 11, padding: "4px 10px", border: "1.5px solid var(--pm)", color: "var(--pm)", background: "var(--paper)", borderRadius: 3 }}>← PM panel</button>
      </span>
    </div>
  );
}

// Mission · Dashboard — the running mission. No PM in this room.
function Mission_Dashboard() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>3 · Mission · running dashboard (no PM here)</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar active="mission:dark-mode" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--paper-2)" }}>
            <MissionStrip name="Dark mode mission" status="running" workers={4} hitl={2} />

            <div style={{ flex: 1, padding: 14, display: "flex", flexDirection: "column", gap: 12, minHeight: 0, overflow: "hidden" }}>
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 12, minHeight: 0 }}>
                <WorkerTile w={WF_DATA.workers[0]}>
                  <StreamLines lines={[
                    { kind: "agent", text: "→ Plan: add ThemeContext, wire toggle in Header" },
                    { kind: "tool",  text: "⛏ read_file: src/App.jsx (132 lines)" },
                    { kind: "tool",  text: "⛏ write_file: src/theme.ts" },
                    { kind: "ok",    text: "✓ committed: scaffold ThemeContext (4f3a1)" }
                  ]} />
                  <HitlCard tool="run_shell" cmd="npx tsc --noEmit && npm test" />
                  <div className="wt-composer">
                    <span className="ph">talk to W1 — e.g. “why CSS vars over context?”</span>
                    <span className="send">↵</span>
                  </div>
                </WorkerTile>

                <WorkerTile w={WF_DATA.workers[1]}>
                  <StreamLines lines={[
                    { kind: "agent", text: "→ Plan: add Export menu, JSON serializer + tests" },
                    { kind: "tool",  text: "⛏ read_file: src/store/todos.ts" },
                    { kind: "ok",    text: "✓ wrote test: exportToJSON returns valid blob" }
                  ]} />
                  <HitlCard tool="write_file" cmd="src/utils/exportJSON.ts (+48 lines)" />
                  <div className="wt-composer">
                    <span className="ph">talk to W2 — e.g. “include archived too”</span>
                    <span className="send">↵</span>
                  </div>
                </WorkerTile>

                <WorkerTile w={WF_DATA.workers[2]}>
                  <StreamLines lines={[
                    { kind: "agent", text: "→ Plan: hotkey hook + visible shortcuts overlay" },
                    { kind: "tool",  text: "⛏ write_file: src/hooks/useHotkeys.ts" },
                    { kind: "ok",    text: "✓ committed: register cmd+n, cmd+f, cmd+/  (a91d2)" },
                    { kind: "agent", text: "→ Building shortcut cheatsheet modal..." }
                  ]} />
                  <div style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>streaming...</div>
                  <div className="wt-composer">
                    <span className="ph">talk to W3 — nudge or redirect</span>
                    <span className="send">↵</span>
                  </div>
                </WorkerTile>

                <WorkerTile w={WF_DATA.workers[3]}>
                  <div style={{ padding: "20px 8px", textAlign: "center", color: "var(--ink-3)", fontSize: 12 }}>
                    <div className="hand" style={{ fontSize: 18, color: "var(--ink-3)", marginBottom: 6 }}>idle — start when ready</div>
                    <button className="btn" style={{ fontSize: 11, padding: "4px 12px", border: "1.5px solid var(--rule)", background: "var(--paper)", borderRadius: 3 }}>▶ Brief & start W4</button>
                  </div>
                  <div className="wt-composer">
                    <span className="ph">brief W4 directly…</span>
                    <span className="send">↵</span>
                  </div>
                </WorkerTile>
              </div>

              {/* Reviewer call strip — user-controlled, not PM-driven */}
              <div className="box" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, background: "var(--paper)" }}>
                <span className="pm-tag" style={{ background: "var(--review-soft)", color: "var(--review)", borderColor: "var(--review)" }}>REVIEWER</span>
                <span style={{ fontSize: 12, color: "var(--ink-2)" }}>Iterate with workers until satisfied, then summon Reviewer to bundle a report.</span>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-3)" }}>2 of 4 workers idle</span>
                <button className="btn" style={{ fontSize: 12, padding: "5px 14px", background: "var(--review)", color: "var(--paper)", border: "1.5px solid var(--review)", borderRadius: 3, fontWeight: 600 }}>Call Reviewer</button>
              </div>
            </div>
          </div>
        </div>
        <BottomBar extra="mission · 11 commits · 2 hitl pending" />
      </div>
    </div>
  );
}

// Mission · Reviewer — bundle of diffs + reviewer notes. User decides: iterate, or archive to PM.
function Mission_Reviewer() {
  const issues = [
    { sev: "warn", w: "W1+W3", text: "src/components/Header.jsx — both touched imports. Trivial rebase." },
    { sev: "info", w: "W2",    text: "includes:false on archived — confirm matches your earlier note." },
    { sev: "good", w: "W4",    text: "14 tests added · coverage 81% → 89%." },
    { sev: "good", w: "all",   text: "No new npm dependencies introduced — matches plan constraints." },
  ];
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>4 · Mission · Reviewer report (user decides)</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="Reviewer · Cross-branch report" />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar active="mission:dark-mode" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--paper-2)" }}>
            <MissionStrip name="Dark mode mission" status="review" workers={4} hitl={0} />

            <div style={{ flex: 1, padding: 14, display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
              {/* Branch ribbon */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
                {WF_DATA.workers.map((w, i) => (
                  <div key={w.id} className="box-soft" style={{ padding: 10, display: "flex", flexDirection: "column", gap: 4, borderLeft: `4px solid ${w.color}` }}>
                    <strong style={{ fontSize: 12 }}>{w.id} · {w.name}</strong>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" }}>{w.branch}</div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 10 }}>+{[124, 68, 156, 42][i]} −{[18, 12, 33, 4][i]} · {[6, 3, 4, 5][i]} files</div>
                  </div>
                ))}
              </div>

              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 10, minHeight: 0 }}>
                {/* Issue list */}
                <div className="box" style={{ padding: 0, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
                  <div style={{ padding: "8px 12px", borderBottom: "1.5px solid var(--rule)", background: "var(--review-soft)", fontSize: 12, fontWeight: 600, color: "var(--review)" }}>
                    Reviewer notes · 4
                  </div>
                  <div style={{ flex: 1, overflow: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    {issues.map((it, idx) => (
                      <div key={idx} className="box-soft" style={{
                        padding: 8, display: "flex", gap: 8,
                        borderColor: it.sev === "warn" ? "var(--review)" : it.sev === "info" ? "var(--pm)" : "var(--approve)",
                        background: it.sev === "warn" ? "#fdf2e0" : it.sev === "info" ? "var(--pm-soft)" : "var(--approve-soft)"
                      }}>
                        <span style={{ fontSize: 14, lineHeight: 1 }}>
                          {it.sev === "warn" ? "⚠" : it.sev === "info" ? "ℹ" : "✓"}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 2 }}>{it.w}</div>
                          <div style={{ fontSize: 12 }}>{it.text}</div>
                        </div>
                        <button className="btn" style={{ fontSize: 10, padding: "2px 6px", alignSelf: "flex-start", border: "1px solid var(--rule-soft)", borderRadius: 3, background: "var(--paper)" }}>view</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Diff preview */}
                <div className="box" style={{ padding: 0, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
                  <div style={{ padding: "8px 12px", borderBottom: "1.5px solid var(--rule)", background: "var(--paper-2)", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>src/components/Header.jsx</span>
                    <span style={{ fontSize: 10, color: "var(--ink-3)" }}>touched by W1 + W3</span>
                  </div>
                  <div style={{ flex: 1, overflow: "auto", padding: 10, fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.55 }}>
                    <div style={{ color: "var(--ink-3)" }}>@@ -10,8 +10,20 @@</div>
                    <div>{" import React from 'react';"}</div>
                    <div style={{ background: "var(--approve-soft)", color: "var(--approve)" }}>+ import {"{ useTheme }"} from '../hooks/useTheme';   {"// W1"}</div>
                    <div style={{ background: "var(--approve-soft)", color: "var(--approve)" }}>+ import {"{ useHotkeys }"} from '../hooks/useHotkeys'; {"// W3"}</div>
                    <div>{" "}</div>
                    <div>{" function Header() {"}</div>
                    <div style={{ background: "var(--approve-soft)", color: "var(--approve)" }}>+   const [theme, toggleTheme] = useTheme();</div>
                    <div style={{ background: "var(--approve-soft)", color: "var(--approve)" }}>+   useHotkeys(shortcuts);</div>
                    <div>{"   return ("}</div>
                    <div>{"     <header>..."}</div>
                  </div>
                </div>
              </div>

              {/* Decision bar — USER decides, PM is downstream */}
              <div className="box" style={{ padding: "10px 14px", background: "var(--paper)", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: 0.4 }}>Your decision · PM is read-only on this</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <button className="btn" style={{ fontSize: 12, padding: "6px 14px", background: "var(--paper)", color: "var(--ink)", border: "1.5px solid var(--rule)", borderRadius: 4 }}>← Send back to workers</button>
                  <span style={{ fontFamily: "var(--hand)", fontSize: 14, color: "var(--ink-3)" }}>or</span>
                  <button className="btn" style={{ fontSize: 12, padding: "6px 14px", background: "var(--approve)", color: "var(--paper)", border: "1.5px solid var(--approve)", borderRadius: 4, fontWeight: 600 }}>✓ Archive to PM's dev log</button>
                  <span style={{ fontSize: 11, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 4 }}>then →</span>
                  <button className="btn" style={{ fontSize: 12, padding: "6px 14px", background: "var(--paper)", color: "var(--ink-2)", border: "1.5px solid var(--rule-soft)", borderRadius: 4 }}>Create PRs on GitHub</button>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-3)" }}>nothing leaves until you click</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <BottomBar extra="reviewer · 4 notes · awaiting your call" />
      </div>
    </div>
  );
}

Object.assign(window, { MissionStrip, Mission_Dashboard, Mission_Reviewer });
