// Phase 2 · Batch 2 — Recruit, HITL reject/rewrite (14, 15)

// ─────────────────────────────────────────────────────────────────────────────
// 14 · Recruit worker — modal with role presets + skill loadout
function Recruit_Worker() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>14 · Recruit · new worker</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="Recruit worker" pending={0} />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar active="team" />

          <div style={{ flex: 1, position: "relative", background: "var(--paper-2)", display: "flex", alignItems: "stretch", justifyContent: "center", padding: "20px", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 1 }} />

            <div className="box" style={{
              position: "relative", zIndex: 2, width: 920, background: "var(--paper)",
              borderColor: "var(--rule)", borderRadius: 6, display: "flex", flexDirection: "column",
              boxShadow: "0 12px 32px rgba(0,0,0,0.18)"
            }}>
              <div style={{ padding: "12px 18px", borderBottom: "1.5px solid var(--rule)", background: "var(--paper-2)", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>＋ Recruit a worker</span>
                <span style={{ fontSize: 11, color: "var(--ink-3)" }}>· pick role · choose skills · name them</span>
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                  <StepDot n={1} label="Role" done /> ─
                  <StepDot n={2} label="Skills" active /> ─
                  <StepDot n={3} label="Name & ship" />
                </div>
              </div>

              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", minHeight: 0 }}>
                {/* Left: role presets */}
                <div style={{ padding: "14px 18px", borderRight: "1.5px solid var(--rule)", display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
                  <Label>Step 1 · Role · pick a preset (or custom)</Label>
                  <div className="wf-scroll" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, overflow: "auto", paddingRight: 6 }}>
                    {ROLE_PRESETS.map((r) => <RoleCard key={r.id} preset={r} selected={r.id === "be"} />)}
                    <div style={{
                      gridColumn: "span 2",
                      border: "1.5px dashed var(--rule-soft)", borderRadius: 4, padding: "10px 12px",
                      color: "var(--ink-3)", fontSize: 11,
                      display: "flex", alignItems: "center", gap: 8, cursor: "pointer"
                    }}>
                      <span style={{ fontSize: 16 }}>＋</span>
                      <span style={{ flex: 1 }}>Custom role · describe responsibilities yourself</span>
                    </div>
                  </div>
                </div>

                {/* Right: skills + identity */}
                <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }} data-comment-anchor="df070e6cc5-div-52-17">
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <Label>Step 2 · Skills · 4 slots equipped by default for Backend</Label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
                      <SkillCard skill={SKILL("rest")} equipped compact onRemove={() => {}} />
                      <SkillCard skill={SKILL("sec")} equipped compact onRemove={() => {}} />
                      <SkillCard skill={SKILL("tdd")} equipped compact onRemove={() => {}} />
                      <SkillCard skill={SKILL("conv-cmt")} equipped compact onRemove={() => {}} />
                      <EmptySlot>+</EmptySlot>
                      <EmptySlot>+</EmptySlot>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "var(--ink-3)" }}>Apply saved set:</span>
                      <span className="branch-chip" style={{ cursor: "pointer", background: "var(--pm-soft)", borderColor: "var(--pm)", color: "var(--pm)" }}>Backend · strict</span>
                      <span className="branch-chip" style={{ cursor: "pointer" }}>QA · full coverage</span>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-3)", textDecoration: "underline", cursor: "pointer" }}>open library →</span>
                    </div>
                  </div>

                  <hr style={{ width: "100%", border: 0, borderTop: "1px dashed var(--rule-soft)", margin: 0 }} />

                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <Label>Step 3 · Identity</Label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ fontSize: 10, color: "var(--ink-3)" }}>Display name</span>
                        <FakeInput value="api-worker · Auth & Sessions" />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ fontSize: 10, color: "var(--ink-3)" }}>Will be assigned id</span>
                        <FakeInput value="W5 (next free)" />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ fontSize: 10, color: "var(--ink-3)" }}>Branch prefix</span>
                        <FakeInput value="feat/api-" />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <span style={{ fontSize: 10, color: "var(--ink-3)" }}>Goes to dept</span>
                        <FakeInput value="Backend Dept (auto)" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ padding: "10px 18px", borderTop: "1.5px solid var(--rule)", background: "var(--paper-2)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--ink-3)" }}>Worker stays idle until you brief them with a mission.</span>
                <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button className="btn" style={{ fontSize: 11, padding: "6px 14px", borderRadius: 4, border: "1.5px solid var(--rule)", background: "var(--paper)" }}>Cancel</button>
                  <button className="btn" style={{ fontSize: 11, padding: "6px 14px", borderRadius: 4, border: "1.5px solid var(--approve)", background: "var(--approve)", color: "var(--paper)", fontWeight: 700 }}>✓ Hire · add to team</button>
                </span>
              </div>
            </div>

            <div style={{ position: "absolute", right: 14, top: 60, width: 150, display: "flex", flexDirection: "column", gap: 12, zIndex: 3 }}>
              <P2bNote color="var(--pm)" style={{ background: "var(--paper)", padding: "4px 6px" }}>↖ 6 role presets ·<br />each ships with a<br />default skill set</P2bNote>
              <P2bNote color="var(--approve)" style={{ background: "var(--paper)", padding: "4px 6px" }}>← apply a saved<br />skill set in one<br />click</P2bNote>
              <P2bNote color="var(--ink-3)" style={{ background: "var(--paper)", padding: "4px 6px" }}>← Dept auto-<br />assigned from<br />preset</P2bNote>
            </div>
          </div>
        </div>
        <BottomBar extra="recruit · step 2 of 3" />
      </div>
    </div>);

}

function StepDot({ n, label, active, done }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{
        width: 18, height: 18, borderRadius: 99, fontSize: 9, fontWeight: 700,
        background: active ? "var(--pm)" : done ? "var(--approve)" : "var(--paper)",
        color: active || done ? "var(--paper)" : "var(--ink-3)",
        border: `1.5px solid ${active ? "var(--pm)" : done ? "var(--approve)" : "var(--rule-soft)"}`,
        display: "inline-flex", alignItems: "center", justifyContent: "center"
      }}>{done ? "✓" : n}</span>
      <span style={{ fontWeight: active ? 600 : 500, color: active ? "var(--pm)" : "var(--ink-3)" }}>{label}</span>
    </span>);

}

function RoleCard({ preset, selected }) {
  return (
    <div style={{
      border: selected ? `1.5px solid var(--pm)` : "1.5px solid var(--rule-soft)",
      borderRadius: 4, padding: "10px 12px",
      background: selected ? "var(--pm-soft)" : "var(--paper)",
      display: "flex", flexDirection: "column", gap: 6, cursor: "pointer", position: "relative"
    }}>
      {selected &&
      <span style={{ position: "absolute", top: -8, right: 8, background: "var(--pm)", color: "var(--paper)", fontSize: 9, padding: "1px 6px", borderRadius: 99, fontWeight: 700 }}>SELECTED</span>
      }
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: preset.color }} />
        <strong style={{ fontSize: 12 }}>{preset.role}</strong>
        <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>{preset.branchPrefix}…</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-2)", lineHeight: 1.4 }}>{preset.desc}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
        {preset.defaultSkills.map((id) =>
        <span key={id} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 2, background: SKILL(id).color + "20", color: SKILL(id).color, fontFamily: "var(--mono)", fontWeight: 600 }}>{SKILL(id).name}</span>
        )}
      </div>
    </div>);

}

// ─────────────────────────────────────────────────────────────────────────────
// 15 · HITL · reject / rewrite flow
function HITL_Reject() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>15 · HITL · reject + rewrite</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="Mission · running" pending={1} />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar active="mission:dark-mode" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--paper-2)" }}>
            <MissionStrip name="Dark mode mission" status="running" workers={4} hitl={1} />

            <div style={{ flex: 1, padding: 14, display: "flex", flexDirection: "column", gap: 12, minHeight: 0, overflow: "hidden" }} data-comment-anchor="f99f57b6cc-div-174-13">
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, minHeight: 0 }}>

                {/* W1 — just rejected, in rewrite mode */}
                <WorkerTile w={WF_DATA.workers[0]}>
                  <StreamLines lines={[
                  { kind: "agent", text: "→ Plan: add ThemeContext, wire toggle in Header" },
                  { kind: "tool", text: "⛏ read_file: src/App.jsx (132 lines)" },
                  { kind: "tool", text: "⛏ write_file: src/theme.ts" }]
                  } />
                  <RejectedHitl />
                  <div className="wt-composer">
                    <span className="ph">talk to W1</span>
                    <span className="send">↵</span>
                  </div>
                </WorkerTile>

                {/* W2 — already re-planning after a previous rejection */}
                <WorkerTile w={WF_DATA.workers[1]}>
                  <StreamLines lines={[
                  { kind: "agent", text: "→ Plan: add Export menu, JSON serializer" },
                  { kind: "tool", text: "⛏ read_file: src/store/todos.ts" },
                  { kind: "agent", text: "✗ user rejected last write · re-planning" },
                  { kind: "agent", text: "→ Switching to streaming JSON writer" },
                  { kind: "ok", text: "✓ wrote test: streamExportToJSON" }]
                  } />
                  <div className="box-soft" style={{ padding: "6px 8px", background: "#fff2e8", border: "1px dashed var(--review)", fontFamily: "var(--mono)", fontSize: 10, color: "var(--ink-2)", lineHeight: 1.5 }}>
                    last reject feedback (you, 14:31):<br />
                    <span style={{ color: "var(--review)" }}>"don't load all todos into memory · stream instead"</span>
                  </div>
                  <div className="wt-composer">
                    <span className="ph">talk to W2</span>
                    <span className="send">↵</span>
                  </div>
                </WorkerTile>

                {/* W3 — running normally for context */}
                <WorkerTile w={WF_DATA.workers[2]}>
                  <StreamLines lines={[
                  { kind: "agent", text: "→ Building shortcut cheatsheet modal..." },
                  { kind: "tool", text: "⛏ write_file: src/components/ShortcutHelp.tsx" },
                  { kind: "ok", text: "✓ committed (a91d2)" }]
                  } />
                  <div style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>streaming...</div>
                  <div className="wt-composer">
                    <span className="ph">talk to W3</span>
                    <span className="send">↵</span>
                  </div>
                </WorkerTile>

                {/* W4 idle */}
                <WorkerTile w={WF_DATA.workers[3]}>
                  <div style={{ padding: "20px 8px", textAlign: "center", color: "var(--ink-3)", fontSize: 12 }}>
                    <div className="hand" style={{ fontSize: 18, color: "var(--ink-3)", marginBottom: 6 }}>idle</div>
                  </div>
                </WorkerTile>
              </div>

              {/* Notes strip */}
              <div className="box" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 14, background: "var(--paper)" }}>
                <P2bNote color="var(--review)">↖ W1: you hit "Reject" — the HITL card flips to <strong>rewrite mode</strong>. Edit the cmd inline & resend (A), OR send feedback only (B) and let the worker re-plan.</P2bNote>
                <span style={{ width: 1, height: 36, background: "var(--rule-soft)" }} />
                <P2bNote color="var(--ink-3)">← W2: what happens AFTER a reject — feedback becomes a pinned note; worker re-plans automatically.</P2bNote>
              </div>
            </div>
          </div>
        </div>
        <BottomBar extra="W1 hitl · rewriting · W2 replanning" />
      </div>
    </div>);

}

function RejectedHitl() {
  return (
    <div className="hitl" style={{ borderColor: "var(--warn)", background: "#fff0ec" }}>
      <div className="hitl-head" style={{ color: "var(--warn)" }}>
        <span>✗</span><span>Rejected · choose how to send back</span>
        <span style={{ marginLeft: "auto", color: "var(--ink-3)", fontWeight: 400 }}>run_shell · 14:34</span>
      </div>

      <div style={{ fontSize: 10, color: "var(--ink-3)" }}>Original command</div>
      <div className="hitl-cmd" style={{ background: "#f8e8e2", textDecoration: "line-through", textDecorationColor: "var(--warn)", color: "var(--ink-3)" }}>
        npm install styled-components
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }} data-comment-anchor="7ef8a1b98d-div-260-7">
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600 }}>
          <span style={{ width: 14, height: 14, borderRadius: 99, background: "var(--review)", color: "var(--paper)", fontSize: 9, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>A</span>
          <span>Rewrite the command and resend</span>
        </div>
        <div className="hitl-cmd" style={{ background: "var(--paper)", border: "1.5px solid var(--review)", color: "var(--ink)" }}>
          <span style={{ background: "#e4f0e4", color: "var(--approve)", padding: "0 3px", borderRadius: 2 }}>echo "use CSS variables instead — no install needed"</span>
          <span style={{ color: "var(--ink-3)", marginLeft: 6, fontFamily: "var(--sans)", fontSize: 10 }}>← editable</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontSize: 11, fontWeight: 600, color: "var(--ink-3)" }}>
          <span style={{ width: 14, height: 14, borderRadius: 99, background: "var(--ink-3)", color: "var(--paper)", fontSize: 9, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>B</span>
          <span>Or send back with feedback only</span>
        </div>
        <div className="composer" style={{ padding: "5px 8px", fontSize: 11 }}>
          <span>e.g. "use CSS variables; no new deps"</span>
          <span className="send">↵</span>
        </div>
      </div>

      <div className="hitl-actions" style={{ marginTop: 4 }}>
        <button className="btn approve" style={{ background: "var(--review)", borderColor: "var(--review)" }}>Send rewrite (A)</button>
        <button className="btn" style={{ background: "var(--paper)", color: "var(--ink-2)", border: "1.5px solid var(--rule-soft)" }}>Send feedback (B)</button>
        <span className="btn kbd">e / f</span>
        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--ink-3)" }}>worker is paused</span>
      </div>
    </div>);

}

Object.assign(window, { Recruit_Worker, StepDot, RoleCard, HITL_Reject, RejectedHitl });