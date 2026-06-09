// Phase 2 · Batch 2 — Skills system shared data + primitives.
// Used by skills library / skill import / loadout / recruit screens.

const SKILL_LIB = [
  { id: "tdd",      name: "TDD-Expert",          cat: "Testing",   source: "built-in", desc: "Write tests before code; refuse to merge red builds.",   color: "#4a7c4a" },
  { id: "a11y",     name: "a11y-audit",          cat: "Frontend",  source: "built-in", desc: "Run axe-core on touched components; flag violations.",  color: "#3b6aa8" },
  { id: "cloud",    name: "Cloud-Deploy",        cat: "DevOps",    source: "built-in", desc: "Vercel + GitHub Actions deploy on green main.",         color: "#8a6a3a" },
  { id: "css-th",   name: "css-theming",         cat: "Frontend",  source: "you",      desc: "CSS variables only. No styled-components.",              color: "#3b6aa8" },
  { id: "rest",     name: "REST-API-design",     cat: "Backend",   source: "GitHub",   desc: "OpenAPI 3 first; verbs, status codes, pagination.",     color: "#6b4e7f" },
  { id: "perf",     name: "perf-budget",         cat: "Frontend",  source: "you",      desc: "TTI < 2s · bundle < 200kb · lighthouse 95+.",           color: "#3b6aa8" },
  { id: "sec",      name: "OWASP-checklist",     cat: "Backend",   source: "GitHub",   desc: "Top 10 review · sanitization · rate limit · cors.",     color: "#6b4e7f" },
  { id: "conv-cmt", name: "Conventional-Commits",cat: "Workflow",  source: "built-in", desc: "feat: / fix: / chore: + scope. Imperative mood.",        color: "#5a5750" },
  { id: "rn",       name: "react-native-bridge", cat: "Mobile",    source: "you",      desc: "Wrap web components for RN. Share state via context.",  color: "#c98a5a" },
  { id: "playwr",   name: "playwright-e2e",      cat: "Testing",   source: "GitHub",   desc: "Run e2e on every PR · screenshot diff on failure.",     color: "#4a7c4a" },
];

const ROLE_PRESETS = [
  { id: "fe", role: "Frontend", dept: "Engineering", desc: "UI components, hooks, state management, styling.",     branchPrefix: "feat/ui-",   defaultSkills: ["css-th","a11y","tdd"], color: "var(--w1)" },
  { id: "be", role: "Backend",  dept: "Engineering", desc: "APIs, data models, business logic, persistence.",       branchPrefix: "feat/api-",  defaultSkills: ["rest","sec","tdd"],    color: "var(--w2)" },
  { id: "mo", role: "Mobile",   dept: "Engineering", desc: "iOS / Android / RN. Native bridges and platform glue.", branchPrefix: "feat/mob-",  defaultSkills: ["rn","tdd"],            color: "var(--w3)" },
  { id: "qa", role: "QA",       dept: "Engineering", desc: "Tests, CI, regression suites, coverage gates.",         branchPrefix: "feat/test-", defaultSkills: ["tdd","playwr"],        color: "var(--w4)" },
  { id: "do", role: "DevOps",   dept: "Engineering", desc: "Deploy, infra, monitoring, secrets, CI/CD.",            branchPrefix: "chore/ops-", defaultSkills: ["cloud","sec"],         color: "#5a5c66" },
  { id: "da", role: "Data",     dept: "Engineering", desc: "Analytics, instrumentation, ML, data pipelines.",       branchPrefix: "feat/data-", defaultSkills: ["tdd"],                 color: "#a86970" },
];

const SAVED_SETS = [
  { id: "fe-classic", label: "Frontend · classic",  skills: ["css-th","a11y","tdd","perf"],     owner: "you" },
  { id: "be-strict",  label: "Backend · strict",    skills: ["rest","sec","tdd","conv-cmt"],    owner: "you" },
  { id: "qa-full",    label: "QA · full coverage",  skills: ["tdd","playwr","conv-cmt"],        owner: "PM" },
];

const SKILL = (id) => SKILL_LIB.find((s) => s.id === id);

// Skill card — reusable in library / slot / preview
function SkillCard({ skill, equipped, draggable = true, onRemove, compact }) {
  if (!skill) return null;
  return (
    <div style={{
      position: "relative",
      border: `1.5px solid ${equipped ? skill.color : "var(--rule-soft)"}`,
      borderRadius: 4,
      background: equipped ? skill.color + "12" : "var(--paper)",
      padding: compact ? "5px 7px" : "8px 10px",
      display: "flex", flexDirection: "column", gap: compact ? 2 : 4,
      cursor: draggable ? "grab" : "default",
      minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {draggable && <span style={{ color: "var(--ink-3)", fontSize: 10 }}>⋮⋮</span>}
        <span style={{ fontSize: compact ? 10 : 11.5, fontWeight: 600, color: skill.color, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{skill.name}</span>
        {onRemove && <span onClick={onRemove} title="unequip" style={{ fontSize: 11, color: "var(--ink-3)", cursor: "pointer" }}>×</span>}
      </div>
      {!compact && <div style={{ fontSize: 10, color: "var(--ink-3)", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{skill.desc}</div>}
      {!compact && (
        <div style={{ display: "flex", gap: 4, fontSize: 9, color: "var(--ink-3)", marginTop: "auto" }}>
          <span style={{ fontFamily: "var(--mono)" }}>{skill.cat}</span><span>·</span>
          <span style={{ fontFamily: "var(--mono)" }}>{skill.source}</span>
        </div>
      )}
    </div>
  );
}

function EmptySlot({ children }) {
  return (
    <div style={{
      border: "1.5px dashed var(--rule-soft)", borderRadius: 4,
      background: "rgba(31,29,26,0.02)",
      padding: "8px 10px",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--ink-3)", fontSize: 11, fontFamily: "var(--hand)",
      minHeight: 60,
    }}>{children || "drop skill here"}</div>
  );
}

function Label({ children }) {
  return <span style={{ fontSize: 11, color: "var(--ink-2)", fontWeight: 600 }}>{children}</span>;
}

function FakeInput({ value }) {
  return (
    <div className="composer" style={{ padding: "7px 10px" }}>
      <span style={{ color: "var(--ink)" }}>{value}</span>
    </div>
  );
}

// Re-use the Note primitive from wf-phase2 if present, else define a fallback
// (phase2 file is loaded first in HTML so Note exists by the time this runs)
const P2bNote = (typeof Note !== "undefined") ? Note : function P2bNote({ children, color = "var(--pm)", style }) {
  return <div style={{ fontFamily: "var(--hand)", fontSize: 14, color, lineHeight: 1.15, ...style }}>{children}</div>;
};

Object.assign(window, { SKILL_LIB, ROLE_PRESETS, SAVED_SETS, SKILL, SkillCard, EmptySlot, Label, FakeInput, P2bNote });
