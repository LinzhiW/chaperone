// Phase 2 · Batch 2 — Worker chat deep-dive (16), Brief a new mission (17)

// Shared chat primitives
function ChatMsg({ from, color, tag, children }) {
  return (
    <div className="box" style={{ padding: "10px 14px", background: "var(--paper)", maxWidth: 560, borderColor: color || "var(--rule)", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: color || "var(--ink-2)" }}>{from}</span>
        {tag && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 2, background: "var(--paper-2)", color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: 0.4 }}>{tag}</span>}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: "var(--ink)" }}>{children}</div>
    </div>
  );
}

function ChatMsgYou({ children }) {
  return (
    <div className="box" style={{ padding: "10px 14px", background: "var(--paper-2)", alignSelf: "flex-end", maxWidth: 500 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)", marginBottom: 4 }}>You</div>
      <div style={{ fontSize: 13, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

function ChatToolCluster({ children }) {
  return (
    <div className="box-soft" style={{ padding: "8px 10px", fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)", lineHeight: 1.6, maxWidth: 560, display: "flex", flexDirection: "column", gap: 2 }}>
      {children}
    </div>
  );
}

function ToolLine({ ok, children }) {
  return <div style={{ color: ok ? "var(--approve)" : "var(--ink-2)" }}>{children}</div>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 16 · Worker chat (single-worker deep-dive)
function Worker_Chat() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>16 · Worker chat · W1 deep-dive</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="W1 · ui-worker · Dark Mode" pending={1} />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar active="mission:dark-mode" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--paper-2)" }}>

            {/* Worker identity strip with back button */}
            <div className="box" style={{ borderRadius: 0, border: "none", borderBottom: "1.5px solid var(--rule)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, background: "var(--paper-2)" }}>
              <button className="btn" style={{ fontSize: 11, padding: "4px 10px", border: "1.5px solid var(--rule)", background: "var(--paper)", borderRadius: 3 }}>← All workers (4)</button>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: "var(--w1)" }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>W1 · Dark Mode</div>
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>ui-worker · ⎇ feat/dark-mode · running · 4 commits · 6 tool calls today</div>
              </div>
              <span style={{ marginLeft: "auto", fontSize: 11, padding: "2px 8px", borderRadius: 99, background: "var(--approve-soft)", color: "var(--approve)", border: "1px solid var(--approve)", fontWeight: 600 }}>● live</span>
              <button className="btn" style={{ fontSize: 11, padding: "4px 10px", border: "1.5px solid var(--rule-soft)", background: "var(--paper)", borderRadius: 3, color: "var(--ink-2)" }}>⏸ Pause</button>
            </div>

            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 280px", minHeight: 0 }}>
              {/* Chat column */}
              <div style={{ display: "flex", flexDirection: "column", minHeight: 0, borderRight: "1.5px solid var(--rule)" }}>
                <div className="wf-scroll" style={{ flex: 1, overflow: "auto", padding: "14px 18px", background: "var(--paper)" }}>
                  <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>

                    <div style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center" }}>session start · 14:24</div>

                    <ChatMsg from="W1" color="var(--w1)" tag="brief received">
                      Got it. <em>Add dark mode to React TODO.</em><br />
                      Plan: ThemeContext + CSS variables, toggle in Header, persist to localStorage. Skipping styled-components per saved set.
                    </ChatMsg>

                    <ChatToolCluster>
                      <ToolLine>⛏ read_file <span style={{ color: "var(--pm)" }}>src/App.jsx</span> · 132 lines</ToolLine>
                      <ToolLine>⛏ read_file <span style={{ color: "var(--pm)" }}>src/components/Header.jsx</span> · 84 lines</ToolLine>
                      <ToolLine ok>✓ context built · 2 files · 216 lines</ToolLine>
                    </ChatToolCluster>

                    <ChatMsg from="W1" color="var(--w1)">
                      Scaffolding ThemeContext. Commit: <span className="mono" style={{ fontSize: 11 }}>feat(theme): scaffold ThemeContext</span>
                    </ChatMsg>

                    <ChatToolCluster>
                      <ToolLine>⛏ write_file <span style={{ color: "var(--pm)" }}>src/theme.ts</span> · +42 lines</ToolLine>
                      <ToolLine>⛏ write_file <span style={{ color: "var(--pm)" }}>src/hooks/useTheme.ts</span> · +28 lines</ToolLine>
                      <ToolLine ok>✓ git commit · 4f3a1 · scaffold ThemeContext</ToolLine>
                    </ChatToolCluster>

                    <ChatMsgYou>any reason you went with Context vs a small store like Zustand?</ChatMsgYou>

                    <ChatMsg from="W1" color="var(--w1)" tag="nudge reply">
                      The saved set <code className="mono" style={{ fontSize: 11, background: "var(--paper-2)", padding: "1px 4px", borderRadius: 2 }}>css-theming</code> says CSS vars only — Context is the minimum to read the var off &lt;html&gt;. Zustand would be overkill for 1 boolean. Open to switching if you want.
                    </ChatMsg>

                    <ChatMsgYou>fine, continue.</ChatMsgYou>

                    <ChatToolCluster>
                      <ToolLine>⛏ edit_file <span style={{ color: "var(--pm)" }}>src/components/Header.jsx</span> · +12 −0</ToolLine>
                    </ChatToolCluster>

                    {/* Pending HITL inline */}
                    <HitlCard tool="run_shell" cmd="npx tsc --noEmit && npm test" />

                    <div style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--mono)", textAlign: "center", padding: "4px 0" }}>
                      waiting for your approval to run tests…
                    </div>
                  </div>
                </div>

                {/* Per-worker composer */}
                <div style={{ padding: "10px 18px", borderTop: "1.5px solid var(--rule)", background: "var(--paper-2)" }}>
                  <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div className="composer" style={{ padding: "10px 12px" }}>
                      <span>Nudge W1 · "switch to Zustand", "skip the test commit", "explain that file"…</span>
                      <span className="send">↵</span>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span className="branch-chip" style={{ cursor: "pointer" }}>Explain last commit</span>
                      <span className="branch-chip" style={{ cursor: "pointer" }}>Show changed files</span>
                      <span className="branch-chip" style={{ cursor: "pointer" }}>What's next?</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right sidebar — worker state at a glance */}
              <div style={{ display: "flex", flexDirection: "column", minHeight: 0, background: "var(--paper-2)" }}>
                <div className="wf-scroll" style={{ flex: 1, overflow: "auto", padding: "14px 12px", display: "flex", flexDirection: "column", gap: 12 }}>

                  {/* Branch info */}
                  <div className="box" style={{ padding: "10px 12px", background: "var(--paper)" }}>
                    <div style={{ fontSize: 10, letterSpacing: 1, color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Branch</div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--ink)" }}>feat/dark-mode</div>
                    <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 4, display: "flex", gap: 6 }}>
                      <span style={{ color: "var(--approve)" }}>+124</span>
                      <span style={{ color: "var(--warn)" }}>−18</span>
                      <span>· 6 files · 4 commits</span>
                    </div>
                  </div>

                  {/* Equipped skills */}
                  <div className="box" style={{ padding: "10px 12px", background: "var(--paper)" }}>
                    <div style={{ fontSize: 10, letterSpacing: 1, color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center" }}>
                      <span style={{ flex: 1 }}>Equipped skills</span>
                      <span style={{ fontSize: 10, color: "var(--pm)", textDecoration: "underline", cursor: "pointer", textTransform: "none", letterSpacing: 0 }}>edit loadout →</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <SkillCard skill={SKILL("css-th")} equipped compact />
                      <SkillCard skill={SKILL("a11y")}   equipped compact />
                      <SkillCard skill={SKILL("tdd")}    equipped compact />
                    </div>
                  </div>

                  {/* Recent files */}
                  <div className="box" style={{ padding: "10px 12px", background: "var(--paper)" }}>
                    <div style={{ fontSize: 10, letterSpacing: 1, color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 700, marginBottom: 4 }}>Recently touched</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, fontFamily: "var(--mono)", fontSize: 10 }}>
                      <div style={{ display: "flex", gap: 6 }}><span style={{ color: "var(--approve)" }}>M</span> <span style={{ flex: 1, color: "var(--ink-2)" }}>src/components/Header.jsx</span></div>
                      <div style={{ display: "flex", gap: 6 }}><span style={{ color: "var(--approve)" }}>+</span> <span style={{ flex: 1, color: "var(--ink-2)" }}>src/hooks/useTheme.ts</span></div>
                      <div style={{ display: "flex", gap: 6 }}><span style={{ color: "var(--approve)" }}>+</span> <span style={{ flex: 1, color: "var(--ink-2)" }}>src/theme.ts</span></div>
                    </div>
                  </div>

                  {/* PM links */}
                  <div className="box-soft" style={{ padding: "8px 10px", background: "var(--paper)" }}>
                    <div style={{ fontSize: 10, color: "var(--ink-3)" }}>PM does not see this chat.</div>
                    <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>What lands in PM's memory: commits + reviewer report.</div>
                  </div>

                  <P2bNote color="var(--pm)">↖ chat scrolls infinitely · tool calls fold inline · HITL stays inline</P2bNote>
                  <P2bNote color="var(--ink-3)">→ right rail = at-a-glance state · click "edit loadout" → screen 13</P2bNote>
                </div>
              </div>
            </div>
          </div>
        </div>
        <BottomBar extra="W1 chat · 1 hitl pending" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 17 · Brief a new mission — PM clarifies before drafting plan
function PM_BriefMission() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>17 · PM · briefing a new mission</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="PM · briefing new mission" pending={0} />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar active="pm" />
          <PMShell activeTab="chat" runningMissions={1}>

            <div className="wf-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "14px 18px" }}>
              <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>

                <div style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center" }}>14:50 · new mission briefing</div>

                {/* Step 1: vague brief */}
                <ChatMsgYou>let's add a way for users to share their TODO list with someone else.</ChatMsgYou>

                {/* PM clarifies, not yet drafting */}
                <ChatMsg from="PM" color="var(--pm)" tag="clarifying">
                  Before I draft a plan, three things I need to nail down — they each fork the architecture:
                  <ul style={{ margin: "6px 0 0 18px", fontSize: 12, lineHeight: 1.55, color: "var(--ink-2)" }}>
                    <li><strong>Scope of "share"</strong> — read-only link, or edit together?</li>
                    <li><strong>Who's the "someone"</strong> — any URL visitor, or a registered account?</li>
                    <li><strong>Persistence</strong> — server-side store, or P2P/CRDT?</li>
                  </ul>
                  <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 6 }}>
                    PRD currently says "no accounts, local-first" — answers below would push back on either.
                  </div>
                </ChatMsg>

                {/* Quick clarification chips */}
                <div className="box" style={{ padding: "10px 14px", background: "var(--paper)", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 10, letterSpacing: 1, color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 700 }}>Choose to answer (or type freely below)</div>

                  <ClarifyRow label="Scope" options={["Read-only link","Edit together","Comment-only"]} selected="Read-only link" />
                  <ClarifyRow label="Who"   options={["Anyone with URL","Registered users","Same Apple ID"]} selected="Anyone with URL" />
                  <ClarifyRow label="Store" options={["Server-side","P2P / CRDT","Static export only"]} selected="Static export only" />
                </div>

                <ChatMsgYou>read-only link, anyone with URL, static export only — keep it local-first.</ChatMsgYou>

                <ChatMsg from="PM" color="var(--pm)" tag="reconciling">
                  Clean. That fits the PRD constraint. One more thing — the static link needs to live <em>somewhere</em>. Options:
                  <ol style={{ margin: "6px 0 0 18px", fontSize: 12, lineHeight: 1.55, color: "var(--ink-2)" }}>
                    <li>encoded directly into the URL hash (works fully offline, big todo lists hit URL length cap)</li>
                    <li>uploaded to a free pastebin-style service (introduces a network dep)</li>
                    <li>generate a downloadable .html file the user emails (most "local-first" honest)</li>
                  </ol>
                </ChatMsg>

                <ChatMsgYou>option 3 — generate downloadable .html.</ChatMsgYou>

                <ChatMsg from="PM" color="var(--pm)" tag="ready to draft">
                  Locked. Here's the scope I'm about to plan:
                  <div className="box-soft" style={{ marginTop: 8, padding: "8px 10px", background: "var(--paper-2)", fontSize: 12, lineHeight: 1.55 }}>
                    <strong>Mission: TODO list export-as-static-page</strong><br />
                    Generate a self-contained <span className="mono" style={{ fontSize: 11 }}>.html</span> file containing the user's current todos, styled to match the app. No network, no accounts. Read-only.
                  </div>
                  Best split I see: <strong>2 workers</strong> — a UI worker for the share button + modal, a backend-ish (template) worker for the html generator + tests. ~2 hours total.
                  <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                    <button className="btn" style={{ fontSize: 12, padding: "6px 14px", borderRadius: 4, background: "var(--review)", border: "1.5px solid var(--review)", color: "var(--paper)", fontWeight: 700 }}>✎ Draft mission plan</button>
                    <button className="btn" style={{ fontSize: 11, padding: "6px 12px", borderRadius: 4, background: "var(--paper)", border: "1.5px solid var(--rule)", color: "var(--ink-2)" }}>Keep refining</button>
                    <span style={{ fontSize: 10, color: "var(--ink-3)", marginLeft: "auto" }}>once drafted, plan opens in PM Chat with sticky comments</span>
                  </div>
                </ChatMsg>

                <P2bNote color="var(--pm)">↑ PM stays in chat until <strong>scope is clamped</strong> — clarification chips + 3-option questions reduce typing.</P2bNote>
                <P2bNote color="var(--ink-3)">↑ when you click "Draft plan" → screen 2 (PM · drafting Mission Plan)</P2bNote>
              </div>
            </div>

            <div style={{ padding: "10px 18px 14px", borderTop: "1.5px solid var(--rule)", background: "var(--paper-2)" }}>
              <div style={{ maxWidth: 720, margin: "0 auto" }}>
                <div className="composer" style={{ padding: "10px 12px" }}>
                  <span>Answer freely, or hit a chip above…</span>
                  <span className="send">↵</span>
                </div>
              </div>
            </div>
          </PMShell>
        </div>
        <BottomBar extra="briefing · 3 clarifications resolved · ready to draft" />
      </div>
    </div>
  );
}

function ClarifyRow({ label, options, selected }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, color: "var(--ink-3)", fontFamily: "var(--mono)", minWidth: 48 }}>{label}</span>
      {options.map((o) => (
        <span key={o} style={{
          fontSize: 11, padding: "3px 10px", borderRadius: 99, cursor: "pointer",
          background: o === selected ? "var(--pm)" : "var(--paper)",
          color: o === selected ? "var(--paper)" : "var(--ink-2)",
          border: `1.5px solid ${o === selected ? "var(--pm)" : "var(--rule-soft)"}`,
          fontWeight: o === selected ? 600 : 500,
        }}>{o}</span>
      ))}
    </div>
  );
}

Object.assign(window, { Worker_Chat, PM_BriefMission, ChatMsg, ChatMsgYou, ChatToolCluster, ToolLine, ClarifyRow });
