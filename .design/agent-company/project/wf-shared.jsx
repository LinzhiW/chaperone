// Shared wireframe primitives used by all variants.

const WF_DATA = {
  mission: "Add dark mode + JSON export + keyboard shortcuts to React TODO",
  workers: [
    { id: "W1", role: "ui-worker",   name: "Dark Mode",          branch: "feat/dark-mode",          color: "var(--w1)", status: "run",  pending: 1, commits: 4, files: 6, skills: ["css-theming","TDD-Expert"] },
    { id: "W2", role: "api-worker",  name: "JSON Export",        branch: "feat/json-export",        color: "var(--w2)", status: "wait", pending: 1, commits: 2, files: 3, skills: ["TDD-Expert"] },
    { id: "W3", role: "ui-worker",   name: "Keyboard Shortcuts", branch: "feat/keyboard-shortcuts", color: "var(--w3)", status: "run",  pending: 0, commits: 5, files: 4, skills: ["a11y-audit"] },
    { id: "W4", role: "qa-worker",   name: "Tests + CI",         branch: "feat/tests",              color: "var(--w4)", status: "idle", pending: 0, commits: 0, files: 0, skills: ["TDD-Expert","Cloud-Deploy"] },
  ],
};

// Top bar reused across variants
function TopBar({ pending = 2, branches = 4, cost = "$0.42", title }) {
  return (
    <div className="wf-topbar">
      <div className="mission">
        {title || "Mission · " + WF_DATA.mission}
        <span className="sub">· started 14:22</span>
      </div>
      <div className="spacer" />
      <div className="chip warn"><span className="dot" /><strong>{pending}</strong> awaiting approval</div>
      <div className="chip"><span className="dot" /><strong>{branches}</strong> branches</div>
      <div className="chip pm"><span className="dot" />gemini-1.5-pro · {cost}</div>
    </div>
  );
}

// Far-left Discord-style mission rail.
// Each circle = one mission/session (independent of "Sessions" inside the workspace).
function MissionRail({ active = "ac" }) {
  const missions = [
    { id: "ac",   label: "AC", color: "#5a6cff", title: "Agent Company (current)" },
    { id: "td",   label: "TD", color: "#c97a3a", title: "Todo refactor" },
    { id: "rg",   label: "RG", color: "#4a7c4a", title: "RAG playground" },
    { id: "py",   label: "py", color: "#a86970", title: "Python migration" },
  ];
  return (
    <div style={{
      width: 60,
      background: "#1a1816",
      borderRight: "1.5px solid var(--rule)",
      padding: "10px 0",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8,
      flex: "0 0 auto",
    }}>
      {missions.map(m => {
        const isActive = m.id === active;
        return (
          <div key={m.id} title={m.title} style={{position:"relative",width:44,height:44}}>
            {isActive && (
              <div style={{
                position:"absolute", left:-10, top:6, bottom:6, width:3,
                background:"var(--paper)", borderRadius:"0 3px 3px 0"
              }} />
            )}
            <div style={{
              width: 44, height: 44,
              borderRadius: isActive ? 12 : 22,
              background: m.color,
              color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 13,
              transition: "border-radius .15s",
              border: isActive ? "2px solid var(--paper)" : "none",
            }}>{m.label}</div>
          </div>
        );
      })}
      <div style={{
        width: 44, height: 44, borderRadius: 22,
        border: "1.5px dashed #6e8b54",
        color: "#6e8b54",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, fontWeight: 300,
      }} title="Start new mission">+</div>
      <div style={{flex:1}} />
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        color:"#6e6a60", display:"flex",alignItems:"center",justifyContent:"center",
        fontSize: 16,
      }} title="Settings">⚙</div>
    </div>
  );
}

// Compact left sidebar — new architecture:
// WORKSPACE · TEAM (PM at top + Departments) · MISSIONS · SKILLS
function Sidebar({ active = "pm" }) {
  const isActive = (k) => active === k;
  const head = (title, { addable, caret = true } = {}) => (
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,padding:"0 2px"}}>
      {caret && <span style={{color:"var(--ink-3)",fontSize:9,lineHeight:1}}>▾</span>}
      <span style={{fontSize:10,letterSpacing:1.4,color:"var(--ink-3)",textTransform:"uppercase",fontWeight:700}}>{title}</span>
      {addable && (
        <span title={`Add ${title.toLowerCase()}`} style={{
          marginLeft:"auto",width:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",
          color:"var(--approve)",border:"1px solid var(--approve)",borderRadius:3,
          fontSize:11,fontWeight:700,lineHeight:1,cursor:"pointer"
        }}>＋</span>
      )}
    </div>
  );
  const subhead = (title, addable) => (
    <div style={{display:"flex",alignItems:"center",gap:5,padding:"3px 4px 1px"}}>
      <span style={{color:"var(--ink-3)",fontSize:8,lineHeight:1}}>▾</span>
      <span style={{fontSize:12,fontWeight:600,color:"var(--ink-2)"}}>{title}</span>
      {addable && (
        <span title={`Add ${title.toLowerCase()}`} style={{
          marginLeft:"auto",width:14,height:14,display:"flex",alignItems:"center",justifyContent:"center",
          color:"var(--approve)",border:"1px solid var(--approve)",borderRadius:3,
          fontSize:10,fontWeight:700,lineHeight:1,cursor:"pointer"
        }}>＋</span>
      )}
    </div>
  );
  return (
    <div className="wf-side">
      {/* Workspace */}
      <div>
        <div style={{fontSize:10,letterSpacing:1.4,color:"var(--ink-3)",textTransform:"uppercase",fontWeight:700,marginBottom:6,padding:"0 2px"}}>Workspace</div>
        <div className="box" style={{padding:"6px 8px",display:"flex",alignItems:"center",gap:6,background:"var(--paper)"}}>
          <span style={{color:"var(--ink-3)",fontSize:11}}>📁</span>
          <span className="mono" style={{fontSize:11,flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>~/todo-app</span>
          <span style={{color:"var(--ink-3)",fontSize:11,cursor:"pointer"}}>⌄</span>
        </div>
        <div className="item mono" style={{color:"var(--ink-3)",marginTop:4}}>main · clean</div>
      </div>

      {/* TEAM (PM + Departments) */}
      <div>
        {head("Team", { addable: true })}
        <div className={`item${isActive("pm")?" active":""}`} style={{fontWeight:600,display:"flex",alignItems:"center",gap:6}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:"var(--pm)",display:"inline-block"}} />
          <span style={{flex:1}}>PM</span>
          <span title="chat with PM" style={{
            display:"inline-flex",alignItems:"center",justifyContent:"center",
            width:18,height:18,borderRadius:3,
            color:isActive("pm")?"var(--paper)":"var(--pm)",
            background:isActive("pm")?"var(--pm)":"var(--pm-soft)",
            fontSize:11,lineHeight:1
          }}>💬</span>
        </div>
        {subhead("Frontend Dept")}
        <div className="item" style={{paddingLeft:18,color:"var(--ink-3)"}}>— ui-worker</div>
        {subhead("Backend Dept")}
        <div className="item" style={{paddingLeft:18,color:"var(--ink-3)"}}>— api-worker</div>
      </div>

      {/* MISSIONS */}
      <div>
        {head("Missions", { addable: true })}
        <div className={`item${isActive("mission:dark-mode")?" active":""}`} style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{color:"var(--approve)"}}>●</span>
          <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>Dark mode mission</span>
          <span title="2 HITL approvals pending" style={{
            minWidth:16,height:16,padding:"0 4px",
            borderRadius:8,background:"var(--review)",color:"var(--paper)",
            fontSize:9,fontWeight:700,
            display:"inline-flex",alignItems:"center",justifyContent:"center",
            lineHeight:1
          }}>2</span>
        </div>
        <div className="item" style={{color:"var(--ink-3)"}}>◐ JSON parser refactor</div>
        <div className="item" style={{color:"var(--ink-3)",fontStyle:"italic",cursor:"pointer"}}>＋ new mission</div>
      </div>

      {/* SKILLS */}
      <div>
        {head("Skills", { addable: true })}
        <div className="item">✓ TDD-Expert</div>
        <div className="item">✓ a11y-audit</div>
        <div className="item">○ Cloud-Deploy</div>
      </div>
    </div>
  );
}

// Bottom status bar
function BottomBar({ extra }) {
  return (
    <div className="wf-bottom">
      <span><span className="ind" />backend: ok</span>
      <span>model: gemini-1.5-pro</span>
      <span>hitl: pending 2</span>
      <span>tokens: 14.2k in / 3.1k out</span>
      <span style={{marginLeft:"auto"}}>{extra || "⌘K · command palette"}</span>
    </div>
  );
}

// Generic HITL approval card (claude-code style)
function HitlCard({ tool = "run_shell", cmd = "npm install styled-components", compact = false }) {
  return (
    <div className="hitl">
      <div className="hitl-head">
        <span>⚠</span><span>Tool call awaiting approval</span>
        <span style={{marginLeft:"auto",color:"var(--ink-3)",fontWeight:400}}>{tool}</span>
      </div>
      <div className="hitl-cmd">{cmd}</div>
      {!compact && (
        <div className="hitl-actions">
          <button className="btn approve">Approve</button>
          <button className="btn reject">Reject</button>
          <span className="btn kbd">y / n</span>
        </div>
      )}
    </div>
  );
}

// Worker tile (compact, used in grids)
function WorkerTile({ w, focused = false, children }) {
  return (
    <div className="worker-tile" style={focused?{boxShadow:"0 0 0 3px var(--pm)"}:undefined}>
      <div className="wt-head">
        <span className="swatch" style={{background:w.color}} />
        <span className="wt-name">{w.id} · {w.name}</span>
        <span className="wt-branch">{w.branch}</span>
        <span className={`wt-status ${w.status}`}>
          {w.status === "run" && "● running"}
          {w.status === "wait" && "⏸ waiting"}
          {w.status === "idle" && "○ idle"}
        </span>
      </div>
      <div className="wt-body">
        {children}
      </div>
    </div>
  );
}

// Quick streaming snippets per worker
function StreamLines({ lines }) {
  return (
    <div className="stream">
      {lines.map((l, i) => (
        <div key={i}>
          <span className={l.kind || "agent"}>{l.text}</span>
        </div>
      ))}
    </div>
  );
}

// Stat chip strip used in dashboard rows
function StatStrip({ items }) {
  return (
    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
      {items.map((it, i) => (
        <div key={i} className="box-soft" style={{padding:"4px 8px",fontSize:11,display:"flex",gap:6,alignItems:"center"}}>
          <span style={{color:"var(--ink-3)"}}>{it.label}</span>
          <strong>{it.val}</strong>
        </div>
      ))}
    </div>
  );
}

// Decorative variant tag in corner
function VariantTag({ children }) {
  return <div className="variant-tag">{children}</div>;
}

Object.assign(window, {
  WF_DATA, TopBar, Sidebar, MissionRail, BottomBar, HitlCard, WorkerTile,
  StreamLines, StatStrip, VariantTag,
});
