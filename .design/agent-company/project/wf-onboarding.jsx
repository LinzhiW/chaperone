// Onboarding screens — what happens BEFORE Phase 1's PM Chat.
//
// 0a · Welcome             — no project open, pick or create one
// 0b · PM onboarding scan  — first time PM enters a fresh workspace, builds memory
// 0c · Project ready       — PM finished scan, no missions yet, ready for first brief

// Mission rail with NO existing projects yet — only the workspace switcher + "+"
function EmptyMissionRail() {
  return (
    <div style={{
      width: 60,
      background: "#1a1816",
      borderRight: "1.5px solid var(--rule)",
      padding: "10px 0",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 10,
      flex: "0 0 auto"
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 14,
        background: "#3a3a3a", color: "#888",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: 13,
        border: "1.5px dashed #555"
      }}>AC</div>
      <div style={{ width: 28, height: 1, background: "rgba(255,255,255,0.08)" }} />
      <div style={{
        width: 44, height: 44, borderRadius: 22,
        border: "1.5px dashed #6e8b54",
        color: "#6e8b54",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, fontWeight: 300,
        boxShadow: "0 0 0 4px rgba(110,139,84,0.10)"
      }} title="Open or create your first project">＋</div>
      <div style={{ flex: 1 }} />
      <div style={{ width: 36, height: 36, color: "#6e6a60", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚙</div>
    </div>);

}

// 0a · Welcome — first launch, no workspace
function Onboarding_Welcome() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>0a · Welcome · no project</VariantTag>
      <EmptyMissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <div className="wf-topbar">
          <div style={{ fontWeight: 600, fontSize: 14 }}>Agent Company</div>
          <span className="mission" style={{ color: "var(--ink-3)", fontSize: 12 }}>·  v0.1 · no project loaded</span>
          <div className="spacer" />
          <span className="chip"><span className="dot" style={{ background: "var(--ink-3)" }} />idle</span>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--paper-2)", padding: 28 }}>
          <div style={{ maxWidth: 720, width: "100%", display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Hero */}
            <div>
              <div className="hand" style={{ fontSize: 32, lineHeight: 1.1, color: "var(--ink)" }}>
                Let's open or<br />build a project.
              </div>
              <p style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55, marginTop: 10, maxWidth: 540 }}>
                Each project gets one PM agent that reads your code, keeps your <span className="mono" style={{ fontSize: 12 }}>PRD.md</span> / <span className="mono" style={{ fontSize: 12 }}>SOP.md</span> / <span className="mono" style={{ fontSize: 12 }}>Dev log.md</span>, and dispatches workers in parallel —with human in the loop.
              </p>
            </div>

            {/* Three entry tiles */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div className="box" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8, cursor: "pointer", background: "var(--paper)" }}>
                <div style={{ fontSize: 24, color: "var(--pm)" }}>📁</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Open a local folder</div>
                <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5, flex: 1 }}>Pick an existing repo. PM will scan it and build memory.</div>
                <button className="btn" style={{ fontSize: 12, padding: "6px 12px", background: "var(--ink)", color: "var(--paper)", border: "1.5px solid var(--ink)", borderRadius: 4, alignSelf: "flex-start", fontWeight: 600 }}>Choose folder…</button>
              </div>
              <div className="box" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8, cursor: "pointer", background: "var(--paper)" }}>
                <div style={{ fontSize: 24, color: "var(--ink-2)" }}>⎇</div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Clone from GitHub</div>
                <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5, flex: 1 }}>Paste a repo URL, we'll clone + open it.</div>
                <div className="composer" style={{ padding: "6px 8px", fontSize: 11 }}>
                  <span className="mono" style={{ fontSize: 11 }}>github.com/you/repo</span>
                  <span className="send">↵</span>
                </div>
              </div>
              <div className="box-dash" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8, cursor: "pointer" }}>
                <div style={{ fontSize: 24, color: "var(--ink-3)" }}>★</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-2)" }}>Try with example</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5, flex: 1 }}>A small React TODO app to play with the full flow in 2 minutes.</div>
                <button className="btn" style={{ fontSize: 12, padding: "6px 12px", background: "var(--paper)", color: "var(--ink-2)", border: "1px solid var(--rule-soft)", borderRadius: 4, alignSelf: "flex-start" }}>Use example →</button>
              </div>
            </div>

            {/* Recent (empty state) */}
            <div className="box-soft" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, background: "var(--paper)" }}>
              <span style={{ fontSize: 10, letterSpacing: 1.4, color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 700 }}>Recent</span>
              <span style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic" }}>nothing here yet — opened projects appear in the left rail</span>
            </div>

            <div style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center", marginTop: 6, fontFamily: "var(--hand)", fontSize: 14 }}>
              Nothing runs on your machine until you approve every step.
            </div>
          </div>
        </div>
        <BottomBar extra="no project · waiting for you to choose" />
      </div>
    </div>);

}

// 0b · PM onboarding scan — PM reads the freshly opened workspace, asks approval per file batch.
function Onboarding_PMScan() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>0b · PM onboarding · scanning workspace</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="PM · meeting your codebase" />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar active="pm" />
          <PMShell activeTab="chat" runningMissions={0}>
            <div className="wf-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "14px 18px 14px" }} data-comment-anchor="512e329485-div-121-13">
              <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>

                <div className="box" style={{ padding: "12px 16px", background: "#fffaec", borderColor: "var(--pm)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="pm-tag">PM</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "var(--pm)" }}>First time in <span className="mono" style={{ fontSize: 12 }}>~/todo-app</span></span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.6 }}>
                    Hi. I'd like to build my initial memory of this project: a draft <span className="mono" style={{ fontSize: 11 }}>PRD.md</span> from your README, an SOP from how the code is organized, and a quick map of which files do what. I won't write anything until you say go on each step.
                  </div>
                </div>

                {/* Step 1 — done */}
                <div className="box" style={{ padding: "10px 14px", background: "var(--paper)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--approve)", marginBottom: 6 }}>STEP 1 · ✓ done · scan files</div>
                  <div className="box-soft" style={{ padding: "8px 10px", fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-2)" }}>
                    ⛏ read_file <span style={{ color: "var(--pm)" }}>README.md</span><br />
                    ⛏ read_file <span style={{ color: "var(--pm)" }}>package.json</span><br />
                    ⛏ run_shell <span style={{ color: "var(--pm)" }}>tree -L 2 src/</span><br />
                    <span style={{ color: "var(--approve)" }}>✓ found 18 files · React 18 · Vite · Vitest</span>
                  </div>
                </div>

                {/* Step 2 — pending HITL */}
                <div className="box" style={{ padding: "10px 14px", background: "var(--paper)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--review)", marginBottom: 6 }}>STEP 2 · ⏸ awaiting approval · write PRD.md</div>
                  <div style={{ fontSize: 12, color: "var(--ink-2)", marginBottom: 8 }}>I'll create <span className="mono" style={{ fontSize: 11 }}>PRD.md</span> at the project root, drafted from your README + observed structure. You can edit it anytime.</div>
                  <HitlCard tool="write_file" cmd={"PRD.md (+62 lines)\n— Product: A minimal React TODO app\n— Tech: Vite + React 18 + TypeScript\n— Storage: localStorage\n— Open todo states: 14 active, 0 archived"} />
                </div>

                {/* Step 3 — queued */}
                <div className="box" style={{ padding: "10px 14px", background: "var(--paper-2)", opacity: 0.7 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", marginBottom: 6 }}>STEP 3 · ◻ queued · draft SOP.md</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Will summarize: coding style, test conventions, branch naming.</div>
                </div>

                <div style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center", marginTop: 4 }}>
                  After scan, I'll be ready for your first mission brief.
                </div>
              </div>
            </div>

            <div style={{ padding: "10px 18px 14px", borderTop: "1.5px solid var(--rule)", background: "var(--paper-2)" }}>
              <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 11, color: "var(--ink-3)", fontStyle: "italic" }}>You can skip scan and start fresh — PM will learn as it goes.</span>
                <span style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  <button className="btn" style={{ fontSize: 11, padding: "5px 12px", background: "var(--paper)", border: "1.5px solid var(--rule)", borderRadius: 4 }}>Skip onboarding</button>
                  <button className="btn" style={{ fontSize: 11, padding: "5px 12px", background: "var(--ink)", color: "var(--paper)", border: "1.5px solid var(--ink)", borderRadius: 4, fontWeight: 600 }}>Approve all 3 steps</button>
                </span>
              </div>
            </div>
          </PMShell>
        </div>
        <BottomBar extra="PM onboarding · 1 of 3 steps awaiting approval" />
      </div>
    </div>);

}

// 0c · Project ready — PM has memory, no missions yet, prompts user to brief first one
function Onboarding_Ready() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>0c · Project ready · no missions yet</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="PM · ready · what shall we build first?" />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* A trimmed sidebar — missions empty, depts not recruited yet */}
          <Sidebar_Empty />
          <PMShell activeTab="chat" runningMissions={0}>
            <div className="wf-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "14px 18px 14px" }}>
              <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>

                <div className="box" style={{ padding: "14px 18px", background: "#fffaec", borderColor: "var(--pm)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="pm-tag">PM</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "var(--pm)" }}>I'm ready · here's what I know so far</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-3)" }}>scan complete · 3 docs written</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
                    <div className="box-soft" style={{ padding: "8px 10px", background: "var(--paper)" }}>
                      <div className="mono" style={{ fontSize: 11, color: "var(--pm)" }}>PRD.md</div>
                      <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 2 }}>"Minimal React TODO with localStorage"</div>
                    </div>
                    <div className="box-soft" style={{ padding: "8px 10px", background: "var(--paper)" }}>
                      <div className="mono" style={{ fontSize: 11, color: "var(--pm)" }}>SOP.md</div>
                      <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 2 }}>Vitest tests · branch prefix <span className="mono" style={{ fontSize: 10 }}>feat/</span></div>
                    </div>
                    <div className="box-soft" style={{ padding: "8px 10px", background: "var(--paper)" }}>
                      <div className="mono" style={{ fontSize: 11, color: "var(--pm)" }}>Dev log.md</div>
                      <div style={{ fontSize: 11, color: "var(--ink-2)", marginTop: 2 }}>empty — first entry on first reviewer report</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 12, lineHeight: 1.55 }}>
                    No team members recruited yet. When you brief your first mission, I'll suggest workers (e.g. <em>ui-worker</em>, <em>api-worker</em>) and you can confirm.
                  </div>
                </div>

                <div style={{ fontSize: 11, color: "var(--ink-3)", textAlign: "center" }}>
                  Tell me what to build, fix, or refactor →
                </div>
              </div>
            </div>

            <div style={{ padding: "10px 18px 14px", borderTop: "1.5px solid var(--rule)", background: "var(--paper-2)" }}>
              <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="composer" style={{ padding: "12px 14px", fontSize: 13 }}>
                  <span style={{ color: "var(--ink-3)" }}>What's our first mission? e.g. "add dark mode + JSON export"…</span>
                  <span className="send">↵</span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontFamily: "var(--hand)", fontSize: 14, color: "var(--ink-3)", marginRight: 4 }}>quick starts:</span>
                  <span className="branch-chip" style={{ cursor: "pointer", background: "var(--pm-soft)", borderColor: "var(--pm)", color: "var(--pm)" }}>Plan a feature</span>
                  <span className="branch-chip" style={{ cursor: "pointer" }}>Plan a refactor</span>
                  <span style={{ width: 1, height: 14, background: "var(--rule-soft)", margin: "0 4px" }} />
                  <span className="branch-chip" style={{ cursor: "pointer" }}>Set up SOP</span>
                  <span className="branch-chip" style={{ cursor: "pointer" }}>Update PRD with me</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--ink-3)", fontStyle: "italic", marginTop: 2, paddingLeft: 4 }}>
                  PM plans &amp; tracks · workers actually write code/tests. Right of the divider = PM-only doc work.
                </div>
              </div>
            </div>
          </PMShell>
        </div>
        <BottomBar extra="project ready · 0 missions · PM idle" />
      </div>
    </div>);

}

// Sidebar variant where Team has no recruited workers yet + no missions
function Sidebar_Empty() {
  return (
    <div className="wf-side">
      <div>
        <div style={{ fontSize: 10, letterSpacing: 1.4, color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 700, marginBottom: 6, padding: "0 2px" }}>Workspace</div>
        <div className="box" style={{ padding: "6px 8px", display: "flex", alignItems: "center", gap: 6, background: "var(--paper)" }}>
          <span style={{ color: "var(--ink-3)", fontSize: 11 }}>📁</span>
          <span className="mono" style={{ fontSize: 11, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>~/todo-app</span>
          <span style={{ color: "var(--ink-3)", fontSize: 11 }}>⌄</span>
        </div>
        <div className="item mono" style={{ color: "var(--ink-3)", marginTop: 4 }}>main · just cloned</div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, padding: "0 2px" }}>
          <span style={{ color: "var(--ink-3)", fontSize: 9 }}>▾</span>
          <span style={{ fontSize: 10, letterSpacing: 1.4, color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 700 }}>Team</span>
          <span style={{ marginLeft: "auto", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--approve)", border: "1px solid var(--approve)", borderRadius: 3, fontSize: 11, fontWeight: 700 }}>＋</span>
        </div>
        <div className="item active" style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--pm)", display: "inline-block" }} />
          <span style={{ flex: 1 }}>PM</span>
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 3, color: "var(--paper)", background: "var(--pm)", fontSize: 11, lineHeight: 1 }}>💬</span>
        </div>
        <div className="item" style={{ paddingLeft: 8, color: "var(--ink-3)", fontStyle: "italic", fontSize: 11 }}>no departments yet — PM will suggest</div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, padding: "0 2px" }}>
          <span style={{ color: "var(--ink-3)", fontSize: 9 }}>▾</span>
          <span style={{ fontSize: 10, letterSpacing: 1.4, color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 700 }}>Missions</span>
        </div>
        <div className="item" style={{ color: "var(--ink-3)", fontStyle: "italic", fontSize: 11 }}>no missions yet</div>
        <div className="item" style={{ color: "var(--approve)", fontWeight: 600, cursor: "pointer" }}>＋ start your first mission</div>
      </div>

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, padding: "0 2px" }}>
          <span style={{ color: "var(--ink-3)", fontSize: 9 }}>▾</span>
          <span style={{ fontSize: 10, letterSpacing: 1.4, color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 700 }}>Skills</span>
          <span style={{ marginLeft: "auto", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--approve)", border: "1px solid var(--approve)", borderRadius: 3, fontSize: 11, fontWeight: 700 }}>＋</span>
        </div>
        <div className="item">✓ TDD-Expert</div>
        <div className="item" style={{ color: "var(--ink-3)" }}>(more loaded from .agents/skills)</div>
      </div>
    </div>);

}

Object.assign(window, { Onboarding_Welcome, Onboarding_PMScan, Onboarding_Ready });