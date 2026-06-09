// Phase 2 wireframes — designed AFTER Phase 1 dev side feedback.
// These do NOT replace Phase 1 components. They live as new artboards in a new canvas section
// so you can compare side-by-side.
//
// Scope (aligned with dev side priorities):
//   5 · Reviewer Panel · full     — replaces P1 stub conceptually
//   6 · PM · Dev log.md tab       — mode A (read + edit)
//   7 · PM · PRD.md tab           — mode B (structured sections + HITL diff)
//   8 · PM · SOP.md tab           — mode B (structured)
//   9 · Mission done state        — all workers green, ready to archive
//  10 · Mission archived          — post-archive: PM dev log red dot + sidebar grayed

// ─────────────────────────────────────────────────────────────────────────────
// Shared annotation taxonomy for Reviewer (the 4-type system)
const ANN = {
  bug: { icon: "🐛", label: "Bug", color: "var(--warn)", soft: "#f7d8d3", text: "var(--warn)" },
  note: { icon: "ℹ", label: "Note", color: "var(--pm)", soft: "var(--pm-soft)", text: "var(--pm)" },
  bloat: { icon: "🧹", label: "Bloat", color: "#8a6a3a", soft: "#efe1c4", text: "#7a5a2a" },
  missing: { icon: "❓", label: "Missing", color: "var(--review)", soft: "var(--review-soft)", text: "var(--review)" }
};

// Annotation pill (used in counts + filter chips)
function AnnPill({ kind, count, active }) {
  const a = ANN[kind];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: 99, fontSize: 11, fontWeight: 600,
      background: active ? a.color : a.soft,
      color: active ? "var(--paper)" : a.text,
      border: `1px solid ${a.color}`,
      cursor: "pointer"
    }}>
      <span style={{ fontSize: 11 }}>{a.icon}</span>
      <span>{a.label}</span>
      {count !== undefined &&
      <span style={{
        background: active ? "rgba(255,255,255,0.25)" : "var(--paper)",
        color: active ? "var(--paper)" : a.text,
        fontSize: 10, fontWeight: 700, padding: "0 5px", borderRadius: 8, minWidth: 14, textAlign: "center"
      }}>{count}</span>
      }
    </span>);

}

// Hand-drawn annotation callout used to label parts of a wireframe
function Note({ children, color = "var(--pm)", style }) {
  return (
    <div style={{
      fontFamily: "var(--hand)", fontSize: 14, color, lineHeight: 1.15,
      ...style
    }}>{children}</div>);

}

// ─────────────────────────────────────────────────────────────────────────────
// 5 · Reviewer Panel · FULL
// Adds: richer branch ribbon, annotation taxonomy (Bug/Note/Bloat/Missing),
// cross-branch diff with the conflict file picked, decision-bar state machine.
function Mission_Reviewer_Full() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>5 · Reviewer Panel · full</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="Reviewer · Cross-branch report" />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar active="mission:dark-mode" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--paper-2)" }}>
            <MissionStrip name="Dark mode mission" status="review" workers={4} hitl={0} />

            <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>

              {/* ── Branch ribbon ── 4 branches with stats + per-branch annotation count */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                {WF_DATA.workers.map((w, i) => {
                  const stats = [
                  { add: 124, del: 18, files: 6, anns: { bug: 0, note: 1, bloat: 1, missing: 0 } },
                  { add: 68, del: 12, files: 3, anns: { bug: 1, note: 0, bloat: 0, missing: 1 } },
                  { add: 156, del: 33, files: 4, anns: { bug: 0, note: 1, bloat: 0, missing: 0 } },
                  { add: 42, del: 4, files: 5, anns: { bug: 0, note: 0, bloat: 0, missing: 0 } }][
                  i];
                  const total = Object.values(stats.anns).reduce((s, n) => s + n, 0);
                  return (
                    <div key={w.id} className="box" style={{
                      padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6,
                      borderLeft: `4px solid ${w.color}`, background: "var(--paper)"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <strong style={{ fontSize: 12 }}>{w.id} · {w.name}</strong>
                        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--ink-3)" }}>{total} notes</span>
                      </div>
                      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-3)" }}>⎇ {w.branch}</div>
                      <div style={{ display: "flex", gap: 8, fontFamily: "var(--mono)", fontSize: 10 }}>
                        <span style={{ color: "var(--approve)" }}>+{stats.add}</span>
                        <span style={{ color: "var(--warn)" }}>−{stats.del}</span>
                        <span style={{ color: "var(--ink-3)" }}>· {stats.files} files</span>
                      </div>
                      {total > 0 &&
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                          {Object.entries(stats.anns).filter(([, n]) => n > 0).map(([k, n]) =>
                        <span key={k} style={{
                          fontSize: 9, padding: "1px 5px", borderRadius: 8,
                          background: ANN[k].soft, color: ANN[k].text,
                          border: `1px solid ${ANN[k].color}`, fontWeight: 600
                        }}>{ANN[k].icon} {n}</span>
                        )}
                        </div>
                      }
                    </div>);

                })}
              </div>

              {/* ── Filter strip ── shows the 4-type annotation system, click-to-filter */}
              <div className="box" style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "var(--paper)" }}>
                <span style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 0.6, textTransform: "uppercase", fontWeight: 700 }}>Filter</span>
                <AnnPill kind="bug" count={1} />
                <AnnPill kind="note" count={2} active />
                <AnnPill kind="bloat" count={1} />
                <AnnPill kind="missing" count={1} />
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-3)" }}>
                  showing <strong>2 notes</strong> · <span style={{ cursor: "pointer", textDecoration: "underline" }}>clear filter</span>
                </span>
              </div>

              {/* ── Annotations list (left) + Diff (right) ── */}
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "minmax(320px, 1fr) 1.5fr", gap: 10, minHeight: 0 }} data-comment-anchor="746f3b047f-div-129-15">

                {/* Annotations list */}
                <div className="box" style={{ padding: 0, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", background: "var(--paper)" }}>
                  <div style={{ padding: "8px 12px", borderBottom: "1.5px solid var(--rule)", background: "var(--paper-2)", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    <span>Annotations</span>
                    <span style={{ color: "var(--ink-3)", fontWeight: 400, fontSize: 11 }}>· 5 total · auto-classified</span>
                  </div>
                  <div className="wf-scroll" style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
                    <AnnRow kind="bug" w="W2" file="src/utils/exportJSON.ts" line="L34" selected
                    title="Crash on empty list" body="JSON.stringify({} as Todo[]) throws when state is uninit. Reviewer suggests guard clause." />
                    <AnnRow kind="note" w="W1+W3" file="src/components/Header.jsx" line="L10-22"
                    title="Both touched imports — trivial rebase" body="W1 added useTheme, W3 added useHotkeys. No semantic conflict, but git will need a merge commit." />
                    <AnnRow kind="bloat" w="W1" file="src/theme.ts" line="L88"
                    title="Unused export `darkPalette`" body="Referenced nowhere after refactor. Safe to remove." />
                    <AnnRow kind="missing" w="W2" file="src/utils/exportJSON.ts"
                    title="No test for archived: true case" body="Plan said `skip archived` — covered in code but no test asserts it. QA worker (W4) didn't pick this up." />
                    <AnnRow kind="note" w="all" file="—"
                    title="No new npm dependencies introduced" body="Matches plan constraints. ✓" />
                  </div>
                </div>

                {/* Diff preview */}
                <div className="box" style={{ padding: 0, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", background: "var(--paper)" }}>
                  {/* Branch tabs — review one worker at a time, then "Cross-branch" for the final pass */}
                  <div style={{ display: "flex", alignItems: "center", gap: 0, borderBottom: "1.5px solid var(--rule)", background: "var(--paper-2)", padding: "0 10px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 0.6, textTransform: "uppercase", fontWeight: 700, marginRight: 8 }}>Review by branch</span>
                    <BranchTab w={WF_DATA.workers[0]} count={2} />
                    <BranchTab w={WF_DATA.workers[1]} count={2} />
                    <BranchTab w={WF_DATA.workers[2]} count={1} />
                    <BranchTab w={WF_DATA.workers[3]} count={0} />
                    <span style={{ width: 1, height: 16, background: "var(--rule-soft)", margin: "0 6px" }} />
                    <BranchTab cross count={1} active />
                    <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--ink-3)", display: "flex", gap: 8 }}>
                      <span style={{ cursor: "pointer" }}>⇆ side-by-side</span>
                      <span style={{ cursor: "pointer", textDecoration: "underline" }}>unified</span>
                    </span>
                  </div>

                  <div style={{ padding: "6px 12px", borderBottom: "1px dashed var(--rule-soft)", background: "var(--paper-2)", fontSize: 11, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: 11 }}>src/components/Header.jsx</span>
                    <span style={{ fontSize: 10, color: "var(--ink-3)" }}>· cross-branch · touched by</span>
                    <span style={{ fontSize: 9, padding: "0 5px", borderRadius: 2, background: "var(--w1)", color: "#fff", fontWeight: 700 }}>W1</span>
                    <span style={{ fontSize: 9, padding: "0 5px", borderRadius: 2, background: "var(--w3)", color: "#fff", fontWeight: 700 }}>W3</span>
                    <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--hand)", fontSize: 12 }}>↑ tabs filter the diff — switch back to a single worker to focus</span>
                  </div>
                  <div className="wf-scroll" style={{ flex: 1, overflow: "auto", padding: "8px 12px", fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.6 }}>
                    <div style={{ color: "var(--ink-3)" }}>@@ -10,8 +10,20 @@</div>
                    <DiffLine>{" import React from 'react';"}</DiffLine>
                    <DiffLine add tag="W1">+ import {"{ useTheme }"} from '../hooks/useTheme';</DiffLine>
                    <DiffLine add tag="W3">+ import {"{ useHotkeys }"} from '../hooks/useHotkeys';</DiffLine>
                    <DiffLine>{" "}</DiffLine>
                    <DiffLine>{" function Header() {"}</DiffLine>
                    <DiffLine add tag="W1">+   const [theme, toggleTheme] = useTheme();</DiffLine>
                    <DiffLine add tag="W3">+   useHotkeys(shortcuts);</DiffLine>
                    <DiffLine>{"   return ("}</DiffLine>
                    <DiffLine>{"     <header className={\"header \" + theme}>"}</DiffLine>

                    {/* Inline annotation pinned to a line */}
                    <div style={{ margin: "6px 0 6px 24px", padding: "6px 8px", borderRadius: 4, background: ANN.note.soft, border: `1px solid ${ANN.note.color}`, fontFamily: "var(--sans)", fontSize: 11, color: ANN.note.text, display: "flex", alignItems: "flex-start", gap: 6 }}>
                      <span>ℹ</span>
                      <span><strong>Reviewer:</strong> both branches add imports in the same hunk — trivial rebase, no conflict.</span>
                      <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--ink-3)", whiteSpace: "nowrap", cursor: "pointer" }}>reply ⌃</span>
                    </div>

                    <DiffLine>{"       <ThemeToggle />"}</DiffLine>
                    <DiffLine>{"       <ShortcutHint />"}</DiffLine>
                    <DiffLine>{"     </header>"}</DiffLine>
                  </div>
                </div>
              </div>

              {/* ── Decision bar — state machine: initial → archiving → archived ── */}
              <div className="box" style={{ padding: 0, background: "var(--paper)", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "8px 14px", borderBottom: "1px dashed var(--rule-soft)", fontSize: 10, color: "var(--ink-3)", letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  Per-branch review
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, textTransform: "none", letterSpacing: 0 }}>
                    {WF_DATA.workers.map((w, i) => {
                      const reviewed = [true, true, false, true][i];
                      return (
                        <span key={w.id} style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          padding: "2px 7px", borderRadius: 99,
                          background: reviewed ? "var(--approve-soft)" : "var(--paper-2)",
                          border: `1px solid ${reviewed ? "var(--approve)" : "var(--rule-soft)"}`,
                          color: reviewed ? "var(--approve)" : "var(--ink-3)",
                          fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)"
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: 99, background: w.color }} />
                          {w.id} {reviewed ? "✓" : "…"}
                        </span>
                      );
                    })}
                    <span style={{ color: "var(--ink-3)" }}>→</span>
                    <span style={{
                      padding: "2px 7px", borderRadius: 99,
                      background: "var(--review-soft)", border: "1px solid var(--review)",
                      color: "var(--review)", fontSize: 10, fontWeight: 700, fontFamily: "var(--mono)"
                    }}>final ▶</span>
                  </span>
                  <span style={{ background: "var(--paper-2)", border: "1px solid var(--rule-soft)", borderRadius: 99, padding: "1px 8px", letterSpacing: 0.5 }}>state · awaiting W3 review</span>
                  <span style={{ marginLeft: "auto", textTransform: "none", letterSpacing: 0, fontFamily: "var(--hand)", fontSize: 12 }}>review each branch first, then the cross-branch pass — final archive only after all clear</span>
                </div>
                <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <button className="btn" style={{ fontSize: 12, padding: "7px 14px", background: "var(--paper)", color: "var(--ink)", border: "1.5px solid var(--rule)", borderRadius: 4 }}>
                    ← Send back to workers
                    <span style={{ marginLeft: 6, fontSize: 10, color: "var(--ink-3)" }}>(iterate)</span>
                  </button>
                  <span style={{ fontFamily: "var(--hand)", fontSize: 14, color: "var(--ink-3)" }}>or</span>
                  <button className="btn" style={{ fontSize: 12, padding: "7px 14px", background: "var(--approve)", color: "var(--paper)", border: "1.5px solid var(--approve)", borderRadius: 4, fontWeight: 700 }}>
                    ✓ Archive to PM's dev log
                  </button>
                  <span style={{ fontSize: 11, color: "var(--ink-3)" }}>then →</span>
                  <button className="btn" style={{ fontSize: 12, padding: "7px 14px", background: "var(--paper)", color: "var(--ink-2)", border: "1.5px solid var(--rule-soft)", borderRadius: 4 }}>
                    Create PRs on GitHub
                    <span style={{ marginLeft: 6, fontSize: 10, color: "var(--ink-3)" }}>(4 branches)</span>
                  </button>
                  <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, color: "var(--ink-3)" }}>
                    next state: <span className="mono" style={{ background: "var(--paper-2)", border: "1px solid var(--rule-soft)", borderRadius: 3, padding: "0 5px" }}>archiving…</span> → <span className="mono" style={{ background: "var(--paper-2)", border: "1px solid var(--rule-soft)", borderRadius: 3, padding: "0 5px" }}>archived</span>
                  </span>
                </div>
              </div>

            </div>
          </div>
        </div>
        <BottomBar extra="reviewer · 5 annotations · awaiting decision" />
      </div>
    </div>);

}
// Branch tab — used in Reviewer's diff panel to filter the diff per-worker, with
// a "Cross-branch" tab at the end for the final pass.
function BranchTab({ w, cross, count, active }) {
  const label = cross ? "Cross-branch" : `${w.id} · ${w.name}`;
  const color = cross ? "var(--ink)" : w.color;
  return (
    <span style={{
      padding: "8px 10px",
      borderBottom: active ? `2px solid ${color}` : "2px solid transparent",
      marginBottom: -1.5, cursor: "pointer",
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: active ? 700 : 500,
      color: active ? "var(--ink)" : "var(--ink-3)"
    }}>
      {cross ?
        <span style={{ width: 8, height: 8, background: "var(--ink)", clipPath: "polygon(0 0, 50% 50%, 0 100%, 100% 100%, 50% 50%, 100% 0)" }} /> :
        <span style={{ width: 7, height: 7, borderRadius: 99, background: color }} />
      }
      <span>{label}</span>
      {count !== undefined && count > 0 &&
        <span style={{ fontSize: 9, padding: "0 5px", borderRadius: 99, background: active ? color : "var(--paper-2)", color: active ? "var(--paper)" : "var(--ink-3)", fontWeight: 700, fontFamily: "var(--mono)" }}>{count}</span>
      }
      {count === 0 && <span style={{ fontSize: 9, color: "var(--approve)", fontFamily: "var(--mono)" }}>✓ clean</span>}
    </span>);
}

// Single annotation row (used in Reviewer Panel left column)
function AnnRow({ kind, w, file, line, title, body, selected }) {
  const a = ANN[kind];
  return (
    <div style={{
      padding: "10px 12px",
      borderBottom: "1px solid var(--rule-soft)",
      background: selected ? "var(--paper-2)" : "transparent",
      borderLeft: selected ? `3px solid ${a.color}` : "3px solid transparent",
      display: "flex", flexDirection: "column", gap: 4, cursor: "pointer"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          fontSize: 9, padding: "2px 6px", borderRadius: 99, fontWeight: 700, letterSpacing: 0.4,
          background: a.soft, color: a.text, border: `1px solid ${a.color}`, textTransform: "uppercase"
        }}>{a.icon} {a.label}</span>
        <span style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>{w}</span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>
          {file}{line ? ` · ${line}` : ""}
        </span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 11, color: "var(--ink-2)", lineHeight: 1.45 }}>{body}</div>
    </div>);

}

// Diff line helper (Reviewer Panel)
function DiffLine({ children, add, del, tag }) {
  return (
    <div style={{
      background: add ? "var(--approve-soft)" : del ? "#f7d8d3" : "transparent",
      color: add ? "var(--approve)" : del ? "var(--warn)" : "var(--ink-2)",
      display: "flex", alignItems: "center", gap: 6, paddingRight: 6, borderRadius: 2
    }}>
      <span style={{ flex: 1 }}>{children}</span>
      {tag &&
      <span style={{
        fontSize: 9, padding: "0 5px", borderRadius: 2, fontWeight: 700,
        background: tag === "W1" ? "var(--w1)" : tag === "W3" ? "var(--w3)" : tag === "W2" ? "var(--w2)" : "var(--w4)",
        color: "#fff"
      }}>{tag}</span>
      }
    </div>);

}

// ─────────────────────────────────────────────────────────────────────────────
// 6 · PM · Dev log.md tab (mode A: read + edit)
function PM_DevLog() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>6 · PM · Dev log.md (read+edit)</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="PM · Dev log.md" />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar active="mission:dark-mode" />
          <PMShell activeTab="devlog">
            <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 0, padding: 0 }}>

              {/* Left rail · entry list */}
              <div style={{ flex: "0 0 220px", borderRight: "1.5px solid var(--rule)", display: "flex", flexDirection: "column", background: "var(--paper-2)" }}>
                <div style={{ padding: "10px 12px 6px", fontSize: 10, color: "var(--ink-3)", letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>
                  Entries · 12
                </div>
                <div className="wf-scroll" style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
                  <DevLogItem date="2026-05-19 · 14:48" title="Dark mode + JSON + hotkeys" badge="NEW" selected />
                  <DevLogItem date="2026-05-17 · 16:02" title="Migrate to Vite" />
                  <DevLogItem date="2026-05-14 · 09:30" title="Add CI on PR + lint gate" />
                  <DevLogItem date="2026-05-12 · 11:14" title="Refactor todos store to Zustand" />
                  <DevLogItem date="2026-05-09 · 17:51" title="Initial scaffold + auth" />
                </div>
              </div>

              {/* Doc body */}
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                {/* Doc head */}
                <div style={{ padding: "10px 18px", borderBottom: "1.5px solid var(--rule)", background: "var(--paper-2)", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)" }}>Dev log.md</span>
                  <span style={{ fontSize: 11, color: "var(--ink-3)" }}>· /Dev log.md</span>
                  <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <span style={{
                      fontSize: 10, padding: "2px 6px", borderRadius: 3,
                      background: "var(--approve-soft)", color: "var(--approve)", border: "1px solid var(--approve)", fontWeight: 600
                    }}>● reading</span>
                    <button className="btn" style={{ fontSize: 11, padding: "3px 10px", borderRadius: 3, border: "1.5px solid var(--rule)", background: "var(--paper)" }}>✎ Edit raw markdown</button>
                  </span>
                </div>

                {/* Scrollable doc */}
                <div className="wf-scroll" style={{ flex: 1, overflow: "auto", padding: "18px 24px" }}>
                  <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>

                    {/* New entry — highlighted */}
                    <div style={{ padding: "14px 18px", border: "1.5px solid var(--review)", borderRadius: 5, background: "#fff8ec", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.6, padding: "2px 6px", borderRadius: 99, background: "var(--review)", color: "var(--paper)" }}>NEW</span>
                        <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>2026-05-19 · 14:48 · archived by you</span>
                      </div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Dark mode + JSON export + keyboard shortcuts</h3>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <span className="branch-chip">feat/dark-mode</span>
                        <span className="branch-chip">feat/json-export</span>
                        <span className="branch-chip">feat/keyboard-shortcuts</span>
                        <span className="branch-chip">feat/tests</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6 }}>
                        Mission completed in 4 branches. Reviewer surfaced <strong>5 annotations</strong>; user resolved all
                        before archiving. Notable: W2 fixed empty-list crash inline before archive; W4 picked up the missing
                        archived-case test on resend.
                      </p>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", fontSize: 11 }}>
                        <span style={{ color: "var(--ink-3)" }}>Annotations resolved →</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: ANN.bug.text }}>🐛 1</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: ANN.note.text }}>ℹ 2</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: ANN.bloat.text }}>🧹 1</span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: ANN.missing.text }}>❓ 1</span>
                      </div>
                      <div style={{ padding: "8px 10px", borderTop: "1px dashed var(--rule-soft)", marginTop: 2, fontSize: 11, color: "var(--ink-2)" }}>
                        <strong>Decisions captured:</strong>
                        <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
                          <li>CSS variables chosen over styled-components for theming</li>
                          <li>Archived todos excluded from JSON export by default</li>
                          <li>cmd+/ chosen as shortcut cheatsheet trigger</li>
                        </ul>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                        <button className="btn" style={{ fontSize: 10, padding: "3px 8px", borderRadius: 3, border: "1px solid var(--rule-soft)", background: "var(--paper)" }}>View full report ↗</button>
                        <button className="btn" style={{ fontSize: 10, padding: "3px 8px", borderRadius: 3, border: "1px solid var(--rule-soft)", background: "var(--paper)" }}>Open as mission ↗</button>
                        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--ink-3)" }}>↳ updated PRD.md §Features (+3 lines)</span>
                      </div>
                    </div>

                    {/* Older entries — plain markdown style */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <h4 style={{ fontSize: 13, margin: 0, color: "var(--ink-2)" }}>2026-05-17 · Migrate to Vite</h4>
                      <p style={{ fontSize: 12, color: "var(--ink-2)", margin: 0, lineHeight: 1.55 }}>
                        CRA → Vite. Build time 14s → 1.2s. <em>Decision: keep CRA env vars working via define.</em>
                      </p>
                      <div style={{ display: "flex", gap: 6 }}><span className="branch-chip">chore/vite</span></div>
                    </div>

                    <hr style={{ border: 0, borderTop: "1px dashed var(--rule-soft)", margin: 0 }} />

                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <h4 style={{ fontSize: 13, margin: 0, color: "var(--ink-2)" }}>2026-05-14 · CI on PR + lint gate</h4>
                      <p style={{ fontSize: 12, color: "var(--ink-2)", margin: 0, lineHeight: 1.55 }}>
                        GitHub Actions: lint + typecheck + test must pass before merge. Reviewer caught one
                        worker pushing without pre-commit; rule added to SOP.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right hand-drawn annotations explaining what this tab is */}
              <div style={{
                flex: "0 0 180px", borderLeft: "1px dashed var(--rule-soft)",
                padding: "16px 12px", display: "flex", flexDirection: "column", gap: 18,
                background: "var(--paper-2)"
              }}>
                <Note color="var(--review)">
                  ↖ "NEW" entry = the<br />reviewer report you<br />just archived
                </Note>
                <Note>
                  ↖ entry is auto-<br />composed from reviewer<br />notes + your decisions
                </Note>
                <Note color="var(--ink-3)">
                  ↑ older entries =<br />plain markdown<br />(mode A)
                </Note>
                <Note color="var(--approve)">
                  ↑ click "Edit raw"<br />to drop into a<br />code-mirror style<br />editor (HITL still)
                </Note>
              </div>
            </div>
          </PMShell>
        </div>
        <BottomBar extra="dev log · 12 entries · 1 new" />
      </div>
    </div>);

}

function DevLogItem({ date, title, badge, selected }) {
  return (
    <div style={{
      padding: "8px 12px",
      borderBottom: "1px solid var(--rule-soft)",
      background: selected ? "var(--paper)" : "transparent",
      borderLeft: selected ? "3px solid var(--pm)" : "3px solid transparent",
      display: "flex", flexDirection: "column", gap: 2, cursor: "pointer"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--ink-3)" }}>{date}</span>
        {badge && <span style={{
          marginLeft: "auto", fontSize: 8, padding: "1px 5px", borderRadius: 99,
          background: "var(--review)", color: "var(--paper)", fontWeight: 700, letterSpacing: 0.4
        }}>{badge}</span>}
      </div>
      <div style={{ fontSize: 12, fontWeight: selected ? 600 : 500 }}>{title}</div>
    </div>);

}

// ─────────────────────────────────────────────────────────────────────────────
// 7 · PM · PRD.md tab (mode B: structured sections + HITL diff)
function PM_PRD() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>7 · PM · PRD.md (structured + HITL)</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="PM · PRD.md" />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar active="mission:dark-mode" />
          <PMShell activeTab="prd">
            <div style={{ flex: 1, minHeight: 0, display: "flex" }}>

              {/* Section nav */}
              <div style={{ flex: "0 0 180px", borderRight: "1.5px solid var(--rule)", background: "var(--paper-2)", padding: "12px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Sections</div>
                <PRDNav label="§ Overview" />
                <PRDNav label="§ Goals" />
                <PRDNav label="§ Personas" />
                <PRDNav label="§ Features" active pending={2} />
                <PRDNav label="§ Non-goals" pending={1} />
                <PRDNav label="§ Constraints" />
                <PRDNav label="§ Open questions" />
                <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                  <button className="btn" style={{ fontSize: 11, padding: "5px 8px", borderRadius: 3, border: "1.5px dashed var(--rule-soft)", background: "var(--paper)", color: "var(--ink-3)" }}>＋ Add section</button>
                  <button className="btn" style={{ fontSize: 10, padding: "4px 8px", borderRadius: 3, border: "1px solid var(--rule-soft)", background: "var(--paper)", color: "var(--ink-3)" }}>↗ View raw markdown</button>
                </div>
              </div>

              {/* Doc */}
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>

                {/* PM proposed change banner */}
                <div style={{ padding: "8px 18px", background: "var(--pm-soft)", borderBottom: "1.5px solid var(--pm)", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "var(--pm)", fontWeight: 700 }}>⚠ PM proposed 3 edits to this PRD</span>
                  <span style={{ fontSize: 11, color: "var(--ink-2)" }}>after archiving the dark-mode mission. Each section change shows a diff — approve / reject per section.</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-3)" }}>HITL · your call</span>
                </div>

                {/* Sections */}
                <div className="wf-scroll" style={{ flex: 1, overflow: "auto", padding: "16px 22px" }}>
                  <div style={{ maxWidth: 660, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }} data-comment-anchor="917faec92b-div-472-19">

                    {/* Section: Overview (unchanged) */}
                    <PRDSection title="Overview" subtitle="What this product is, in one paragraph.">
                      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--ink-2)" }}>
                        A local-first React TODO app. Lives in <span className="mono" style={{ fontSize: 11 }}>~/todo-app</span>.
                        Single user (you). Focus: keyboard-first, dark mode, exportable.
                      </p>
                    </PRDSection>

                    {/* Section: Features — has pending PM edits */}
                    <PRDSection
                      title="Features"
                      subtitle="What the product does. Updated as missions are archived."
                      pending={2}>
                      
                      {/* existing bullet — unchanged */}
                      <PRDBullet>Add / edit / archive todos with optimistic save.</PRDBullet>
                      <PRDBullet>Filter by tag (local persistence).</PRDBullet>

                      {/* PM addition — pending */}
                      <PRDDiff add>
                        <strong>Dark mode</strong> via CSS variables. Toggle in Header.
                        Persisted per-device.
                      </PRDDiff>
                      <PRDDiff add>
                        <strong>JSON export</strong> from Header menu. Excludes archived
                        by default; "include archived" toggle available.
                      </PRDDiff>

                      {/* Unchanged bullet */}
                      <PRDBullet>Hotkey: <span className="mono" style={{ fontSize: 11 }}>cmd+n</span> new, <span className="mono" style={{ fontSize: 11 }}>cmd+f</span> filter.</PRDBullet>

                      <div style={{ marginTop: 8, padding: "6px 8px", display: "flex", alignItems: "center", gap: 8, background: "var(--paper-2)", borderRadius: 3, border: "1px dashed var(--rule-soft)" }}>
                        <span style={{ fontSize: 11, color: "var(--ink-3)" }}>2 PM additions in this section</span>
                        <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                          <button className="btn" style={{ fontSize: 10, padding: "3px 8px", borderRadius: 3, background: "var(--paper)", border: "1px solid var(--rule)", color: "var(--ink-2)" }}>Reject section</button>
                          <button className="btn" style={{ fontSize: 10, padding: "3px 8px", borderRadius: 3, background: "var(--approve)", border: "1px solid var(--approve)", color: "var(--paper)", fontWeight: 600 }}>✓ Approve section</button>
                        </span>
                      </div>
                    </PRDSection>

                    {/* Section: Non-goals — pending */}
                    <PRDSection
                      title="Non-goals"
                      subtitle="Things we deliberately don't do."
                      pending={1}>
                      
                      <PRDBullet>No multi-user / sync. Local only.</PRDBullet>
                      <PRDBullet>No drag-reorder. Tags are enough.</PRDBullet>
                      <PRDDiff add>
                        <strong>No native installer.</strong> Web app only — per decision in
                        dev log 2026-05-19.
                      </PRDDiff>
                      <div style={{ marginTop: 8, padding: "6px 8px", display: "flex", alignItems: "center", gap: 8, background: "var(--paper-2)", borderRadius: 3, border: "1px dashed var(--rule-soft)" }}>
                        <span style={{ fontSize: 11, color: "var(--ink-3)" }}>1 PM addition · derived from dev log</span>
                        <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                          <button className="btn" style={{ fontSize: 10, padding: "3px 8px", borderRadius: 3, background: "var(--paper)", border: "1px solid var(--rule)", color: "var(--ink-2)" }}>Reject</button>
                          <button className="btn" style={{ fontSize: 10, padding: "3px 8px", borderRadius: 3, background: "var(--approve)", border: "1px solid var(--approve)", color: "var(--paper)", fontWeight: 600 }}>✓ Approve</button>
                        </span>
                      </div>
                    </PRDSection>

                  </div>
                </div>

                {/* Bottom: aggregate approve */}
                <div style={{ padding: "10px 18px", borderTop: "1.5px solid var(--rule)", background: "var(--paper-2)", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "var(--ink-3)" }}>3 pending edits across 2 sections</span>
                  <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <button className="btn" style={{ fontSize: 11, padding: "5px 12px", borderRadius: 4, border: "1.5px solid var(--rule)", background: "var(--paper)" }}>Reject all</button>
                    <button className="btn" style={{ fontSize: 11, padding: "5px 12px", borderRadius: 4, border: "1.5px solid var(--approve)", background: "var(--approve)", color: "var(--paper)", fontWeight: 700 }}>✓ Approve all PM edits</button>
                  </span>
                </div>
              </div>

              {/* Right annotations */}
              <div style={{
                flex: "0 0 170px", borderLeft: "1px dashed var(--rule-soft)",
                padding: "16px 10px", display: "flex", flexDirection: "column", gap: 16,
                background: "var(--paper-2)"
              }}>
                <Note color="var(--pm)">
                  ↖ banner says PM<br />wants to change<br />the doc. nothing<br />persists until you<br />approve.
                </Note>
                <Note color="var(--pm)">
                  ↑ left rail = structured<br />sections (mode B).<br />click "Add section"<br />to extend.
                </Note>
                <Note color="var(--approve)">
                  ↑ green inline diff =<br />PM's proposed<br />addition. red strike<br />= PM proposes<br />removal (not<br />shown here).
                </Note>
                <Note>
                  ↑ approve per-section<br />or all at once at<br />the bottom.
                </Note>
              </div>
            </div>
          </PMShell>
        </div>
        <BottomBar extra="PRD.md · 3 pending edits" />
      </div>
    </div>);

}

function PRDNav({ label, active, pending }) {
  return (
    <div style={{
      padding: "5px 8px", borderRadius: 3, fontSize: 12, cursor: "pointer",
      background: active ? "var(--pm)" : "transparent",
      color: active ? "var(--paper)" : "var(--ink-2)",
      display: "flex", alignItems: "center", gap: 6,
      fontWeight: active ? 600 : 500
    }}>
      <span style={{ flex: 1 }}>{label}</span>
      {pending &&
      <span style={{
        minWidth: 16, padding: "0 5px", borderRadius: 99, fontSize: 9, fontWeight: 700,
        background: active ? "var(--paper)" : "var(--review)",
        color: active ? "var(--review)" : "var(--paper)",
        textAlign: "center"
      }}>{pending}</span>
      }
    </div>);

}

function PRDSection({ title, subtitle, pending, children }) {
  return (
    <section style={{
      border: pending ? "1.5px solid var(--review)" : "1.5px solid var(--rule)",
      borderRadius: 5,
      background: "var(--paper)",
      padding: "12px 16px",
      display: "flex", flexDirection: "column", gap: 8,
      position: "relative"
    }}>
      {pending &&
      <span style={{
        position: "absolute", top: -9, right: 12,
        background: "var(--review)", color: "var(--paper)",
        fontSize: 9, fontWeight: 700, letterSpacing: 0.4,
        padding: "2px 7px", borderRadius: 99
      }}>{pending} pending</span>
      }
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>§ {title}</h3>
        <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{subtitle}</span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--ink-3)", cursor: "pointer" }}>✎ edit</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {children}
      </div>
    </section>);

}

function PRDBullet({ children }) {
  return (
    <div style={{ display: "flex", gap: 6, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.5 }}>
      <span style={{ color: "var(--ink-3)" }}>•</span>
      <span style={{ flex: 1 }}>{children}</span>
    </div>);

}

function PRDDiff({ add, del, children }) {
  return (
    <div style={{
      display: "flex", gap: 6,
      background: add ? "var(--approve-soft)" : "#f7d8d3",
      color: add ? "var(--approve)" : "var(--warn)",
      padding: "4px 8px", borderRadius: 3, fontSize: 12.5, lineHeight: 1.5,
      border: `1px solid ${add ? "var(--approve)" : "var(--warn)"}`
    }}>
      <span style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>{add ? "+" : "−"}</span>
      <span style={{ flex: 1, color: "var(--ink)" }}>{children}</span>
      <span style={{ fontSize: 9, color: "var(--ink-3)", fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>PM</span>
    </div>);

}

// ─────────────────────────────────────────────────────────────────────────────
// 8 · PM · SOP.md tab (mode B: structured)
function PM_SOP() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>8 · PM · SOP.md (structured)</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="PM · SOP.md" />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar active="mission:dark-mode" />
          <PMShell activeTab="sop">
            <div style={{ flex: 1, minHeight: 0, display: "flex" }}>

              {/* Section nav */}
              <div style={{ flex: "0 0 180px", borderRight: "1.5px solid var(--rule)", background: "var(--paper-2)", padding: "12px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Categories</div>
                <PRDNav label="§ Naming" />
                <PRDNav label="§ Branching" active />
                <PRDNav label="§ Testing" />
                <PRDNav label="§ Commits" />
                <PRDNav label="§ Code style" />
                <PRDNav label="§ Review checklist" />
                <div style={{ marginTop: "auto" }}>
                  <button className="btn" style={{ fontSize: 11, padding: "5px 8px", borderRadius: 3, border: "1.5px dashed var(--rule-soft)", background: "var(--paper)", color: "var(--ink-3)", width: "100%" }}>＋ Add category</button>
                </div>
              </div>

              {/* Doc */}
              <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>

                {/* Header strip */}
                <div style={{ padding: "8px 18px", background: "var(--paper-2)", borderBottom: "1.5px solid var(--rule)", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-3)" }}>SOP.md · § Branching</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-3)" }}>last touched 2026-05-14 · 3 missions ago</span>
                </div>

                <div className="wf-scroll" style={{ flex: 1, overflow: "auto", padding: "16px 22px" }}>
                  <div style={{ maxWidth: 660, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>

                    <PRDSection title="Branching" subtitle="One worker = one branch. Never reuse.">
                      <PRDBullet>Each <span className="mono" style={{ fontSize: 11 }}>worker</span> creates exactly one branch from <span className="mono" style={{ fontSize: 11 }}>main</span>.</PRDBullet>
                      <PRDBullet>Naming: <span className="mono" style={{ fontSize: 11 }}>feat/&lt;mission-slug&gt;-&lt;short-scope&gt;</span></PRDBullet>
                      <PRDBullet>Workers never push to <span className="mono" style={{ fontSize: 11 }}>main</span>. Reviewer + your decision is required to create PRs.</PRDBullet>
                      <PRDBullet>PM never creates branches. PM only writes plan + maintains docs.</PRDBullet>
                    </PRDSection>

                    <PRDSection title="Commits" subtitle="Each tool-call cluster = one commit.">
                      <PRDBullet>Conventional commits: <span className="mono" style={{ fontSize: 11 }}>feat: / fix: / chore: / docs: / test:</span></PRDBullet>
                      <PRDBullet>Body line 1 ≤ 72 chars. Imperative ("add", not "added").</PRDBullet>
                      <PRDBullet>Worker commits show <span className="mono" style={{ fontSize: 11 }}>[W&lt;n&gt;]</span> tag for cross-branch traceability.</PRDBullet>
                    </PRDSection>

                    <PRDSection title="Testing" subtitle="TDD when feasible. Test before HITL approves write.">
                      <PRDBullet>Coverage minimum: <strong>80%</strong> on the touched files.</PRDBullet>
                      <PRDBullet>Tests live next to source: <span className="mono" style={{ fontSize: 11 }}>foo.ts</span> ↔ <span className="mono" style={{ fontSize: 11 }}>foo.test.ts</span></PRDBullet>
                      <PRDBullet>Reviewer will flag <strong>Missing</strong> for any new public function without a test.</PRDBullet>
                    </PRDSection>

                  </div>
                </div>
              </div>

              {/* Right annotations */}
              <div style={{
                flex: "0 0 170px", borderLeft: "1px dashed var(--rule-soft)",
                padding: "16px 10px", display: "flex", flexDirection: "column", gap: 16,
                background: "var(--paper-2)"
              }}>
                <Note color="var(--pm)">
                  ↖ same shape as<br />PRD: sections,<br />but here PM has<br />no pending edits<br />— stable doc
                </Note>
                <Note color="var(--ink-3)">
                  ↑ SOP changes are<br />rare. usually only<br />after a Reviewer<br />flags a pattern.
                </Note>
                <Note>
                  ↑ each bullet =<br />a rule reviewer<br />can cite when<br />annotating
                </Note>
              </div>
            </div>
          </PMShell>
        </div>
        <BottomBar extra="SOP.md · stable · last touched 2026-05-14" />
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────────────────────
// 9 · Mission done state — all 4 workers green, ready to archive
function Mission_Done() {
  // mutate a local copy of workers so we don't change WF_DATA
  const done = WF_DATA.workers.map((w) => ({ ...w, status: "done", pending: 0 }));
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>9 · Mission · done (pre-archive)</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="Mission · all workers done" pending={0} />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar active="mission:dark-mode" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--paper-2)" }}>
            <MissionStrip name="Dark mode mission" status="review" workers={4} hitl={0} />

            <div style={{ flex: 1, padding: 14, display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>

              {/* Banner */}
              <div className="box" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, background: "var(--approve-soft)", borderColor: "var(--approve)" }}>
                <span style={{ fontSize: 20 }}>✓</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--approve)" }}>All 4 workers finished · mission ready to archive</div>
                  <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 2 }}>
                    11 commits across 4 branches · 0 HITL pending · last activity 14:46
                  </div>
                </div>
                <button className="btn" style={{ fontSize: 11, padding: "5px 12px", border: "1.5px solid var(--rule)", background: "var(--paper)", borderRadius: 4 }}>Call Reviewer again</button>
                <button className="btn" style={{ fontSize: 12, padding: "7px 14px", border: "1.5px solid var(--approve)", background: "var(--approve)", color: "var(--paper)", borderRadius: 4, fontWeight: 700 }}>
                  ✓ Archive to PM dev log
                </button>
              </div>

              {/* Worker grid — done state */}
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", gap: 10, minHeight: 0 }}>
                {done.map((w, i) =>
                <DoneTile key={w.id} w={w} stats={[
                { commits: 4, files: 6, last: "✓ tests pass · coverage 87%" },
                { commits: 2, files: 3, last: "✓ JSON round-trip verified" },
                { commits: 5, files: 4, last: "✓ cmd+/ cheatsheet shipped" },
                { commits: 0, files: 5, last: "✓ 14 tests added · CI green" }][
                i]} />
                )}
              </div>

            </div>
          </div>
        </div>
        <BottomBar extra="mission · all done · 0 HITL pending" />
      </div>
    </div>);

}

function DoneTile({ w, stats }) {
  return (
    <div className="worker-tile" style={{ opacity: 1 }}>
      <div className="wt-head" style={{ background: "var(--approve-soft)" }}>
        <span className="swatch" style={{ background: w.color }} />
        <span className="wt-name">{w.id} · {w.name}</span>
        <span className="wt-branch">{w.branch}</span>
        <span className="wt-status" style={{ background: "var(--approve)", color: "var(--paper)", border: "1px solid var(--approve)" }}>✓ done</span>
      </div>
      <div className="wt-body" style={{ gap: 8 }}>
        <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--ink-2)" }}>
          <span><strong>{stats.commits}</strong> commits</span>
          <span><strong>{stats.files}</strong> files</span>
        </div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--approve)" }}>
          {stats.last}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: "auto", display: "flex", gap: 6 }}>
          <span style={{ cursor: "pointer", textDecoration: "underline" }}>view branch diff</span>
          <span>·</span>
          <span style={{ cursor: "pointer", textDecoration: "underline" }}>view chat history</span>
        </div>
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────────────────────
// 10 · Mission archived — post-archive state. Mission grayed in sidebar, PM dev log
// has a red dot, success toast still visible. PM panel is what the user lands on.
function Mission_Archived() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>10 · Archive flow · post-archive</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="PM · Project Orchestrator" pending={0} />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

          {/* Sidebar with archived state visually overridden */}
          <ArchivedSidebar />

          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--paper-2)", position: "relative" }}>

            {/* Success toast — top right */}
            <div style={{
              position: "absolute", top: 12, right: 12, zIndex: 5,
              background: "var(--approve)", color: "var(--paper)",
              padding: "10px 14px", borderRadius: 5, border: "1.5px solid var(--approve)",
              boxShadow: "0 6px 14px rgba(74,124,74,0.25)",
              display: "flex", alignItems: "center", gap: 10, maxWidth: 340
            }}>
              <span style={{ fontSize: 18 }}>✓</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Archived to PM's dev log</div>
                <div style={{ fontSize: 10, opacity: 0.9, marginTop: 2 }}>
                  Dark mode mission · 5 annotations resolved · PM will propose PRD updates
                </div>
              </div>
              <span style={{ fontSize: 10, opacity: 0.7, cursor: "pointer" }}>dismiss ×</span>
            </div>

            <PMShell activeTab="chat" runningMission={null}>
              <div className="wf-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "14px 18px" }}>
                <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>

                  {/* PM speaks first after archive */}
                  <div className="box" style={{ padding: "12px 14px", background: "var(--paper)", maxWidth: 580, borderColor: "var(--pm)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--pm)", marginBottom: 6 }}>PM</div>
                    <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                      Got the report. I've written entry <em>"Dark mode + JSON + hotkeys"</em> to
                      <span className="mono" style={{ fontSize: 11 }}> Dev log.md</span> and queued
                      <strong> 3 PRD edits</strong> for your review. Open the
                      <span className="mono" style={{ fontSize: 11 }}> PRD.md </span>tab when ready.
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                      <button className="btn" style={{ fontSize: 11, padding: "5px 10px", borderRadius: 3, background: "var(--pm)", color: "var(--paper)", border: "1.5px solid var(--pm)", fontWeight: 600 }}>Open Dev log →</button>
                      <button className="btn" style={{ fontSize: 11, padding: "5px 10px", borderRadius: 3, background: "var(--paper)", color: "var(--pm)", border: "1.5px solid var(--pm)" }}>Review PRD edits (3) →</button>
                      <span style={{ fontSize: 10, color: "var(--ink-3)", alignSelf: "center" }}>SOP unchanged</span>
                    </div>
                  </div>

                  {/* Hand-drawn notes */}
                  <Note color="var(--review)" style={{ marginLeft: 60, marginTop: 6 }}>
                    ↑ PM moves first — it's<br />the only time PM "wakes<br />up" on its own (when an<br />archive arrives).
                  </Note>

                  <div className="box" style={{ padding: "10px 14px", background: "var(--paper-2)", alignSelf: "flex-end", maxWidth: 500 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)", marginBottom: 4 }}>You</div>
                    <div style={{ fontSize: 13, lineHeight: 1.55 }}>OK, let me check PRD first.</div>
                  </div>

                </div>
              </div>

              <div style={{ padding: "10px 18px 14px", borderTop: "1.5px solid var(--rule)", background: "var(--paper-2)" }}>
                <div style={{ maxWidth: 720, margin: "0 auto" }}>
                  <div className="composer" style={{ padding: "10px 12px" }}>
                    <span>Reply to PM…</span>
                    <span className="send">↵</span>
                  </div>
                </div>
              </div>
            </PMShell>
          </div>

          {/* Right annotations */}
          <div style={{
            flex: "0 0 180px", borderLeft: "1px dashed var(--rule-soft)",
            padding: "16px 12px", display: "flex", flexDirection: "column", gap: 18,
            background: "var(--paper-2)"
          }}>
            <Note color="var(--approve)">
              ↖ toast confirms<br />the archive landed.<br />auto-dismiss 5s.
            </Note>
            <Note color="var(--review)">
              ← sidebar: mission<br />now grayed under<br />"Archived" subhead<br />· red dot moved to<br />PM tab "Dev log.md"
            </Note>
            <Note color="var(--pm)">
              ↑ PM speaks first<br />only after an archive.<br />otherwise PM waits<br />for you.
            </Note>
            <Note color="var(--ink-3)">
              dev side: this whole<br />transition is one<br />state change in<br />the mission machine.
            </Note>
          </div>
        </div>
        <BottomBar extra="mission archived · PM has 3 pending edits" />
      </div>
    </div>);

}

// Sidebar variant — shows the "Archived" sub-section under MISSIONS
function ArchivedSidebar() {
  return (
    <div className="wf-side">
      {/* Workspace */}
      <div>
        <div style={{ fontSize: 10, letterSpacing: 1.4, color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 700, marginBottom: 6, padding: "0 2px" }}>Workspace</div>
        <div className="box" style={{ padding: "6px 8px", display: "flex", alignItems: "center", gap: 6, background: "var(--paper)" }}>
          <span style={{ color: "var(--ink-3)", fontSize: 11 }}>📁</span>
          <span className="mono" style={{ fontSize: 11, flex: 1 }}>~/todo-app</span>
          <span style={{ color: "var(--ink-3)", fontSize: 11 }}>⌄</span>
        </div>
        <div className="item mono" style={{ color: "var(--ink-3)", marginTop: 4 }}>main · clean</div>
      </div>

      {/* TEAM */}
      <div>
        <div style={{ fontSize: 10, letterSpacing: 1.4, color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 700, marginBottom: 6, padding: "0 2px" }}>▾ Team</div>
        <div className="item active" style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--review)", display: "inline-block" }} />
          <span style={{ flex: 1 }}>PM</span>
          <span title="3 PRD edits to review" style={{
            minWidth: 16, height: 16, padding: "0 4px", borderRadius: 8,
            background: "var(--review)", color: "var(--paper)",
            fontSize: 9, fontWeight: 700,
            display: "inline-flex", alignItems: "center", justifyContent: "center"
          }}>3</span>
        </div>
        <div className="item" style={{ paddingLeft: 18, color: "var(--ink-3)", fontSize: 11 }}>▸ Frontend Dept</div>
        <div className="item" style={{ paddingLeft: 18, color: "var(--ink-3)", fontSize: 11 }}>▸ Backend Dept</div>
      </div>

      {/* MISSIONS — Active + Archived split */}
      <div>
        <div style={{ fontSize: 10, letterSpacing: 1.4, color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 700, marginBottom: 6, padding: "0 2px" }}>▾ Missions</div>
        <div className="item" style={{ color: "var(--ink-3)" }}>◐ JSON parser refactor</div>
        <div className="item" style={{ color: "var(--ink-3)", fontStyle: "italic" }}>＋ new mission</div>

        <div style={{ fontSize: 9, letterSpacing: 1.2, color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 600, marginTop: 10, marginBottom: 4, padding: "0 2px", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 8 }}>▾</span> Archived · 1
        </div>
        <div className="item" style={{ color: "var(--ink-3)", opacity: 0.7, display: "flex", alignItems: "center", gap: 6 }}>
          <span>○</span>
          <span style={{ flex: 1, fontSize: 11, textDecoration: "line-through", textDecorationColor: "var(--ink-3)" }}>Dark mode mission</span>
          <span style={{ fontSize: 9, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>14:48</span>
        </div>
      </div>

      {/* SKILLS */}
      <div>
        <div style={{ fontSize: 10, letterSpacing: 1.4, color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 700, marginBottom: 6, padding: "0 2px" }}>▾ Skills</div>
        <div className="item">✓ TDD-Expert</div>
        <div className="item">✓ a11y-audit</div>
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────────────────────

Object.assign(window, {
  ANN, AnnPill, Note,
  Mission_Reviewer_Full, AnnRow, DiffLine, BranchTab,
  PM_DevLog, DevLogItem,
  PM_PRD, PRDNav, PRDSection, PRDBullet, PRDDiff,
  PM_SOP,
  Mission_Done, DoneTile,
  Mission_Archived, ArchivedSidebar
});