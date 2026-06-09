// Phase 2 · Batch 2 — Skills system screens (11 · Library, 12 · Import, 13 · Loadout)

// ─────────────────────────────────────────────────────────────────────────────
// Expanded sidebar for Skills screens — replaces the middle "Categories" rail.
// Categories + Frequently used + Saved sets live here. Future: Skill community.
function Sidebar_Skills({ activeCat = "All" }) {
  const cats = [
    { id: "All", count: SKILL_LIB.length },
    { id: "Frontend", count: SKILL_LIB.filter(s => s.cat === "Frontend").length },
    { id: "Backend",  count: SKILL_LIB.filter(s => s.cat === "Backend").length },
    { id: "Mobile",   count: SKILL_LIB.filter(s => s.cat === "Mobile").length },
    { id: "Testing",  count: SKILL_LIB.filter(s => s.cat === "Testing").length },
    { id: "DevOps",   count: SKILL_LIB.filter(s => s.cat === "DevOps").length },
    { id: "Workflow", count: SKILL_LIB.filter(s => s.cat === "Workflow").length },
  ];
  const frequent = ["css-th", "tdd", "sec"]; // illustrative top-used
  return (
    <div className="wf-side" style={{ width: 230 }}>
      {/* Workspace */}
      <div>
        <div style={{ fontSize: 10, letterSpacing: 1.4, color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 700, marginBottom: 6, padding: "0 2px" }}>Workspace</div>
        <div className="box" style={{ padding: "6px 8px", display: "flex", alignItems: "center", gap: 6, background: "var(--paper)" }}>
          <span style={{ color: "var(--ink-3)", fontSize: 11 }}>📁</span>
          <span className="mono" style={{ fontSize: 11, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>~/todo-app</span>
          <span style={{ color: "var(--ink-3)", fontSize: 11 }}>⌄</span>
        </div>
      </div>

      {/* Team (collapsed peek) */}
      <div>
        <div style={{ fontSize: 10, letterSpacing: 1.4, color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 700, marginBottom: 6, padding: "0 2px", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 9 }}>▸</span><span>Team</span>
        </div>
      </div>

      {/* Missions (collapsed peek) */}
      <div>
        <div style={{ fontSize: 10, letterSpacing: 1.4, color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 700, marginBottom: 6, padding: "0 2px", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 9 }}>▸</span><span>Missions</span>
        </div>
      </div>

      {/* SKILLS — expanded */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, padding: "0 2px" }}>
          <span style={{ color: "var(--ink-3)", fontSize: 9, lineHeight: 1 }}>▾</span>
          <span style={{ fontSize: 10, letterSpacing: 1.4, color: "var(--ink)", textTransform: "uppercase", fontWeight: 700 }}>Skills</span>
          <span title="add skill" style={{
            marginLeft: "auto", width: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--approve)", border: "1px solid var(--approve)", borderRadius: 3,
            fontSize: 11, fontWeight: 700, lineHeight: 1, cursor: "pointer"
          }}>＋</span>
        </div>

        {/* Categories sub-section */}
        <div style={{ display: "flex", flexDirection: "column", gap: 1, paddingLeft: 6 }}>
          <div style={{ fontSize: 9, color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: 0.5, padding: "2px 4px 4px" }}>by category</div>
          {cats.map(c => (
            <div key={c.id} style={{
              padding: "3px 8px", borderRadius: 3, fontSize: 11, cursor: "pointer",
              background: c.id === activeCat ? "var(--ink)" : "transparent",
              color: c.id === activeCat ? "var(--paper)" : "var(--ink-2)",
              fontWeight: c.id === activeCat ? 600 : 500,
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ flex: 1 }}>{c.id}</span>
              <span style={{ fontSize: 9, fontFamily: "var(--mono)", color: c.id === activeCat ? "var(--paper)" : "var(--ink-3)" }}>{c.count}</span>
            </div>
          ))}
        </div>

        {/* Frequently used */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 6, marginTop: 10 }}>
          <div style={{ fontSize: 9, color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: 0.5, padding: "2px 4px 4px", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 8 }}>▾</span><span>frequently used</span>
          </div>
          {frequent.map(id => {
            const s = SKILL(id);
            return (
              <div key={id} style={{ padding: "3px 8px", fontSize: 11, color: "var(--ink-2)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", borderRadius: 3 }}>
                <span style={{ width: 5, height: 5, borderRadius: 99, background: s.color }} />
                <span style={{ flex: 1, fontFamily: "var(--mono)", fontSize: 10 }}>{s.name}</span>
              </div>
            );
          })}
        </div>

        {/* Saved sets */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingLeft: 6, marginTop: 10 }}>
          <div style={{ fontSize: 9, color: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: 0.5, padding: "2px 4px 4px", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 8 }}>▾</span><span>saved sets · 3</span>
          </div>
          {SAVED_SETS.map(set => (
            <div key={set.id} style={{ padding: "3px 8px", fontSize: 11, color: "var(--ink-2)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", borderRadius: 3 }}>
              <span style={{ color: "var(--ink-3)" }}>▣</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{set.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Future: Skill community */}
      <div style={{ marginTop: "auto", paddingTop: 10, borderTop: "1px dashed var(--rule-soft)" }}>
        <div style={{
          padding: "6px 8px", borderRadius: 3,
          background: "transparent", border: "1px dashed var(--rule-soft)",
          fontSize: 11, color: "var(--ink-3)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span>🌐</span>
          <span style={{ flex: 1 }}>Skill community</span>
          <span style={{ fontSize: 8, fontFamily: "var(--mono)", color: "var(--ink-3)", background: "var(--paper-2)", padding: "1px 4px", borderRadius: 2 }}>soon</span>
        </div>
        <div style={{ fontSize: 9, color: "var(--ink-3)", padding: "4px 8px", lineHeight: 1.4, fontFamily: "var(--hand)", fontSize: 12 }}>
          browse & install skills shared by other teams
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 11 · Skills library — all skills in workspace, search + filter
function Skills_Library() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>11 · Skills · library</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="Skills · Library" pending={0} />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar_Skills activeCat="All" />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--paper-2)" }}>
            {/* Page head — search prominent, no middle rail anymore */}
            <div style={{ padding: "12px 18px", borderBottom: "1.5px solid var(--rule)", background: "var(--paper)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: "0 0 auto" }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>Skill library · All</div>
                <div style={{ fontSize: 11, color: "var(--ink-3)" }}>10 skills · 3 built-in · 4 yours · 3 from GitHub · used by 6 workers</div>
              </div>
              <div className="composer" style={{ padding: "8px 12px", flex: 1, maxWidth: 460, marginLeft: "auto" }}>
                <span style={{ fontSize: 12 }}>🔍 Search skills · or type a category like <span className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>frontend</span> / <span className="mono" style={{ fontSize: 11, color: "var(--ink-2)" }}>source:you</span></span>
              </div>
              <button className="btn" style={{ fontSize: 12, padding: "7px 14px", background: "var(--approve)", color: "var(--paper)", border: "1.5px solid var(--approve)", borderRadius: 4, fontWeight: 700 }}>＋ New skill</button>
            </div>

            <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
              {/* Grid takes the whole main area now */}
              <div className="wf-scroll" style={{ flex: 1, overflow: "auto", padding: 14 }}>
                {/* Active filters + sort strip — resolved state from sidebar/search */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 0.6, textTransform: "uppercase", fontWeight: 700 }}>Showing</span>
                  <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 99, background: "var(--ink)", color: "var(--paper)", fontWeight: 600 }}>All categories</span>
                  <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 99, background: "var(--paper)", border: "1px solid var(--rule-soft)", color: "var(--ink-2)" }}>any source</span>

                  <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 0.6, textTransform: "uppercase", fontWeight: 700 }}>Sort</span>
                    <span style={{ display: "inline-flex", border: "1.5px solid var(--rule)", borderRadius: 4, overflow: "hidden" }}>
                      <SortChip label="Most used" active />
                      <SortChip label="Newest" />
                      <SortChip label="By role" />
                    </span>
                    <span style={{ fontSize: 11, color: "var(--ink-3)" }}>· 10 results</span>
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                  {SKILL_LIB.map((s) => <LibrarySkillCard key={s.id} skill={s} />)}
                </div>
              </div>

              {/* Right rail — Saved sets · compose (functional, not annotation) */}
              <div style={{ flex: "0 0 240px", borderLeft: "1.5px solid var(--rule)", background: "var(--paper)", display: "flex", flexDirection: "column", minHeight: 0 }}>
                <div style={{ padding: "12px 14px", borderBottom: "1.5px solid var(--rule)", background: "var(--paper-2)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>Saved sets</span>
                    <span style={{ fontSize: 10, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>· {SAVED_SETS.length}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.4 }}>
                    Reusable skill combos. Apply to any worker in one click.
                  </div>
                </div>

                {/* Primary CTA — the missing "compose" entry */}
                <div style={{ padding: "10px 14px", borderBottom: "1px dashed var(--rule-soft)" }}>
                  <button className="btn" style={{
                    width: "100%", fontSize: 12, padding: "8px 12px", borderRadius: 4,
                    background: "var(--pm)", color: "var(--paper)", border: "1.5px solid var(--pm)",
                    fontWeight: 700, display: "flex", alignItems: "center", gap: 6, justifyContent: "center"
                  }}>
                    <span style={{ fontSize: 14 }}>⊞</span>
                    <span>Compose a new set</span>
                  </button>
                  <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 4, textAlign: "center", fontFamily: "var(--hand)", fontSize: 13 }}>
                    pick 4-6 skills → save as a loadout
                  </div>
                </div>

                {/* List of saved sets, each actionable */}
                <div className="wf-scroll" style={{ flex: 1, overflow: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  {SAVED_SETS.map((set) => (
                    <div key={set.id} className="box-soft" style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6, background: "var(--paper-2)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <strong style={{ fontSize: 12, flex: 1 }}>{set.label}</strong>
                        <span style={{ fontSize: 9, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>by {set.owner}</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {set.skills.map((id) => (
                          <span key={id} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 2, background: SKILL(id).color + "20", color: SKILL(id).color, fontFamily: "var(--mono)", fontWeight: 600 }}>{SKILL(id).name}</span>
                        ))}
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                        <button className="btn" style={{ flex: 1, fontSize: 10, padding: "3px 6px", borderRadius: 3, background: "var(--paper)", color: "var(--pm)", border: "1px solid var(--pm)", fontWeight: 600 }}>Apply to worker…</button>
                        <button className="btn" style={{ fontSize: 10, padding: "3px 6px", borderRadius: 3, background: "var(--paper)", color: "var(--ink-2)", border: "1px solid var(--rule-soft)" }}>✎</button>
                        <button className="btn" style={{ fontSize: 10, padding: "3px 6px", borderRadius: 3, background: "var(--paper)", color: "var(--ink-3)", border: "1px solid var(--rule-soft)" }} title="duplicate">⎘</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <BottomBar extra="skills · 10 in library · 6 workers equipped" />
      </div>
    </div>
  );
}

function SortChip({ label, active }) {
  return (
    <span style={{
      padding: "4px 10px", fontSize: 11, fontWeight: active ? 700 : 500, cursor: "pointer",
      background: active ? "var(--ink)" : "var(--paper)",
      color: active ? "var(--paper)" : "var(--ink-2)",
      borderRight: "1px solid var(--rule)",
    }}>{label}</span>
  );
}

function SourceFilter({ label, count, active }) {
  return (
    <div style={{
      padding: "4px 8px", borderRadius: 3, fontSize: 11, fontFamily: "var(--mono)",
      background: active ? "var(--pm-soft)" : "transparent",
      color: active ? "var(--pm)" : "var(--ink-2)",
      border: active ? "1px solid var(--pm)" : "1px solid transparent",
      display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
    }}>
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ fontSize: 9, color: "var(--ink-3)" }}>{count}</span>
    </div>
  );
}

function LibrarySkillCard({ skill }) {
  const sourceIcon = skill.source === "GitHub" ? "⌥" : skill.source === "you" ? "✎" : "■";
  return (
    <div className="box" style={{
      padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6,
      background: "var(--paper)", borderColor: skill.color + "80", cursor: "pointer", minHeight: 110,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: skill.color }} />
        <strong style={{ fontSize: 12, color: skill.color, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{skill.name}</strong>
        <span style={{ fontSize: 9, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>{sourceIcon} {skill.source}</span>
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-2)", lineHeight: 1.45, minHeight: 32 }}>{skill.desc}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: "auto", paddingTop: 4, borderTop: "1px dashed var(--rule-soft)" }}>
        <span style={{ fontSize: 9, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>{skill.cat}</span>
        <span style={{ marginLeft: "auto", fontSize: 9, color: "var(--ink-3)" }}>used by 3 workers</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 12 · Skill import / new — modal on dimmed library
function Skills_Import() {
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>12 · Skill · import / new</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="Skills · Library" pending={0} />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar active="skills" />
          <div style={{ flex: 1, position: "relative", background: "var(--paper-2)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "30px 20px", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 1 }} />
            <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 10, padding: 14, opacity: 0.4 }}>
              {SKILL_LIB.slice(0, 6).map((s) => <LibrarySkillCard key={s.id} skill={s} />)}
            </div>

            <div className="box" style={{
              position: "relative", zIndex: 2, width: 720, background: "var(--paper)",
              borderColor: "var(--rule)", borderRadius: 6, display: "flex", flexDirection: "column",
              boxShadow: "0 12px 32px rgba(0,0,0,0.18)", maxHeight: "100%",
            }}>
              <div style={{ padding: "12px 18px", borderBottom: "1.5px solid var(--rule)", background: "var(--paper-2)", display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>＋ New skill</span>
                <span style={{ fontSize: 11, color: "var(--ink-3)" }}>· lands in your library, usable by any worker</span>
                <span style={{ marginLeft: "auto", fontSize: 14, color: "var(--ink-3)", cursor: "pointer" }}>×</span>
              </div>

              <div style={{ padding: "10px 18px 0", display: "flex", gap: 4, borderBottom: "1.5px solid var(--rule)" }}>
                <ImportTab label="Upload .md" />
                <ImportTab label="GitHub link" active />
                <ImportTab label="Paste raw" />
              </div>

              <div style={{ padding: "14px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <Label>GitHub URL · single .md file or folder</Label>
                  <div className="composer" style={{ padding: "8px 10px", fontFamily: "var(--mono)" }}>
                    <span style={{ color: "var(--ink)" }}>github.com/team/skills/blob/main/owasp-checklist.md</span>
                    <span className="send" title="fetch">↓</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--approve)" }}>✓ fetched · 142 lines · last commit 2 weeks ago</div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <Label>Name <small style={{ color: "var(--ink-3)" }}>· what workers see when equipping</small></Label>
                    <FakeInput value="OWASP-checklist" />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <Label>Category</Label>
                    <FakeInput value="Backend ⌄" />
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <Label>Short description <small style={{ color: "var(--ink-3)" }}>· shown on card</small></Label>
                  <FakeInput value="Top 10 review · sanitization · rate limit · cors." />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <Label>Content preview <small style={{ color: "var(--ink-3)" }}>· injected into worker's system prompt</small></Label>
                  <div className="box-soft wf-scroll" style={{ padding: "10px 12px", background: "var(--paper-2)", maxHeight: 130, overflow: "auto", fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.55, color: "var(--ink-2)" }}>
                    # OWASP Top 10 — checklist<br />
                    <br />For every endpoint touched, verify:
                    <br />1. Input is sanitized (escape, parametrize SQL, validate types)
                    <br />2. AuthZ check matches resource owner
                    <br />3. Rate limit headers respected
                    <br />4. CORS origins explicit, not wildcard
                    <br />5. Secrets in env, not in code
                    <br />...
                  </div>
                </div>

                <div style={{ padding: "8px 10px", background: "var(--pm-soft)", border: "1px solid var(--pm)", borderRadius: 4, display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 11, color: "var(--pm)" }}>★ Equip immediately on:</span>
                  <select style={{ fontFamily: "var(--sans)", fontSize: 11, padding: "3px 6px", borderRadius: 3, border: "1px solid var(--pm)", background: "var(--paper)" }}>
                    <option>nobody (save to library only)</option>
                    <option>W2 · api-worker</option>
                    <option>all backend workers</option>
                  </select>
                </div>
              </div>

              <div style={{ padding: "10px 18px", borderTop: "1.5px solid var(--rule)", background: "var(--paper-2)", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "var(--ink-3)" }}>Source · GitHub · auto-resync on file change</span>
                <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button className="btn" style={{ fontSize: 11, padding: "6px 14px", borderRadius: 4, border: "1.5px solid var(--rule)", background: "var(--paper)" }}>Cancel</button>
                  <button className="btn" style={{ fontSize: 11, padding: "6px 14px", borderRadius: 4, border: "1.5px solid var(--approve)", background: "var(--approve)", color: "var(--paper)", fontWeight: 700 }}>Save to library</button>
                </span>
              </div>
            </div>

            <div style={{ position: "absolute", right: 14, top: 60, width: 150, display: "flex", flexDirection: "column", gap: 12, zIndex: 3 }}>
              <P2bNote color="var(--pm)" style={{ background: "var(--paper)", padding: "4px 6px", borderRadius: 3 }}>↖ 3 import modes<br />(.md / GitHub /<br />paste raw)</P2bNote>
              <P2bNote color="var(--ink-3)" style={{ background: "var(--paper)", padding: "4px 6px", borderRadius: 3 }}>↖ GitHub source<br />auto-resyncs on<br />upstream change</P2bNote>
              <P2bNote color="var(--approve)" style={{ background: "var(--paper)", padding: "4px 6px", borderRadius: 3 }}>↖ optionally equip<br />immediately, or<br />save to library</P2bNote>
            </div>
          </div>
        </div>
        <BottomBar extra="new skill · GitHub source · awaiting save" />
      </div>
    </div>
  );
}

function ImportTab({ label, active }) {
  return (
    <div style={{
      padding: "8px 14px",
      background: active ? "var(--paper)" : "transparent",
      border: active ? "1.5px solid var(--rule)" : "1.5px solid transparent",
      borderBottom: active ? "1.5px solid var(--paper)" : "1.5px solid transparent",
      marginBottom: -1.5, borderRadius: "4px 4px 0 0",
      fontSize: 12, fontWeight: active ? 600 : 500,
      color: active ? "var(--ink)" : "var(--ink-3)", cursor: "pointer",
    }}>{label}</div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 13a · Skill loadout — MODE A: editing a specific worker's loadout
//   Entry: Team → click worker → "edit loadout"
//   Shows: explicit save bar (HITL principle · changes don't affect worker until saved)
//          slot-capacity handling · apply-set preview
function Skills_Loadout() {
  const equipped = ["css-th", "a11y", "tdd", "perf", "conv-cmt", "rest"]; // 6 of 6 — at capacity
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>13a · Loadout · edit worker's skills</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="W1 · ui-worker · Loadout" pending={0} />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar_Skills />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--paper-2)" }}>

            {/* Mode-aware breadcrumb · clarifies the entry path */}
            <div style={{ borderBottom: "1.5px solid var(--rule)", background: "var(--paper-2)" }}>
              <div style={{ padding: "8px 16px 0", display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--ink-3)" }}>
                <span className="mono">Team</span>
                <span>›</span>
                <span className="mono">W1 · Dark Mode</span>
                <span>›</span>
                <span style={{ color: "var(--ink-2)", fontWeight: 600 }}>Loadout</span>
                <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10 }}>
                  <span style={{ fontFamily: "var(--hand)", fontSize: 13, color: "var(--ink-3)" }}>or:</span>
                  <span style={{ padding: "2px 8px", borderRadius: 99, background: "var(--paper)", border: "1px dashed var(--rule-soft)", color: "var(--ink-3)", cursor: "pointer" }}>Skills › Compose new set →</span>
                </span>
              </div>
              <div style={{ padding: "8px 16px 10px", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 99, background: "var(--pm)", color: "var(--paper)", fontWeight: 700, letterSpacing: 0.5 }}>MODE · WORKER LOADOUT</span>
                <span style={{ width: 10, height: 10, borderRadius: 99, background: "var(--w1)" }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>W1 · Dark Mode</div>
                  <div style={{ fontSize: 11, color: "var(--ink-3)" }}>ui-worker · ⎇ feat/dark-mode · ● running</div>
                </div>
                <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--ink-3)", maxWidth: 320, textAlign: "right", lineHeight: 1.4 }}>
                  Changes affect W1's next tool call. Save when ready · discard to revert.
                </span>
              </div>
            </div>

            <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 12, minHeight: 0, overflow: "hidden" }}>

              {/* Equipped slots — show 6/6 capacity case */}
              <div className="box" style={{ padding: "14px 16px", background: "var(--paper)", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)", letterSpacing: 0.4, textTransform: "uppercase" }}>Equipped</span>
                  <span style={{ fontSize: 11, color: "var(--ink-3)" }}>· drag to reorder · ✕ to unequip</span>
                  <span style={{
                    marginLeft: "auto", fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                    padding: "2px 8px", borderRadius: 99,
                    background: "var(--review-soft)", color: "var(--review)", border: "1px solid var(--review)",
                  }}>6 / 6 · at capacity</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
                  {equipped.map((id, i) => <SkillCard key={i} skill={SKILL(id)} equipped onRemove={() => {}} />)}
                </div>
                {/* Overflow warning */}
                <div style={{ padding: "6px 10px", background: "#fff3e6", border: "1px dashed var(--review)", borderRadius: 3, fontSize: 11, color: "var(--review)", display: "flex", alignItems: "center", gap: 8 }}>
                  <span>⚠</span>
                  <span style={{ flex: 1 }}>All slots full. Drop a skill before dragging another in — or <span style={{ textDecoration: "underline", cursor: "pointer", fontWeight: 600 }}>request +2 slots</span> (PM decision · advanced workers can carry more).</span>
                </div>
              </div>

              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 280px", gap: 14, minHeight: 0 }}>
                {/* Library */}
                <div className="box" style={{ padding: 0, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", background: "var(--paper)" }}>
                  <div style={{ padding: "8px 12px", borderBottom: "1.5px solid var(--rule)", background: "var(--paper-2)", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>Skill library</span>
                    <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>· drag onto a slot · swap with current</span>
                    <div className="composer" style={{ marginLeft: "auto", padding: "3px 8px", maxWidth: 180, fontSize: 11 }}>
                      <span style={{ fontSize: 11 }}>🔍 search</span>
                    </div>
                  </div>
                  <div className="wf-scroll" style={{ flex: 1, overflow: "auto", padding: 10, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 8, alignContent: "start" }}>
                    {SKILL_LIB.map((s) => <SkillCard key={s.id} skill={s} draggable />)}
                  </div>
                </div>

                {/* Saved sets — one shown in apply-preview state */}
                <div className="box" style={{ padding: 0, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", background: "var(--paper)" }}>
                  <div style={{ padding: "8px 12px", borderBottom: "1.5px solid var(--rule)", background: "var(--paper-2)", fontSize: 12, fontWeight: 600 }}>
                    Apply a saved set
                  </div>
                  <div className="wf-scroll" style={{ flex: 1, overflow: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>

                    {/* Apply-set PREVIEW state — shows the diff before user commits */}
                    <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6, background: "var(--pm-soft)", border: "1.5px solid var(--pm)", borderRadius: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <strong style={{ fontSize: 12, color: "var(--pm)", flex: 1 }}>{SAVED_SETS[0].label}</strong>
                        <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 99, background: "var(--pm)", color: "var(--paper)", fontWeight: 700, letterSpacing: 0.4 }}>PREVIEW</span>
                      </div>
                      <div style={{ fontSize: 10, color: "var(--ink-2)", display: "flex", flexDirection: "column", gap: 2, fontFamily: "var(--mono)" }}>
                        <div><span style={{ color: "var(--ink-3)" }}>keep ✓</span>  css-theming · a11y-audit · TDD-Expert</div>
                        <div><span style={{ color: "var(--approve)" }}>add  +</span>  perf-budget</div>
                        <div><span style={{ color: "var(--warn)" }}>drop ✕</span>  perf-budget · conv-cmt · REST-API</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                        <button className="btn" style={{ flex: 1, fontSize: 10, padding: "4px 6px", borderRadius: 3, background: "var(--pm)", color: "var(--paper)", border: "1.5px solid var(--pm)", fontWeight: 700 }}>Replace loadout</button>
                        <button className="btn" style={{ fontSize: 10, padding: "4px 6px", borderRadius: 3, background: "var(--paper)", color: "var(--pm)", border: "1px solid var(--pm)" }}>Merge</button>
                        <button className="btn" style={{ fontSize: 10, padding: "4px 6px", borderRadius: 3, background: "var(--paper)", color: "var(--ink-3)", border: "1px solid var(--rule-soft)" }}>✕</button>
                      </div>
                    </div>

                    {/* Other sets — not in preview */}
                    {SAVED_SETS.slice(1).map((set) => (
                      <div key={set.id} className="box-soft" style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6, background: "var(--paper-2)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <strong style={{ fontSize: 12, flex: 1 }}>{set.label}</strong>
                          <span style={{ fontSize: 9, color: "var(--ink-3)", fontFamily: "var(--mono)" }}>by {set.owner}</span>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {set.skills.map((id) => (
                            <span key={id} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 2, background: SKILL(id).color + "20", color: SKILL(id).color, fontFamily: "var(--mono)", fontWeight: 600 }}>{SKILL(id).name}</span>
                          ))}
                        </div>
                        <button className="btn" style={{ fontSize: 10, padding: "3px 6px", borderRadius: 3, background: "var(--paper)", color: "var(--pm)", border: "1px solid var(--pm)" }}>Preview apply →</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Save bar — pinned to bottom. No auto-save. */}
            <div style={{ borderTop: "1.5px solid var(--rule)", background: "var(--paper)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, color: "var(--review)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: "var(--review)" }} />
                <strong>2 unsaved changes</strong>
                <span style={{ color: "var(--ink-3)", fontFamily: "var(--mono)", fontSize: 10 }}>+ perf-budget · − a11y-audit</span>
              </span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button className="btn" style={{ fontSize: 11, padding: "6px 14px", borderRadius: 4, border: "1.5px solid var(--rule)", background: "var(--paper)", color: "var(--ink-2)" }}>↶ Discard changes</button>
                <button className="btn" style={{ fontSize: 12, padding: "6px 16px", borderRadius: 4, border: "1.5px solid var(--approve)", background: "var(--approve)", color: "var(--paper)", fontWeight: 700 }}>✓ Save · apply to W1</button>
              </span>
            </div>
          </div>
        </div>
        <BottomBar extra="loadout · W1 · 2 unsaved · capacity 6/6" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 13b · Compose new set — MODE B: building a reusable skill set, not bound to a worker
//   Entry: Skills library → "⊞ Compose a new set"
function Skills_ComposeSet() {
  const composed = ["rest", "sec", "tdd", null, null, null];
  return (
    <div className="wf" style={{ flexDirection: "row" }}>
      <VariantTag>13b · Compose new set</VariantTag>
      <MissionRail />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <TopBar title="Skills · Compose new set" pending={0} />
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          <Sidebar_Skills />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, background: "var(--paper-2)" }}>

            {/* Mode breadcrumb */}
            <div style={{ borderBottom: "1.5px solid var(--rule)", background: "var(--paper-2)" }}>
              <div style={{ padding: "8px 16px 0", display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--ink-3)" }}>
                <span className="mono">Skills</span>
                <span>›</span>
                <span style={{ color: "var(--ink-2)", fontWeight: 600 }}>Compose new set</span>
                <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10 }}>
                  <span style={{ fontFamily: "var(--hand)", fontSize: 13, color: "var(--ink-3)" }}>or:</span>
                  <span style={{ padding: "2px 8px", borderRadius: 99, background: "var(--paper)", border: "1px dashed var(--rule-soft)", color: "var(--ink-3)", cursor: "pointer" }}>Team › Worker › Loadout →</span>
                </span>
              </div>
              <div style={{ padding: "8px 16px 10px", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 99, background: "var(--review)", color: "var(--paper)", fontWeight: 700, letterSpacing: 0.5 }}>MODE · COMPOSE SET</span>
                <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 10, color: "var(--ink-3)" }}>Set name</span>
                  <div className="composer" style={{ padding: "4px 8px", maxWidth: 360, marginTop: 2 }}>
                    <span style={{ fontSize: 12, color: "var(--ink)" }}>Backend · v2 (rate-limited)</span>
                  </div>
                </div>
                <span style={{ fontSize: 10, color: "var(--ink-3)", maxWidth: 260, textAlign: "right", lineHeight: 1.4 }}>
                  Not bound to a worker. Save → appears in library, can be applied to any worker.
                </span>
              </div>
            </div>

            <div style={{ flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 12, minHeight: 0, overflow: "hidden" }}>

              {/* Compose slot row */}
              <div className="box" style={{ padding: "14px 16px", background: "var(--paper)", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-2)", letterSpacing: 0.4, textTransform: "uppercase" }}>Skills in this set</span>
                  <span style={{ fontSize: 11, color: "var(--ink-3)" }}>· min 1 · suggested 4-6 · max 8</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-2)" }}>3 of 6 picked</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
                  {composed.map((id, i) => id ? (
                    <SkillCard key={i} skill={SKILL(id)} equipped onRemove={() => {}} />
                  ) : (
                    <EmptySlot key={i}>slot {i + 1}</EmptySlot>
                  ))}
                </div>
              </div>

              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 280px", gap: 14, minHeight: 0 }}>
                {/* Library */}
                <div className="box" style={{ padding: 0, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", background: "var(--paper)" }}>
                  <div style={{ padding: "8px 12px", borderBottom: "1.5px solid var(--rule)", background: "var(--paper-2)", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    <span>Skill library</span>
                    <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>· drag in to build this set</span>
                    <div className="composer" style={{ marginLeft: "auto", padding: "3px 8px", maxWidth: 180, fontSize: 11 }}>
                      <span style={{ fontSize: 11 }}>🔍 search</span>
                    </div>
                  </div>
                  <div className="wf-scroll" style={{ flex: 1, overflow: "auto", padding: 10, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 8, alignContent: "start" }}>
                    {SKILL_LIB.map((s) => <SkillCard key={s.id} skill={s} draggable />)}
                  </div>
                </div>

                {/* Compose options */}
                <div className="box" style={{ padding: 0, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", background: "var(--paper)" }}>
                  <div style={{ padding: "8px 12px", borderBottom: "1.5px solid var(--rule)", background: "var(--paper-2)", fontSize: 12, fontWeight: 600 }}>
                    Set options
                  </div>
                  <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <Label>Description <small style={{ color: "var(--ink-3)" }}>· optional</small></Label>
                      <FakeInput value="Hardened backend stack · rate limits + sec audit" />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <Label>Save target</Label>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <ChoiceRow active label="Private · only you" hint="visible only in your library" />
                        <ChoiceRow label="Shared · this workspace" hint="other teammates can apply" />
                        <ChoiceRow label="Publish to Skill community" hint="future · global library" disabled />
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <Label>Optionally · seed onto a role preset</Label>
                      <div className="composer" style={{ padding: "5px 8px" }}>
                        <span style={{ fontSize: 11, color: "var(--ink)" }}>Backend (default for new Backend workers) ⌄</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Save bar */}
            <div style={{ borderTop: "1.5px solid var(--rule)", background: "var(--paper)", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, color: "var(--ink-3)" }}>Set is unsaved · 3 skills picked · pick at least 1 to save</span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button className="btn" style={{ fontSize: 11, padding: "6px 14px", borderRadius: 4, border: "1.5px solid var(--rule)", background: "var(--paper)", color: "var(--ink-2)" }}>Cancel</button>
                <button className="btn" style={{ fontSize: 12, padding: "6px 16px", borderRadius: 4, border: "1.5px solid var(--review)", background: "var(--review)", color: "var(--paper)", fontWeight: 700 }}>✓ Save set</button>
              </span>
            </div>
          </div>
        </div>
        <BottomBar extra="compose set · 3 skills · unsaved" />
      </div>
    </div>
  );
}

function ChoiceRow({ active, disabled, label, hint }) {
  return (
    <div style={{
      padding: "6px 8px", borderRadius: 3, cursor: disabled ? "not-allowed" : "pointer",
      background: active ? "var(--pm-soft)" : "var(--paper)",
      border: active ? "1.5px solid var(--pm)" : "1px solid var(--rule-soft)",
      display: "flex", flexDirection: "column", gap: 2,
      opacity: disabled ? 0.5 : 1,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          width: 12, height: 12, borderRadius: 99,
          background: active ? "var(--pm)" : "var(--paper)",
          border: `1.5px solid ${active ? "var(--pm)" : "var(--rule-soft)"}`,
          display: "inline-block", flex: "0 0 auto",
        }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: active ? "var(--pm)" : "var(--ink)" }}>{label}</span>
        {disabled && <span style={{ marginLeft: "auto", fontSize: 9, fontFamily: "var(--mono)", color: "var(--ink-3)" }}>soon</span>}
      </div>
      <span style={{ fontSize: 10, color: "var(--ink-3)", paddingLeft: 18 }}>{hint}</span>
    </div>
  );
}

Object.assign(window, { Skills_Library, Skills_Import, Skills_Loadout, Skills_ComposeSet, Sidebar_Skills, SourceFilter, SortChip, LibrarySkillCard, ImportTab, ChoiceRow });
