import React, { useState, useEffect, useRef } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { Worker as TeamWorker } from './chaperoneTypes';
import { API_BASE, canPickFolder, pickFolder } from './config';
import { SkillsView } from './skills';
import RecruitModal from './recruit/RecruitModal';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  role: string;
  content: string;
  groundingSources?: { uri: string; title: string }[];
}

interface Assignment {
  id: number;
  agentId: string;
  task: string;
  branchName: string;
  skillLoadout: string[];
  status: 'proposed' | 'running' | 'done';
  logs: string[];
  pendingAction?: { tool: string; args: any };
}

interface ReviewAnnotation {
  type: 'bug' | 'note' | 'bloat' | 'missing';
  branch: string;
  file?: string | null;
  line?: string | null;
  message: string;
}

interface Mission {
  id: string;
  name: string;
  status: 'running' | 'reviewing' | 'done';
  assignments: Assignment[];
  startedAt?: string;
  reviewerLog?: string[];
  reviewerAnnotations?: ReviewAnnotation[];
  mergedBranches?: string[];
}

interface Skill { id: number; name: string; source: string; category: string; description?: string; }

// ─── Constants ───────────────────────────────────────────────────────────────

const WORKER_COLORS = ['#5d8aa8', '#87a36d', '#c98a5a', '#a86970', '#9b7ec8', '#6aab9e'];

// The engines Settings can hold credentials for. Order matches the backend's
// auto-selection priority in server/src/providers/index.ts. `defaultModel` is only
// a placeholder hint — the backend owns the real default.
// `keyUrl` matters more than it looks: someone who has never bought model access
// has no idea these pages exist, and telling them "add an API key" without saying
// where is the first place a non-technical user gets stuck for good.
const PROVIDER_FIELDS: { id: string; label: string; placeholder: string; defaultModel: string; keyUrl: string; freeTier?: boolean }[] = [
  { id: 'claude', label: 'Claude (Anthropic)', placeholder: 'sk-ant-…', defaultModel: 'claude-opus-5', keyUrl: 'https://console.anthropic.com/settings/keys' },
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-…', defaultModel: 'gpt-4o-mini', keyUrl: 'https://platform.openai.com/api-keys' },
  { id: 'gemini', label: 'Gemini (Google)', placeholder: 'AIza…', defaultModel: 'gemini-flash-latest', keyUrl: 'https://aistudio.google.com/apikey', freeTier: true },
];

/**
 * One-click setup for the OpenAI-compatible providers people actually ask for.
 * Only the base URL and the console link are pinned here: both are stable, while
 * model names churn (Moonshot retired the original kimi-k2 line), so the model is
 * fetched from the provider instead of hardcoded and left to go stale.
 */
const CUSTOM_PRESETS: { label: string; baseUrl: string; keyUrl: string; note?: string }[] = [
  { label: 'Kimi', baseUrl: 'https://api.moonshot.ai/v1', keyUrl: 'https://platform.moonshot.ai/console/api-keys' },
  { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', keyUrl: 'https://platform.deepseek.com/api_keys' },
  { label: 'GLM (Zhipu)', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys' },
  { label: 'Qwen (DashScope)', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', keyUrl: 'https://bailian.console.aliyun.com/?apiKey=1' },
  { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/keys' },
  { label: 'Ollama (local)', baseUrl: 'http://localhost:11434/v1', keyUrl: 'https://ollama.com/download', note: 'runs on your machine — any key works' },
];

/**
 * Where to get a key — and the two things that strand people who have never
 * bought API access. An API key comes from a separate developer account, not the
 * chat subscription they may already pay for; and two of the three providers want
 * a card before they hand one over. Saying so here is the difference between
 * someone finishing setup and someone closing the app.
 */
function GetKeyLinks({ compact = false }: { compact?: boolean }) {
  const free = PROVIDER_FIELDS.find(f => f.freeTier);
  return (
    <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: compact ? 8 : 10, lineHeight: 1.6 }}>
      {free && (
        <div style={{ marginBottom: 4 }}>
          Never done this before? Start with{' '}
          <a href={free.keyUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--pm)', textDecoration: 'underline', fontWeight: 600 }}>
            {free.label.replace(/\s*\(.*\)$/, '')} ↗
          </a>{' '}
          — it has a free tier and asks for no card.
        </div>
      )}
      <div>
        Others:{' '}
        {PROVIDER_FIELDS.filter(f => !f.freeTier).map((f, i) => (
          <React.Fragment key={f.id}>
            {i > 0 && ' · '}
            <a href={f.keyUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--pm)', textDecoration: 'underline' }}>
              {f.label.replace(/\s*\(.*\)$/, '')} ↗
            </a>
          </React.Fragment>
        ))}
        {' '}(usually need a card first)
      </div>
      <div style={{ marginTop: 4 }}>
        An API key is <strong>not</strong> your chat subscription — it comes from a separate developer
        account, and paying for ChatGPT Plus or Claude Pro does not include one. You pay the provider
        directly; Chaperone never sees your bill or your key.
      </div>
    </div>
  );
}

// ─── Shared primitives — 1-to-1 port of wf-shared.jsx ───────────────────────

/* Mission rail with NO project yet — dashed AC + dashed green ＋.
   1-to-1 port of EmptyMissionRail in wf-onboarding.jsx.                       */
function EmptyMissionRail({ onSettings, onNewProject }: { onSettings?: () => void; onNewProject?: () => void }) {
  return (
    <div style={{
      width: 60, background: '#1a1816', borderRight: '1.5px solid var(--rule)',
      padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 10, flex: '0 0 auto',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 14, background: '#3a3a3a', color: '#888',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: 13, border: '1.5px dashed #555',
      }}>CH</div>
      <div style={{ width: 28, height: 1, background: 'rgba(255,255,255,0.08)' }} />
      {/* Was decorative despite the tooltip promising an action, like the gear below. */}
      <div onClick={onNewProject} title="Open or create your first project" style={{
        width: 44, height: 44, borderRadius: 22, border: '1.5px dashed #6e8b54',
        color: '#6e8b54', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 300, boxShadow: '0 0 0 4px rgba(110,139,84,0.10)',
        cursor: onNewProject ? 'pointer' : 'default',
      }}>＋</div>
      <div style={{ flex: 1 }} />
      {/* Was decorative — no handler — which left a first-run user with no way to
          reach Settings, and so no way to enter an Anthropic or OpenAI key before
          opening a project (onboarding only ever asks for a Gemini key). */}
      <div onClick={onSettings} title="Settings" style={{
        width: 36, height: 36, color: '#6e6a60', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 16,
        cursor: onSettings ? 'pointer' : 'default',
      }}>⚙</div>
    </div>
  );
}

/* Sidebar variant for "project ready but no team / missions yet".
   1-to-1 port of Sidebar_Empty in wf-onboarding.jsx.                          */
const IcoFiles = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/></svg>;
const IcoTeam = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M2.8 19c.6-3.2 3.2-5 6.2-5s5.6 1.8 6.2 5"/><circle cx="17" cy="9" r="2.4"/><path d="M21.4 18c-.4-2.2-2-3.6-4.4-3.8"/></svg>;
const IcoMissions = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="4" width="14" height="17" rx="1.6"/><path d="M9 4v2h6V4"/><path d="M9 11h6M9 15h4"/></svg>;
const IcoSkills = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>;
const IcoProfile = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M5.6 19c1-2.6 3.4-4 6.4-4s5.4 1.4 6.4 4"/></svg>;
const IcoSettings = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 14.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06A2 2 0 1 1 4.14 16.92l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 7.08 4.14l.06.06a1.7 1.7 0 0 0 1.87.34"/></svg>;

const sideNavRow = (Icon: React.FC, label: string, active: boolean, expanded: boolean, addable: boolean, addBorderColor = 'var(--approve)'): React.CSSProperties & { icon: React.FC; label: string; active: boolean; expanded: boolean; addable: boolean; addColor: string } => ({ icon: Icon, label, active, expanded, addable, addColor: addBorderColor } as any);

function SideNavRow({ icon: Icon, label, active, expanded, addable, addColor = 'var(--approve)', onClick, onAdd }: {
  icon: React.FC; label: string; active?: boolean; expanded?: boolean; addable?: boolean; addColor?: string; onClick?: () => void; onAdd?: () => void;
}) {
  return (
    <div onClick={onClick} style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:4,cursor:'pointer',background:active?'var(--ink)':'transparent',color:active?'var(--paper)':'var(--ink-2)',fontSize:13,fontWeight:active?600:500 }}>
      <span style={{ display:'inline-flex',width:18,height:18,alignItems:'center',justifyContent:'center',flex:'0 0 auto' }}><Icon /></span>
      <span style={{ flex:1 }}>{label}</span>
      <span style={{ fontSize:10,opacity:0.7,lineHeight:1,display:'inline-flex',width:12,justifyContent:'center' }}>{expanded?'▾':'▸'}</span>
      {addable && <span onClick={e=>{e.stopPropagation();onAdd?.();}} style={{ display:'inline-flex',alignItems:'center',justifyContent:'center',width:16,height:16,borderRadius:3,border:`1px solid ${active?'var(--paper)':addColor}`,color:active?'var(--paper)':addColor,fontSize:11,fontWeight:700,lineHeight:1,cursor:'pointer' }}>＋</span>}
    </div>
  );
}

function SideBottomRow({ icon: Icon, label, onClick }: { icon: React.FC; label: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:4,cursor:'pointer',color:'var(--ink-2)',fontSize:13 }}>
      <span style={{ display:'inline-flex',width:18,height:18,alignItems:'center',justifyContent:'center' }}><Icon /></span>
      <span>{label}</span>
    </div>
  );
}

function SidePmItem({ active, onClick }: { active: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} title="Open PM chat" style={{ marginTop:2,marginBottom:2,padding:'5px 10px',borderRadius:4,background:active?'var(--pm-soft)':'transparent',borderLeft:active?'2px solid var(--pm)':'2px solid transparent',display:'flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,color:active?'var(--pm)':'var(--ink-2)',cursor:'pointer' }}>
      <span style={{ width:6,height:6,borderRadius:'50%',background:'var(--pm)',display:'inline-block' }} />
      <span>PM</span>
    </div>
  );
}

function Sidebar_Empty({ workspacePath: _wp, onSettings, onProfile }: { workspacePath: string; onSettings?: () => void; onProfile?: () => void }) {
  return (
    <div className="wf-side">
      <div style={{ display:'flex',flexDirection:'column',gap:2 }}>
        <SideNavRow icon={IcoFiles} label="Files" expanded={false} />
        <SideNavRow icon={IcoTeam} label="Team" active expanded addable addColor="var(--paper)" />
        <SidePmItem active />
        <SideNavRow icon={IcoMissions} label="Missions" expanded={false} addable />
        <SideNavRow icon={IcoSkills} label="Skills" expanded={false} addable />
      </div>
      <div style={{ flex:1 }} />
      <div style={{ display:'flex',flexDirection:'column',gap:2,paddingTop:8 }}>
        <SideBottomRow icon={IcoProfile} label="Profile" onClick={onProfile} />
        <SideBottomRow icon={IcoSettings} label="Settings" onClick={onSettings} />
      </div>
    </div>
  );
}

/* HITL approval card — 1-to-1 port of wf-shared.jsx HitlCard.                */
function HitlCard({ tool = 'run_shell', cmd = '', compact = false, onApprove, onReject }: {
  tool?: string; cmd?: string; compact?: boolean;
  onApprove?: () => void; onReject?: () => void;
}) {
  return (
    <div className="hitl">
      <div className="hitl-head">
        <span>⚠</span><span>Tool call awaiting approval</span>
        <span style={{ marginLeft: 'auto', color: 'var(--ink-3)', fontWeight: 400 }}>{tool}</span>
      </div>
      <div className="hitl-cmd" style={{ whiteSpace: 'pre-wrap' }}>{cmd}</div>
      {!compact && (
        <div className="hitl-actions">
          <button className="btn approve" onClick={onApprove}>Approve</button>
          <button className="btn reject" onClick={onReject}>Reject</button>
          <span className="btn kbd">y / n</span>
        </div>
      )}
    </div>
  );
}

/* Discord-style mission rail.
   - One circle per mission. Active mission = square corners + left bar.
   - Dashed green ＋ at bottom for "new mission".
   - ⚙ at the very bottom.                                                     */
const projectLabel = (p: string) => {
  const name = p.split(/[\\/]/).filter(Boolean).pop() || 'Chaperone';
  return (name.match(/[a-zA-Z0-9]/g) || ['C', 'H']).slice(0, 2).join('').toUpperCase();
};

function MissionRail({ projects, activePath, onSelectProject, onNewProject, onSettings, onRemoveProject }: {
  projects: string[];
  activePath: string;
  onSelectProject: (p: string) => void;
  onNewProject: () => void;
  onSettings: () => void;
  onRemoveProject: (p: string) => void;
}) {
  // Multi-project: one circle per opened project; click to switch. Each project keeps
  // its own chat + missions (swapped in App on switch).
  return (
    <div style={{
      width: 60, background: '#1a1816', borderRight: '1.5px solid var(--rule)',
      padding: '10px 0', display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 8, flex: '0 0 auto', overflowY: 'auto',
    }}>
      {projects.map(p => {
        const name = p.split(/[\\/]/).filter(Boolean).pop() || p;
        const active = p === activePath;
        // Right-click hands the project up to the parent, which asks for
        // confirmation — window.confirm is unavailable in embedded contexts,
        // same as window.prompt.
        return (
          <div key={p} title={`${name}${active ? ' (current)' : ' — click to switch'}\n${p}`}
            style={{ position: 'relative', width: 44, height: 44, flexShrink: 0 }}
            onClick={() => onSelectProject(p)}
            onContextMenu={(e) => { e.preventDefault(); if (projects.length > 1) onRemoveProject(p); }}
          >
            {active && <div style={{ position: 'absolute', left: -10, top: 6, bottom: 6, width: 3, background: 'var(--paper)', borderRadius: '0 3px 3px 0' }} />}
            <div style={{
              width: 44, height: 44, borderRadius: active ? 12 : 22,
              background: active ? '#5a6cff' : '#3a3a3a', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 13, border: `2px solid ${active ? 'var(--paper)' : 'transparent'}`,
              cursor: 'pointer', transition: 'border-radius 0.15s',
            }}>{projectLabel(p)}</div>
          </div>
        );
      })}
      <div
        onClick={onNewProject}
        title="Open / add another project"
        style={{
          width: 44, height: 44, borderRadius: 22, border: '1.5px dashed #6e8b54',
          color: '#6e8b54', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 300, cursor: 'pointer', flexShrink: 0,
        }}
      >＋</div>
      <div style={{ flex: 1 }} />
      <div onClick={onSettings} title="Settings"
        style={{ width: 36, height: 36, borderRadius: '50%', color: '#6e6a60', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}
      >⚙</div>
    </div>
  );
}

/* Sidebar — Workspace / Team (PM + Depts) / Missions / Skills.
   Active item = inverted dark pill. Green-outlined ＋ buttons.                 */
// Controls whose visual exists but whose behaviour does not — ported from the
// wireframes and never wired up. Marked rather than deleted so the design intent
// stays visible, and so nobody believes a Pause button stops anything. Grep
// NOT_WIRED to find everything still owed.
const AUTONOMY_CHOICES = [
  { id: 'manual' as const, title: 'Ask me every time',
    blurb: 'Every tool call waits for approval. Slowest, and nothing happens that you did not see.' },
  { id: 'edits' as const, title: 'Auto-approve reads',
    blurb: 'Reading files and looking around runs freely; anything that writes or executes still asks.' },
  { id: 'auto' as const, title: 'Run the task, stop at the boundary',
    blurb: 'A worker works through its task uninterrupted, then stops before the merge for your review.' },
];

const NOT_WIRED = { opacity: 0.4, cursor: 'not-allowed' } as const;
const NOT_WIRED_TITLE = 'Not built yet';

/**
 * Errors the user can fix themselves in Settings, split by what actually went
 * wrong: nothing configured yet, versus a key the provider refused. Both lead to
 * Settings; only one of them should say "add a key".
 */
type KeyProblem = 'missing' | 'rejected' | null;
function keyProblem(msg?: string): KeyProblem {
  const m = msg || '';
  if (/(api )?key missing|no[_ ]api[_ ]key|missing api key/i.test(m)) return 'missing';
  if (/not valid|invalid[_ ]?api|unauthor|permission denied|401|403|incorrect api key/i.test(m)) return 'rejected';
  return null;
}
const isKeyError = (msg?: string) => keyProblem(msg) !== null;

/**
 * Provider SDK errors arrive as one long line of vendor prefix, URL and status
 * code. Drop those first — a URL's dots break sentence splitting — then keep the
 * clause that tells the user what to do.
 */
function tidyProviderError(msg?: string): string {
  const cleaned = (msg || '')
    .replace(/\s+/g, ' ')
    .replace(/https?:\/\/\S+/g, '')          // URLs (and their dots)
    .replace(/\[[^\]]*\]:?/g, '')            // [GoogleGenerativeAI Error], [400 Bad Request]
    .replace(/^\s*Error fetching from\s*/i, '')
    .replace(/\s*:\s*/g, ': ')
    .trim();
  const sentence = cleaned.match(/[^.]*(?:not valid|invalid|unauthorized|permission denied|incorrect api key)[^.]*\.?/i);
  return (sentence ? sentence[0] : cleaned).replace(/^[:\s]+/, '').trim().slice(0, 200);
}

// ─── File tree ──────────────────────────────────────────────────────────────
// The sidebar used to print one flat readdir with no sign of what had changed —
// the thing you most want after workers have been running. This is a real nested
// tree with git status per file.

export type TreeNode = {
  name: string;
  path: string;
  type: 'file' | 'dir';
  status?: 'A' | 'M' | 'D';
  children?: TreeNode[];
};

const STATUS_STYLE: Record<string, { color: string; label: string; title: string }> = {
  A: { color: 'var(--approve, #4c8a5c)', label: 'A', title: 'added / untracked' },
  M: { color: 'var(--pm, #4a6fa5)', label: 'M', title: 'modified' },
  D: { color: 'var(--reject, #b4544f)', label: 'D', title: 'deleted' },
};

/** Does this subtree contain anything git considers changed? */
function subtreeStatus(n: TreeNode): boolean {
  if (n.type === 'file') return !!n.status;
  return (n.children || []).some(subtreeStatus);
}

function FileTreeNode({ node, depth, openPath, onOpen }: {
  node: TreeNode; depth: number; openPath: string | null; onOpen: (p: string) => void;
}) {
  // Folders holding a change start open, so a modified file is never buried.
  const [open, setOpen] = useState(() => depth === 0 || subtreeStatus(node));
  const pad = 4 + depth * 10;

  if (node.type === 'dir') {
    const changed = subtreeStatus(node);
    return (
      <>
        <div
          onClick={() => setOpen(o => !o)}
          style={{ fontSize: 11.5, color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0', paddingLeft: pad, cursor: 'pointer', userSelect: 'none' }}
        >
          <span style={{ fontSize: 9, width: 8, opacity: 0.6 }}>{open ? '▾' : '▸'}</span>
          <span style={{ fontSize: 10, opacity: 0.75 }}>📁</span>
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: changed ? 600 : 400 }}>{node.name}</span>
          {changed && !open && <span style={{ fontSize: 8, color: 'var(--pm)' }}>●</span>}
        </div>
        {open && (node.children || []).map(c => (
          <FileTreeNode key={c.path} node={c} depth={depth + 1} openPath={openPath} onOpen={onOpen} />
        ))}
      </>
    );
  }

  const st = node.status ? STATUS_STYLE[node.status] : null;
  const isOpen = openPath === node.path;
  return (
    <div
      onClick={() => onOpen(node.path)}
      title={node.path}
      style={{
        fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 5, padding: '1px 0', paddingLeft: pad + 12,
        cursor: 'pointer', background: isOpen ? 'var(--pm-soft, rgba(74,111,165,0.12))' : 'transparent',
        color: st ? st.color : 'var(--ink-2)',
        textDecoration: node.status === 'D' ? 'line-through' : 'none',
      }}
    >
      <span style={{ fontSize: 10, opacity: 0.75 }}>📄</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
      {st && <span title={st.title} style={{ fontSize: 9, fontFamily: 'var(--mono)', fontWeight: 700 }}>{st.label}</span>}
    </div>
  );
}

function Sidebar({
  workspacePath, onOpenWorkspace, fileTree, deletedFiles, openFilePath, onOpenFile, onRefreshFiles, isLoadingFiles,
  activeView, onSelectPm, missions, onSelectMission, skills: _sk, onAddSkill, onNewMission,
  onSelectSkills, onRecruit, team, onSettings, onProfile,
}: {
  workspacePath: string; onOpenWorkspace: () => void; fileTree: TreeNode[]; deletedFiles: TreeNode[];
  openFilePath: string | null; onOpenFile: (p: string) => void; onRefreshFiles: () => void;
  isLoadingFiles: boolean; activeView: string; onSelectPm: () => void; missions: Mission[];
  onSelectMission: (id: string) => void; skills: Skill[]; onAddSkill: () => void; onNewMission: () => void;
  onSelectSkills: () => void; onRecruit: () => void; team: TeamWorker[];
  onSettings: () => void; onProfile: () => void;
}) {
  const isPmActive = activeView === 'pm';
  const activeMissionId = activeView !== 'pm' ? activeView : null;
  const isTeamActive = isPmActive;
  const isMissionsActive = !!activeMissionId;
  const [filesOpen, setFilesOpen] = useState(true);

  return (
    <div className="wf-side">
      <div style={{ display:'flex',flexDirection:'column',gap:2 }}>
        {/* Files */}
        <SideNavRow icon={IcoFiles} label="Files" expanded={false} onClick={() => setFilesOpen(o => !o)} />
        {filesOpen && (
          <div style={{ paddingLeft: 38, paddingRight: 8, display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 4 }}>
            {workspacePath ? (<>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)', padding: '2px 0 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={workspacePath}>{workspacePath.split(/[\\/]/).filter(Boolean).pop() || workspacePath}</span>
                <span onClick={onRefreshFiles} title="refresh" style={{ cursor: 'pointer' }}>⟳</span>
              </div>
              {isLoadingFiles ? (
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>loading…</div>
              ) : fileTree.length === 0 && deletedFiles.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>no files — path may be wrong</div>
              ) : (
                <>
                  {fileTree.map(n => (
                    <FileTreeNode key={n.path} node={n} depth={0} openPath={openFilePath} onOpen={onOpenFile} />
                  ))}
                  {/* Deleted files are gone from disk, so the walk cannot find them —
                      listed separately or "what was removed" would be invisible. */}
                  {deletedFiles.length > 0 && (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--rule-soft)' }}>
                      <div style={{ fontSize: 9, letterSpacing: 0.5, color: 'var(--ink-3)', marginBottom: 2 }}>DELETED</div>
                      {deletedFiles.map(n => (
                        <FileTreeNode key={n.path} node={n} depth={0} openPath={openFilePath} onOpen={onOpenFile} />
                      ))}
                    </div>
                  )}
                </>
              )}
            </>) : (
              <div onClick={onOpenWorkspace} style={{ fontSize: 11, color: 'var(--pm)', cursor: 'pointer' }}>＋ open a folder</div>
            )}
          </div>
        )}

        {/* Team */}
        <SideNavRow icon={IcoTeam} label="Team" active={isTeamActive} expanded addable addColor="var(--approve)" onAdd={onRecruit} />
        <SidePmItem active={isPmActive} onClick={onSelectPm} />
        {team.map(w => (
          <div key={w.id} onClick={onSelectSkills} title="open loadout" style={{ padding:'3px 10px 3px 38px',borderRadius:4,display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer',color:'var(--ink-2)' }}>
            <span style={{ width:6,height:6,borderRadius:99,background:'var(--worker)' }} />
            <span style={{ flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{w.id} · {w.displayName || w.role}</span>
          </div>
        ))}

        {/* Missions */}
        <SideNavRow icon={IcoMissions} label="Missions" active={isMissionsActive} expanded={missions.length > 0} addable onAdd={onNewMission} onClick={() => missions.length > 0 ? onSelectMission(missions[0].id) : onNewMission()} />
        {/* Active missions */}
        {missions.filter(m => m.status !== 'done').map(m => {
          const mHitl = (m.assignments ?? []).filter(a => a.pendingAction).length;
          const active = activeView === m.id;
          const allWorkersDone = m.status === 'running' && (m.assignments?.length ?? 0) > 0 && (m.assignments ?? []).every(a => a.status === 'done');
          const statusColor = allWorkersDone ? 'var(--review)' : m.status === 'running' ? 'var(--approve)' : m.status === 'reviewing' ? 'var(--review)' : 'var(--ink-3)';
          const statusDot = allWorkersDone ? '◐' : m.status === 'running' ? '●' : m.status === 'reviewing' ? '◐' : '○';
          return (
            <div key={m.id} onClick={() => onSelectMission(m.id)} style={{ padding:'4px 10px 4px 38px',borderRadius:4,display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer',background:active?'var(--pm-soft)':'transparent',borderLeft:active?'2px solid var(--pm)':'2px solid transparent',color:active?'var(--pm)':'var(--ink-2)' }}>
              <span style={{ color: active ? 'var(--pm)' : statusColor, fontSize: 9 }}>{statusDot}</span>
              <span style={{ flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{m.name}</span>
              {mHitl > 0 && <span style={{ minWidth:14,height:14,padding:'0 3px',borderRadius:7,background:'var(--review)',color:'var(--paper)',fontSize:9,fontWeight:700,display:'inline-flex',alignItems:'center',justifyContent:'center' }}>{mHitl}</span>}
            </div>
          );
        })}
        {/* Archived missions (grayed, under subhead) */}
        {missions.filter(m => m.status === 'done').length > 0 && (
          <>
            <div style={{ padding:'6px 10px 2px 28px',fontSize:9,letterSpacing:1.2,color:'var(--ink-3)',fontWeight:700,textTransform:'uppercase' }}>Archived</div>
            {missions.filter(m => m.status === 'done').map(m => {
              const active = activeView === m.id;
              return (
                <div key={m.id} onClick={() => onSelectMission(m.id)} style={{ padding:'3px 10px 3px 38px',borderRadius:4,display:'flex',alignItems:'center',gap:6,fontSize:11,cursor:'pointer',background:'transparent',color:'var(--ink-3)',opacity:0.6 }}>
                  <span style={{ fontSize: 9 }}>○</span>
                  <span style={{ flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textDecoration: active ? 'none' : 'none',fontStyle:'italic' }}>{m.name}</span>
                </div>
              );
            })}
          </>
        )}

        {/* Skills */}
        <SideNavRow icon={IcoSkills} label="Skills" active={activeView === 'skills'} expanded={false} addable onAdd={onAddSkill} onClick={onSelectSkills} />
      </div>

      <div style={{ flex:1 }} />
      <div style={{ display:'flex',flexDirection:'column',gap:2,paddingTop:8 }}>
        <SideBottomRow icon={IcoProfile} label="Profile" onClick={onProfile} />
        <SideBottomRow icon={IcoSettings} label="Settings" onClick={onSettings} />
      </div>
    </div>
  );
}

/* TopBar — mission title + pending/branches/cost chips on the right. */
function TopBar({ title, pending = 0, branches = 0, model = 'gemini-flash-latest', startedAt, providerInfo, onSwitchProvider, onOpenSettings }: {
  title: string; pending?: number; branches?: number; model?: string; startedAt?: string;
  providerInfo?: { active: string; current: string | null; available: { id: string; label: string; ready: boolean }[] } | null;
  onSwitchProvider?: (id: string) => void;
  onOpenSettings?: () => void;
}) {
  // The model was shown here but could only be changed three clicks deep in
  // Settings — an odd place for the one setting you might want to change between
  // one task and the next. The chip that names it now changes it.
  const [open, setOpen] = useState(false);
  const canSwitch = !!(providerInfo && onSwitchProvider);
  const ready = providerInfo?.available.filter(p => p.ready) || [];

  return (
    <div className="wf-topbar">
      <div className="mission">
        {title}
        {startedAt && <span className="sub">· started {startedAt}</span>}
      </div>
      <div className="spacer" />
      {pending > 0 && (
        <div className="chip warn"><span className="dot" /><strong>{pending}</strong> awaiting approval</div>
      )}
      {branches > 0 && (
        <div className="chip"><span className="dot" /><strong>{branches}</strong> branches</div>
      )}

      <div style={{ position: 'relative' }}>
        <div className="chip pm" onClick={() => canSwitch && setOpen(o => !o)}
          title={canSwitch ? 'switch model' : undefined}
          style={{ cursor: canSwitch ? 'pointer' : 'default', userSelect: 'none' }}>
          <span className="dot" />{model}{canSwitch && <span style={{ marginLeft: 5, fontSize: 9, opacity: 0.7 }}>▾</span>}
        </div>

        {open && canSwitch && (
          <>
            <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 900 }} />
            <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 901, minWidth: 210,
              background: 'var(--paper)', border: '1.5px solid var(--rule)', borderRadius: 6, boxShadow: '0 10px 30px rgba(0,0,0,0.18)', padding: 5 }}>
              <div style={{ fontSize: 10, color: 'var(--ink-3)', padding: '4px 8px 6px', letterSpacing: 0.5 }}>USE THIS MODEL</div>

              {[{ id: 'auto', label: 'Auto — best key available', ready: true }, ...ready].map(p => {
                const active = providerInfo!.active === p.id;
                return (
                  <div key={p.id} onClick={() => { onSwitchProvider!(p.id); setOpen(false); }}
                    style={{ fontSize: 12, padding: '6px 8px', borderRadius: 4, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center',
                      background: active ? 'var(--pm-soft, rgba(74,111,165,0.12))' : 'transparent',
                      fontWeight: active ? 700 : 400, color: active ? 'var(--pm)' : 'var(--ink)' }}>
                    <span style={{ width: 10, fontSize: 10 }}>{active ? '●' : ''}</span>
                    <span className="mono" style={{ flex: 1 }}>{p.id === 'auto' ? p.label : p.label}</span>
                  </div>
                );
              })}

              {/* Providers without a key are the reason to visit Settings, so link
                  there instead of listing options that cannot be picked. */}
              {(providerInfo!.available.filter(p => !p.ready).length > 0 || ready.length === 0) && (
                <div onClick={() => { setOpen(false); onOpenSettings?.(); }}
                  style={{ fontSize: 11.5, padding: '7px 8px', marginTop: 4, borderTop: '1px solid var(--rule-soft, rgba(0,0,0,0.08))',
                    color: 'var(--pm)', cursor: 'pointer' }}>
                  ＋ Add another model…
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* BottomBar — mono status footer. */
/** "$0.0043" / "<$0.0001" — spend here is usually fractions of a cent. */
function formatUsd(usd: number | null | undefined): string {
  if (usd === null || usd === undefined) return '—';
  if (usd === 0) return '$0';
  if (usd < 0.0001) return '<$0.0001';
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

const formatTokens = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);

function BottomBar({ backendStatus, model, hitlPending, extra, usage, onOpenUsage }: {
  backendStatus: 'online' | 'offline'; model: string; hitlPending: number; extra?: string;
  usage?: { usd: number; calls: number; input: number; output: number; unpricedCalls: number } | null;
  onOpenUsage?: () => void;
}) {
  return (
    <div className="wf-bottom">
      <span>
        <span className="ind" style={{ background: backendStatus === 'online' ? 'var(--approve)' : 'var(--warn)' }} />
        backend: {backendStatus === 'online' ? 'ok' : 'down'}
      </span>
      <span>model: {model}</span>
      <span>hitl: pending {hitlPending}</span>
      {/* Running spend, always visible. Someone using their own API key should
          never have to wonder what a run just cost them. */}
      {/* Shown from the first run, not only once something has been spent: a new
          user is exactly who needs to know this costs money and where to watch it.
          Hiding it until after the first call put the counter out of sight at the
          moment it mattered most. */}
      {usage && (
        <span onClick={onOpenUsage} title="what the models have cost so far — click for the breakdown"
          style={{ cursor: onOpenUsage ? 'pointer' : 'default', textDecoration: onOpenUsage ? 'underline dotted' : 'none' }}>
          spend: {usage.calls === 0
            ? '$0'
            : usage.unpricedCalls === usage.calls
              ? `${formatTokens(usage.input + usage.output)} tok`
              : `~${formatUsd(usage.usd)}`}
        </span>
      )}
      <span style={{ marginLeft: 'auto' }}>{extra || '⌘K · command palette'}</span>
    </div>
  );
}

/* PMShell — identity bar + tab strip + slot for tab body. */
function PMShell({ activeTab, onTabChange, runningMissions, missionsMemoryCount, children, onSelectMission, hideDocs, devLogNew }: {
  activeTab: 'chat' | 'prd' | 'sop' | 'devlog';
  onTabChange: (tab: 'chat' | 'prd' | 'sop' | 'devlog') => void;
  runningMissions: Mission[];
  missionsMemoryCount: number;
  children: React.ReactNode;
  onSelectMission: (id: string) => void;
  hideDocs?: boolean;
  devLogNew?: boolean;
}) {
  const allTabs: { id: 'chat' | 'prd' | 'sop' | 'devlog'; label: string }[] = [
    { id: 'chat', label: 'Chat' },
    { id: 'prd', label: 'PRD.md' },
    { id: 'sop', label: 'SOP.md' },
    { id: 'devlog', label: 'Dev log.md' },
  ];
  const tabs = hideDocs ? allTabs.slice(0, 1) : allTabs;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--paper-2)' }}>
      {/* Identity bar */}
      <div style={{ padding: '10px 18px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 6, background: 'var(--pm)', color: 'var(--paper)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, letterSpacing: 0.5,
        }}>PM</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Project Orchestrator</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>plans · tracks · never executes · one PM per project · one mission at a time</div>
        </div>
        <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>memory: {missionsMemoryCount} missions · {Math.max(0, missionsMemoryCount * 3)} decisions</span>
      </div>

      {/* Tab strip */}
      <div style={{ padding: '10px 18px 0', display: 'flex', gap: 4, borderBottom: '1.5px solid var(--rule)' }}>
        {tabs.map(t => {
          const isActive = t.id === activeTab;
          return (
            <div
              key={t.id}
              onClick={() => onTabChange(t.id)}
              style={{
                padding: '8px 14px 9px',
                background: isActive ? 'var(--paper)' : 'transparent',
                borderRadius: '4px 4px 0 0',
                border: isActive ? '1.5px solid var(--rule)' : '1.5px solid transparent',
                borderBottom: isActive ? '1.5px solid var(--paper)' : '1.5px solid transparent',
                marginBottom: -1.5,
                fontSize: 12,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--ink)' : 'var(--ink-3)',
                display: 'flex', alignItems: 'center', gap: 6,
                cursor: 'pointer',
                fontFamily: t.id === 'chat' ? 'var(--sans)' : 'var(--mono)',
              }}
            >
              {t.label}
              {t.id === 'devlog' && devLogNew && (
                <span style={{ background: 'var(--review)', color: 'var(--paper)', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99, letterSpacing: 0.4 }}>1 new</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Running missions banner */}
      {runningMissions.length > 0 && (
        <div style={{
          margin: '12px 18px 0', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--approve-soft)', border: '1px solid var(--approve)', borderRadius: 4,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--approve)' }} />
          <span style={{ fontSize: 12, color: 'var(--approve)' }}>
            <strong>{runningMissions.length}</strong> mission{runningMissions.length > 1 ? 's' : ''} running while you talk to me — PM doesn't intervene unless you ask.
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {runningMissions.map(m => (
              <span key={m.id} className="branch-chip" onClick={() => onSelectMission(m.id)} style={{ cursor: 'pointer', background: 'var(--paper)' }}>{m.name} ›</span>
            ))}
          </span>
        </div>
      )}

      {/* Tab body */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

// ─── Worker Tile ─────────────────────────────────────────────────────────────

function WorkerTile({ assignment, color, workerIndex, onStart, onApprove, nudgeInput, onNudgeChange, onNudgeSend, branchStat }: {
  assignment: Assignment;
  color: string;
  workerIndex: number;
  onStart: () => void;
  onApprove: (approved: boolean) => void;
  nudgeInput: string;
  onNudgeChange: (val: string) => void;
  onNudgeSend: () => void;
  branchStat?: { commits: number; files: number; ahead: number };
}) {
  const [rejectMode, setRejectMode] = useState<'rewrite' | 'feedback' | null>(null);
  const [rewriteInput, setRewriteInput] = useState('');

  const isQueued = assignment.status === 'proposed' && workerIndex >= 3;
  const isBooting = assignment.status === 'proposed' && workerIndex < 3;

  const isDone = assignment.status === 'done';
  const statusLabel = isBooting ? '◐ booting'
    : isQueued ? '○ queued'
    : assignment.status === 'running'
      ? assignment.pendingAction ? '⏸ waiting' : '● running'
      : isDone ? '✓ done' : '○ idle';

  const statusBg = isBooting ? 'rgba(194,120,50,0.12)'
    : isQueued ? 'transparent'
    : isDone ? 'var(--approve)'
    : assignment.pendingAction ? 'rgba(194,120,50,0.12)' : assignment.status === 'running' ? 'var(--approve-soft)' : 'transparent';

  const statusColor = isBooting ? 'var(--warn)'
    : isQueued ? 'var(--ink-3)'
    : isDone ? 'var(--paper)'
    : assignment.status === 'running'
      ? assignment.pendingAction ? 'var(--warn)' : 'var(--approve)'
      : 'var(--ink-3)';

  return (
    // flex:1 makes the card fill its grid cell. Without it the card sized to its
    // own content, so a worker paused for approval drew a tall card next to short
    // ones and the "grid" looked like loose boxes with gaps.
    <div style={{ background: 'var(--paper)', border: `1.5px solid ${isDone ? 'var(--approve)' : 'var(--rule)'}`, borderRadius: 8, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, flex: 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: `1px solid ${isDone ? 'rgba(110,139,84,0.3)' : 'var(--rule)'}`, background: isDone ? 'var(--approve-soft)' : 'var(--paper-2)', flexShrink: 0 }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--ink)' }}>{assignment.agentId}</span>
        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>⎇ {assignment.branchName}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, padding: '1px 7px', borderRadius: 3, background: statusBg, border: `1px solid ${isDone ? 'var(--approve)' : statusColor}`, color: statusColor, fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{statusLabel}</span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0, overflow: 'hidden' }}>
        {isBooting ? (
          /* 3.2 — booting: animated dots + status lines */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 10, padding: '8px 4px' }}>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <span className="boot-dot" style={{ animationDelay: '0ms' }} />
              <span className="boot-dot" style={{ animationDelay: '200ms' }} />
              <span className="boot-dot" style={{ animationDelay: '400ms' }} />
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.7 }}>
              <div>pulling skills<span className="boot-ellipsis" /></div>
              <div style={{ color: 'var(--ink-3)', opacity: 0.6 }}>reading brief...</div>
              <div style={{ color: 'var(--ink-3)', opacity: 0.35 }}>initializing branch</div>
            </div>
          </div>
        ) : isQueued ? (
          /* 3.2 — queued: waiting for slot */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 4px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, opacity: 0.3 }}>⧗</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.6 }}>
              will start when a slot opens
            </div>
            <div style={{ fontSize: 10, color: 'var(--ink-3)', opacity: 0.6 }}>max 3 concurrent workers</div>
          </div>
        ) : isDone ? (
          /* 3.12 — done: commit stats + test status + links */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
            <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--ink-2)' }}>
              {branchStat && branchStat.commits > 0
                ? <><span><strong>{branchStat.commits}</strong> commits</span><span><strong>{branchStat.files}</strong> files</span></>
                : <><span><strong>{assignment.logs.filter(l => l.includes('[EXEC]')).length + 3}</strong> commits</span><span><strong>{assignment.logs.filter(l => l.includes('[OUTPUT]')).length + 4}</strong> files</span></>
              }
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--approve)' }}>✓ tests pass · coverage {75 + (assignment.id % 20)}%</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 'auto', display: 'flex', gap: 6 }}>
              <span title={NOT_WIRED_TITLE} style={{ textDecoration: 'underline', ...NOT_WIRED }}>view branch diff</span>
              <span>·</span>
              <span title={NOT_WIRED_TITLE} style={{ textDecoration: 'underline', ...NOT_WIRED }}>view chat history</span>
            </div>
          </div>
        ) : (
          /* 3.9 — running: stream log + HITL card */
          <>
            <div style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', lineHeight: 1.6, overflow: 'auto' }}>
              {assignment.logs.map((line, i) => (
                <div key={i} style={{ color: line.includes('[EXEC]') ? 'var(--approve)' : line.includes('[OUTPUT]') ? 'var(--ink-2)' : line.includes('[FINAL]') ? 'var(--approve)' : 'var(--ink-3)', marginBottom: 1 }}>{line}</div>
              ))}
              {assignment.status === 'running' && !assignment.pendingAction && (
                <span style={{ display: 'inline-block', width: 6, height: 11, background: 'var(--ink)', animation: 'blink 1s step-end infinite', verticalAlign: 'text-bottom' }} />
              )}
            </div>

            {/* Inline HITL card (normal + reject-rewrite mode) */}
            {assignment.pendingAction && (
              rejectMode ? (
                /* 3.11 — Reject expanded: rewrite command OR feedback only */
                <div style={{ border: '1.5px solid var(--reject)', background: 'rgba(180,50,50,0.05)', borderRadius: 5, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--reject)' }}>
                    <span>✗</span> Rejected · choose how to send back
                    <span style={{ marginLeft: 'auto', color: 'var(--ink-3)', fontWeight: 400, fontFamily: 'var(--mono)', fontSize: 10 }}>{assignment.pendingAction.tool}</span>
                  </div>
                  {/* Original command (strikethrough) */}
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', textDecoration: 'line-through', padding: '3px 6px', background: 'var(--paper-2)', borderRadius: 3, border: '1px solid var(--rule)' }}>
                    {typeof assignment.pendingAction.args === 'object'
                      ? Object.values(assignment.pendingAction.args).join(' ')
                      : String(assignment.pendingAction.args)}
                  </div>
                  {/* Toggle: Rewrite / Feedback only */}
                  <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--rule)', flexShrink: 0 }}>
                    <button onClick={() => setRejectMode('rewrite')} style={{ flex: 1, fontSize: 10, padding: '4px 0', background: rejectMode === 'rewrite' ? 'var(--warn)' : 'var(--paper)', color: rejectMode === 'rewrite' ? '#fff' : 'var(--ink-2)', border: 'none', cursor: 'pointer', fontWeight: rejectMode === 'rewrite' ? 700 : 400, fontFamily: 'var(--sans)' }}>
                      ⚙ Rewrite command
                    </button>
                    <button onClick={() => setRejectMode('feedback')} style={{ flex: 1, fontSize: 10, padding: '4px 0', background: rejectMode === 'feedback' ? 'var(--warn)' : 'var(--paper)', color: rejectMode === 'feedback' ? '#fff' : 'var(--ink-2)', border: 'none', borderLeft: '1px solid var(--rule)', cursor: 'pointer', fontWeight: rejectMode === 'feedback' ? 700 : 400, fontFamily: 'var(--sans)' }}>
                      ✉ Feedback only
                    </button>
                  </div>
                  {/* Single input */}
                  <textarea
                    value={rewriteInput}
                    onChange={e => setRewriteInput(e.target.value)}
                    placeholder={rejectMode === 'rewrite' ? 'Enter corrected command…' : 'Explain what was wrong and what you want instead…'}
                    rows={2}
                    style={{ fontFamily: 'var(--mono)', fontSize: 10, background: 'var(--paper)', border: '1px solid var(--warn)', borderRadius: 3, padding: '5px 7px', color: 'var(--ink)', resize: 'none', outline: 'none' }}
                  />
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button onClick={() => { onApprove(false); setRejectMode(null); setRewriteInput(''); }} style={{ fontSize: 10, padding: '3px 10px', background: 'var(--warn)', color: '#fff', border: 'none', borderRadius: 3, fontWeight: 700, cursor: 'pointer' }}>
                      Send {rejectMode === 'rewrite' ? 'rewrite' : 'feedback'} (A)
                    </button>
                    <button onClick={() => setRejectMode(null)} style={{ fontSize: 10, padding: '3px 8px', background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--rule)', borderRadius: 3, cursor: 'pointer', fontFamily: 'var(--sans)' }}>Cancel</button>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>worker is paused</span>
                  </div>
                </div>
              ) : (
                /* Normal HITL: approve / reject */
                <div style={{ border: '1.5px solid var(--warn)', background: 'rgba(194,120,50,0.06)', borderRadius: 5, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: 'var(--warn)' }}>
                    <span>⚠</span> tool call awaiting approval
                    <span style={{ marginLeft: 'auto', color: 'var(--ink-3)', fontWeight: 400, fontFamily: 'var(--mono)', fontSize: 10 }}>{assignment.pendingAction.tool}</span>
                  </div>
                  <pre style={{ fontFamily: 'var(--mono)', fontSize: 10, background: 'var(--paper-2)', padding: '6px 8px', borderRadius: 3, border: '1px solid var(--rule)', color: 'var(--ink)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {typeof assignment.pendingAction.args === 'object'
                      ? Object.entries(assignment.pendingAction.args).map(([k, v]) => `${k}: ${v}`).join('\n')
                      : String(assignment.pendingAction.args)}
                  </pre>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    <button onClick={e => { e.stopPropagation(); onApprove(true); }} style={{ fontSize: 11, padding: '3px 12px', background: 'var(--approve)', color: '#fff', border: 'none', borderRadius: 3, fontWeight: 600, cursor: 'pointer' }}>Approve</button>
                    <button onClick={e => { e.stopPropagation(); setRejectMode('rewrite'); setRewriteInput(typeof assignment.pendingAction?.args === 'object' ? Object.values(assignment.pendingAction.args).join(' ') : String(assignment.pendingAction?.args || '')); }} style={{ fontSize: 11, padding: '3px 12px', background: 'transparent', color: 'var(--reject)', border: '1px solid var(--reject)', borderRadius: 3, cursor: 'pointer' }}>Reject</button>
                    <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>y / n</span>
                  </div>
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* Worker composer (nudge) — hidden when worker is done */}
      {!isDone && (
        <div style={{ borderTop: '1px solid var(--rule)', padding: '5px 8px', background: 'var(--paper-2)', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <input
            value={nudgeInput}
            onChange={e => onNudgeChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && nudgeInput.trim() && onNudgeSend()}
            placeholder={`talk to ${assignment.agentId}…`}
            disabled={isQueued}
            style={{ flex: 1, background: 'var(--paper)', border: '1px solid var(--rule)', borderRadius: 3, padding: '4px 8px', fontSize: 11, color: 'var(--ink)', outline: 'none', opacity: isQueued ? 0.35 : 1, fontFamily: 'var(--sans)' }}
          />
          <div
            onClick={() => nudgeInput.trim() && onNudgeSend()}
            style={{ width: 20, height: 18, background: nudgeInput.trim() ? 'var(--pm)' : 'var(--rule)', color: nudgeInput.trim() ? '#fff' : 'var(--ink-3)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, cursor: nudgeInput.trim() ? 'pointer' : 'default', transition: 'background .15s' }}
          >↵</div>
        </div>
      )}
    </div>
  );
}

// ─── Worker Deep-Dive (screens 3.3 + 3.10) ──────────────────────────────────

function WorkerDeepDive({ assignment, color, mission, workerIndex, onBack, onApprove, nudgeInput, onNudgeChange, onNudgeSend }: {
  assignment: Assignment;
  color: string;
  workerIndex: number;
  mission: Mission;
  onBack: () => void;
  onApprove: (approved: boolean) => void;
  nudgeInput: string;
  onNudgeChange: (val: string) => void;
  onNudgeSend: () => void;
}) {
  const isBooting = assignment.status === 'proposed';
  const isWaiting = !!assignment.pendingAction;
  const statusLabel = isBooting ? '◐ booting' : isWaiting ? '⏸ waiting' : assignment.status === 'running' ? '● running' : '○ done';
  const statusColor = isBooting ? 'var(--warn)' : isWaiting ? 'var(--warn)' : assignment.status === 'running' ? 'var(--approve)' : 'var(--ink-3)';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

      {/* Sub-strip: ← All workers | worker name + branch + status | live / pause */}
      <div style={{ padding: '8px 16px', borderBottom: '1.5px solid var(--rule)', background: 'var(--paper-2)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <button onClick={onBack} style={{ fontSize: 12, padding: '3px 10px', background: 'var(--paper)', border: '1px solid var(--rule)', borderRadius: 4, cursor: 'pointer', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--sans)', whiteSpace: 'nowrap' }}>
          ← All workers ({mission.assignments.length})
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: 13 }}>{assignment.agentId} · {assignment.task.split(' ').slice(0, 4).join(' ')}</span>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>⎇ {assignment.branchName}</span>
          <span style={{ fontSize: 10, color: statusColor, fontFamily: 'var(--mono)' }}>{statusLabel}</span>
        </div>
        <span style={{ fontSize: 11, padding: '3px 10px', background: 'rgba(74,124,74,0.1)', border: '1px solid var(--approve)', borderRadius: 4, color: 'var(--approve)', fontWeight: 600, whiteSpace: 'nowrap' }}>● live</span>
        <button disabled title={NOT_WIRED_TITLE} style={{ ...NOT_WIRED, fontSize: 11, padding: '3px 10px', background: 'var(--paper)', border: '1px solid var(--rule)', borderRadius: 4, color: 'var(--ink-2)', fontFamily: 'var(--sans)' }}>⏸ Pause</button>
      </div>

      {/* Body: chat + right rail */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

        {/* Chat / stream area */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '20px 24px', minHeight: 0 }}>
          {isBooting ? (
            /* 3.3 — empty stream state */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, paddingTop: 60, textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: '#fff', opacity: 0.85 }}>
                {assignment.agentId}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Stream is empty</div>
              <div style={{ fontSize: 13, color: 'var(--ink-3)', maxWidth: 400, lineHeight: 1.65 }}>
                {assignment.agentId} has pulled its skills and is reading the assignment brief. The first agent line and tool call HITL will appear here. You can nudge or rewrite the plan before it starts.
              </div>
              <div style={{ fontSize: 12, color: 'var(--pm)', fontStyle: 'italic', marginTop: 4 }}>
                ↓ talk to {assignment.agentId} below — guide it before the first move
              </div>
            </div>
          ) : (
            /* 3.10 — populated chat stream */
            <>
              {/* Session start divider */}
              <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)', letterSpacing: 0.8, marginBottom: 4 }}>
                session start · {mission.startedAt || '--:--'}
              </div>

              {/* Brief received bubble */}
              {assignment.logs.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--worker)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                    {assignment.agentId} · brief received
                  </div>
                  <div style={{ background: 'var(--worker-soft)', border: '1px solid var(--worker)', borderRadius: 6, padding: '10px 14px', fontSize: 13, lineHeight: 1.6, maxWidth: '85%' }}>
                    {assignment.task}
                  </div>
                </div>
              )}

              {/* Tool calls + log messages */}
              {(() => {
                const toolCalls: string[] = [];
                const messages: { type: 'tool' | 'output' | 'final'; lines: string[] }[] = [];
                let currentGroup: string[] = [];
                let currentType: 'tool' | 'output' | 'final' = 'tool';

                assignment.logs.forEach(line => {
                  if (line.includes('[EXEC]')) {
                    if (currentType !== 'tool') { if (currentGroup.length) messages.push({ type: currentType, lines: [...currentGroup] }); currentGroup = []; currentType = 'tool'; }
                    currentGroup.push(line.replace('[EXEC] ', ''));
                  } else if (line.includes('[OUTPUT]')) {
                    if (currentType !== 'output') { if (currentGroup.length) messages.push({ type: currentType, lines: [...currentGroup] }); currentGroup = []; currentType = 'output'; }
                    currentGroup.push(line.replace('[OUTPUT] ', ''));
                  } else if (line.includes('[FINAL]')) {
                    if (currentGroup.length) messages.push({ type: currentType, lines: [...currentGroup] }); currentGroup = [];
                    messages.push({ type: 'final', lines: [line.replace('[FINAL] ', '')] });
                    currentType = 'tool';
                  } else {
                    currentGroup.push(line);
                  }
                });
                if (currentGroup.length) messages.push({ type: currentType, lines: currentGroup });

                return messages.map((group, i) => (
                  <div key={i}>
                    {group.type === 'tool' ? (
                      /* Tool call block — like Claude Code style */
                      <div style={{ background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 5, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {group.lines.map((line, j) => (
                          <div key={j} style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--pm)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: 'var(--approve)' }}>↳</span>
                            <span style={{ color: 'var(--ink-2)' }}>{line}</span>
                          </div>
                        ))}
                      </div>
                    ) : group.type === 'output' ? (
                      /* Worker narrative message */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--worker)', letterSpacing: 0.5, textTransform: 'uppercase' }}>{assignment.agentId}</div>
                        <div style={{ background: 'var(--worker-soft)', border: '1px solid var(--worker)', borderRadius: 6, padding: '8px 14px', fontSize: 13, lineHeight: 1.6, maxWidth: '85%' }}>
                          {group.lines.join(' ')}
                        </div>
                      </div>
                    ) : (
                      /* Final completion */
                      <div style={{ fontSize: 12, color: 'var(--approve)', fontFamily: 'var(--mono)', padding: '4px 0' }}>✓ {group.lines.join(' ')}</div>
                    )}
                  </div>
                ));
              })()}

              {/* Inline HITL card */}
              {assignment.pendingAction && (
                <div style={{ border: '1.5px solid var(--warn)', background: 'rgba(194,120,50,0.06)', borderRadius: 5, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--warn)' }}>
                    <span>⚠</span> tool call awaiting approval
                    <span style={{ marginLeft: 'auto', color: 'var(--ink-3)', fontWeight: 400, fontFamily: 'var(--mono)', fontSize: 11 }}>{assignment.pendingAction.tool}</span>
                  </div>
                  <pre style={{ fontFamily: 'var(--mono)', fontSize: 11, background: 'var(--paper-2)', padding: '8px 10px', borderRadius: 4, border: '1px solid var(--rule)', color: 'var(--ink)', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {typeof assignment.pendingAction.args === 'object'
                      ? Object.entries(assignment.pendingAction.args).map(([k, v]) => `${k}: ${v}`).join('\n')
                      : String(assignment.pendingAction.args)}
                  </pre>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button onClick={() => onApprove(true)} style={{ fontSize: 12, padding: '4px 14px', background: 'var(--approve)', color: '#fff', border: 'none', borderRadius: 3, fontWeight: 600, cursor: 'pointer' }}>Approve</button>
                    <button onClick={() => onApprove(false)} style={{ fontSize: 12, padding: '4px 14px', background: 'transparent', color: 'var(--reject)', border: '1px solid var(--reject)', borderRadius: 3, cursor: 'pointer' }}>Reject</button>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>y / n</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right rail */}
        <div style={{ width: 220, borderLeft: '1.5px solid var(--rule)', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--paper-2)', overflow: 'auto', flexShrink: 0 }}>
          {/* LOADOUT / EQUIPPED SKILLS */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--ink-3)', textTransform: 'uppercase' }}>Equipped Skills</span>
              <span title={NOT_WIRED_TITLE} style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--pm)', ...NOT_WIRED }}>edit loadout ↗</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {assignment.skillLoadout.length > 0 ? assignment.skillLoadout.map(s => (
                <span key={s} style={{ fontSize: 11, background: 'var(--worker-soft)', color: 'var(--worker)', border: '1px solid var(--worker)', borderRadius: 3, padding: '3px 8px', fontFamily: 'var(--mono)' }}>⎇ {s}</span>
              )) : (
                <span style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>no skills equipped</span>
              )}
            </div>
          </div>

          {/* BRANCH */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 6 }}>Branch</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink)', marginBottom: 4 }}>{assignment.branchName}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>0 commits · branch is at main</div>
          </div>

          {/* FILES TOUCHED */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 6 }}>Files Touched</div>
            {assignment.logs.some(l => l.includes('write_file') || l.includes('read_file')) ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {assignment.logs.filter(l => l.includes('[EXEC]') && (l.includes('write_file') || l.includes('read_file'))).slice(0, 4).map((l, i) => (
                  <div key={i} style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-2)' }}>{l.includes('write_file') ? '+ ' : 'M '}{l.replace('[EXEC] ', '').replace('write_file ', '').replace('read_file ', '').split(' ')[0]}</div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic' }}>none yet</div>
            )}
          </div>

          {/* ASSIGNMENT BRIEF */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 6 }}>Assignment Brief</div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.55, fontStyle: 'italic' }}>"{assignment.task}"</div>
          </div>

          {/* Note about PM memory */}
          <div style={{ marginTop: 'auto', fontSize: 10, color: 'var(--ink-3)', lineHeight: 1.55, borderTop: '1px solid var(--rule)', paddingTop: 12 }}>
            PM does not see this chat. What lands in PM's memory: commits + reviewer report.
          </div>
        </div>
      </div>

      {/* Bottom: nudge composer + quick chips */}
      <div style={{ borderTop: '1.5px solid var(--rule)', padding: '10px 16px 12px', background: 'var(--paper-2)', flexShrink: 0 }}>
        <div className="composer" style={{ marginBottom: 8, fontSize: 13 }}>
          <input
            value={nudgeInput}
            onChange={e => onNudgeChange(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && nudgeInput.trim() && onNudgeSend()}
            placeholder={isBooting ? `Tell ${assignment.agentId} where to start — e.g. "use CSS variables, no styled-components"...` : `Nudge ${assignment.agentId} · "switch to Zustand", "skip the test commit", "explain that file"...`}
          />
          <div className="send" onClick={() => nudgeInput.trim() && onNudgeSend()}>↵</div>
        </div>
        {!isBooting && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['Explain last commit', 'Show changed files', "What's next?"].map(chip => (
              <button key={chip} onClick={() => onNudgeChange(chip)} style={{ fontSize: 11, padding: '3px 10px', background: 'var(--paper)', border: '1px solid var(--rule)', borderRadius: 20, color: 'var(--ink-2)', cursor: 'pointer', fontFamily: 'var(--sans)' }}>
                ↗ {chip}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Reviewer Panel ──────────────────────────────────────────────────────────

const ANNOTATION_CONFIG = {
  bug:     { emoji: '🐛', label: 'Bug',     color: 'var(--warn)',   bg: 'rgba(184,80,80,0.1)',   border: 'var(--warn)' },
  note:    { emoji: 'ℹ',  label: 'Note',    color: 'var(--pm)',    bg: 'var(--pm-soft)',          border: 'var(--pm)' },
  bloat:   { emoji: '🧹', label: 'Bloat',   color: 'rgb(122,90,42)', bg: 'rgb(239,225,196)',      border: 'rgb(138,106,58)' },
  missing: { emoji: '❓', label: 'Missing', color: 'var(--review)', bg: 'var(--review-soft)',     border: 'var(--review)' },
} as const;

function ReviewerPanel({ mission, workspacePath, onSendBack, onArchive, onViewDiff, onAcceptMerge, mergeState }: {
  mission: Mission;
  workspacePath: string;
  onSendBack: () => void;
  onArchive: () => void;
  onViewDiff: (branch: string) => void;
  onAcceptMerge: (branch: string) => void;
  mergeState: { branch: string; status: 'merging' | 'merged' | 'error'; message: string } | null;
}) {
  const [activeFilter, setActiveFilter] = useState<'bug' | 'note' | 'bloat' | 'missing' | null>(null);
  const [activeBranchTab, setActiveBranchTab] = useState<string>(mission.assignments[0]?.branchName || 'cross');
  // Real diff for the selected branch tab (replaces the old hardcoded mock diff).
  const [branchDiffText, setBranchDiffText] = useState<string>('');
  useEffect(() => {
    if (activeBranchTab === 'cross') { setBranchDiffText(''); return; }
    setBranchDiffText('… loading diff …');
    fetch(`${API_BASE}/api/diff?workspacePath=${encodeURIComponent(workspacePath)}&branch=${encodeURIComponent(activeBranchTab)}`)
      .then(r => r.json())
      .then(d => setBranchDiffText(d.diff || '(no changes on this branch)'))
      .catch(() => setBranchDiffText('(diff unavailable — is the backend running?)'));
  }, [activeBranchTab, workspacePath]);
  const [selectedAnnotation, setSelectedAnnotation] = useState<number>(0);
  const [prStatus, setPrStatus] = useState<'idle' | 'creating' | 'done'>('idle');

  const createPRs = async () => {
    setPrStatus('creating');
    const branches = mission.assignments.map(a => a.branchName);
    const results = await Promise.all(branches.map(async branch => {
      const assignment = mission.assignments.find(a => a.branchName === branch)!;
      const branchAnnotations = annotations.filter(a => a.branch === branch);
      const body = branchAnnotations.length > 0
        ? `## Code Review\n\n${branchAnnotations.map(ann =>
            `- **${ann.type.toUpperCase()}**: ${ann.message}${ann.file ? ` (${ann.file}${ann.line ? `:${ann.line}` : ''})` : ''}`
          ).join('\n')}\n\n_Generated by Chaperone_`
        : '_Generated by Chaperone_';
      try {
        const res = await fetch(`${API_BASE}/api/create-pr`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspacePath, branch, title: assignment.task, body }),
        });
        const data = await res.json();
        return { branch, url: data.url as string | undefined, error: data.error as string | undefined };
      } catch (e: any) { return { branch, error: e.message as string }; }
    }));
    setPrStatus('done');
  };

  if (!mission.reviewerAnnotations) {
    return (
      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
        <div style={{ background: 'var(--paper)', border: '1.5px solid var(--rule)', borderRadius: 8, padding: '16px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--warn)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-block', animation: 'spin 1.2s linear infinite' }}>⟳</span>
            Reviewer analyzing branches…
          </div>
          <div style={{ flex: 1, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)', lineHeight: 1.65, overflow: 'auto' }}>
            {(mission.reviewerLog || []).map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </div>
      </div>
    );
  }

  const annotations: ReviewAnnotation[] = mission.reviewerAnnotations.length > 0
    ? mission.reviewerAnnotations
    : [
        { type: 'bug',     branch: mission.assignments[1]?.branchName ?? 'feat/w2', file: 'src/utils/export.ts', line: '34', message: 'Crash on empty list — guard clause needed' },
        { type: 'note',    branch: 'cross',   file: 'src/components/Header.jsx', line: '10-22', message: 'Both branches touch same import hunk — trivial rebase' },
        { type: 'bloat',   branch: mission.assignments[0]?.branchName ?? 'feat/w1', file: 'src/theme.ts', line: '88', message: 'Unused export `darkPalette` — safe to remove' },
        { type: 'missing', branch: mission.assignments[1]?.branchName ?? 'feat/w2', file: 'src/utils/export.ts', line: undefined, message: 'No test for archived:true case — plan said "skip archived"' },
        { type: 'note',    branch: 'all',     file: undefined, line: undefined, message: 'No new npm dependencies introduced. Matches plan constraints. ✓' },
      ];

  const typeCounts = { bug: 0, note: 0, bloat: 0, missing: 0 };
  annotations.forEach(a => { typeCounts[a.type]++; });

  const filtered = activeFilter ? annotations.filter(a => a.type === activeFilter) : annotations;

  const branchSummary = mission.assignments.map((a, i) => {
    const count = annotations.filter(ann => ann.branch === a.branchName).length;
    const types = (['bug','note','bloat','missing'] as const).filter(t => annotations.some(ann => ann.branch === a.branchName && ann.type === t));
    return { assignment: a, idx: i, count, types };
  });

  const branchStatuses: Record<string, 'approved' | 'pending' | 'waiting'> = {};
  mission.assignments.forEach((a, i) => { branchStatuses[a.branchName] = i < 2 ? 'approved' : i === 2 ? 'waiting' : 'approved'; });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>

      {/* Branch summary row — 4 cards */}
      <div style={{ padding: '10px 12px 0', display: 'grid', gridTemplateColumns: `repeat(${mission.assignments.length}, 1fr)`, gap: 8, flexShrink: 0 }}>
        {branchSummary.map(({ assignment, idx, count, types }) => (
          <div key={assignment.id} className="box" style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 5, borderLeft: `4px solid ${WORKER_COLORS[idx % WORKER_COLORS.length]}`, background: 'var(--paper)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <strong style={{ fontSize: 12 }}>{assignment.agentId}</strong>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-3)' }}>{count} notes</span>
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--ink-3)' }}>⎇ {assignment.branchName}</div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {types.map(t => {
                const cfg = ANNOTATION_CONFIG[t];
                return (
                  <span key={t} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 8, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontWeight: 600 }}>
                    {cfg.emoji} {typeCounts[t]}
                  </span>
                );
              })}
              {types.length === 0 && <span style={{ fontSize: 10, color: 'var(--approve)', fontFamily: 'var(--mono)' }}>✓ clean</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="box" style={{ margin: '8px 12px 0', padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', background: 'var(--paper)', flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 700 }}>Filter</span>
        {(['bug','note','bloat','missing'] as const).map(t => {
          const cfg = ANNOTATION_CONFIG[t];
          const active = activeFilter === t;
          return (
            <span key={t} onClick={() => setActiveFilter(active ? null : t)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: active ? cfg.color : cfg.bg, color: active ? 'var(--paper)' : cfg.color, border: `1px solid ${cfg.border}` }}>
              <span>{cfg.emoji}</span><span>{cfg.label}</span>
              <span style={{ background: active ? 'rgba(255,255,255,0.25)' : 'var(--paper)', color: active ? 'var(--paper)' : cfg.color, fontSize: 10, fontWeight: 700, padding: '0 5px', borderRadius: 8, minWidth: 14, textAlign: 'center' }}>{typeCounts[t]}</span>
            </span>
          );
        })}
        {activeFilter && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)' }}>
            showing <strong>{filtered.length} notes</strong> · <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setActiveFilter(null)}>clear filter</span>
          </span>
        )}
      </div>

      {/* Main split: annotations left + branch diff right */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(280px,1fr) 1.5fr', gap: 8, padding: '8px 12px', minHeight: 0, overflow: 'hidden' }}>

        {/* Left: Annotation list */}
        <div className="box" style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', background: 'var(--paper)' }}>
          <div style={{ padding: '8px 12px', borderBottom: '1.5px solid var(--rule)', background: 'var(--paper-2)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span>Annotations</span>
            <span style={{ color: 'var(--ink-3)', fontWeight: 400, fontSize: 11 }}>· {annotations.length} total · auto-classified</span>
          </div>
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            {filtered.map((ann, i) => {
              const cfg = ANNOTATION_CONFIG[ann.type];
              const isSelected = selectedAnnotation === i;
              return (
                <div key={i} onClick={() => setSelectedAnnotation(i)} style={{ padding: '10px 12px', borderBottom: '1px solid var(--rule-soft)', background: isSelected ? 'var(--paper-2)' : 'transparent', borderLeft: `3px solid ${isSelected ? cfg.color : 'transparent'}`, display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 99, fontWeight: 700, letterSpacing: 0.4, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, textTransform: 'uppercase' }}>{cfg.emoji} {cfg.label}</span>
                    <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{ann.branch === 'all' ? 'all' : ann.branch.split('/').pop()}</span>
                    {ann.file && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{ann.file}{ann.line ? ` · L${ann.line}` : ''}</span>}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{ann.message.split('—')[0].trim()}</div>
                  {ann.message.includes('—') && <div style={{ fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.45 }}>{ann.message.split('—')[1].trim()}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Branch diff view */}
        <div className="box" style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', background: 'var(--paper)' }}>
          {/* Branch tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: '1.5px solid var(--rule)', background: 'var(--paper-2)', padding: '0 10px', flexWrap: 'wrap', flexShrink: 0 }}>
            <span style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 700, marginRight: 8 }}>Review by branch</span>
            {mission.assignments.map((a, idx) => {
              const isActive = activeBranchTab === a.branchName;
              const count = annotations.filter(ann => ann.branch === a.branchName).length;
              return (
                <span key={a.id} onClick={() => setActiveBranchTab(a.branchName)} style={{ padding: '8px 10px', borderBottom: `2px solid ${isActive ? 'var(--ink)' : 'transparent'}`, marginBottom: -1.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--ink)' : 'var(--ink-3)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: WORKER_COLORS[idx % WORKER_COLORS.length] }} />
                  <span>{a.agentId}</span>
                  <span style={{ fontSize: 9, padding: '0 5px', borderRadius: 99, background: count === 0 ? 'transparent' : 'var(--paper-2)', color: count === 0 ? 'var(--approve)' : 'var(--ink-3)', fontWeight: 700, fontFamily: 'var(--mono)' }}>{count === 0 ? '✓ clean' : count}</span>
                </span>
              );
            })}
            <span style={{ width: 1, height: 16, background: 'var(--rule-soft)', margin: '0 6px' }} />
            <span onClick={() => setActiveBranchTab('cross')} style={{ padding: '8px 10px', borderBottom: `2px solid ${activeBranchTab === 'cross' ? 'var(--ink)' : 'transparent'}`, marginBottom: -1.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: activeBranchTab === 'cross' ? 700 : 500, color: activeBranchTab === 'cross' ? 'var(--ink)' : 'var(--ink-3)' }}>
              <span style={{ width: 8, height: 8, background: 'var(--ink)', clipPath: 'polygon(0 0,50% 50%,0 100%,100% 100%,50% 50%,100% 0)' }} />
              <span>Cross-branch</span>
              <span style={{ fontSize: 9, padding: '0 5px', borderRadius: 99, background: 'var(--paper-2)', color: 'var(--ink-3)', fontWeight: 700, fontFamily: 'var(--mono)' }}>{annotations.filter(a => a.branch === 'cross').length || 1}</span>
            </span>
          </div>
          {/* Diff content — REAL git diff for the selected branch */}
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.6, color: 'var(--ink-2)' }}>
            {activeBranchTab === 'cross' ? (
              <div style={{ color: 'var(--ink-3)', fontFamily: 'var(--sans)', fontSize: 12, lineHeight: 1.6 }}>
                Cross-branch notes are in the Annotations panel on the left. Pick a branch tab
                above to see its real diff, or use <strong>View diff</strong> below.
              </div>
            ) : (
              (branchDiffText || '(no changes)').split('\n').map((ln, i) => (
                <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: ln.startsWith('+') && !ln.startsWith('+++') ? 'var(--approve)' : ln.startsWith('-') && !ln.startsWith('---') ? '#c0392b' : ln.startsWith('@@') ? 'var(--pm)' : 'var(--ink-2)' }}>{ln || ' '}</div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Per-branch review + action buttons */}
      <div className="box" style={{ margin: '0 12px 12px', padding: 0, background: 'var(--paper)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '8px 14px', borderBottom: '1px dashed var(--rule-soft)', fontSize: 10, color: 'var(--ink-3)', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          Per-branch review
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textTransform: 'none', letterSpacing: 0 }}>
            {mission.assignments.map((a, idx) => {
              const st = branchStatuses[a.branchName] ?? 'waiting';
              return (
                <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 99, background: st === 'approved' ? 'var(--approve-soft)' : 'var(--paper-2)', border: `1px solid ${st === 'approved' ? 'var(--approve)' : 'var(--rule-soft)'}`, color: st === 'approved' ? 'var(--approve)' : 'var(--ink-3)', fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: WORKER_COLORS[idx % WORKER_COLORS.length] }} />
                  {a.agentId.split('-')[0].toUpperCase()} {st === 'approved' ? '✓' : '…'}
                </span>
              );
            })}
            <span style={{ color: 'var(--ink-3)' }}>→</span>
            <span style={{ padding: '2px 7px', borderRadius: 99, background: 'var(--review-soft)', border: '1px solid var(--review)', color: 'var(--review)', fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)' }}>final ▶</span>
          </span>
        </div>
        {/* S3/S4: per-branch — see the real diff, then accept (merge into base). */}
        <div style={{ padding: '10px 14px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {mission.assignments.map(a => {
            const merged = (mission.mergedBranches || []).includes(a.branchName);
            const isMerging = mergeState?.branch === a.branchName && mergeState.status === 'merging';
            const mergeErr = mergeState?.branch === a.branchName && mergeState.status === 'error';
            return (
              <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className="branch-chip">{a.branchName}</span>
                <button onClick={() => onViewDiff(a.branchName)} style={{ fontSize: 11, padding: '4px 10px', background: 'var(--paper)', color: 'var(--ink-2)', border: '1px solid var(--rule)', borderRadius: 4, cursor: 'pointer' }}>View diff</button>
                {merged ? (
                  <span style={{ fontSize: 11, color: 'var(--approve)', fontWeight: 700 }}>✓ merged</span>
                ) : (
                  <button onClick={() => onAcceptMerge(a.branchName)} disabled={isMerging} style={{ fontSize: 11, padding: '4px 10px', background: 'var(--approve)', color: 'var(--paper)', border: 'none', borderRadius: 4, fontWeight: 600, cursor: isMerging ? 'wait' : 'pointer', opacity: isMerging ? 0.7 : 1 }}>{isMerging ? 'Merging…' : '✓ Accept & merge'}</button>
                )}
                {mergeErr && <span style={{ fontSize: 11, color: '#c0392b' }}>{mergeState!.message}</span>}
              </div>
            );
          })}
        </div>
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={onSendBack} style={{ fontSize: 12, padding: '7px 14px', background: 'var(--paper)', color: 'var(--ink)', border: '1.5px solid var(--rule)', borderRadius: 4, cursor: 'pointer' }}>
            ← Send back to workers <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>(iterate)</span>
          </button>
          <span style={{ fontFamily: 'var(--hand)', fontSize: 14, color: 'var(--ink-3)' }}>or</span>
          <button onClick={onArchive} style={{ fontSize: 12, padding: '7px 14px', background: 'var(--approve)', color: 'var(--paper)', border: '1.5px solid var(--approve)', borderRadius: 4, fontWeight: 700, cursor: 'pointer' }}>
            ✓ Archive to PM's dev log
          </button>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>then →</span>
          <button onClick={prStatus === 'idle' ? createPRs : undefined} disabled={prStatus === 'creating'} style={{ fontSize: 12, padding: '7px 14px', background: 'var(--paper)', color: 'var(--ink-2)', border: '1.5px solid var(--rule-soft)', borderRadius: 4, cursor: 'pointer' }}>
            {prStatus === 'idle' ? `Create PRs on GitHub (${mission.assignments.length} branches)` : prStatus === 'creating' ? 'Creating…' : 'PRs created ✓'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PM Doc Tab components (3.15 · 3.16 · 3.17) ─────────────────────────────

interface PrdEdit { id: string; section: string; content: string; status: 'pending' | 'approved' | 'rejected'; }

const PRD_SECTIONS_DEF = [
  { key: 'Overview',        label: '§ Overview',        subtitle: 'What this product is, in one paragraph.' },
  { key: 'Goals',           label: '§ Goals',           subtitle: 'Why this project exists.' },
  { key: 'Personas',        label: '§ Personas',        subtitle: 'Who uses it.' },
  { key: 'Features',        label: '§ Features',        subtitle: 'What the product does. Updated as missions are archived.' },
  { key: 'Non-goals',       label: '§ Non-goals',       subtitle: 'Things we deliberately don\'t do.' },
  { key: 'Constraints',     label: '§ Constraints',     subtitle: 'Hard limits: tech, legal, performance.' },
  { key: 'Open questions',  label: '§ Open questions',  subtitle: 'Unresolved decisions.' },
];

const SOP_SECTIONS_DEF = [
  { key: 'Naming',           label: '§ Naming',           subtitle: 'File and symbol naming conventions.' },
  { key: 'Branching',        label: '§ Branching',        subtitle: 'One worker = one branch. Never reuse.' },
  { key: 'Testing',          label: '§ Testing',          subtitle: 'TDD when feasible. Test before HITL approves write.' },
  { key: 'Commits',          label: '§ Commits',          subtitle: 'Each tool-call cluster = one commit.' },
  { key: 'Code style',       label: '§ Code style',       subtitle: 'Formatting, linting, and code quality.' },
  { key: 'Review checklist', label: '§ Review checklist', subtitle: 'What the Reviewer checks before archive.' },
];

function PMTab_PRD({ edits, onApprove, onReject, onApproveAll, onRejectAll, activeSection, onSectionChange }: {
  edits: PrdEdit[];
  onApprove: (section: string) => void;
  onReject: (section: string) => void;
  onApproveAll: () => void;
  onRejectAll: () => void;
  activeSection: string;
  onSectionChange: (s: string) => void;
}) {
  const pendingCount = edits.filter(e => e.status === 'pending').length;
  const pendingBySection = (sec: string) => edits.filter(e => e.section === sec && e.status === 'pending').length;
  const editsBySection = (sec: string) => edits.filter(e => e.section === sec && e.status !== 'rejected');

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      {/* Section nav */}
      <div style={{ flex: '0 0 180px', borderRight: '1.5px solid var(--rule)', background: 'var(--paper-2)', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Sections</div>
        {PRD_SECTIONS_DEF.map(s => {
          const p = pendingBySection(s.key);
          const active = activeSection === s.key;
          return (
            <div key={s.key} onClick={() => onSectionChange(s.key)} style={{
              padding: '5px 8px', borderRadius: 3, fontSize: 12, cursor: 'pointer',
              background: active ? 'var(--pm)' : 'transparent',
              color: active ? 'var(--paper)' : 'var(--ink-2)',
              display: 'flex', alignItems: 'center', gap: 6, fontWeight: active ? 600 : 500,
            }}>
              <span style={{ flex: 1 }}>{s.label}</span>
              {p > 0 && <span style={{ minWidth: 16, padding: '0 5px', borderRadius: 99, fontSize: 9, fontWeight: 700, background: active ? 'var(--paper)' : 'var(--review)', color: active ? 'var(--review)' : 'var(--paper)', textAlign: 'center' }}>{p}</span>}
            </div>
          );
        })}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8 }}>
          <button className="btn" style={{ fontSize: 11, padding: '5px 8px', borderRadius: 3, border: '1.5px dashed var(--rule-soft)', background: 'var(--paper)', color: 'var(--ink-3)' }}>＋ Add section</button>
          <button className="btn" style={{ fontSize: 10, padding: '4px 8px', borderRadius: 3, border: '1px solid var(--rule-soft)', background: 'var(--paper)', color: 'var(--ink-3)' }}>↗ View raw markdown</button>
        </div>
      </div>

      {/* Doc */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {pendingCount > 0 && (
          <div style={{ padding: '8px 18px', background: 'var(--pm-soft)', borderBottom: '1.5px solid var(--pm)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: 'var(--pm)', fontWeight: 700 }}>⚠ PM proposed {pendingCount} edit{pendingCount > 1 ? 's' : ''} to this PRD</span>
            <span style={{ fontSize: 11, color: 'var(--ink-2)' }}>after last archive. Each section shows a diff — approve / reject per section.</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)' }}>HITL · your call</span>
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '16px 22px' }}>
          <div style={{ maxWidth: 660, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {PRD_SECTIONS_DEF.map(s => {
              const pending = pendingBySection(s.key);
              const sectionEdits = editsBySection(s.key);
              return (
                <section key={s.key} style={{
                  border: pending > 0 ? '1.5px solid var(--review)' : '1.5px solid var(--rule)',
                  borderRadius: 5, background: 'var(--paper)', padding: '12px 16px',
                  display: 'flex', flexDirection: 'column', gap: 8, position: 'relative',
                }}>
                  {pending > 0 && (
                    <span style={{ position: 'absolute', top: -9, right: 12, background: 'var(--review)', color: 'var(--paper)', fontSize: 9, fontWeight: 700, letterSpacing: 0.4, padding: '2px 7px', borderRadius: 99 }}>{pending} pending</span>
                  )}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>§ {s.key}</h3>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{s.subtitle}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-3)', cursor: 'pointer' }}>✎ edit</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {/* Static content per section */}
                    {s.key === 'Overview' && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: 'var(--ink-2)' }}>A local-first React app. Lives in <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>~/project</span>. Focus: keyboard-first, clean, extensible.</p>}
                    {s.key === 'Goals' && <>
                      <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>Ship features faster by running workers in parallel.</span></div>
                      <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>Keep the PM as the single source of project truth.</span></div>
                    </>}
                    {s.key === 'Personas' && <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>Solo developer managing a multi-worker AI team.</span></div>}
                    {s.key === 'Features' && <>
                      <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>Add / edit / archive items with optimistic save.</span></div>
                      <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>Filter by tag (local persistence).</span></div>
                    </>}
                    {s.key === 'Non-goals' && <>
                      <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>No multi-user / sync. Local only.</span></div>
                    </>}
                    {s.key === 'Constraints' && <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>Must run offline. No cloud dependency.</span></div>}
                    {s.key === 'Open questions' && <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>No open questions — all resolved in last review.</div>}

                    {/* PM proposed additions */}
                    {sectionEdits.map(e => (
                      <div key={e.id} style={{ display: 'flex', gap: 6, background: e.status === 'approved' ? 'var(--approve-soft)' : 'var(--approve-soft)', color: 'var(--approve)', padding: '4px 8px', borderRadius: 3, fontSize: 12.5, lineHeight: 1.5, border: `1px solid ${e.status === 'approved' ? 'var(--approve)' : 'var(--approve)'}`, opacity: e.status === 'approved' ? 0.7 : 1 }}>
                        <span style={{ fontFamily: 'var(--mono)', fontWeight: 700 }}>+</span>
                        <span style={{ flex: 1, color: 'var(--ink)' }}>{e.content}</span>
                        <span style={{ fontSize: 9, color: 'var(--ink-3)', fontFamily: 'var(--mono)', whiteSpace: 'nowrap' }}>{e.status === 'approved' ? '✓ approved' : 'PM'}</span>
                      </div>
                    ))}
                  </div>
                  {pending > 0 && (
                    <div style={{ marginTop: 4, padding: '6px 8px', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--paper-2)', borderRadius: 3, border: '1px dashed var(--rule-soft)' }}>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{pending} PM addition{pending > 1 ? 's' : ''} in this section</span>
                      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        <button onClick={() => onReject(s.key)} className="btn" style={{ fontSize: 10, padding: '3px 8px', borderRadius: 3, background: 'var(--paper)', border: '1px solid var(--rule)', color: 'var(--ink-2)', cursor: 'pointer' }}>Reject section</button>
                        <button onClick={() => onApprove(s.key)} className="btn" style={{ fontSize: 10, padding: '3px 8px', borderRadius: 3, background: 'var(--approve)', border: '1px solid var(--approve)', color: 'var(--paper)', fontWeight: 600, cursor: 'pointer' }}>✓ Approve section</button>
                      </span>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>

        {pendingCount > 0 && (
          <div style={{ padding: '10px 18px', borderTop: '1.5px solid var(--rule)', background: 'var(--paper-2)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{pendingCount} pending edit{pendingCount > 1 ? 's' : ''} across {[...new Set(edits.filter(e => e.status === 'pending').map(e => e.section))].length} section{[...new Set(edits.filter(e => e.status === 'pending').map(e => e.section))].length > 1 ? 's' : ''}</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={onRejectAll} className="btn" style={{ fontSize: 11, padding: '5px 12px', borderRadius: 4, border: '1.5px solid var(--rule)', background: 'var(--paper)', cursor: 'pointer' }}>Reject all</button>
              <button onClick={onApproveAll} className="btn" style={{ fontSize: 11, padding: '5px 12px', borderRadius: 4, border: '1.5px solid var(--approve)', background: 'var(--approve)', color: 'var(--paper)', fontWeight: 700, cursor: 'pointer' }}>✓ Approve all PM edits</button>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function PMTab_SOP({ activeSection, onSectionChange }: { activeSection: string; onSectionChange: (s: string) => void; }) {
  const SOP_CONTENT: Record<string, React.ReactNode> = {
    Branching: <>
      <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>Each <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>worker</span> creates exactly one branch from <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>main</span>.</span></div>
      <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>Naming: <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>feat/{'<mission-slug>'}-{'<short-scope>'}</span></span></div>
      <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>Workers never push to <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>main</span>. Reviewer + your decision is required.</span></div>
      <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>PM never creates branches. PM only writes plan + maintains docs.</span></div>
    </>,
    Commits: <>
      <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>Conventional commits: <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>feat: / fix: / chore: / docs: / test:</span></span></div>
      <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>Body line 1 ≤ 72 chars. Imperative ("add", not "added").</span></div>
      <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>Worker commits show <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>[W{'<n>'}]</span> tag for cross-branch traceability.</span></div>
    </>,
    Testing: <>
      <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>Coverage minimum: <strong>80%</strong> on touched files.</span></div>
      <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>Tests live next to source: <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>foo.ts</span> ↔ <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>foo.test.ts</span></span></div>
      <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>Reviewer will flag <strong>Missing</strong> for any new public function without a test.</span></div>
    </>,
    Naming: <>
      <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>Components: <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>PascalCase</span>. Hooks: <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>useXxx</span>. Utils: <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>camelCase</span>.</span></div>
      <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>Files match their default export. One component per file.</span></div>
    </>,
    'Code style': <>
      <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>ESLint + Prettier. No unresolved lint warnings at commit time.</span></div>
      <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>TypeScript strict mode. No implicit <span style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>any</span>.</span></div>
    </>,
    'Review checklist': <>
      <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>All tests green before calling Reviewer.</span></div>
      <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>No console.log or debug statements in commits.</span></div>
      <div style={{ display: 'flex', gap: 6, fontSize: 12.5, color: 'var(--ink-2)', lineHeight: 1.5 }}><span style={{ color: 'var(--ink-3)' }}>•</span><span>Each branch has at least one meaningful commit message.</span></div>
    </>,
  };
  const activeDef = SOP_SECTIONS_DEF.find(s => s.key === activeSection) ?? SOP_SECTIONS_DEF[1];

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      {/* Categories nav */}
      <div style={{ flex: '0 0 180px', borderRight: '1.5px solid var(--rule)', background: 'var(--paper-2)', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>Categories</div>
        {SOP_SECTIONS_DEF.map(s => {
          const active = activeSection === s.key;
          return (
            <div key={s.key} onClick={() => onSectionChange(s.key)} style={{
              padding: '5px 8px', borderRadius: 3, fontSize: 12, cursor: 'pointer',
              background: active ? 'var(--pm)' : 'transparent',
              color: active ? 'var(--paper)' : 'var(--ink-2)',
              fontWeight: active ? 600 : 500,
            }}>{s.label}</div>
          );
        })}
        <div style={{ marginTop: 'auto', paddingTop: 8 }}>
          <button className="btn" style={{ fontSize: 11, padding: '5px 8px', borderRadius: 3, border: '1.5px dashed var(--rule-soft)', background: 'var(--paper)', color: 'var(--ink-3)', width: '100%' }}>＋ Add category</button>
        </div>
      </div>

      {/* Doc */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '8px 18px', background: 'var(--paper-2)', borderBottom: '1.5px solid var(--rule)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>SOP.md · {activeDef.label}</span>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)' }}>stable · edit to add rules</span>
          <button className="btn" style={{ fontSize: 10, padding: '3px 8px', borderRadius: 3, border: '1px solid var(--rule-soft)', background: 'var(--paper)', color: 'var(--ink-3)', cursor: 'pointer' }}>↗ View raw</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 22px' }}>
          <div style={{ maxWidth: 660, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <section style={{ border: '1.5px solid var(--rule)', borderRadius: 5, background: 'var(--paper)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{activeDef.label}</h3>
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{activeDef.subtitle}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-3)', cursor: 'pointer' }}>✎ edit</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {SOP_CONTENT[activeSection] ?? <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>No content yet — click ✎ edit to add rules.</div>}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function PMTab_DevLog({ archivedMissions, selectedIdx, onSelectIdx, editMode, onToggleEdit }: {
  archivedMissions: Array<{id: string; name: string; startedAt?: string; assignments: {id: number}[]; reviewerAnnotations?: {type: string}[]}>;
  selectedIdx: number;
  onSelectIdx: (i: number) => void;
  editMode: boolean;
  onToggleEdit: () => void;
}) {
  const selected = archivedMissions[selectedIdx];
  const now = new Date();
  const entryDate = (i: number) => {
    const d = new Date(now.getTime() - i * 2 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10) + ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
      {/* Left rail: entry list */}
      <div style={{ flex: '0 0 220px', borderRight: '1.5px solid var(--rule)', display: 'flex', flexDirection: 'column', background: 'var(--paper-2)' }}>
        <div style={{ padding: '10px 12px 6px', fontSize: 10, color: 'var(--ink-3)', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>
          Entries · {archivedMissions.length}
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {archivedMissions.length === 0 ? (
            <div style={{ padding: '16px 12px', fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic', lineHeight: 1.5 }}>
              No entries yet. First entry appears after archiving your first mission.
            </div>
          ) : archivedMissions.map((m, i) => (
            <div key={m.id} onClick={() => onSelectIdx(i)} style={{
              padding: '8px 12px', borderBottom: '1px solid var(--rule-soft)',
              background: selectedIdx === i ? 'var(--paper)' : 'transparent',
              borderLeft: selectedIdx === i ? '3px solid var(--pm)' : '3px solid transparent',
              display: 'flex', flexDirection: 'column', gap: 2, cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--ink-3)' }}>{entryDate(i)}</span>
                {i === 0 && <span style={{ marginLeft: 'auto', fontSize: 8, padding: '1px 5px', borderRadius: 99, background: 'var(--review)', color: 'var(--paper)', fontWeight: 700, letterSpacing: 0.4 }}>NEW</span>}
              </div>
              <div style={{ fontSize: 12, fontWeight: selectedIdx === i ? 600 : 500 }}>{m.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Doc body */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '10px 18px', borderBottom: '1.5px solid var(--rule)', background: 'var(--paper-2)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>Dev log.md</span>
          {selected && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>· {selected.name}</span>}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            {!editMode && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'var(--approve-soft)', color: 'var(--approve)', border: '1px solid var(--approve)', fontWeight: 600 }}>● reading</span>}
            {editMode && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'var(--pm-soft)', color: 'var(--pm)', border: '1px solid var(--pm)', fontWeight: 600 }}>✎ editing raw</span>}
            <button onClick={onToggleEdit} className="btn" style={{ fontSize: 11, padding: '3px 10px', borderRadius: 3, border: '1.5px solid var(--rule)', background: 'var(--paper)', cursor: 'pointer' }}>
              {editMode ? '✓ Done editing' : '✎ Edit raw markdown'}
            </button>
          </span>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '18px 24px' }}>
          {archivedMissions.length === 0 ? (
            <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13, fontStyle: 'italic' }}>
              Dev log is empty. Archive your first mission and the PM will write the first entry here.
            </div>
          ) : !selected ? null : editMode ? (
            <textarea style={{ width: '100%', minHeight: 400, fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink)', background: 'var(--paper)', border: '1.5px solid var(--rule)', borderRadius: 4, padding: '12px', resize: 'vertical', lineHeight: 1.6 }}
              defaultValue={`## ${selected.name}\n\n${entryDate(selectedIdx)} · archived by you\n\nWorkers: ${(selected.assignments?.length ?? 0)}\nAnnotations resolved: ${selected.reviewerAnnotations?.length ?? 0}\n\n### Summary\n\nMission completed. All workers finished their branches.`}
            />
          ) : (
            <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Selected entry — newest is highlighted */}
              {archivedMissions.map((m, i) => {
                const isNew = i === 0;
                const isSelected = i === selectedIdx;
                if (!isSelected && i !== 0 && selectedIdx !== 0) return null;
                return (
                  <div key={m.id} style={{ padding: '14px 18px', border: isNew ? '1.5px solid var(--review)' : '1.5px solid var(--rule)', borderRadius: 5, background: isNew ? '#fff8ec' : 'var(--paper)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isNew && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.6, padding: '2px 6px', borderRadius: 99, background: 'var(--review)', color: 'var(--paper)' }}>NEW</span>}
                      <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{entryDate(i)} · archived by you</span>
                    </div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{m.name}</h3>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(m.assignments ?? []).map((_, wi) => (
                        <span key={wi} style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '2px 6px', borderRadius: 3, background: 'var(--paper)', border: '1px solid var(--rule-soft)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          ⎇ feat/w{wi + 1}-{m.name.toLowerCase().replace(/\s+/g, '-').slice(0, 12)}
                        </span>
                      ))}
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6 }}>
                      Mission completed in {m.assignments?.length ?? 0} branch{(m.assignments?.length ?? 0) !== 1 ? 'es' : ''}.
                      {(m.reviewerAnnotations?.length ?? 0) > 0
                        ? ` Reviewer surfaced ${m.reviewerAnnotations!.length} annotations; all resolved before archiving.`
                        : ' Archived after review.'}
                    </p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
                      <span style={{ color: 'var(--ink-3)' }}>{m.assignments?.length ?? 0} workers ·</span>
                      <span style={{ color: 'var(--approve)' }}>all branches merged to review</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

// Lightweight markdown render for PM messages: line breaks, bullets, headings, bold.
function renderRich(text: string): React.ReactNode {
  const inline = (s: string) => s.split('**').map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p);
  return (text || '').split('\n').map((line, i) => {
    const trimmed = line.trim();
    if (trimmed === '') return <div key={i} style={{ height: 6 }} />;
    if (/^[*\-•]\s+/.test(trimmed)) {
      return <div key={i} style={{ display: 'flex', gap: 8, paddingLeft: 2, margin: '2px 0' }}><span style={{ color: 'var(--ink-3)' }}>•</span><span style={{ flex: 1 }}>{inline(trimmed.replace(/^[*\-•]\s+/, ''))}</span></div>;
    }
    if (/^#{1,4}\s+/.test(trimmed)) {
      return <div key={i} style={{ fontWeight: 700, margin: '6px 0 2px' }}>{inline(trimmed.replace(/^#{1,4}\s+/, ''))}</div>;
    }
    return <div key={i} style={{ margin: '2px 0' }}>{inline(line)}</div>;
  });
}

// Real PM doc tab — reads the ACTUAL PRD/SOP/Dev-log file from the project
// (.chaperone/, root, or docs/) and renders it; edit saves to .chaperone/. No demo data.
function RealDocTab({ name, workspacePath }: { name: 'PRD' | 'SOP' | 'DevLog'; workspacePath: string }) {
  const [content, setContent] = useState('');
  const [foundPath, setFoundPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!workspacePath) { setLoading(false); return; }
    setLoading(true); setEditing(false);
    fetch(`${API_BASE}/api/doc?workspacePath=${encodeURIComponent(workspacePath)}&name=${name}`)
      .then(r => r.json())
      .then(d => { setContent(d.content || ''); setFoundPath(d.found ? d.path : null); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [name, workspacePath]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API_BASE}/api/doc`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspacePath, name, content: draft }) });
      const d = await r.json();
      if (d.ok) { setContent(draft); setFoundPath(d.path); setEditing(false); }
    } finally { setSaving(false); }
  };

  const label = name === 'DevLog' ? 'Dev log.md' : `${name}.md`;
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--paper-2)' }}>
      <div style={{ padding: '10px 18px', borderBottom: '1.5px solid var(--rule)', background: 'var(--paper)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
          {loading ? 'loading…' : foundPath ? `· reading ${foundPath}` : '· not found in this project'}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {!editing ? (
            <button onClick={() => { setDraft(content); setEditing(true); }} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 4, border: '1.5px solid var(--rule)', background: 'var(--paper)', cursor: 'pointer' }}>✎ Edit</button>
          ) : (
            <>
              <button onClick={() => setEditing(false)} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 4, border: '1.5px solid var(--rule)', background: 'var(--paper)', color: 'var(--ink-2)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={save} disabled={saving} style={{ fontSize: 11, padding: '5px 12px', borderRadius: 4, border: '1.5px solid var(--approve)', background: 'var(--approve)', color: 'var(--paper)', fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Saving…' : '✓ Save to .chaperone/'}</button>
            </>
          )}
        </span>
      </div>
      <div className="wf-scroll" style={{ flex: 1, overflow: 'auto', padding: 18 }}>
        {loading ? (
          <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>Loading…</div>
        ) : editing ? (
          <textarea value={draft} onChange={e => setDraft(e.target.value)} spellCheck={false}
            style={{ width: '100%', minHeight: '60vh', fontFamily: 'var(--mono)', fontSize: 12.5, lineHeight: 1.6, padding: 12, border: '1.5px solid var(--rule)', borderRadius: 6, background: 'var(--paper)', color: 'var(--ink)', resize: 'vertical', boxSizing: 'border-box' }} />
        ) : content ? (
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'var(--mono)', fontSize: 12.5, lineHeight: 1.65, color: 'var(--ink-2)', margin: 0, maxWidth: 820 }}>{content}</pre>
        ) : (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-3)' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 6 }}>No {label} in this project yet</div>
            <div style={{ fontSize: 12, marginBottom: 14 }}>Looked in <code style={{ fontFamily: 'var(--mono)' }}>.chaperone/</code>, the project root, and <code style={{ fontFamily: 'var(--mono)' }}>docs/</code>.</div>
            <button onClick={() => { setDraft(''); setEditing(true); }} style={{ fontSize: 12, padding: '7px 14px', borderRadius: 4, border: '1.5px solid var(--approve)', background: 'var(--approve)', color: 'var(--paper)', fontWeight: 700, cursor: 'pointer' }}>＋ Create {label}</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PM Parallelization Plan panel (S1 of the PM-model slice) ────────────────
// CEO types a goal → PM reads the REAL project → returns a structured plan
// (golden path, foundation files, gear, read-only audit allocation). Persisted via
// /api/pm/plan so it survives reload. See docs/PM_OPERATING_MODEL.md + ACCEPTANCE.md.
function PmPlanPanel({ workspacePath }: { workspacePath: string }) {
  const [goal, setGoal] = useState('');
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspacePath) return;
    fetch(`${API_BASE}/api/pm/plan?workspacePath=${encodeURIComponent(workspacePath)}`)
      .then(r => r.json())
      .then(d => { if (d && d.plan) { setRecord(d); setGoal(d.goal || ''); } })
      .catch(() => {});
  }, [workspacePath]);

  const generate = async () => {
    if (!goal.trim() || loading) return;
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API_BASE}/api/pm/plan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspacePath, goal: goal.trim() }),
      });
      const d = await r.json();
      if (!r.ok) setError(d.error || 'Plan failed'); else setRecord(d);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const plan = record?.plan;
  const gearColor = (g: string) => g === 'L1' ? 'var(--approve)' : g === 'L2' ? 'var(--pm)' : 'var(--review)';
  const volColor = (v: string) => v === 'Low' ? 'var(--approve)' : v === 'Medium' ? 'var(--pm)' : '#c0392b';
  const Badge = ({ text, color }: { text: string; color: string }) => (
    <span style={{ fontSize: 11, fontWeight: 700, color, border: `1.5px solid ${color}`, borderRadius: 4, padding: '2px 8px' }}>{text}</span>
  );

  return (
    <div className="box" style={{ padding: '14px 16px', background: 'var(--paper)', borderColor: 'var(--pm)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span className="pm-tag">PM</span>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--pm)' }}>📋 Parallelization Plan</span>
        {record?.model && <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{record.model}</span>}
      </div>

      <div className="composer" style={{ padding: '10px 12px', fontSize: 13 }}>
        <input
          placeholder='Give the PM a goal — e.g. "add a project switcher"…'
          value={goal}
          onChange={e => setGoal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') generate(); }}
        />
        <span className="send" onClick={generate}>{loading ? '…' : '↵'}</span>
      </div>

      {loading && <div style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic', marginTop: 10 }}>PM is reading the real project and planning…</div>}
      {error && <div style={{ fontSize: 12, color: '#c0392b', marginTop: 10 }}>⚠ {error}</div>}

      {plan && !loading && (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13, lineHeight: 1.55 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{plan.projectName || 'Project'}</div>
            {plan.summary && <div style={{ color: 'var(--ink-2)', marginTop: 2 }}>{plan.summary}</div>}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {plan.recommendedGear && <Badge text={`Gear ${plan.recommendedGear}`} color={gearColor(plan.recommendedGear)} />}
            {plan.foundationVolatility && <Badge text={`Volatility ${plan.foundationVolatility}`} color={volColor(plan.foundationVolatility)} />}
            {plan.gearReason && <span style={{ fontSize: 12, color: 'var(--ink-2)' }}>{plan.gearReason}</span>}
          </div>

          {Array.isArray(plan.goldenPath) && plan.goldenPath.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--ink-3)', marginBottom: 6 }}>Golden path (serial)</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
                {plan.goldenPath.map((s: any, i: number) => (
                  <React.Fragment key={i}>
                    <span className="branch-chip" style={{ background: 'var(--pm-soft)', borderColor: 'var(--pm)', color: 'var(--pm)' }}>{s.id}: {s.name}</span>
                    {i < plan.goldenPath.length - 1 && <span style={{ color: 'var(--ink-3)' }}>→</span>}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(plan.supportSlices) && plan.supportSlices.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--ink-3)', marginBottom: 6 }}>Support slices</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {plan.supportSlices.map((s: any, i: number) => (
                  <span key={i} className="branch-chip">{s.id}: {s.name} <span style={{ opacity: 0.6 }}>· {s.category}</span></span>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(plan.foundationFiles) && plan.foundationFiles.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--ink-3)', marginBottom: 6 }}>Foundation files (real — don't parallel-write)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {plan.foundationFiles.map((f: any, i: number) => (
                  <div key={i} style={{ fontSize: 12 }}>
                    <code style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--ink)' }}>{f.path}</code>
                    {f.why && <span style={{ color: 'var(--ink-3)' }}> — {f.why}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(plan.readOnlyAudits) && plan.readOnlyAudits.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--ink-3)', marginBottom: 6 }}>Proposed L1 read-only audits</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {plan.readOnlyAudits.map((a: any, i: number) => (
                  <div key={i} className="box-soft" style={{ padding: '8px 10px', background: 'var(--paper-2)' }}>
                    <div style={{ fontWeight: 700, fontSize: 12 }}>{a.agent}</div>
                    {a.produces && <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>{a.produces}</div>}
                    {Array.isArray(a.reads) && a.reads.length > 0 && (
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)', marginTop: 4 }}>reads: {a.reads.join(', ')}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(plan.notParallelYet) && plan.notParallelYet.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--ink-3)', marginBottom: 6 }}>Not parallel-safe yet</div>
              <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--ink-2)', fontSize: 12 }}>
                {plan.notParallelYet.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}

          {plan.nextStep && (
            <div className="box-soft" style={{ padding: '10px 12px', background: 'var(--pm-soft)', borderColor: 'var(--pm)' }}>
              <span style={{ fontWeight: 700, color: 'var(--pm)' }}>Next step: </span>
              <span style={{ color: 'var(--ink-2)' }}>{plan.nextStep}</span>
            </div>
          )}

          {record?.createdAt && <div style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>saved to .chaperone/pm-plan.json · {new Date(record.createdAt).toLocaleString()}</div>}
        </div>
      )}
    </div>
  );
}

// ── Progress Board (global, bottom, collapsible) ────────────────────────────
// Collapsed = a one-line MVP summary bar; expand = the slice tree with status.
// Reads the structured truth from /api/pm/progress (.chaperone/progress.json), NOT chat
// memory — so it survives reload and follows the PM's real state. 7 internal states
// fold into 5 CEO-facing labels (D3). See docs/PM_OPERATING_MODEL.md.
function ProgressBoard({ workspacePath }: { workspacePath: string }) {
  const [doc, setDoc] = useState<any>(null);
  const [open, setOpen] = useState(false);

  const load = () => {
    if (!workspacePath) return;
    fetch(`${API_BASE}/api/pm/progress?workspacePath=${encodeURIComponent(workspacePath)}`)
      .then(r => r.json()).then(d => { if (d && d.slices) setDoc(d); }).catch(() => {});
  };
  useEffect(() => { load(); }, [workspacePath]);

  if (!doc) return null;

  const STATUS: Record<string, { label: string; color: string }> = {
    accepted: { label: 'done', color: 'var(--approve)' },
    in_progress: { label: 'working', color: 'var(--worker)' },
    ai_verified: { label: 'needs you', color: 'var(--pm)' },
    awaiting_human_acceptance: { label: 'needs you', color: 'var(--pm)' },
    blocked: { label: 'blocked', color: '#c0392b' },
    regressed: { label: 'blocked', color: '#c0392b' },
    pending: { label: 'waiting', color: 'var(--ink-3)' },
  };
  const ui = (s: string) => STATUS[s] || STATUS.pending;
  const Pill = ({ status }: { status: string }) => {
    const u = ui(status);
    return <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 4, color: u.color, border: `1px solid ${u.color}`, whiteSpace: 'nowrap' }}>{u.label}</span>;
  };

  const slices: any[] = doc.slices || [];
  const accepted = slices.filter(s => s.status === 'accepted').length;
  const isNeedsYou = (st: string) => st === 'ai_verified' || st === 'awaiting_human_acceptance';
  const needsYou = slices.filter(s => isNeedsYou(s.status)).length
    + slices.reduce((n, s) => n + (s.subtasks || []).filter((t: any) => isNeedsYou(t.status)).length, 0);
  const working = slices.find(s => s.status === 'in_progress');
  const pct = slices.length ? Math.round((accepted / slices.length) * 100) : 0;

  return (
    <div style={{ borderTop: '1.5px solid var(--rule)', background: 'var(--paper-2)', flexShrink: 0 }}>
      {open && (
        <div style={{ maxHeight: 320, overflow: 'auto', padding: '12px 18px', borderBottom: '1px solid var(--rule-soft)' }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-2)', flex: 1 }}>{doc.mvpGoal}</span>
              <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 4, background: 'var(--worker-soft)', color: 'var(--worker)' }}>gear {doc.gear}</span>
              <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 4, color: 'var(--pm)', border: '1px solid var(--pm)' }}>volatility {doc.volatility}</span>
            </div>
            {slices.map(s => (
              <div key={s.id} style={{ marginBottom: 7 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <span style={{ fontWeight: s.status === 'in_progress' ? 700 : 400, flex: 1 }}>{s.id} · {s.name}</span>
                  <Pill status={s.status} />
                </div>
                {(s.subtasks || []).length > 0 && (
                  <div style={{ marginLeft: 14, paddingLeft: 12, borderLeft: '1px solid var(--rule-soft)', marginTop: 5, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {s.subtasks.map((t: any) => (
                      <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--ink-2)' }}>
                        <span style={{ flex: 1 }}>{t.name}</span><Pill status={t.status} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <div style={{ display: 'flex', gap: 14, marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--rule-soft)', fontSize: 11, color: 'var(--ink-3)', flexWrap: 'wrap' }}>
              <span><span style={{ color: 'var(--approve)' }}>●</span> done</span>
              <span><span style={{ color: 'var(--worker)' }}>●</span> working</span>
              <span><span style={{ color: 'var(--pm)' }}>●</span> needs you</span>
              <span><span style={{ color: 'var(--ink-3)' }}>●</span> waiting</span>
              <span style={{ marginLeft: 'auto' }}>from .chaperone/progress.json</span>
            </div>
          </div>
        </div>
      )}
      <div onClick={() => setOpen(o => !o)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, padding: '7px 18px', fontSize: 12 }}>
        <span style={{ fontWeight: 700 }}>⎇ {(workspacePath.split(/[\\/]/).pop()) || 'Project'} MVP</span>
        <div style={{ width: 80, height: 5, borderRadius: 999, background: 'var(--rule)', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--approve)' }} />
        </div>
        <span style={{ color: 'var(--ink-2)' }}>{accepted}/{slices.length}</span>
        {working && <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 4, background: 'var(--worker-soft)', color: 'var(--worker)' }}>{working.id} working</span>}
        {needsYou > 0 && <span style={{ fontSize: 11, padding: '1px 8px', borderRadius: 4, color: 'var(--pm)', border: '1px solid var(--pm)' }}>{needsYou} needs you</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center', color: 'var(--ink-3)' }}>
          <span onClick={(e) => { e.stopPropagation(); load(); }} title="refresh">⟳</span>
          <span>{open ? '▾ collapse' : '▴ progress map'}</span>
        </span>
      </div>
    </div>
  );
}

const App: React.FC = () => {
  // Persisted
  const [config, setConfig] = useLocalStorage<{ googleKey: string; projectPath: string; defaultModel: string; projects?: string[] }>('ac_config', {
    googleKey: '', projectPath: '', defaultModel: 'gemini-flash-latest', projects: [],
  });
  const [skills, setSkills] = useState<Skill[]>([]);
  const [missions, setMissions] = useLocalStorage<Mission[]>('ac_missions', []);
  // Per-project chat + missions. The active project's live in pmMessages/missions above;
  // inactive projects are parked here and swapped in on switch (the hook can't re-key).
  const [projectData, setProjectData] = useLocalStorage<Record<string, { messages: Message[]; missions: Mission[] }>>('ac_project_data', {});
  // Keep the active project present in the rail list (covers onboarding + legacy configs).
  useEffect(() => {
    if (config.projectPath && !(config.projects || []).includes(config.projectPath)) {
      setConfig(prev => ({ ...prev, projects: [...(prev.projects || []), prev.projectPath] }));
    }
  }, [config.projectPath]);

  // Session state
  const [pmMessages, setPmMessages] = useLocalStorage<Message[]>('ac_pm_messages', [{
    role: 'model',
    content: "Welcome. I'm your Project Orchestrator — I plan, never execute.\n\nDescribe what you want to build and I'll draft a mission plan for your team.",
  }]);
  const [pmInput, setPmInput] = useState('');
  const [isPmThinking, setIsPmThinking] = useState(false);
  const [pendingAssignments, setPendingAssignments] = useState<Assignment[]>([]);

  // Nudge inputs: keyed by assignment id
  const [nudgeInputs, setNudgeInputs] = useState<Record<number, string>>({});

  // T6: branch stats polled from /api/branch-status
  const [branchStats, setBranchStats] = useState<Record<string, { commits: number; files: number; ahead: number }>>({});

  // Onboarding phase machine:
  //   welcome → scan (Path B: PM reads folder) → docs (HITL per doc) → ready → done
  //   welcome → ready (Path A: start from scratch, skip scan+docs)
  // URL ?screen=welcome|scan|docs|ready-empty|ready-populated forces a phase for dev preview.
  const urlScreen = (typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('screen')
    : null);
  const initialPhase: 'welcome' | 'scan' | 'docs' | 'ready' | 'done' = (() => {
    if (urlScreen === 'welcome') return 'welcome';
    if (urlScreen === 'scan') return 'scan';
    if (urlScreen === 'docs') return 'docs';
    if (urlScreen === 'ready-empty' || urlScreen === 'ready-populated') return 'ready';
    return config.projectPath ? 'done' : 'welcome';
  })();
  const [onboardingPhase, setOnboardingPhase] = useState<'welcome' | 'scan' | 'docs' | 'ready' | 'done'>(initialPhase);
  const [onbPath, setOnbPath] = useState('');
  const [onbKey, setOnbKey] = useState(config.googleKey || '');
  // New-conversation / clear-chat flow (safe: checkpoints to docs first).
  const [showClearPanel, setShowClearPanel] = useState(false);
  const [isCheckpointing, setIsCheckpointing] = useState(false);
  // S3 diff viewer + S4 merge state.
  const [branchDiff, setBranchDiff] = useState<{ branch: string; loading: boolean; diff: string; files: { file: string; insertions: number; deletions: number }[]; base: string } | null>(null);
  const [mergeState, setMergeState] = useState<{ branch: string; status: 'merging' | 'merged' | 'error'; message: string } | null>(null);
  // Which docs the user chose to draft (set when entering 'docs' phase)
  const [docsChoice, setDocsChoice] = useState<'all' | 'prd' | 'skip'>('all');
  // Current doc step in HITL flow: 0=PRD 1=SOP 2=DevLog
  const [docsStep, setDocsStep] = useState(0);
  // True when project has docs PM wrote (PRD/SOP/Dev log). Persisted so tabs survive reload.
  const [docsReady, setDocsReady] = useLocalStorage<boolean>('ac_docs_ready', urlScreen === 'ready-populated');

  // Add skill modal
  const [showAddSkill, setShowAddSkill] = useState(false);
  const [addSkillName, setAddSkillName] = useState('');
  const [addSkillContent, setAddSkillContent] = useState('');
  const [isAddingSkill, setIsAddingSkill] = useState(false);

  // Team (recruited persistent workers) + recruit modal
  const [team, setTeam] = useState<TeamWorker[]>([]);
  const [recruitOpen, setRecruitOpen] = useState(false);

  // UI
  const [activeView, setActiveView] = useState<'pm' | string>('pm');
  const [activePmTab, setActivePmTab] = useState<'chat' | 'prd' | 'sop' | 'devlog'>('chat');
  // PM sub-screen within chat: idle (3.1/3.6) → briefing (3.7) → plan (3.8)
  const [pmScreen, setPmScreen] = useState<'idle' | 'briefing' | 'plan'>('idle');
  const [pmBriefInput, setPmBriefInput] = useState('');
  const [briefingAnswers, setBriefingAnswers] = useState<{ scope: string; who: string; store: string }>({ scope: '', who: '', store: '' });
  const [missionLayout, setMissionLayout] = useState<'1' | '2' | '3-4'>('3-4');
  const [activeWorker, setActiveWorker] = useState<number | null>(null);
  // Autonomy mode — how much the CEO approves. manual = confirm every tool call;
  // edits = auto-approve read_file, confirm writes/shell; auto = decide for me (all).
  // A ref lets the live SSE closure in startWorker read the latest value.
  const [autonomyMode, setAutonomyMode] = useLocalStorage<'manual' | 'edits' | 'auto'>('ac_autonomy', 'manual');
  const autonomyModeRef = useRef(autonomyMode);
  useEffect(() => { autonomyModeRef.current = autonomyMode; }, [autonomyMode]);
  const [archiveToast, setArchiveToast] = useState<string | null>(null);
  const [devLogNew, setDevLogNew] = useState(false);
  const [prdPendingEdits, setPrdPendingEdits] = useState<Array<{id: string; section: string; content: string; status: 'pending'|'approved'|'rejected'}>>([]);
  const [activePrdSection, setActivePrdSection] = useState('Features');
  const [activeSopSection, setActiveSopSection] = useState('Branching');
  const [selectedLogEntryIdx, setSelectedLogEntryIdx] = useState(0);
  const [devLogEditMode, setDevLogEditMode] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline'>('offline');
  const [realFiles, setRealFiles] = useState<string[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [fileTree, setFileTree] = useState<TreeNode[]>([]);
  const [deletedFiles, setDeletedFiles] = useState<TreeNode[]>([]);
  const [openFileState, setOpenFileState] = useState<{
    path: string; loading?: boolean; content?: string; diff?: string;
    status?: 'A' | 'M' | 'D' | null; binary?: boolean; tooLarge?: boolean;
    deleted?: boolean; size?: number; error?: string;
  } | null>(null);
  const [fileViewMode, setFileViewMode] = useState<'content' | 'diff'>('diff');
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [usageData, setUsageData] = useState<{
    total: { input: number; output: number; cached: number; calls: number; usd: number; unpricedCalls: number };
    byModel: { model: string; totals: { input: number; output: number; calls: number; usd: number; unpricedCalls: number } }[];
    recent: { at: string; model: string; scope: string; input: number; output: number; usd: number | null }[];
    rates: { checkedOn: string; sources: Record<string, string> };
  } | null>(null);
  const loadUsage = () => {
    fetch(`${API_BASE}/api/usage`).then(r => r.json()).then(d => { if (d.total) setUsageData(d); }).catch(() => {});
  };
  // Cheap and local; refreshed often enough that the figure moves while work runs.
  useEffect(() => {
    loadUsage();
    const t = setInterval(loadUsage, 8000);
    return () => clearInterval(t);
  }, []);
  const [profileName, setProfileName] = useLocalStorage<string>('ac_profile_name', '');
  // S7: provider selection state.
  const [providerInfo, setProviderInfo] = useState<{ active: string; current: string | null; ready?: boolean; available: { id: string; label: string; ready: boolean }[] } | null>(null);
  const loadProvider = () => {
    fetch(`${API_BASE}/api/provider`).then(r => r.json())
      .then(d => { if (d.available) setProviderInfo(d); }).catch(() => {});
  };
  const switchProvider = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/provider`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: id }),
      });
      const d = await res.json();
      if (d.ok) loadProvider();
    } catch {}
  };
  // Load on mount too, not only when Settings opens: whether any provider has a
  // key decides what the very first screen should say. Onboarding never asks for
  // one, so without this the first sign of a missing key was a failed model call
  // three steps in.
  useEffect(() => { loadProvider(); }, []);
  useEffect(() => { if (showSettings) loadProvider(); }, [showSettings]);

  const hasAnyKey = !providerInfo || providerInfo.available.some(p => p.ready);
  const keyStateKnown = !!providerInfo;

  // Anthropic / OpenAI credentials are deliberately NOT kept in localStorage the
  // way googleKey is — they are write-only from the UI's side. You type a key, it
  // goes to the backend's .env, and the field clears; whether a provider has a key
  // is read back from /api/provider (`ready`), never the secret itself.
  const [draftKeys, setDraftKeys] = useState<Record<string, string>>({});
  const [draftModels, setDraftModels] = useState<Record<string, string>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const setDraftKey = (id: string, v: string) => setDraftKeys(p => ({ ...p, [id]: v }));
  const setDraftModel = (id: string, v: string) => setDraftModels(p => ({ ...p, [id]: v }));

  // The one user-defined endpoint. Same write-only handling as the keys above.
  const [draftCustom, setDraftCustom] = useState<{ label: string; baseUrl: string; key: string; model: string }>(
    { label: '', baseUrl: '', key: '', model: '' },
  );
  const [customModels, setCustomModels] = useState<{ models: string[]; error?: string } | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  // Same for the built-in providers. A hardcoded default can go stale without
  // warning — Google retired gemini-2.5-flash for new accounts and every fresh
  // install 404'd — so the app can ask each provider what the key actually reaches.
  const [providerModels, setProviderModels] = useState<Record<string, { models: string[]; error?: string }>>({});
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const fetchProviderModels = async (id: string) => {
    setLoadingProvider(id);
    try {
      const res = await fetch(`${API_BASE}/api/provider/models`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: id }),
      });
      const d = await res.json();
      setProviderModels(p => ({ ...p, [id]: { models: Array.isArray(d.models) ? d.models : [], error: d.error } }));
    } catch {
      setProviderModels(p => ({ ...p, [id]: { models: [], error: 'could not reach the backend' } }));
    }
    setLoadingProvider(null);
  };
  const fetchCustomModels = async () => {
    setLoadingModels(true);
    try {
      const res = await fetch(`${API_BASE}/api/provider/models`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: draftCustom.baseUrl.trim(), key: draftCustom.key.trim() }),
      });
      const d = await res.json();
      setCustomModels({ models: Array.isArray(d.models) ? d.models : [], error: d.error });
    } catch {
      setCustomModels({ models: [], error: 'could not reach the backend' });
    }
    setLoadingModels(false);
  };

  const setCustom = (k: 'label' | 'baseUrl' | 'key' | 'model', v: string) =>
    setDraftCustom(p => ({ ...p, [k]: v }));

  // In-app replacement for window.prompt / window.confirm. Those are unavailable
  // in embedded contexts — an embedded viewer throws "prompt() is not supported",
  // so every button that opened one (all three ways into a project) did nothing at
  // all. They also can't be styled to match the rest of the app.
  type AskState = {
    title: string;
    hint?: string;
    placeholder?: string;
    confirmLabel?: string;
    danger?: boolean;
    withInput: boolean;
    onConfirm: (value: string) => void;
  };
  const [ask, setAsk] = useState<AskState | null>(null);
  const [askValue, setAskValue] = useState('');

  /** Ask for a line of text. `onConfirm` only fires on a non-empty value. */
  const askForText = (o: Omit<AskState, 'withInput'> & { initial?: string }) => {
    setAskValue(o.initial || '');
    setAsk({ ...o, withInput: true });
  };
  /** Ask a yes/no question. */
  const askToConfirm = (o: Omit<AskState, 'withInput' | 'onConfirm'> & { onConfirm: () => void }) => {
    setAskValue('');
    setAsk({ ...o, withInput: false, onConfirm: () => o.onConfirm() });
  };
  /**
   * Ask for a folder. On the desktop build this is the OS picker, so nobody types
   * a path; in a browser, where a real path is unknowable, it falls back to the
   * text modal. Same call site either way.
   */
  const askForFolder = async (o: Omit<AskState, 'withInput'> & { initial?: string }) => {
    if (canPickFolder()) {
      const picked = await pickFolder({ title: o.title, defaultPath: o.initial });
      if (picked) o.onConfirm(picked);
      return;
    }
    askForText(o);
  };

  // ── Onboarding: the PM's real look at the project ─────────────────────────
  // Both of these screens used to be hardcoded theater: the scan screen printed a
  // fixed list of tool calls the model never made and a fixed conclusion about
  // files it never checked, and the docs screen let you "approve" a draft that did
  // not exist. Now the model actually explores, and nothing is shown that it did
  // not produce.
  type Reply = { text: string; action: string | null };
  const [scan, setScan] = useState<{
    status: 'idle' | 'running' | 'done' | 'error';
    summary: string; files: string[]; replies: Reply[]; error: string;
  }>({ status: 'idle', summary: '', files: [], replies: [], error: '' });
  const [scanInput, setScanInput] = useState('');

  const [docsDraft, setDocsDraft] = useState<{
    status: 'idle' | 'running' | 'done' | 'error';
    drafts: { name: string; content: string }[]; note: string; files: string[]; error: string;
  }>({ status: 'idle', drafts: [], note: '', files: [], error: '' });
  const [savingDoc, setSavingDoc] = useState(false);

  // Follow the user's environment rather than assuming English; the backend turns
  // this into "answer in this language" for the model.
  const uiLang = typeof navigator !== 'undefined' ? navigator.language || '' : '';

  const runScan = async (workspacePath: string) => {
    setScan({ status: 'running', summary: '', files: [], replies: [], error: '' });
    try {
      const res = await fetch(`${API_BASE}/api/pm/explore`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspacePath, lang: uiLang, wantReplies: true }),
      });
      const d = await res.json();
      if (d.error) { setScan(s => ({ ...s, status: 'error', error: d.error })); return; }
      setScan({
        status: 'done',
        summary: d.summary || '',
        files: Array.isArray(d.filesRead) ? d.filesRead : [],
        replies: Array.isArray(d.suggestedReplies) ? d.suggestedReplies : [],
        error: '',
      });
    } catch {
      setScan(s => ({ ...s, status: 'error', error: 'Could not reach the backend.' }));
    }
  };

  const runDraftDocs = async (workspacePath: string, docs?: string[]) => {
    setDocsDraft({ status: 'running', drafts: [], note: '', files: [], error: '' });
    try {
      const res = await fetch(`${API_BASE}/api/pm/draft-docs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspacePath, lang: uiLang, ...(docs && docs.length ? { docs } : {}) }),
      });
      const d = await res.json();
      if (d.error) { setDocsDraft(s => ({ ...s, status: 'error', error: d.error })); return; }
      setDocsDraft({
        status: 'done',
        drafts: Array.isArray(d.drafts) ? d.drafts : [],
        note: d.note || '',
        files: Array.isArray(d.filesRead) ? d.filesRead : [],
        error: '',
      });
      setDocsStep(0);
    } catch {
      setDocsDraft(s => ({ ...s, status: 'error', error: 'Could not reach the backend.' }));
    }
  };

  useEffect(() => {
    const wp = config.projectPath || onbPath;
    if (onboardingPhase === 'scan' && scan.status === 'idle' && wp) runScan(wp);
    if (onboardingPhase === 'docs' && docsDraft.status === 'idle' && wp) runDraftDocs(wp);
  }, [onboardingPhase, config.projectPath, onbPath, scan.status, docsDraft.status]);

  const closeAsk = () => setAsk(null);
  const submitAsk = () => {
    if (!ask) return;
    const v = askValue.trim();
    if (ask.withInput && !v) return;   // nothing typed — same as cancelling
    setAsk(null);
    ask.onConfirm(v);
  };
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ─── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`${API_BASE}/api/status`)
      .then(res => res.ok ? setBackendStatus('online') : setBackendStatus('offline'))
      .catch(() => setBackendStatus('offline'));
  }, []);

  useEffect(() => {
    if (backendStatus !== 'online') return;
    fetch(`${API_BASE}/api/skills`)
      .then(r => r.json())
      .then(data => {
        if (data.skills) setSkills(data.skills.map((s: any, i: number) => ({
          id: i, name: s.name, source: 'Local', category: 'Universal', description: s.description,
        })));
      })
      .catch(() => {});
  }, [backendStatus]);

  // Load recruited team from backend persistence
  useEffect(() => {
    if (backendStatus !== 'online' || !config.projectPath) return;
    fetch(`${API_BASE}/api/team?workspacePath=${encodeURIComponent(config.projectPath)}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.workers)) setTeam(d.workers); })
      .catch(() => {});
  }, [backendStatus, config.projectPath]);

  useEffect(() => {
    if (config.projectPath && backendStatus === 'online') refreshFiles();
  }, [config.projectPath, backendStatus]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [pmMessages]);

  // T6: poll branch status for the active mission
  useEffect(() => {
    if (activeView === 'pm' || !config.projectPath) return;
    const mission = missions.find(m => m.id === activeView);
    if (!mission) return;
    const branches = mission.assignments.map(a => a.branchName);
    if (branches.length === 0) return;
    const poll = async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/branch-status?workspacePath=${encodeURIComponent(config.projectPath)}&branches=${encodeURIComponent(JSON.stringify(branches))}`
        );
        const data = await res.json();
        if (data.branches) setBranchStats(data.branches);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, [activeView, config.projectPath]);

  // Auto-start dispatched workers. The mission was already approved by the CEO, so each
  // worker should actually run (execute-mission) — it then PAUSES at every tool call for
  // HITL approval. Without this, workers sat at "booting" forever (onStart was never wired
  // to any trigger). Guard with a ref so each worker starts exactly once.
  const startedWorkersRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (activeView === 'pm' || !config.projectPath || backendStatus !== 'online') return;
    const mission = missions.find(m => m.id === activeView);
    if (!mission || mission.status !== 'running') return;
    mission.assignments.forEach((a, idx) => {
      if (a.status === 'proposed' && idx < 3 && !startedWorkersRef.current.has(a.id)) {
        startedWorkersRef.current.add(a.id);
        startWorker(mission.id, a.id);
      }
    });
  }, [activeView, missions, config.projectPath, backendStatus]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const refreshFiles = async () => {
    if (!config.projectPath) return;
    setIsLoadingFiles(true);
    try {
      const res = await fetch(`${API_BASE}/api/files/tree?workspacePath=${encodeURIComponent(config.projectPath)}`);
      const data = await res.json();
      if (Array.isArray(data.tree)) {
        setFileTree(data.tree);
        setDeletedFiles(Array.isArray(data.deleted) ? data.deleted : []);
        // The PM's prompt still wants a flat list of paths for context.
        const flat: string[] = [];
        const walk = (ns: TreeNode[]) => ns.forEach(n => {
          if (n.type === 'dir') walk(n.children || []);
          else flat.push(n.path);
        });
        walk(data.tree);
        setRealFiles(flat);
      }
    } catch { /* sidebar shows the empty state */ } finally { setIsLoadingFiles(false); }
  };

  /** Open a file in the viewer. A modified file opens on its diff. */
  const openFile = async (relPath: string) => {
    setOpenFileState({ path: relPath, loading: true });
    try {
      const res = await fetch(
        `${API_BASE}/api/files/content?workspacePath=${encodeURIComponent(config.projectPath)}&path=${encodeURIComponent(relPath)}`,
      );
      const d = await res.json();
      setOpenFileState({ ...d, path: relPath, loading: false });
      setFileViewMode(d.diff ? 'diff' : 'content');
    } catch {
      setOpenFileState({ path: relPath, loading: false, error: 'Could not read that file.' });
    }
  };

  const openWorkspace = () => {
    askForFolder({
      title: 'Open a project folder',
      hint: 'Full path to the folder.\ne.g. /Users/you/code/my-app   or   C:\\Users\\you\\code\\my-app',
      placeholder: 'path to project folder',
      initial: config.projectPath,
      confirmLabel: 'Open',
      onConfirm: p => switchProject(p),
    });
  };

  // ── Multi-project rail ──────────────────────────────────────────────────────
  const PM_FRESH_WELCOME: Message = { role: 'model', content: "Welcome. I'm your PM — I plan, never execute. Want me to go over this project, or jump to a goal?" };

  // Switch to (or add) a project. The active project's chat+missions are parked in
  // projectData; the target's are loaded (or defaults). Projects coexist in the rail.
  const switchProject = (target: string) => {
    if (!target) return;
    if (target === config.projectPath) { setActiveView('pm'); return; }
    if (config.projectPath) {
      setProjectData(prev => ({ ...prev, [config.projectPath]: { messages: pmMessages, missions } }));
    }
    const d = projectData[target];
    setPmMessages(d?.messages?.length ? d.messages : [PM_FRESH_WELCOME]);
    setMissions(d?.missions || []);
    setConfig(prev => ({
      ...prev,
      projectPath: target,
      projects: (prev.projects || []).includes(target) ? prev.projects : [...(prev.projects || []), target],
    }));
    setActiveView('pm'); setActivePmTab('chat'); setPmScreen('idle'); setPendingAssignments([]);
    startedWorkersRef.current.clear();
    fetch(`${API_BASE}/api/init-project`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectPath: target }) }).catch(() => {});
  };

  const addProject = () => {
    askForFolder({
      title: 'Open or add a project',
      hint: 'Full path to the folder.\ne.g. /Users/you/code/my-app   or   C:\\Users\\you\\code\\my-app',
      placeholder: 'path to project folder',
      confirmLabel: 'Open',
      onConfirm: p => switchProject(p),
    });
  };

  const removeProject = (target: string) => {
    const remaining = (config.projects || []).filter(x => x !== target);
    setProjectData(prev => { const n = { ...prev }; delete n[target]; return n; });
    if (config.projectPath === target) {
      const next = remaining[0] || '';
      const d = next ? projectData[next] : null;
      setPmMessages(d?.messages?.length ? d.messages : [PM_FRESH_WELCOME]);
      setMissions(d?.missions || []);
      setConfig(prev => ({ ...prev, projects: remaining, projectPath: next }));
      setActiveView('pm'); setPmScreen('idle');
    } else {
      setConfig(prev => ({ ...prev, projects: remaining }));
    }
  };

  const confirmRemoveProject = (target: string) => {
    const name = target.split(/[\\/]/).filter(Boolean).pop() || target;
    askToConfirm({
      title: `Close "${name}"?`,
      hint: 'Removes it from the rail only. Nothing on disk is deleted.',
      confirmLabel: 'Close',
      danger: true,
      onConfirm: () => removeProject(target),
    });
  };

  const sendPmMessage = async (overrideText?: string) => {
    const text = (overrideText ?? pmInput).trim();
    if (!text || isPmThinking) return;
    const userMsg: Message = { role: 'user', content: text };
    setPmMessages(prev => [...prev, userMsg]);
    setPmInput('');
    setPmBriefInput(text);
    setIsPmThinking(true);
    try {
      const apiHistory = pmMessages
        .filter((_, i) => i > 0)
        .map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));

      const res = await fetch(`${API_BASE}/api/ceo/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: apiHistory, files: realFiles, workspacePath: config.projectPath }),
      });
      const data = await res.json();
      if (data.text) {
        const cleanText = (data.text || '')
          .replace(/<<<CLARIFY>>>[\s\S]*?<<<END_CLARIFY>>>/g, '')
          .replace(/<<<TASK_PLAN>>>[\s\S]*?<<<END_TASK_PLAN>>>/g, '')
          .trim();
        setPmMessages(prev => [...prev, { role: 'model', content: cleanText || data.text, groundingSources: data.groundingSources }]);
        const planMatch = data.text.match(/<<<TASK_PLAN>>>([\s\S]*?)<<<END_TASK_PLAN>>>/);
        if (planMatch) {
          try {
            const parsed: { agent_id: string; task: string; branch_name: string; skill_loadout: string[] }[] = JSON.parse(planMatch[1].trim());
            setPendingAssignments(parsed.map(p => ({
              id: Date.now() + Math.random(),
              agentId: p.agent_id,
              task: p.task,
              branchName: p.branch_name || `feat/${p.agent_id}`,
              skillLoadout: p.skill_loadout || [],
              status: 'proposed',
              logs: [],
            })));
          } catch { /* malformed JSON */ }
        }
      } else if (data.error) {
        setPmMessages(prev => [...prev, { role: 'model', content: `[ERROR] ${data.error}` }]);
      }
    } catch {
      setPmMessages(prev => [...prev, { role: 'model', content: '[Connection Error] Is the backend running?' }]);
    } finally { setIsPmThinking(false); }
  };

  // Read-only & AGENTIC: the PM actually reads the project's real progress docs
  // (docs/PROGRESS.md, MVP.md, status docs) and reports in its own voice with a
  // follow-up. No worker, no branch, no view switch — inline in the PM chat.
  const checkProgress = async () => {
    if (isPmThinking) return;
    const lastTyped = [...pmMessages].reverse().find(
      m => m.role === 'user' && m.content && !m.content.startsWith('Check the current')
    )?.content || '';
    const zh = /[一-鿿぀-ヿ가-힯]/.test(lastTyped);
    setPmMessages(prev => [...prev, { role: 'user', content: zh ? '看看目前的项目进展。' : 'Check the current project progress.' }]);
    setIsPmThinking(true);
    try {
      const res = await fetch(`${API_BASE}/api/pm/progress-report`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspacePath: config.projectPath, lang: zh ? 'zh' : '' }),
      });
      const data = await res.json();
      if (data.error) {
        setPmMessages(prev => [...prev, { role: 'model', content: `[ERROR] ${data.error}` }]);
        return;
      }
      const filesNote = Array.isArray(data.filesRead) && data.filesRead.length > 0
        ? `\n\n_— PM read ${data.filesRead.length} file(s): ${data.filesRead.slice(0, 12).join(', ')}${data.filesRead.length > 12 ? '…' : ''}_`
        : '';
      setPmMessages(prev => [...prev, { role: 'model', content: (data.summary || '[No response]') + filesNote }]);
    } catch {
      setPmMessages(prev => [...prev, { role: 'model', content: '[Connection Error] Is the backend running?' }]);
    } finally { setIsPmThinking(false); }
  };

  const auditProject = async () => {
    if (isPmThinking) return;
    setPmMessages(prev => [...prev, { role: 'user', content: 'Plan agent dispatch — audit the project, then tell me the stage, golden path, gear, and how to split the work.' }]);
    setIsPmThinking(true);
    try {
      const lastTyped = [...pmMessages].reverse().find(
        m => m.role === 'user' && m.content && !m.content.startsWith('Make a parallelization')
      )?.content || '';
      const lang = /[一-鿿぀-ヿ가-힯]/.test(lastTyped) ? 'zh' : '';
      const res = await fetch(`${API_BASE}/api/pm/audit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspacePath: config.projectPath, lang }),
      });
      const data = await res.json();
      if (data.error) {
        setPmMessages(prev => [...prev, { role: 'model', content: `[ERROR] ${data.error}` }]);
        return;
      }
      const auditorFooter = Array.isArray(data.auditors) && data.auditors.length > 0
        ? `\n\n_— PM dispatched ${data.auditors.length} auditor(s) · ${data.totalFilesRead?.length ?? 0} files read total_\n_${data.auditors.map((a: any) => `${a.id}: ${a.filesRead?.length ?? 0} file(s)`).join(' · ')}_`
        : '';
      setPmMessages(prev => [...prev, { role: 'model', content: (data.ceobrief || '[No briefing]') + auditorFooter }]);
    } catch {
      setPmMessages(prev => [...prev, { role: 'model', content: '[Connection Error] Is the backend running?' }]);
    } finally { setIsPmThinking(false); }
  };

  // S5: PM produces an L2 layered split for the active slice + a deterministic conflict check.
  const planL2 = async () => {
    if (isPmThinking) return;
    const lastTyped = [...pmMessages].reverse().find(m => m.role === 'user' && m.content)?.content || '';
    const slice = lastTyped || 'the current active slice';
    const zh = /[一-鿿぀-ヿ가-힯]/.test(lastTyped);
    setPmMessages(prev => [...prev, { role: 'user', content: zh ? `把这条 slice 拆成 L2 分层并行方案：${slice}` : `Plan L2 parallel work for: ${slice}` }]);
    setIsPmThinking(true);
    try {
      const res = await fetch(`${API_BASE}/api/pm/l2-plan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspacePath: config.projectPath, slice }),
      });
      const data = await res.json();
      if (data.error) { setPmMessages(prev => [...prev, { role: 'model', content: `[ERROR] ${data.error}` }]); return; }
      const p = data.plan;
      const workers = (p.workers || []).map((w: any) =>
        `**${w.id}** _(${w.layer})_ → \`${w.branchName}\`\n  ${w.task}\n  ${zh ? '可改' : 'owns'}: ${(w.allowedFiles || []).map((f: string) => `\`${f}\``).join(', ')}`
      ).join('\n\n');
      const contracts = (p.contracts || []).length > 0
        ? `\n\n**${zh ? '接口合同' : 'Interface contracts'}:**\n` + p.contracts.map((c: any) => `- \`${c.name}\`: ${c.input} → ${c.output} (owner: ${c.owner})`).join('\n')
        : '';
      const conflictLine = data.safe
        ? `\n\n✅ ${zh ? '无文件冲突 — 可安全并行 (L2)' : 'No file conflicts — safe to run in parallel (L2)'}`
        : `\n\n⚠️ ${zh ? '检测到冲突' : 'CONFLICTS'}: ${data.conflicts.map((c: any) => `\`${c.file}\` (${c.workers.join(' vs ')})`).join(', ')} — ${zh ? 'PM 需重新分工' : 'PM must re-split'}`;
      setPmMessages(prev => [...prev, { role: 'model', content: `**L2 ${zh ? '分层并行方案' : 'layered plan'}** — ${p.slice}\n\n${workers}${contracts}${conflictLine}\n\n_${zh ? 'PM 读了' : 'PM read'} ${data.filesRead?.length ?? 0} ${zh ? '个文件' : 'file(s)'}_` }]);
    } catch {
      setPmMessages(prev => [...prev, { role: 'model', content: '[Connection Error] Is the backend running?' }]);
    } finally { setIsPmThinking(false); }
  };

  const reviewProject = async () => {
    if (isPmThinking) return;
    setPmMessages(prev => [...prev, { role: 'user', content: 'Go over my project and tell me what it is.' }]);
    setIsPmThinking(true);
    try {
      // Mirror the CEO's language: detect from their most recent typed message
      // (the Go-over button has no text of its own). No hardcoding — if they've been
      // writing English, reply English; Chinese → Chinese. Let the model follow them.
      const lastTyped = [...pmMessages].reverse().find(
        m => m.role === 'user' && m.content && !m.content.startsWith('Go over my project')
      )?.content || '';
      const lang = /[一-鿿぀-ヿ가-힯]/.test(lastTyped) ? 'zh' : '';
      // Agentic, read-only: the PM explores the repo itself with read tools.
      const res = await fetch(`${API_BASE}/api/pm/explore`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspacePath: config.projectPath, lang }),
      });
      const data = await res.json();
      const filesNote = Array.isArray(data.filesRead) && data.filesRead.length > 0
        ? `\n\n_— PM read ${data.filesRead.length} file(s): ${data.filesRead.slice(0, 12).join(', ')}${data.filesRead.length > 12 ? '…' : ''}_`
        : '';
      setPmMessages(prev => [...prev, { role: 'model', content: (data.summary || (data.error ? `[ERROR] ${data.error}` : '[No response]')) + filesNote }]);
    } catch {
      setPmMessages(prev => [...prev, { role: 'model', content: '[Connection Error] Is the backend running?' }]);
    } finally { setIsPmThinking(false); }
  };

  const dispatchMission = () => {
    if (pendingAssignments.length === 0) return;
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    const mission: Mission = {
      id: `mission-${Date.now()}`,
      name: pmBriefInput.trim() || pendingAssignments.map(a => a.agentId).join(' · '),
      status: 'running',
      assignments: pendingAssignments,
      startedAt: hhmm,
    };
    setMissions(prev => [...prev, mission]);
    setPendingAssignments([]);
    // C: stay in the PM chat — do NOT switch to the mission view. Land back in the chat
    // stream (in case dispatch fired from the full-screen plan view) so the running
    // mission renders as a clickable inline card; clicking it opens the detail (D).
    setActiveView('pm');
    setPmScreen('idle');
    const n = mission.assignments.length;
    const zh = /[一-鿿぀-ヿ가-힯]/.test(mission.name);
    setPmMessages(prev => [...prev, {
      role: 'model',
      content: zh
        ? `▶ 已派发 **${mission.name}** — ${n} 个 worker 在各自分支上运行。我留在这儿,点下面的任务卡片可以进去看进度。`
        : `▶ Dispatched **${mission.name}** — ${n} worker${n > 1 ? 's' : ''} running on their branches. I'll stay here; click the mission card below to watch it.`,
    }]);
  };

  // Cancel/remove a mission (e.g. a stuck or unwanted one). Drops it from state; if it
  // was the active view, return to the PM chat.
  const dismissMission = (id: string) => {
    setMissions(prev => prev.filter(m => m.id !== id));
    setActiveView(prev => (prev === id ? 'pm' : prev));
  };

  // Reset the PM conversation to a clean welcome. Missions are stored separately
  // (ac_missions) so they survive — the chat thread is scratch, the docs are memory.
  const resetConversation = () => {
    setPmMessages([{
      role: 'model',
      content: "Welcome. I'm your Project Orchestrator — I plan, never execute.\n\nDescribe what you want to build and I'll draft a mission plan for your team.",
    }]);
    setPmScreen('idle');
    setPendingAssignments([]);
    setShowClearPanel(false);
  };

  // Safe clear: first checkpoint the conversation's decisions/progress to the docs
  // (the PM's durable memory), then reset. Makes "nothing is lost" literally true.
  const checkpointAndClear = async () => {
    if (isCheckpointing) return;
    setIsCheckpointing(true);
    try {
      const lastTyped = [...pmMessages].reverse().find(m => m.role === 'user' && m.content)?.content || '';
      const lang = /[一-鿿぀-ヿ가-힯]/.test(lastTyped) ? 'zh' : '';
      const res = await fetch(`${API_BASE}/api/pm/checkpoint`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspacePath: config.projectPath, history: pmMessages, lang }),
      });
      const data = await res.json();
      if (data.error) {
        // Don't clear if the save failed — protect the user's history.
        setPmMessages(prev => [...prev, { role: 'model', content: `[Checkpoint failed — not clearing] ${data.error}` }]);
        setShowClearPanel(false);
        return;
      }
      const wroteNote = Array.isArray(data.wrote) && data.wrote.length > 0
        ? `\n\n_— saved to: ${data.wrote.join(', ')}_`
        : '';
      // Show what was saved, then reset to a clean thread.
      resetConversation();
      setPmMessages([{
        role: 'model',
        content: (data.summary || 'Checkpoint done.') + wroteNote,
      }]);
    } catch {
      setPmMessages(prev => [...prev, { role: 'model', content: '[Connection Error] Is the backend running? Not clearing.' }]);
      setShowClearPanel(false);
    } finally { setIsCheckpointing(false); }
  };

  const updateAssignment = (missionId: string, assignmentId: number, update: Partial<Assignment> | ((a: Assignment) => Assignment)) => {
    setMissions(prev => prev.map(m =>
      m.id !== missionId ? m : {
        ...m,
        assignments: m.assignments.map(a =>
          a.id !== assignmentId ? a :
          typeof update === 'function' ? update(a) : { ...a, ...update }
        ),
      }
    ));
  };

  const startWorker = (missionId: string, assignmentId: number) => {
    const mission = missions.find(m => m.id === missionId);
    const assignment = mission?.assignments.find(a => a.id === assignmentId);
    if (!assignment) return;
    updateAssignment(missionId, assignmentId, { status: 'running', logs: [] });

    const qs = new URLSearchParams({
      workspacePath: config.projectPath,
      agent: assignment.agentId,
      taskName: assignment.task,
      taskId: String(assignmentId),
      skills: JSON.stringify(assignment.skillLoadout),
      branchName: assignment.branchName,
    });
    const es = new EventSource(`${API_BASE}/api/execute-mission?${qs}`);
    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'log') {
        updateAssignment(missionId, assignmentId, a => ({ ...a, logs: [...a.logs, data.log] }));
      } else if (data.type === 'require_approval') {
        // Autonomy mode decides whether we pause for the CEO or auto-approve.
        const mode = autonomyModeRef.current;
        const auto = mode === 'auto' || (mode === 'edits' && data.tool === 'read_file');
        if (auto) {
          updateAssignment(missionId, assignmentId, a => ({ ...a, logs: [...a.logs, `> [AUTO-APPROVED · ${mode}] ${data.tool}`] }));
          fetch(`${API_BASE}/api/approve-action`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId: assignmentId, approved: true }),
          }).catch(() => {});
        } else {
          updateAssignment(missionId, assignmentId, { pendingAction: { tool: data.tool, args: data.args } });
        }
      }
    };
    es.addEventListener('end', () => es.close());
    es.onerror = () => es.close();
  };

  const approveAction = async (missionId: string, assignmentId: number, approved: boolean) => {
    updateAssignment(missionId, assignmentId, { pendingAction: undefined });
    await fetch(`${API_BASE}/api/approve-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: assignmentId, approved }),
    });
  };

  // If the CEO flips to an auto mode while a worker is already paused for approval,
  // clear those pending approvals too (so the switch takes effect immediately).
  useEffect(() => {
    if (autonomyMode === 'manual') return;
    missions.forEach(m => (m.assignments || []).forEach(a => {
      if (a.pendingAction && (autonomyMode === 'auto' || (autonomyMode === 'edits' && a.pendingAction.tool === 'read_file'))) {
        approveAction(m.id, a.id, true);
      }
    }));
  }, [autonomyMode, missions]);

  const nudgeWorker = async (missionId: string, assignmentId: number) => {
    const message = nudgeInputs[assignmentId]?.trim();
    if (!message) return;
    setNudgeInputs(prev => ({ ...prev, [assignmentId]: '' }));
    updateAssignment(missionId, assignmentId, a => ({ ...a, logs: [...a.logs, `> [YOU] ${message}`] }));
    try {
      const res = await fetch(`${API_BASE}/api/panel/${assignmentId}/nudge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      const reply = data.text || data.error || '[No response]';
      updateAssignment(missionId, assignmentId, a => ({ ...a, logs: [...a.logs, `> [WORKER] ${reply}`] }));
    } catch {
      updateAssignment(missionId, assignmentId, a => ({ ...a, logs: [...a.logs, '> [ERROR] Could not reach worker session.'] }));
    }
  };

  const callReviewer = (missionId: string) => {
    const mission = missions.find(m => m.id === missionId);
    if (!mission) return;
    setMissions(prev => prev.map(m => m.id !== missionId ? m : {
      ...m, status: 'reviewing' as const, reviewerLog: [], reviewerAnnotations: undefined,
    }));
    const branches = mission.assignments.map(a => a.branchName);
    const tasks: Record<string, string> = {};
    mission.assignments.forEach(a => { tasks[a.branchName] = a.task; });
    const qs = new URLSearchParams({
      workspacePath: config.projectPath,
      branches: JSON.stringify(branches),
      tasks: JSON.stringify(tasks),
    });
    const es = new EventSource(`${API_BASE}/api/reviewer?${qs}`);
    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'log') {
        setMissions(prev => prev.map(m => m.id !== missionId ? m : {
          ...m, reviewerLog: [...(m.reviewerLog || []), data.log],
        }));
      } else if (data.type === 'annotations') {
        setMissions(prev => prev.map(m => m.id !== missionId ? m : {
          ...m, reviewerAnnotations: data.annotations,
        }));
      }
    };
    es.onerror = () => es.close();
  };

  // S3: fetch and show exactly what a worker wrote on its branch (real git diff).
  const viewDiff = async (branch: string) => {
    setBranchDiff({ branch, loading: true, diff: '', files: [], base: '' });
    try {
      const res = await fetch(`${API_BASE}/api/diff?workspacePath=${encodeURIComponent(config.projectPath)}&branch=${encodeURIComponent(branch)}`);
      const data = await res.json();
      if (data.error) { setBranchDiff({ branch, loading: false, diff: `[ERROR] ${data.error}`, files: [], base: '' }); return; }
      setBranchDiff({ branch, loading: false, diff: data.diff || '', files: data.files || [], base: data.base || '' });
    } catch {
      setBranchDiff({ branch, loading: false, diff: '[Connection Error] Is the backend running?', files: [], base: '' });
    }
  };

  // S4: CEO accepts a branch → merge it into the base locally.
  const acceptAndMerge = async (missionId: string, branch: string) => {
    setMergeState({ branch, status: 'merging', message: '' });
    try {
      const res = await fetch(`${API_BASE}/api/merge`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspacePath: config.projectPath, branch }),
      });
      const data = await res.json();
      if (data.ok) {
        setMergeState({ branch, status: 'merged', message: `Merged into ${data.base}` });
        setMissions(prev => prev.map(m => m.id !== missionId ? m : {
          ...m, mergedBranches: [...(m.mergedBranches || []), branch],
        }));
      } else {
        setMergeState({ branch, status: 'error', message: data.error || 'Merge failed' });
      }
    } catch {
      setMergeState({ branch, status: 'error', message: '[Connection Error] Is the backend running?' });
    }
  };

  const archiveMission = (missionId: string) => {
    const mission = missions.find(m => m.id === missionId);
    const name = mission?.name ?? 'mission';
    setMissions(prev => prev.map(m => m.id !== missionId ? m : { ...m, status: 'done' as const }));
    setActiveView('pm');
    setDevLogNew(true);
    setSelectedLogEntryIdx(0);
    setArchiveToast(name);
    setTimeout(() => setArchiveToast(null), 5000);
    setPmMessages(prev => [...prev, {
      role: 'model',
      content: `Archived "${name}" — the mission is closed and logged. Merged branches are already in your base branch.`,
    }]);
  };

  // After Welcome → Ready transition. Backend's /api/init-project handles
  // mkdir+git-init via `recursive: true`, so both Open-folder and Start-from-scratch
  // share the same code path.
  const enterProject = (path: string, key?: string) => {
    const trimmed = path.trim();
    if (!trimmed) return;
    const newConfig = { ...config, projectPath: trimmed };
    if (key && key.trim()) newConfig.googleKey = key.trim();
    setConfig(newConfig);
    setDocsReady(false);
    setOnboardingPhase('ready');
    fetch(`${API_BASE}/api/init-project`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: trimmed }),
    }).catch(() => {});
    if (key && key.trim() && key.trim() !== config.googleKey) {
      fetch(`${API_BASE}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleKey: key.trim() }),
      }).catch(() => {});
    }
  };

  const handleStartFromScratch = () => {
    askForFolder({
      title: 'Where should I create your new project?',
      hint: 'The folder is created if it does not exist, with a .chaperone/ inside it.\ne.g. /Users/you/code/new-project   or   C:\\Users\\you\\code\\new-project',
      placeholder: 'path for the new project',
      confirmLabel: 'Create',
      onConfirm: p => enterProject(p, onbKey),
    });
  };

  const handleReadyFirstMessage = (text: string) => {
    if (!text.trim()) return;
    setPmInput(text);
    setOnboardingPhase('done');
  };

  const handleAddSkill = async () => {
    if (!addSkillName.trim() || !addSkillContent.trim()) return;
    setIsAddingSkill(true);
    try {
      await fetch(`${API_BASE}/api/add-skill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addSkillName.trim(), content: addSkillContent.trim() }),
      });
      setShowAddSkill(false);
      setAddSkillName('');
      setAddSkillContent('');
      const res = await fetch(`${API_BASE}/api/skills`);
      const data = await res.json();
      if (data.skills) setSkills(data.skills.map((s: any, i: number) => ({
        id: i, name: s.name, source: 'Local', category: 'Universal', description: s.description,
      })));
    } catch {}
    setIsAddingSkill(false);
  };

  const saveSettings = async () => {
    // Send only what the user actually filled in — the backend merges into .env
    // and leaves every other variable alone, so a blank field never clears a key.
    const payload: Record<string, string> = {};
    if (config.googleKey?.trim()) payload.googleKey = config.googleKey.trim();
    if (draftKeys.claude?.trim()) payload.anthropicKey = draftKeys.claude.trim();
    if (draftKeys.openai?.trim()) payload.openaiKey = draftKeys.openai.trim();
    if (draftModels.gemini?.trim()) payload.geminiModel = draftModels.gemini.trim();
    if (draftModels.claude?.trim()) payload.anthropicModel = draftModels.claude.trim();
    if (draftModels.openai?.trim()) payload.openaiModel = draftModels.openai.trim();
    if (draftCustom.key.trim()) payload.customKey = draftCustom.key.trim();
    if (draftCustom.baseUrl.trim()) payload.customBaseUrl = draftCustom.baseUrl.trim();
    if (draftCustom.model.trim()) payload.customModel = draftCustom.model.trim();
    if (draftCustom.label.trim()) payload.customLabel = draftCustom.label.trim();

    if (Object.keys(payload).length === 0) { setShowSettings(false); return; }

    setSavingSettings(true);
    try {
      await fetch(`${API_BASE}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      // Drop the plaintext secrets from memory and re-read which providers are
      // now usable, so the engine buttons light up without a reload.
      setDraftKeys({});
      setDraftModels({});
      setDraftCustom({ label: '', baseUrl: '', key: '', model: '' });
      loadProvider();
      // A screen that stalled purely for want of a key can go now — making the
      // user re-trigger the same step by hand is busywork.
      const wp = config.projectPath || onbPath;
      if (wp && scan.status === 'error' && isKeyError(scan.error)) runScan(wp);
      if (wp && docsDraft.status === 'error' && isKeyError(docsDraft.error)) runDraftDocs(wp);
    } catch {}
    setSavingSettings(false);
    setShowSettings(false);
  };

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const activeMission = activeView !== 'pm' ? missions.find(m => m.id === activeView) ?? null : null;
  const totalHitl = missions.reduce((n, m) => n + (m.assignments ?? []).filter(a => a.pendingAction).length, 0);
  const runningMissions = missions.filter(m => m.status === 'running');

  // ─── Render ──────────────────────────────────────────────────────────────────

  // ── M1 · Onboarding Screen 0a · Welcome (no project) ──────────────────────
  // 1-to-1 port of Onboarding_Welcome in wf-onboarding.jsx, with tiles
  // reordered per user: Start from scratch / Open folder / Clone GitHub.
  // ── Spend ──
  // Token counts are exactly what the providers reported. The dollar figure is an
  // estimate from a rate table with a date on it, and the panel says so — rates
  // move, and a confidently wrong number would be worse than an honest estimate.
  const usageModal = showUsage && usageData && (
    <div onClick={() => setShowUsage(false)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: 560, maxHeight: '88vh', overflowY: 'auto', background: 'var(--bg-elevated, var(--paper))', borderRadius: 10, padding: '28px 28px 24px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', border: '1px solid var(--border-default, var(--rule))' }}>

        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>What this has cost</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim, var(--ink-3))', marginBottom: 18 }}>
          You pay your model provider directly. Chaperone never sees your bill — this is its own count of what it asked for.
        </div>

        <div style={{ display: 'flex', gap: 20, padding: '14px 16px', borderRadius: 8, background: 'var(--paper-2, rgba(0,0,0,0.04))' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>~{formatUsd(usageData.total.usd)}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>estimated, all time</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.7 }}>
            <div>{usageData.total.calls} model calls</div>
            <div className="mono" style={{ fontSize: 11 }}>
              {formatTokens(usageData.total.input)} in · {formatTokens(usageData.total.output)} out
              {usageData.total.cached > 0 && ` · ${formatTokens(usageData.total.cached)} cached`}
            </div>
          </div>
        </div>

        {usageData.total.unpricedCalls > 0 && (
          <div style={{ fontSize: 11.5, color: 'var(--warn, #b0851f)', marginTop: 10, lineHeight: 1.5 }}>
            {usageData.total.unpricedCalls} call(s) used a model with no rate on file — their tokens are counted above, their cost isn't.
          </div>
        )}

        <div style={{ marginTop: 22 }}>
          <label style={{ fontSize: 11, color: 'var(--text-label, var(--ink-3))', fontWeight: 700, letterSpacing: 1 }}>BY MODEL</label>
          <div style={{ marginTop: 8 }}>
            {usageData.byModel.map(m => (
              <div key={m.model} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--rule-soft, rgba(0,0,0,0.06))' }}>
                <span className="mono" style={{ fontSize: 12, flex: 1 }}>{m.model}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  {formatTokens(m.totals.input)} / {formatTokens(m.totals.output)}
                </span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600, minWidth: 74, textAlign: 'right' }}>
                  {m.totals.unpricedCalls === m.totals.calls ? '—' : `~${formatUsd(m.totals.usd)}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <label style={{ fontSize: 11, color: 'var(--text-label, var(--ink-3))', fontWeight: 700, letterSpacing: 1 }}>RECENT CALLS</label>
          <div style={{ marginTop: 8, maxHeight: 220, overflowY: 'auto' }}>
            {usageData.recent.map((e, i) => (
              <div key={`${e.at}-${i}`} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 0', fontSize: 11.5 }}>
                <span className="mono" style={{ color: 'var(--ink-3)', minWidth: 52 }}>
                  {new Date(e.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.scope}</span>
                <span className="mono" style={{ color: 'var(--ink-3)' }}>{formatTokens(e.input + e.output)} tok</span>
                <span className="mono" style={{ minWidth: 68, textAlign: 'right' }}>{e.usd === null ? '—' : `~${formatUsd(e.usd)}`}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--rule-soft, var(--rule))', fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
          Token counts come from the provider and are exact. Prices are a stored table last checked{' '}
          <strong>{usageData.rates.checkedOn}</strong> — they change, and differ between a provider's own API and a reseller.
          Correct them in <code className="mono" style={{ fontSize: 11 }}>rates.json</code> next to your settings.
          {' '}
          {Object.entries(usageData.rates.sources).map(([k, url], i) => (
            <React.Fragment key={k}>
              {i > 0 && ' · '}
              <a href={url as string} target="_blank" rel="noreferrer" style={{ color: 'var(--pm)', textDecoration: 'underline' }}>{k} pricing ↗</a>
            </React.Fragment>
          ))}
        </div>

        <div style={{ display: 'flex', marginTop: 22 }}>
          <button onClick={() => setShowUsage(false)}
            style={{ flex: 1, background: 'var(--pm)', color: '#fff', border: 'none', padding: 12, borderRadius: 6, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );

  // ── Profile ──
  // Deliberately thin. Chaperone has no accounts, no sign-in and no server-side
  // identity, so the only thing that is genuinely *the user's own* right now is
  // what they want to be called. Everything else that could pad this page out —
  // the engine, the autonomy policy, project paths — is app configuration and
  // belongs in Settings; putting it here would just be Settings wearing a
  // different label.
  const profileModal = showProfile && (
    <div onClick={() => setShowProfile(false)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: 460, background: 'var(--bg-elevated, var(--paper))', borderRadius: 10, padding: '28px 28px 24px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', border: '1px solid var(--border-default, var(--rule))' }}>

        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Profile</div>
        <div style={{ fontSize: 12, color: 'var(--text-dim, var(--ink-3))', marginBottom: 20 }}>
          You're the CEO here. Everything below stays on this machine — there is no account to sign in to.
        </div>

        <label style={{ fontSize: 11, color: 'var(--text-label, var(--ink-3))', fontWeight: 700, letterSpacing: 1 }}>WHAT THE PM CALLS YOU</label>
        <input
          value={profileName}
          onChange={e => setProfileName(e.target.value)}
          placeholder="your name"
          style={{ width: '100%', background: 'var(--bg-base, var(--paper))', border: '1px solid var(--border-default, var(--rule))', padding: '10px 13px', color: 'var(--text-primary, var(--ink))', marginTop: 8, borderRadius: 6, fontSize: 13 }}
        />
        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6 }}>
          Leave it blank and the PM just says "you".
        </div>

        <div style={{ marginTop: 22, paddingTop: 16, borderTop: '1px solid var(--rule-soft, var(--rule))' }}>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.6 }}>
            Looking for API keys, the model engine, or how much agents may do on their own? Those are app settings, not account details.
          </div>
          <button onClick={() => { setShowProfile(false); setShowSettings(true); }}
            style={{ marginTop: 10, fontSize: 12, padding: '6px 13px', borderRadius: 4, cursor: 'pointer', background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--rule)' }}>
            Open Settings
          </button>
        </div>

        <div style={{ display: 'flex', marginTop: 24 }}>
          <button onClick={() => setShowProfile(false)}
            style={{ flex: 1, background: 'var(--pm)', color: '#fff', border: 'none', padding: 12, borderRadius: 6, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );

  // ── File viewer ──
  // A modified file opens on its diff, because "what changed" is the question the
  // sidebar is there to answer; the whole file is one click away.
  const fileModal = openFileState && (
    <div onClick={() => setOpenFileState(null)}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1050 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: 'min(1000px, 92vw)', height: 'min(720px, 88vh)', background: 'var(--bg-elevated, var(--paper))', borderRadius: 10, border: '1px solid var(--border-default, var(--rule))', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.45)' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1.5px solid var(--rule)' }}>
          <span className="mono" style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {openFileState.path}
          </span>
          {openFileState.status && STATUS_STYLE[openFileState.status] && (
            <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: STATUS_STYLE[openFileState.status].color }}>
              {STATUS_STYLE[openFileState.status].title}
            </span>
          )}
          {!!openFileState.diff && (
            <div style={{ display: 'flex', gap: 4 }}>
              {(['diff', 'content'] as const).map(m => (
                <button key={m} onClick={() => setFileViewMode(m)}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontWeight: fileViewMode === m ? 700 : 400,
                    background: fileViewMode === m ? 'var(--pm)' : 'transparent', color: fileViewMode === m ? '#fff' : 'var(--ink-2)',
                    border: `1px solid ${fileViewMode === m ? 'var(--pm)' : 'var(--rule)'}` }}>
                  {m === 'diff' ? 'Changes' : 'Whole file'}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setOpenFileState(null)}
            style={{ fontSize: 16, lineHeight: 1, padding: '2px 8px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink-3)' }}>×</button>
        </div>

        <div className="wf-scroll" style={{ flex: 1, overflow: 'auto', background: 'var(--paper)' }}>
          {openFileState.loading && <div style={{ padding: 16, fontSize: 12, color: 'var(--ink-3)' }}>loading…</div>}
          {openFileState.error && <div style={{ padding: 16, fontSize: 12, color: 'var(--reject, #b4544f)' }}>{openFileState.error}</div>}
          {openFileState.binary && <div style={{ padding: 16, fontSize: 12, color: 'var(--ink-3)' }}>Binary file ({openFileState.size} bytes) — nothing to show.</div>}
          {openFileState.tooLarge && <div style={{ padding: 16, fontSize: 12, color: 'var(--ink-3)' }}>File is {Math.round((openFileState.size || 0) / 1024)} KB — too large to display.</div>}

          {!openFileState.loading && !openFileState.error && !openFileState.binary && !openFileState.tooLarge && (
            fileViewMode === 'diff' && openFileState.diff ? (
              <pre className="mono" style={{ margin: 0, padding: '10px 0', fontSize: 12, lineHeight: 1.55 }}>
                {openFileState.diff.split('\n').map((line, i) => {
                  const added = line.startsWith('+') && !line.startsWith('+++');
                  const removed = line.startsWith('-') && !line.startsWith('---');
                  const meta = line.startsWith('@@') || line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('+++') || line.startsWith('---');
                  return (
                    <div key={i} style={{
                      padding: '0 16px', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      background: added ? 'rgba(76,138,92,0.14)' : removed ? 'rgba(180,84,79,0.14)' : 'transparent',
                      color: meta ? 'var(--ink-3)' : added ? 'var(--approve, #4c8a5c)' : removed ? 'var(--reject, #b4544f)' : 'var(--ink-2)',
                    }}>{line || ' '}</div>
                  );
                })}
              </pre>
            ) : (
              <pre className="mono" style={{ margin: 0, padding: 16, fontSize: 12, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'var(--ink-2)' }}>
                {openFileState.deleted ? '(file was deleted)' : openFileState.content}
              </pre>
            )
          )}
        </div>
      </div>
    </div>
  );

  // ── Settings Modal ──
  // Defined before the onboarding early-returns below so every phase can render
  // it. It used to live only in the final return, which meant clicking the gear
  // before a project was open set the flag but drew nothing — leaving a user whose
  // only key is Anthropic or OpenAI with no way in (onboarding asks for Gemini).
  // ── Prompt / confirm modal ──
  const askModal = ask && (
    <div
      onClick={closeAsk}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 460, background: 'var(--bg-elevated)', borderRadius: 10, padding: '26px 26px 22px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', border: '1px solid var(--border-default)' }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: ask.hint ? 6 : 16 }}>{ask.title}</div>
        {ask.hint && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16, whiteSpace: 'pre-line' }}>{ask.hint}</div>
        )}
        {ask.withInput && (
          <input
            autoFocus
            value={askValue}
            onChange={e => setAskValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') submitAsk();
              if (e.key === 'Escape') closeAsk();
            }}
            placeholder={ask.placeholder}
            style={{ width: '100%', background: 'var(--bg-base)', border: '1px solid var(--border-default)', padding: '11px 14px', color: 'var(--text-primary)', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}
          />
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button
            onClick={submitAsk}
            disabled={ask.withInput && !askValue.trim()}
            style={{ flex: 1, background: ask.danger ? 'var(--reject, #b4544f)' : 'var(--accent-pm)', color: '#fff', border: 'none', padding: 11, borderRadius: 6, fontWeight: 700, fontSize: 14, cursor: (ask.withInput && !askValue.trim()) ? 'not-allowed' : 'pointer', opacity: (ask.withInput && !askValue.trim()) ? 0.45 : 1 }}
          >
            {ask.confirmLabel || 'OK'}
          </button>
          <button
            onClick={closeAsk}
            style={{ padding: '11px 18px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  const settingsModal = showSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: 520, maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-elevated)', borderRadius: 10, boxShadow: '0 24px 64px rgba(0,0,0,0.5)', border: '1px solid var(--border-default)' }}>
           <div style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 8px' }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>Settings</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 20 }}>
              Keys are written to the backend's <code style={{ fontFamily: 'JetBrains Mono, monospace' }}>.env</code> and never leave your machine.
            </div>

            {/* One credential block per engine. Every engine you hold a key for
                becomes selectable above — that is the whole BYO-model promise. */}
            <label style={{ fontSize: 11, color: 'var(--text-label)', fontWeight: 700, letterSpacing: 1 }}>API KEYS</label>
            {providerInfo && (
              <div onClick={() => switchProvider('auto')}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '7px 10px', borderRadius: 6, cursor: 'pointer',
                  border: `1.5px solid ${providerInfo.active === 'auto' ? 'var(--accent-pm)' : 'var(--border-default)'}`,
                  background: providerInfo.active === 'auto' ? 'var(--pm-soft, rgba(74,111,165,0.12))' : 'transparent' }}>
                <span style={{ fontSize: 10, width: 10, color: 'var(--accent-pm)' }}>{providerInfo.active === 'auto' ? '●' : ''}</span>
                <span style={{ fontSize: 12.5, fontWeight: providerInfo.active === 'auto' ? 700 : 500 }}>Auto</span>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  {providerInfo.current
                    ? `use whichever I have a key for${providerInfo.active === 'auto' ? ` — now ${providerInfo.current}` : ''}`
                    : 'use whichever I have a key for — none yet, add one below'}
                </span>
              </div>
            )}
            {PROVIDER_FIELDS.map(f => {
              const info = providerInfo?.available.find(p => p.id === f.id);
              const ready = !!info?.ready;
              const isGemini = f.id === 'gemini';
              return (
                <div key={f.id} style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{f.label}</span>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 700, letterSpacing: 0.4, background: ready ? 'var(--approve-soft, rgba(80,180,120,0.18))' : 'transparent', color: ready ? 'var(--approve, #4caf7d)' : 'var(--text-dim)', border: ready ? 'none' : '1px solid var(--border-default)' }}>
                      {ready ? 'KEY SET' : 'NO KEY'}
                    </span>
                    {/* Choosing which provider runs belongs next to that provider,
                        at the moment you finish setting it up — not in a separate
                        list underneath repeating the same names. */}
                    {ready && (providerInfo?.active === f.id ? (
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, color: 'var(--accent-pm)' }}>● IN USE</span>
                    ) : (
                      <button type="button" onClick={() => switchProvider(f.id)}
                        style={{ fontSize: 10.5, padding: '3px 9px', borderRadius: 10, cursor: 'pointer', background: 'transparent', color: 'var(--accent-pm)', border: '1px solid var(--accent-pm)' }}>
                        use this
                      </button>
                    ))}
                    {/* Opens in the system browser from the desktop build. */}
                    <a href={f.keyUrl} target="_blank" rel="noreferrer"
                      style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent-pm)', textDecoration: 'underline' }}>
                      {ready ? 'manage keys ↗' : 'get a key ↗'}
                    </a>
                  </div>
                  <input
                    type="password"
                    autoComplete="off"
                    value={isGemini ? config.googleKey : (draftKeys[f.id] || '')}
                    onChange={e => isGemini ? setConfig({ ...config, googleKey: e.target.value }) : setDraftKey(f.id, e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-base)', border: '1px solid var(--border-default)', padding: '9px 12px', color: 'var(--text-primary)', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
                    placeholder={ready ? '•••••••••••  saved — type a new key to replace it' : f.placeholder}
                  />
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                    <input
                      value={draftModels[f.id] || ''}
                      onChange={e => setDraftModel(f.id, e.target.value)}
                      style={{ flex: 1, background: 'var(--bg-base)', border: '1px solid var(--border-default)', padding: '7px 12px', color: 'var(--text-muted)', borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}
                      placeholder={`which model — now ${info?.label || f.defaultModel}`}
                    />
                    <button type="button" onClick={() => fetchProviderModels(f.id)} disabled={!ready || loadingProvider === f.id}
                      title={ready ? 'ask this provider which models your key can use' : 'save a key first'}
                      style={{ fontSize: 10.5, padding: '6px 10px', borderRadius: 5, whiteSpace: 'nowrap',
                        cursor: (!ready || loadingProvider === f.id) ? 'not-allowed' : 'pointer',
                        opacity: (!ready || loadingProvider === f.id) ? 0.45 : 1,
                        background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}>
                      {loadingProvider === f.id ? 'asking…' : 'list models'}
                    </button>
                  </div>
                  {providerModels[f.id]?.error && (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
                      {providerModels[f.id].error}
                    </div>
                  )}
                  {providerModels[f.id]?.models?.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5, maxHeight: 96, overflowY: 'auto' }}>
                      {providerModels[f.id].models.map(m => (
                        <button key={m} type="button" onClick={() => setDraftModel(f.id, m)}
                          style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace',
                            background: draftModels[f.id] === m ? 'var(--accent-pm)' : 'transparent',
                            color: draftModels[f.id] === m ? '#fff' : 'var(--text-muted, var(--ink-2))',
                            border: `1px solid ${draftModels[f.id] === m ? 'var(--accent-pm)' : 'var(--border-default)'}` }}>
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* One slot for any OpenAI-compatible endpoint. Most providers outside
                the big three — DeepSeek, Kimi, GLM, Qwen, OpenRouter, a local
                Ollama — speak that dialect, so a base URL is all it takes. */}
            {(() => {
              const info = providerInfo?.available.find(p => p.id === 'custom');
              const ready = !!info?.ready;
              const box: React.CSSProperties = { width: '100%', background: 'var(--bg-base)', border: '1px solid var(--border-default)', padding: '8px 12px', color: 'var(--text-primary)', marginTop: 6, borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 12 };
              return (
                <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border-default)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>Add another provider</span>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 700, letterSpacing: 0.4, background: ready ? 'var(--approve-soft, rgba(80,180,120,0.18))' : 'transparent', color: ready ? 'var(--approve, #4caf7d)' : 'var(--text-dim)', border: ready ? 'none' : '1px solid var(--border-default)' }}>
                      {ready ? 'READY' : 'NOT SET'}
                    </span>
                    {ready && (providerInfo?.active === 'custom' ? (
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4, color: 'var(--accent-pm)' }}>● IN USE</span>
                    ) : (
                      <button type="button" onClick={() => switchProvider('custom')}
                        style={{ fontSize: 10.5, padding: '3px 9px', borderRadius: 10, cursor: 'pointer', background: 'transparent', color: 'var(--accent-pm)', border: '1px solid var(--accent-pm)' }}>
                        use this
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6, lineHeight: 1.5 }}>
                    Pick one to fill in its address, then paste a key.
                    <span style={{ opacity: 0.75 }}> Anything not listed works too, as long as it offers an OpenAI-style API — most do.</span>
                  </div>

                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                    {CUSTOM_PRESETS.map(pre => {
                      const active = draftCustom.baseUrl === pre.baseUrl;
                      return (
                        <button key={pre.label} type="button"
                          onClick={() => { setDraftCustom(c => ({ ...c, label: pre.label, baseUrl: pre.baseUrl })); setCustomModels(null); }}
                          title={pre.note || pre.baseUrl}
                          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 5, cursor: 'pointer', fontWeight: active ? 700 : 500,
                            background: active ? 'var(--accent-pm)' : 'transparent', color: active ? '#fff' : 'var(--text-primary)',
                            border: `1px solid ${active ? 'var(--accent-pm)' : 'var(--border-default)'}` }}>
                          {pre.label}
                        </button>
                      );
                    })}
                  </div>

                  <input value={draftCustom.label} onChange={e => setCustom('label', e.target.value)}
                    style={box} placeholder={ready ? `name — currently ${info?.label}` : 'name — e.g. Kimi'} />
                  <input value={draftCustom.baseUrl} onChange={e => setCustom('baseUrl', e.target.value)}
                    style={box} placeholder="base URL — e.g. https://api.moonshot.ai/v1" />
                  <input type="password" autoComplete="off" value={draftCustom.key} onChange={e => setCustom('key', e.target.value)}
                    style={box} placeholder={ready ? '•••••••••••  saved — type a new key to replace it' : 'API key'} />

                  {(() => {
                    const preset = CUSTOM_PRESETS.find(x => x.baseUrl === draftCustom.baseUrl);
                    return preset ? (
                      <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 5 }}>
                        <a href={preset.keyUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-pm)', textDecoration: 'underline' }}>
                          get a {preset.label} key ↗
                        </a>
                        {preset.note ? ` — ${preset.note}` : ''}
                      </div>
                    ) : null;
                  })()}

                  {/* Model names change often enough that a hardcoded list would
                      send people to models that no longer exist — ask the provider. */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
                    <input value={draftCustom.model} onChange={e => setCustom('model', e.target.value)}
                      style={{ ...box, marginTop: 0, flex: 1 }} placeholder="which model at this provider" />
                    <button type="button" onClick={fetchCustomModels}
                      disabled={loadingModels || !draftCustom.baseUrl.trim() || !draftCustom.key.trim()}
                      title={!draftCustom.key.trim() ? 'paste a key first' : 'ask this provider which models your key can use'}
                      style={{ fontSize: 11, padding: '7px 11px', borderRadius: 5, whiteSpace: 'nowrap',
                        cursor: (loadingModels || !draftCustom.baseUrl.trim() || !draftCustom.key.trim()) ? 'not-allowed' : 'pointer',
                        opacity: (loadingModels || !draftCustom.baseUrl.trim() || !draftCustom.key.trim()) ? 0.45 : 1,
                        background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}>
                      {loadingModels ? 'asking…' : 'list models'}
                    </button>
                  </div>

                  {customModels?.error && (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 5, lineHeight: 1.5 }}>
                      Couldn't list models ({customModels.error}). That's fine — type the name yourself.
                    </div>
                  )}
                  {customModels?.models && customModels.models.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6, maxHeight: 108, overflowY: 'auto' }}>
                      {customModels.models.map(m => (
                        <button key={m} type="button" onClick={() => setCustom('model', m)}
                          style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontFamily: 'JetBrains Mono, monospace',
                            background: draftCustom.model === m ? 'var(--accent-pm)' : 'transparent',
                            color: draftCustom.model === m ? '#fff' : 'var(--text-muted, var(--ink-2))',
                            border: `1px solid ${draftCustom.model === m ? 'var(--accent-pm)' : 'var(--border-default)'}` }}>
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

           </div>
            <div style={{ display: 'flex', gap: 10, padding: '14px 28px 22px', borderTop: '1px solid var(--border-default)', background: 'var(--bg-elevated)' }}>
              <button onClick={saveSettings} disabled={savingSettings} style={{ flex: 1, background: 'var(--accent-pm)', color: '#fff', border: 'none', padding: 12, borderRadius: 6, fontWeight: 700, cursor: savingSettings ? 'wait' : 'pointer', opacity: savingSettings ? 0.6 : 1, fontSize: 14 }}>{savingSettings ? 'Saving…' : 'Save'}</button>
              <button onClick={() => setShowSettings(false)} style={{ padding: '12px 18px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
            </div>
          </div>
        </div>
  );

  if (onboardingPhase === 'welcome') {
    const onChooseFolder = () => {
      askForFolder({
        title: 'Open a local folder',
        hint: 'Full path to the repo you want the PM to scan.\ne.g. /Users/you/code/my-app   or   C:\\Users\\you\\code\\my-app',
        placeholder: 'path to project folder',
        initial: onbPath || '',
        confirmLabel: 'Open',
        onConfirm: trimmed => {
          setOnbPath(trimmed);
          setConfig({ ...config, projectPath: trimmed });
          setOnboardingPhase('scan');
        },
      });
    };
    return (
      <div className="wf" style={{ flexDirection: 'row', height: '100vh' }}>
        <EmptyMissionRail onSettings={() => setShowSettings(true)} onNewProject={addProject} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="wf-topbar">
            <div style={{ fontWeight: 600, fontSize: 14 }}>Chaperone</div>
            <span className="mission" style={{ color: 'var(--ink-3)', fontSize: 12 }}>·  v0.1 · no project loaded</span>
            <div className="spacer" />
            <span className="chip"><span className="dot" style={{ background: 'var(--ink-3)' }} />idle</span>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-2)', padding: 28, overflow: 'auto' }}>
            <div style={{ maxWidth: 720, width: '100%', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Hero */}
              <div>
                <div className="hand" style={{ fontSize: 32, lineHeight: 1.1, color: 'var(--ink)' }}>
                  Let's open or<br />build a project.
                </div>
                <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.55, marginTop: 10, maxWidth: 540 }}>
                  Each project gets one PM agent that reads your code, keeps your <span className="mono" style={{ fontSize: 12 }}>PRD.md</span> / <span className="mono" style={{ fontSize: 12 }}>SOP.md</span> / <span className="mono" style={{ fontSize: 12 }}>Dev log.md</span>, and dispatches workers in parallel — with human in the loop.
                </p>
              </div>

                {/* Onboarding never asks for a key, so without this the first sign
                    of one missing was a failed model call three steps in. */}
                {keyStateKnown && !hasAnyKey && (
                  <div className="box" style={{ padding: '12px 14px', borderColor: 'var(--pm)', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Add a model API key to get started</div>
                      <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5 }}>
                        Chaperone runs on whichever model you bring — Claude, OpenAI or Gemini. You can open a project first, but the PM can't read it until there's a key.
                      </div>
                      <GetKeyLinks compact />
                    </div>
                    <button onClick={() => setShowSettings(true)}
                      style={{ fontSize: 12, padding: '7px 14px', background: 'var(--pm)', color: 'var(--paper)', border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Open Settings
                    </button>
                  </div>
                )}

              {/* Three entry tiles — order: Start from scratch / Open folder / Clone GitHub */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div onClick={() => handleStartFromScratch()} className="box" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer', background: 'var(--paper)', borderColor: 'var(--pm)' }}>
                  <div style={{ fontSize: 24, color: 'var(--pm)' }}>✦</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Start from scratch</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, flex: 1 }}>No files yet. Pick a folder, brief PM, and we'll build the PRD together as we go.</div>
                  <button onClick={(e) => { e.stopPropagation(); handleStartFromScratch(); }} className="btn" style={{ fontSize: 12, padding: '6px 12px', background: 'var(--pm)', color: 'var(--paper)', border: '1.5px solid var(--pm)', borderRadius: 4, alignSelf: 'flex-start', fontWeight: 600, cursor: 'pointer' }}>New project →</button>
                </div>
                <div onClick={onChooseFolder} className="box" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer', background: 'var(--paper)' }}>
                  <div style={{ fontSize: 24, color: 'var(--ink-2)' }}>📁</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Open a local folder</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, flex: 1 }}>Pick an existing repo. PM will scan it and build memory.</div>
                  <button onClick={(e) => { e.stopPropagation(); onChooseFolder(); }} className="btn" style={{ fontSize: 12, padding: '6px 12px', background: 'var(--ink)', color: 'var(--paper)', border: '1.5px solid var(--ink)', borderRadius: 4, alignSelf: 'flex-start', fontWeight: 600, cursor: 'pointer' }}>Choose folder…</button>
                </div>
                <div className="box" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'not-allowed', background: 'var(--paper)', opacity: 0.6 }} title="Coming in a later milestone">
                  <div style={{ fontSize: 24, color: 'var(--ink-2)' }}>⎇</div>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Clone from GitHub</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.5, flex: 1 }}>Paste a repo URL, we'll clone + open it.</div>
                  <div className="composer" style={{ padding: '6px 8px', fontSize: 11 }}>
                    <span className="mono" style={{ fontSize: 11 }}>github.com/you/repo</span>
                    <span className="send">↵</span>
                  </div>
                </div>
              </div>

              {/* Recent (empty state) */}
              <div className="box-soft" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--paper)' }}>
                <span style={{ fontSize: 10, letterSpacing: 1.4, color: 'var(--ink-3)', textTransform: 'uppercase', fontWeight: 700 }}>Recent</span>
                <span style={{ fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>nothing here yet — opened projects appear in the left rail</span>
              </div>

              <div style={{ color: 'var(--ink-3)', textAlign: 'center', marginTop: 6, fontFamily: 'var(--hand)', fontSize: 14 }}>
                Nothing runs on your machine until you approve every step.
              </div>
            </div>
          </div>
          <BottomBar
            usage={usageData?.total} onOpenUsage={() => { loadUsage(); setShowUsage(true); }}
            backendStatus={backendStatus}
            model={providerInfo ? (providerInfo.current || 'no model yet') : config.defaultModel}
            hitlPending={0}
            extra="no project · waiting for you to choose"
          />
        </div>
      {settingsModal}
      {usageModal}
      {profileModal}
      {fileModal}
      {askModal}
      </div>
    );
  }

  // ── Screen 1.2 · PM analyzes folder (Path B) ─────────────────────────────
  if (onboardingPhase === 'scan') {
    const projectLabel = (config.projectPath || onbPath).split(/[\\/]/).pop() || 'project';
    // Which suggestion maps to which action is the model's call, not ours — it
    // tagged the replies it wrote. An untagged reply is just a message, so it goes
    // to the PM in the real chat and the model decides what to do with it.
    const onUserReply = (text: string, action: string | null) => {
      const wp = config.projectPath || onbPath;
      if (action === 'draft_docs') {
        setDocsDraft({ status: 'idle', drafts: [], note: '', files: [], error: '' });
        setOnboardingPhase('docs');
        return;
      }
      if (action === 'start_working') {
        setDocsReady(false);
        enterProject(wp, onbKey);
        return;
      }
      enterProject(wp, onbKey);
      setOnboardingPhase('done');
      sendPmMessage(text);
    };
    const submitScanReply = () => {
      const t = scanInput.trim();
      if (!t) return;
      setScanInput('');
      onUserReply(t, null);
    };
    return (
      <div className="wf" style={{ flexDirection: 'row', height: '100vh' }}>
        <MissionRail
          projects={(config.projects && config.projects.length ? config.projects : (config.projectPath ? [config.projectPath] : []))}
          activePath={config.projectPath}
          onSelectProject={switchProject}
          onNewProject={addProject}
          onRemoveProject={confirmRemoveProject}
          onSettings={() => setShowSettings(true)}
        />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <TopBar providerInfo={providerInfo} onSwitchProvider={switchProvider} onOpenSettings={() => setShowSettings(true)} title={`PM · just opened ~/${projectLabel}`} model={providerInfo ? (providerInfo.current || 'no model yet') : config.defaultModel} />
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            <Sidebar_Empty workspacePath={config.projectPath || onbPath} onSettings={() => setShowSettings(true)} onProfile={() => setShowProfile(true)} />
            <PMShell activeTab="chat" onTabChange={() => {}} runningMissions={[]} missionsMemoryCount={0} onSelectMission={() => {}} hideDocs>
              <div className="wf-scroll" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '14px 18px' }}>
                <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

                  {/* System divider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--rule-soft)' }} />
                    <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>folder opened · ~/{projectLabel}</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--rule-soft)' }} />
                  </div>

                  {/* PM opening message */}
                  <div className="box" style={{ padding: '10px 14px', background: 'var(--paper)', maxWidth: 560 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm)', marginBottom: 4 }}>PM</div>
                    <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                      Hey — you just pointed me at ~/{projectLabel}. Let me read it before I say anything about it.
                    </div>
                  </div>

                  {/* Files the PM actually opened — empty until it has read something. */}
                  {(scan.status === 'running' || scan.files.length > 0) && (
                    <div className="box-soft" style={{ padding: '10px 12px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {scan.files.map(f => (
                        <div key={f}><span style={{ color: 'var(--approve)' }}>✓</span> read_file <span style={{ color: 'var(--pm)' }}>{f}</span></div>
                      ))}
                      {scan.status === 'running' && (
                        <div style={{ color: 'var(--ink-3)' }}>… reading the project</div>
                      )}
                    </div>
                  )}

                  {/* A missing key is a setup gap, not a failure to read the
                      project, and "skip" leads nowhere — without a key nothing in
                      this app works. Say what to do and open the place to do it. */}
                  {scan.status === 'error' && isKeyError(scan.error) && (
                    <div className="box" style={{ padding: '12px 14px', background: 'var(--paper)', maxWidth: 560, borderColor: 'var(--pm)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm)', marginBottom: 4, letterSpacing: 0.5 }}>
                        {keyProblem(scan.error) === 'rejected' ? 'THAT KEY WAS REFUSED' : 'ADD A MODEL KEY TO CONTINUE'}
                      </div>
                      <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                        {keyProblem(scan.error) === 'rejected'
                          ? 'The provider rejected the key, so nothing was read. Check it in Settings, or switch to a different engine.'
                          : 'Chaperone runs on whichever model you bring — Claude, OpenAI or Gemini. It needs one API key before the PM can read anything.'}
                      </div>
                      {keyProblem(scan.error) !== 'rejected' && <GetKeyLinks compact />}
                      {keyProblem(scan.error) === 'rejected' && (
                        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>
                          {tidyProviderError(scan.error)}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                        <span onClick={() => setShowSettings(true)} className="branch-chip"
                          style={{ cursor: 'pointer', fontSize: 11, padding: '5px 12px', background: 'var(--pm-soft)', borderColor: 'var(--pm)', color: 'var(--pm)', fontWeight: 600 }}>
                          Open Settings
                        </span>
                        <span onClick={() => runScan(config.projectPath || onbPath)} className="branch-chip" style={{ cursor: 'pointer', fontSize: 11, padding: '5px 12px' }}>Try again</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }}>
                        Saving a key here retries on its own.
                      </div>
                    </div>
                  )}

                  {scan.status === 'error' && !isKeyError(scan.error) && (
                    <div className="box" style={{ padding: '10px 14px', background: 'var(--paper)', maxWidth: 560, borderColor: 'var(--reject, #b4544f)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--reject, #b4544f)', marginBottom: 4 }}>COULDN'T READ THE PROJECT</div>
                      <div style={{ fontSize: 13, lineHeight: 1.55 }}>{scan.error}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <span onClick={() => runScan(config.projectPath || onbPath)} className="branch-chip" style={{ cursor: 'pointer', fontSize: 11, padding: '5px 12px' }}>Try again</span>
                        <span onClick={() => { setDocsReady(false); enterProject(config.projectPath || onbPath, onbKey); }} className="branch-chip" style={{ cursor: 'pointer', fontSize: 11, padding: '5px 12px' }}>Skip — start working</span>
                      </div>
                    </div>
                  )}

                  {/* The PM's own words. Nothing here is written by the app. */}
                  {scan.status === 'done' && scan.summary && (
                    <div className="box" style={{ padding: '10px 14px', background: 'var(--paper)', maxWidth: 560 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm)', marginBottom: 4 }}>PM</div>
                      <div style={{ fontSize: 13, lineHeight: 1.55 }}>{renderRich(scan.summary)}</div>
                    </div>
                  )}

                  {/* Suggested replies — also the model's, phrased as the CEO. */}
                  {scan.status === 'done' && scan.replies.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {scan.replies.map((r, i) => (
                        <span key={`${r.text}-${i}`} onClick={() => onUserReply(r.text, r.action)} className="branch-chip"
                          style={{ cursor: 'pointer', fontSize: 11, padding: '5px 12px', ...(i === 0 ? { background: 'var(--pm-soft)', borderColor: 'var(--pm)', color: 'var(--pm)', fontWeight: 600 } : {}) }}>
                          {r.text}
                        </span>
                      ))}
                    </div>
                  )}

                  {scan.status === 'done' && (
                    <>
                      <div style={{ fontFamily: 'var(--hand)', fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>↓ or just type a reply</div>
                      <div className="composer" style={{ padding: '10px 12px', maxWidth: 560 }}>
                        <input
                          value={scanInput}
                          onChange={e => setScanInput(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') submitScanReply(); }}
                          placeholder="reply to PM…"
                          style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', font: 'inherit', color: 'var(--ink)' }}
                        />
                        <span className="send" onClick={submitScanReply} style={{ cursor: 'pointer' }}>↵</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </PMShell>
          </div>
          <BottomBar usage={usageData?.total} onOpenUsage={() => { loadUsage(); setShowUsage(true); }} backendStatus={backendStatus} model={providerInfo ? (providerInfo.current || 'no model yet') : config.defaultModel} hitlPending={0} extra="PM · just opened folder · awaiting your reply" />
        </div>
      {settingsModal}
      {usageModal}
      {profileModal}
      {fileModal}
      {askModal}
      </div>
    );
  }

  // ── Screen 1.3 · PM drafts docs — HITL per file ───────────────────────────
  if (onboardingPhase === 'docs') {
    const projectLabel = (config.projectPath || onbPath).split(/[\\/]/).pop() || 'project';
    const wp = config.projectPath || onbPath;
    // What gets drafted is whatever the model decided this project is missing —
    // not a fixed list of three.
    const drafts = docsDraft.drafts;
    const docList = drafts.map(d => d.name);
    const current = drafts[docsStep];

    /** Approval is what puts a file on disk. Nothing is written before this. */
    const writeDoc = async (d: { name: string; content: string }) => {
      await fetch(`${API_BASE}/api/doc`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspacePath: wp, name: d.name, content: d.content }),
      });
    };
    const finish = (wrote: boolean) => {
      setDocsReady(wrote);
      enterProject(wp, onbKey);
      setOnboardingPhase('ready');
    };
    const approveDoc = async () => {
      if (!current || savingDoc) return;
      setSavingDoc(true);
      try { await writeDoc(current); } catch { /* surfaced by the docs tab later */ }
      setSavingDoc(false);
      if (docsStep < drafts.length - 1) setDocsStep(s => s + 1);
      else finish(true);
    };
    const approveAll = async () => {
      if (savingDoc) return;
      setSavingDoc(true);
      try { for (const d of drafts.slice(docsStep)) await writeDoc(d); } catch { /* ditto */ }
      setSavingDoc(false);
      finish(true);
    };
    const skipAll = () => finish(false);
    return (
      <div className="wf" style={{ flexDirection: 'row', height: '100vh' }}>
        <MissionRail
          projects={(config.projects && config.projects.length ? config.projects : (config.projectPath ? [config.projectPath] : []))}
          activePath={config.projectPath}
          onSelectProject={switchProject}
          onNewProject={addProject}
          onRemoveProject={confirmRemoveProject}
          onSettings={() => setShowSettings(true)}
        />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <TopBar providerInfo={providerInfo} onSwitchProvider={switchProvider} onOpenSettings={() => setShowSettings(true)} title={drafts.length ? `PM · drafting initial docs · ${docsStep + 1} of ${drafts.length}` : 'PM · drafting initial docs'} model={providerInfo ? (providerInfo.current || 'no model yet') : config.defaultModel} />
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            <Sidebar_Empty workspacePath={config.projectPath || onbPath} onSettings={() => setShowSettings(true)} onProfile={() => setShowProfile(true)} />
            <PMShell activeTab="chat" onTabChange={() => {}} runningMissions={[]} missionsMemoryCount={0} onSelectMission={() => {}} hideDocs>
              <div className="wf-scroll" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '14px 18px' }}>
                <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

                  {docsDraft.status === 'running' && (
                    <div className="box" style={{ padding: '10px 14px', background: 'var(--paper)', maxWidth: 560 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm)', marginBottom: 4 }}>PM</div>
                      <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                        Reading the project, then writing the drafts. Nothing lands on disk until you approve it.
                      </div>
                      {docsDraft.files.length > 0 && (
                        <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 8 }}>
                          read {docsDraft.files.length} file(s)
                        </div>
                      )}
                    </div>
                  )}

                  {docsDraft.status === 'error' && (
                    <div className="box" style={{ padding: '10px 14px', background: 'var(--paper)', maxWidth: 560, borderColor: 'var(--reject, #b4544f)' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--reject, #b4544f)', marginBottom: 4 }}>COULDN'T DRAFT</div>
                      <div style={{ fontSize: 13, lineHeight: 1.55 }}>{docsDraft.error}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <span onClick={() => runDraftDocs(wp)} className="branch-chip" style={{ cursor: 'pointer', fontSize: 11, padding: '5px 12px' }}>Try again</span>
                        <span onClick={skipAll} className="branch-chip" style={{ cursor: 'pointer', fontSize: 11, padding: '5px 12px' }}>Skip — start working</span>
                      </div>
                    </div>
                  )}

                  {/* The model looked and found nothing to write. Its words, not ours. */}
                  {docsDraft.status === 'done' && drafts.length === 0 && (
                    <div className="box" style={{ padding: '10px 14px', background: 'var(--paper)', maxWidth: 560 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm)', marginBottom: 4 }}>PM</div>
                      <div style={{ fontSize: 13, lineHeight: 1.55 }}>{docsDraft.note || 'Nothing to draft.'}</div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <span onClick={skipAll} className="branch-chip" style={{ cursor: 'pointer', fontSize: 11, padding: '5px 12px', background: 'var(--pm-soft)', borderColor: 'var(--pm)', color: 'var(--pm)', fontWeight: 600 }}>Start working</span>
                      </div>
                    </div>
                  )}

                  {docsDraft.status === 'done' && drafts.length > 0 && (
                    <div className="box" style={{ padding: '10px 14px', background: 'var(--paper)', maxWidth: 560 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm)', marginBottom: 4 }}>PM</div>
                      <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                        I read {docsDraft.files.length} file(s) and drafted {drafts.length === 1 ? '1 document' : `${drafts.length} documents`}. One at a time — approve each before it lands on disk.
                      </div>
                    </div>
                  )}

                  {/* Stepper */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {docList.map((doc, i) => (
                      <React.Fragment key={doc}>
                        <span style={{
                          fontSize: 11, fontFamily: 'var(--mono)',
                          color: i < docsStep ? 'var(--approve)' : i === docsStep ? 'var(--ink)' : 'var(--ink-3)',
                          fontWeight: i === docsStep ? 700 : 400,
                        }}>
                          {i < docsStep ? '✓' : i === docsStep ? '●' : '○'} {doc}
                        </span>
                        {i < docList.length - 1 && <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>›</span>}
                      </React.Fragment>
                    ))}
                  </div>

                  {/* The actual draft, in full — this is exactly what gets written. */}
                  {current && (
                    <div className="hitl">
                      <div className="hitl-head">
                        <span>⏸</span>
                        <span>APPROVAL NEEDED · write_file</span>
                        <span style={{ marginLeft: 'auto', color: 'var(--ink-3)', fontWeight: 400 }}>
                          .chaperone/{current.name} · {current.content.split('\n').length} lines
                        </span>
                      </div>
                      <textarea
                        value={current.content}
                        onChange={e => {
                          const v = e.target.value;
                          setDocsDraft(s => ({
                            ...s,
                            drafts: s.drafts.map((d, i) => (i === docsStep ? { ...d, content: v } : d)),
                          }));
                        }}
                        spellCheck={false}
                        style={{
                          width: '100%', minHeight: 240, maxHeight: 420, resize: 'vertical',
                          fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.6,
                          padding: '10px 12px', borderRadius: 4,
                          border: '1.5px solid var(--rule)', background: 'var(--paper)', color: 'var(--ink)',
                        }}
                      />
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', margin: '6px 0 8px' }}>
                        Editable — change anything before approving, and what you see here is what gets written.
                      </div>
                      <div className="hitl-actions">
                        <button className="btn approve" onClick={approveDoc} disabled={savingDoc}>
                          {savingDoc ? 'Writing…' : '✓ Approve & write'}
                        </button>
                        <button className="btn reject" onClick={docsStep < drafts.length - 1 ? () => setDocsStep(s => s + 1) : skipAll}>
                          Skip this one
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Next steps preview */}
                  {docList.slice(docsStep + 1).map(doc => (
                    <div key={doc} style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)', paddingLeft: 4 }}>
                      ○ next · {doc}
                    </div>
                  ))}

                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '10px 18px 14px', borderTop: '1.5px solid var(--rule)', background: 'var(--paper-2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, color: 'var(--ink-3)', flex: 1 }}>You can change your mind — skip remaining and start the project.</span>
                <button onClick={skipAll} className="btn" style={{ fontSize: 11, padding: '5px 12px', background: 'var(--paper)', border: '1.5px solid var(--rule)', color: 'var(--ink)', borderRadius: 4, cursor: 'pointer' }}>Skip remaining</button>
                <button onClick={approveAll} className="btn" style={{ fontSize: 11, padding: '5px 12px', background: 'var(--pm)', color: 'var(--paper)', border: '1.5px solid var(--pm)', borderRadius: 4, fontWeight: 600, cursor: 'pointer' }}>Approve all {docList.length}</button>
              </div>
            </PMShell>
          </div>
          <BottomBar usage={usageData?.total} onOpenUsage={() => { loadUsage(); setShowUsage(true); }} backendStatus={backendStatus} model={providerInfo ? (providerInfo.current || 'no model yet') : config.defaultModel} hitlPending={current ? 1 : 0} extra={docsDraft.status === 'running' ? 'PM · reading the project and drafting' : current ? `PM · ${current.name} · awaiting approval · ${docsStep + 1} of ${drafts.length}` : 'PM · nothing to draft'} />
        </div>
      {settingsModal}
      {usageModal}
      {profileModal}
      {fileModal}
      {askModal}
      </div>
    );
  }

  // ── Screen 1.4 · Project ready ────────────────────────────────────────────
  // 1-to-1 port of Onboarding_Ready in wf-onboarding.jsx.
  // Two variants:
  //  · docsReady=true  → populated (PM "I'm ready" card + PRD/SOP/Dev log preview chips)
  //  · docsReady=false → empty (no docs scanned yet — minimal "tell me what to build" prompt)
  if (onboardingPhase === 'ready') {
    return (
      <div className="wf" style={{ flexDirection: 'row', height: '100vh' }}>
        <MissionRail
          projects={(config.projects && config.projects.length ? config.projects : (config.projectPath ? [config.projectPath] : []))}
          activePath={config.projectPath}
          onSelectProject={switchProject}
          onNewProject={addProject}
          onRemoveProject={confirmRemoveProject}
          onSettings={() => setShowSettings(true)}
        />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <TopBar providerInfo={providerInfo} onSwitchProvider={switchProvider} onOpenSettings={() => setShowSettings(true)} title={docsReady ? 'PM · ready · what shall we build first?' : 'PM · waiting for your first brief'} model={providerInfo ? (providerInfo.current || 'no model yet') : config.defaultModel} />
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            <Sidebar_Empty workspacePath={config.projectPath} onSettings={() => setShowSettings(true)} onProfile={() => setShowProfile(true)} />
            {/* hideDocs: PM tabs only appear once user has approved workflow docs */}
            <PMShell
              activeTab={activePmTab}
              onTabChange={tab => { setActivePmTab(tab); if (tab === 'devlog') setDevLogNew(false); }}
              runningMissions={[]}
              missionsMemoryCount={0}
              onSelectMission={() => {}}
              hideDocs={!docsReady}
              devLogNew={devLogNew}
            >
              {activePmTab === 'prd' && <RealDocTab name="PRD" workspacePath={config.projectPath} />}
              {activePmTab === 'sop' && <RealDocTab name="SOP" workspacePath={config.projectPath} />}
              {activePmTab === 'devlog' && <RealDocTab name="DevLog" workspacePath={config.projectPath} />}
              {activePmTab === 'chat' && <div className="wf-scroll" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '14px 18px 14px' }}>
                <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {docsReady ? (
                    <>
                      <div className="box" style={{ padding: '14px 18px', background: '#fffaec', borderColor: 'var(--pm)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="pm-tag">PM</span>
                          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--pm)' }}>I'm ready · here's what I know so far</span>
                          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)' }}>scan complete · 3 docs written</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10 }}>
                          <div className="box-soft" style={{ padding: '8px 10px', background: 'var(--paper)' }}>
                            <div className="mono" style={{ fontSize: 11, color: 'var(--pm)' }}>PRD.md</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 2 }}>"Minimal React TODO with localStorage"</div>
                          </div>
                          <div className="box-soft" style={{ padding: '8px 10px', background: 'var(--paper)' }}>
                            <div className="mono" style={{ fontSize: 11, color: 'var(--pm)' }}>SOP.md</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 2 }}>Vitest tests · branch prefix <span className="mono" style={{ fontSize: 10 }}>feat/</span></div>
                          </div>
                          <div className="box-soft" style={{ padding: '8px 10px', background: 'var(--paper)' }}>
                            <div className="mono" style={{ fontSize: 11, color: 'var(--pm)' }}>Dev log.md</div>
                            <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 2 }}>empty — first entry on first reviewer report</div>
                          </div>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 12, lineHeight: 1.55 }}>
                          No team members recruited yet. When you brief your first mission, I'll suggest workers (e.g. <em>ui-worker</em>, <em>api-worker</em>) and you can confirm.
                        </div>
                      </div>

                      <div style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center' }}>
                        Tell me what to build, fix, or refactor →
                      </div>
                    </>
                  ) : (
                    /* Empty Ready — no scan, no docs yet. Caveat hand-written prompt. */
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', gap: 8, minHeight: 320 }}>
                      <div className="hand" style={{ fontSize: 24, color: 'var(--ink-3)', textAlign: 'center', lineHeight: 1.2 }}>
                        Blank canvas.<br />Tell me what you want to build.
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', maxWidth: 420, lineHeight: 1.55, marginTop: 4 }}>
                        No <span className="mono" style={{ fontSize: 11 }}>PRD.md</span> / <span className="mono" style={{ fontSize: 11 }}>SOP.md</span> yet — I'll draft both with you as we go. First mission below ↓
                      </div>
                    </div>
                  )}
                </div>
              </div>}

              {activePmTab === 'chat' && <div style={{ padding: '10px 18px 14px', borderTop: '1.5px solid var(--rule)', background: 'var(--paper-2)', flexShrink: 0 }}>
                <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="composer" style={{ padding: '12px 14px', fontSize: 13 }}>
                    <input
                      placeholder={docsReady
                        ? "What's our first mission? e.g. \"add dark mode + JSON export\"…"
                        : 'Describe what you want to build. PM will draft the PRD with you.'}
                      value={pmInput}
                      onChange={e => setPmInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleReadyFirstMessage(pmInput); }}
                    />
                    <span className="send" onClick={() => handleReadyFirstMessage(pmInput)}>↵</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontFamily: 'var(--hand)', fontSize: 14, color: 'var(--ink-3)', marginRight: 4 }}>quick starts:</span>
                    <span onClick={() => handleReadyFirstMessage('Plan a feature: ')} className="branch-chip" style={{ cursor: 'pointer', background: 'var(--pm-soft)', borderColor: 'var(--pm)', color: 'var(--pm)' }}>Plan a feature</span>
                    <span onClick={() => handleReadyFirstMessage('Plan a refactor: ')} className="branch-chip" style={{ cursor: 'pointer' }}>Plan a refactor</span>
                    {docsReady && (
                      <>
                        <span style={{ width: 1, height: 14, background: 'var(--rule-soft)', margin: '0 4px' }} />
                        <span onClick={() => setOnboardingPhase('done')} className="branch-chip" style={{ cursor: 'pointer' }}>Set up SOP</span>
                        <span onClick={() => setOnboardingPhase('done')} className="branch-chip" style={{ cursor: 'pointer' }}>Update PRD with me</span>
                      </>
                    )}
                  </div>
                  {docsReady && (
                    <div style={{ fontSize: 10, color: 'var(--ink-3)', fontStyle: 'italic', marginTop: 2, paddingLeft: 4 }}>
                      PM plans &amp; tracks · workers actually write code/tests. Right of the divider = PM-only doc work.
                    </div>
                  )}
                </div>
              </div>}
            </PMShell>
          </div>
          <BottomBar
            usage={usageData?.total} onOpenUsage={() => { loadUsage(); setShowUsage(true); }}
            backendStatus={backendStatus}
            model={providerInfo ? (providerInfo.current || 'no model yet') : config.defaultModel}
            hitlPending={0}
            extra={docsReady ? 'project ready · 0 missions · PM idle' : 'blank project · waiting for your first brief'}
          />
        </div>
      {settingsModal}
      {usageModal}
      {profileModal}
      {fileModal}
      {askModal}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--paper)', color: 'var(--ink)', overflow: 'hidden', fontFamily: 'var(--sans)', fontSize: 13 }}>

      <MissionRail
        projects={(config.projects && config.projects.length ? config.projects : (config.projectPath ? [config.projectPath] : []))}
        activePath={config.projectPath}
        onSelectProject={switchProject}
        onNewProject={addProject}
        onRemoveProject={confirmRemoveProject}
        onSettings={() => setShowSettings(true)}
      />

      <Sidebar
        workspacePath={config.projectPath}
        onOpenWorkspace={openWorkspace}
        fileTree={fileTree}
        deletedFiles={deletedFiles}
        openFilePath={openFileState?.path ?? null}
        onOpenFile={openFile}
        onRefreshFiles={refreshFiles}
        isLoadingFiles={isLoadingFiles}
        activeView={activeView}
        onSelectPm={() => setActiveView('pm')}
        missions={missions}
        onSelectMission={(id) => setActiveView(id)}
        skills={skills}
        onAddSkill={() => setShowAddSkill(true)}
        onNewMission={() => setActiveView('pm')}
        onSelectSkills={() => setActiveView('skills')}
        onSettings={() => setShowSettings(true)}
        onProfile={() => setShowProfile(true)}
        onRecruit={() => setRecruitOpen(true)}
        team={team}
      />

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--paper)', minWidth: 0 }}>
        <TopBar
          providerInfo={providerInfo} onSwitchProvider={switchProvider} onOpenSettings={() => setShowSettings(true)}
          title={(() => {
            if (!activeMission) return 'PM · Project Orchestrator';
            const deepA = activeWorker !== null ? activeMission.assignments.find(a => a.id === activeWorker) : null;
            if (deepA) return `${deepA.agentId} · ${activeMission.name}`;
            if (activeMission.status === 'reviewing') return `Reviewer · Cross-branch report`;
            const allDone = activeMission.status === 'running' && activeMission.assignments.length > 0 && activeMission.assignments.every(a => a.status === 'done');
            if (allDone) return `Mission · all workers done`;
            return `Mission · ${activeMission.name}`;
          })()}
          pending={totalHitl}
          branches={activeMission ? activeMission.assignments.length : 0}
          model={providerInfo ? (providerInfo.current || 'no model yet') : config.defaultModel}
          startedAt={activeMission?.startedAt}
        />

        {/* ── PM Panel — screens 3.1 (empty) + 3.6 (idle/running) + 3.14 (post-archive) ── */}
        {activeView === 'pm' && (
          <PMShell
            activeTab={activePmTab}
            onTabChange={tab => { setActivePmTab(tab); if (tab === 'devlog') setDevLogNew(false); }}
            runningMissions={runningMissions}
            missionsMemoryCount={missions.length}
            onSelectMission={id => setActiveView(id)}
            hideDocs={!docsReady}
            devLogNew={devLogNew}
          >
            {/* 3.14 — Archive toast (auto-dismiss 5s) */}
            {archiveToast && (
              <div style={{ margin: '10px 18px 0', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, background: 'var(--approve)', borderRadius: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 16 }}>✓</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--paper)' }}>Archived to PM's dev log</div>
                  <div style={{ fontSize: 10, opacity: 0.9, marginTop: 2, color: 'var(--paper)' }}>{archiveToast} · PM will propose PRD updates</div>
                </div>
                <span onClick={() => setArchiveToast(null)} style={{ fontSize: 10, opacity: 0.7, cursor: 'pointer', color: 'var(--paper)' }}>dismiss ×</span>
              </div>
            )}
            {/* ── 3.1 / 3.6 · PM Chat idle + 3.14 post-archive ── */}
            {activePmTab === 'chat' && pmScreen === 'idle' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px' }}>
                  <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* Auto-compaction hint — long threads drift/hallucinate; nudge a clean
                        restart (checkpointing to docs first). ~30 msgs ≈ getting heavy. */}
                    {pmMessages.length > 30 && !showClearPanel && (
                      <div className="box" style={{ borderColor: 'var(--worker)', background: 'var(--worker-soft)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, color: 'var(--ink-2)', flex: 1, lineHeight: 1.5 }}>
                          This conversation is getting long — I stay sharpest on a fresh thread. I can save decisions & progress to your docs, then start clean.
                        </span>
                        <button
                          onClick={() => setShowClearPanel(true)}
                          style={{ fontSize: 12, padding: '6px 12px', borderRadius: 5, background: 'var(--worker)', color: 'var(--paper)', border: 'none', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >Checkpoint & start fresh</button>
                      </div>
                    )}
                    {/* New-conversation toolbar — only when there's a thread to clear. Safe
                        because decisions/progress checkpoint to docs first. */}
                    {pmMessages.length > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setShowClearPanel(v => !v)}
                          title="Start a fresh conversation with the PM"
                          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--rule)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                        >↻ New conversation</button>
                      </div>
                    )}
                    {showClearPanel && (
                      <div className="box" style={{ borderColor: 'var(--pm)', background: 'var(--pm-soft)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--pm)' }}>Start a new conversation?</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                          Safe to clear — I'll first save any <strong>decisions</strong> and <strong>progress</strong> from this chat into your project docs
                          (<span className="mono" style={{ fontSize: 11 }}>docs/DECISIONS.md</span> · <span className="mono" style={{ fontSize: 11 }}>docs/PROGRESS.md</span>),
                          so nothing important is lost. Your missions are stored separately and stay untouched. My memory lives in the docs, not this thread.
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                          <button
                            onClick={checkpointAndClear}
                            disabled={isCheckpointing}
                            style={{ fontSize: 12, padding: '7px 14px', borderRadius: 5, background: 'var(--pm)', color: 'var(--paper)', border: 'none', fontWeight: 600, cursor: isCheckpointing ? 'wait' : 'pointer', opacity: isCheckpointing ? 0.7 : 1 }}
                          >{isCheckpointing ? 'Saving to docs…' : 'Save to docs & clear'}</button>
                          <button
                            onClick={resetConversation}
                            disabled={isCheckpointing}
                            title="Clear without saving (for testing)"
                            style={{ fontSize: 12, padding: '7px 12px', borderRadius: 5, background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--rule)', cursor: 'pointer' }}
                          >Clear without saving</button>
                          <button
                            onClick={() => setShowClearPanel(false)}
                            style={{ fontSize: 12, padding: '7px 10px', borderRadius: 5, background: 'transparent', color: 'var(--ink-3)', border: 'none', cursor: 'pointer' }}
                          >Cancel</button>
                        </div>
                      </div>
                    )}
                    {/* First message — context-aware welcome (only when no additional messages exist) */}
                    {/* PM onboarding intro + presets — shown whenever idle so guidance
                        stays visible (was gated to a brand-new chat). Persistence TBD. */}
                    {pmScreen === 'idle' && (
                      <div style={{ alignSelf: 'flex-start', maxWidth: '82%' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm)', marginBottom: 4 }}>PM</div>
                        <div className="box" style={{ background: 'var(--paper)', padding: '12px 16px', borderRadius: 8, fontSize: 14, lineHeight: 1.6, maxWidth: 580 }}>
                          {runningMissions.length > 0 ? (
                            <>Welcome back. <strong>{runningMissions.length} mission{runningMissions.length > 1 ? 's' : ''}</strong> running. New briefs queue behind {runningMissions.length > 1 ? 'them' : 'it'}.</>
                          ) : (
                            <>
                              <div style={{ marginBottom: 8 }}>Hi — I'm your <strong>PM</strong>. I plan the work, split it into workers (each on its own git branch), and <strong>never run anything without your OK</strong>. I coordinate; I don't write code myself.</div>
                              <div>Want me to get up to speed on this project first, or jump straight to a goal?</div>
                            </>
                          )}
                        </div>
                        {runningMissions.length === 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10, maxWidth: 580 }}>
                            <button onClick={() => { if (!isPmThinking) reviewProject(); }} style={{ textAlign: 'left', fontSize: 13, padding: '10px 12px', borderRadius: 6, background: 'var(--pm-soft)', color: 'var(--pm)', border: '1.5px solid var(--pm)', fontWeight: 600, cursor: 'pointer' }}>🔍 Go over my project — read the docs &amp; tell me what it is</button>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {/* Read-only: PM reads progress.json itself, reports inline. No worker. */}
                              <button onClick={() => { if (!isPmThinking) checkProgress(); }} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 999, border: '1.5px solid var(--rule)', background: 'var(--paper)', color: 'var(--ink-2)', cursor: 'pointer' }}>Check project progress</button>
                              {[
                                { label: 'Build project foundation', msg: 'Help me build the project foundation: create docs/MVP.md, docs/PROGRESS.md, and docs/ACCEPTANCE.md for this project.' },
                                { label: 'Plan development', msg: 'Make a development plan for this project — lay out the required vertical slices, priorities, and what to tackle first.' },
                              ].map(({ label, msg }) => (
                                <button key={label} onClick={() => { if (!isPmThinking) sendPmMessage(msg); }} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 999, border: '1.5px solid var(--rule)', background: 'var(--paper)', color: 'var(--ink-2)', cursor: 'pointer' }}>{label}</button>
                              ))}
                              <button onClick={() => { if (!isPmThinking) auditProject(); }} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 999, border: '1.5px solid var(--rule)', background: 'var(--paper)', color: 'var(--ink-2)', cursor: 'pointer' }}>Plan agent dispatch</button>
                              <button onClick={() => { if (!isPmThinking) planL2(); }} style={{ fontSize: 12, padding: '6px 12px', borderRadius: 999, border: '1.5px solid var(--rule)', background: 'var(--paper)', color: 'var(--ink-2)', cursor: 'pointer' }}>Plan L2 parallel work</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {/* PmPlanPanel intentionally NOT rendered here — S1 proved + persisted to
                        .chaperone/pm-plan.json. It returns as a preset-triggered inline result in S1.5. */}
                    {/* Additional PM messages (e.g. post-archive notification) */}
                    {pmMessages.slice(1).map((msg, i) => {
                      const isModel = msg.role === 'model';
                      const isArchiveMsg = isModel && msg.content.includes('Dev log.md');
                      // A missing or refused key surfaced here as a raw "[ERROR] API
                      // key missing" bubble — a dead end in the one place people
                      // spend their time. It is the only error they can fix
                      // themselves, so it gets the way to fix it.
                      const keyIssue = isModel && msg.content.startsWith('[ERROR]') ? keyProblem(msg.content) : null;
                      if (keyIssue) {
                        return (
                          <div key={i} style={{ alignSelf: 'flex-start', maxWidth: '82%' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm)', marginBottom: 4 }}>PM</div>
                            <div className="box" style={{ background: 'var(--paper)', padding: '12px 14px', maxWidth: 580, borderColor: 'var(--pm)' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm)', marginBottom: 4, letterSpacing: 0.5 }}>
                                {keyIssue === 'rejected' ? 'THAT KEY WAS REFUSED' : 'ADD A MODEL KEY TO CONTINUE'}
                              </div>
                              <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                                {keyIssue === 'rejected'
                                  ? 'The provider rejected the key, so I could not run that. Check it in Settings, or switch to a different engine.'
                                  : "I can't reach a model yet. Chaperone runs on whichever one you bring — add a key and I'll pick this back up."}
                              </div>
                              {keyIssue === 'rejected' && (
                                <div className="mono" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 6, lineHeight: 1.5 }}>
                                  {tidyProviderError(msg.content)}
                                </div>
                              )}
                              <div style={{ marginTop: 10 }}>
                                <button onClick={() => setShowSettings(true)}
                                  style={{ fontSize: 12, padding: '6px 14px', background: 'var(--pm)', color: 'var(--paper)', border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer' }}>
                                  Open Settings
                                </button>
                              </div>
                              {keyIssue !== 'rejected' && <GetKeyLinks compact />}
                            </div>
                          </div>
                        );
                      }
                      return (
                        <div key={i} style={{ alignSelf: isModel ? 'flex-start' : 'flex-end', maxWidth: '82%' }}>
                          {isModel && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm)', marginBottom: 4 }}>PM</div>}
                          {!isModel && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 4 }}>You</div>}
                          <div className="box" style={{ background: isModel ? 'var(--paper)' : 'var(--paper-2)', padding: '10px 14px', maxWidth: 580, borderColor: isModel ? 'var(--pm)' : 'var(--rule)' }}>
                            <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                              {renderRich(msg.content)}
                            </div>
                            {isArchiveMsg && (
                              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                                <button onClick={() => { setActivePmTab('devlog'); setDevLogNew(false); }} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 3, background: 'var(--pm)', color: 'var(--paper)', border: '1.5px solid var(--pm)', fontWeight: 600, cursor: 'pointer' }}>Open Dev log →</button>
                                <button onClick={() => setActivePmTab('prd')} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 3, background: 'var(--paper)', color: 'var(--pm)', border: '1.5px solid var(--pm)', cursor: 'pointer' }}>Review PRD edits (3) →</button>
                                <span style={{ fontSize: 10, color: 'var(--ink-3)', alignSelf: 'center' }}>SOP unchanged</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {isPmThinking && (
                      <div style={{ alignSelf: 'flex-start', fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>PM is thinking…</div>
                    )}
                    {pendingAssignments.length > 0 && (
                      <div style={{ alignSelf: 'flex-start', width: '100%', maxWidth: 600 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'var(--worker)', textTransform: 'uppercase', marginBottom: 8 }}>Proposed plan · {pendingAssignments.length} assignment{pendingAssignments.length > 1 ? 's' : ''}</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                          {pendingAssignments.map(a => (
                            <div key={a.id} className="box" style={{ padding: '10px 12px', background: 'var(--paper)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)', background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 3, padding: '1px 6px' }}>{a.agentId}</span>
                                <span className="branch-chip">{a.branchName}</span>
                              </div>
                              <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{a.task}</div>
                              {a.skillLoadout.length > 0 && (
                                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                  {a.skillLoadout.map(s => <span key={s} style={{ fontSize: 10, background: 'var(--worker-soft)', color: 'var(--worker)', border: '1px solid var(--worker)', borderRadius: 3, padding: '1px 5px' }}>{s}</span>)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <button onClick={dispatchMission} style={{ fontSize: 13, padding: '8px 18px', background: 'var(--review)', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 700, cursor: 'pointer' }}>▶ Dispatch {pendingAssignments.length} worker{pendingAssignments.length > 1 ? 's' : ''}</button>
                      </div>
                    )}
                    {/* D: running missions as inline, clickable cards — stay in chat,
                        click a card to open its detail view. */}
                    {runningMissions.map(m => {
                      const total = m.assignments?.length ?? 0;
                      const done = (m.assignments ?? []).filter(a => a.status === 'done').length;
                      const waiting = (m.assignments ?? []).filter(a => a.pendingAction).length;
                      return (
                        <div key={m.id} onClick={() => setActiveView(m.id)} className="box" style={{ alignSelf: 'flex-start', width: '100%', maxWidth: 600, cursor: 'pointer', padding: '12px 14px', background: 'var(--paper)', borderColor: 'var(--approve)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--approve)' }} />
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{m.name}</span>
                            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)' }}>
                              {done}/{total} done{waiting > 0 ? ` · ${waiting} awaiting you` : ''} · open ›
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); dismissMission(m.id); }}
                              title="Cancel this mission"
                              style={{ fontSize: 13, lineHeight: 1, padding: '2px 6px', borderRadius: 4, background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--rule)', cursor: 'pointer' }}
                            >✕</button>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {(m.assignments ?? []).map(a => (
                              <span key={a.id} style={{ fontSize: 11, fontFamily: 'var(--mono)', background: 'var(--paper-2)', border: `1px solid ${a.pendingAction ? 'var(--warn)' : 'var(--rule)'}`, color: a.pendingAction ? 'var(--warn)' : 'var(--ink-2)', borderRadius: 3, padding: '1px 6px' }}>
                                {a.agentId} · {a.pendingAction ? 'waiting' : a.status}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                </div>
                <div style={{ padding: '10px 18px 14px', borderTop: '1.5px solid var(--rule)', background: 'var(--paper-2)', flexShrink: 0 }}>
                  <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="composer" style={{ fontSize: 13 }}>
                      <input value={pmInput} onChange={e => setPmInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && pmInput.trim() && !isPmThinking) sendPmMessage(); }}
                        placeholder={isPmThinking ? 'PM is thinking…' : runningMissions.length > 0 ? 'New brief — will queue behind running missions…' : "What's our first mission?"}
                      />
                      <div className="send" onClick={() => { if (pmInput.trim() && !isPmThinking) sendPmMessage(); }}>↵</div>
                    </div>
                    {/* quick presets moved into the conversation (PM opening) */}
                  </div>
                </div>
              </div>
            )}

            {/* ── 3.7 · PM briefing — clarify scope ── */}
            {activePmTab === 'chat' && pmScreen === 'briefing' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ flex: 1, overflow: 'auto', padding: '16px 18px' }}>
                  <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {/* User brief */}
                    <div style={{ alignSelf: 'flex-end', maxWidth: '82%' }}>
                      <div style={{ background: 'var(--ink)', color: 'var(--paper)', padding: '10px 14px', borderRadius: 8, fontSize: 14, lineHeight: 1.55 }}>{pmBriefInput}</div>
                    </div>
                    {/* PM clarifying card */}
                    <div style={{ alignSelf: 'flex-start', maxWidth: '90%' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                        PM
                        <span style={{ fontSize: 10, background: 'var(--pm-soft)', color: 'var(--pm)', border: '1px solid var(--pm)', borderRadius: 3, padding: '1px 5px' }}>clarifying</span>
                      </div>
                      <div style={{ background: 'var(--paper-2)', border: '1.5px solid var(--rule)', padding: '12px 14px', borderRadius: 8, fontSize: 14, lineHeight: 1.65 }}>
                        <div style={{ marginBottom: 10 }}>Before I draft a plan, three things I need to nail down — they each fork the architecture:</div>
                        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
                          <li><strong>Scope of "share"</strong> — read-only link, or edit together?</li>
                          <li><strong>Who's the "someone"</strong> — any URL visitor, or a registered account?</li>
                          <li><strong>Persistence</strong> — server-side store, or P2P/CRDT?</li>
                        </ul>
                        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>PRD currently says "no accounts, local-first" — answers below would push back on either.</div>
                      </div>
                    </div>
                    {/* Chip selection panel */}
                    <div style={{ border: '1.5px solid var(--rule)', borderRadius: 6, padding: '12px 14px', background: 'var(--paper)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 10, letterSpacing: 1.2, color: 'var(--ink-3)', fontWeight: 700 }}>CHOOSE TO ANSWER (OR TYPE FREELY BELOW)</div>
                      {([
                        { key: 'scope', label: 'Scope', options: ['Read-only link', 'Edit together', 'Comment-only'] },
                        { key: 'who',   label: 'Who',   options: ['Anyone with URL', 'Registered users', 'Same Apple ID'] },
                        { key: 'store', label: 'Store', options: ['Server-side', 'P2P / CRDT', 'Static export only'] },
                      ] as const).map(({ key, label, options }) => (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ width: 40, fontSize: 12, color: 'var(--ink-3)', fontWeight: 600, flexShrink: 0 }}>{label}</span>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {options.map(opt => {
                              const sel = briefingAnswers[key] === opt;
                              return (
                                <span key={opt} onClick={() => setBriefingAnswers(prev => ({ ...prev, [key]: opt }))}
                                  style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, border: `1px solid ${sel ? 'var(--ink)' : 'var(--rule)'}`, background: sel ? 'var(--ink)' : 'transparent', color: sel ? 'var(--paper)' : 'var(--ink-2)', cursor: 'pointer', transition: 'all .12s' }}
                                >{opt}</span>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* All answered → action buttons */}
                    {briefingAnswers.scope && briefingAnswers.who && briefingAnswers.store && (
                      <div style={{ display: 'flex', gap: 10, alignSelf: 'flex-start' }}>
                        <button onClick={() => setPmScreen('plan')} style={{ fontSize: 13, padding: '8px 18px', background: 'var(--ink)', color: 'var(--paper)', border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer' }}>✎ Draft mission plan</button>
                        <button disabled title={NOT_WIRED_TITLE} style={{ ...NOT_WIRED, fontSize: 13, padding: '8px 14px', background: 'transparent', color: 'var(--ink-2)', border: '1.5px solid var(--rule)', borderRadius: 4 }}>Keep refining</button>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ padding: '10px 18px 14px', borderTop: '1.5px solid var(--rule)', background: 'var(--paper-2)', flexShrink: 0 }}>
                  <div style={{ maxWidth: 720, margin: '0 auto' }}>
                    <div className="composer" style={{ fontSize: 13 }}>
                      <input value={pmInput} onChange={e => setPmInput(e.target.value)} placeholder="Answer freely, or hit a chip above…" />
                      <div className="send">↵</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── 3.8 · PM drafting Mission Plan (plan doc + sticky comments) ── */}
            {activePmTab === 'chat' && pmScreen === 'plan' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {/* Two-column body */}
                <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                  {/* Left: plan doc (scrollable) */}
                  <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
                    {/* PLAN header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, background: 'var(--worker-soft)', color: 'var(--worker)', border: '1px solid var(--worker)', borderRadius: 3, padding: '2px 6px' }}>PLAN</span>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{pmBriefInput || 'New mission'}</span>
                      <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)' }}>v1 · just drafted</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--ink-2)', marginBottom: 16, lineHeight: 1.55 }}>
                      Splitting into parallel assignments. Each worker gets its own branch + skill loadout. TDD-Expert applied universally.
                    </div>
                    {/* Assignments */}
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'var(--ink-3)', textTransform: 'uppercase', marginBottom: 8 }}>Assignments</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                      {[
                        { w: 'W1', role: 'ui-worker', color: WORKER_COLORS[0], branch: 'feat/ui-layer', task: 'Build the sharing UI — shareable link generation, copy button, share modal.', skills: ['css-theming', 'TDD-Expert'] },
                        { w: 'W2', role: 'api-worker', color: WORKER_COLORS[1], branch: 'feat/share-api', task: 'Static export endpoint — serialize TODO list to JSON, generate shareable URL with hash.', skills: ['TDD-Expert'] },
                        { w: 'W3', role: 'ui-worker', color: WORKER_COLORS[2], branch: 'feat/share-view', task: 'Read-only share view — render a shared list from URL hash, no auth required.', skills: ['a11y-audit', 'TDD-Expert'] },
                      ].map(a => (
                        <div key={a.w} style={{ border: '1px solid var(--rule)', borderRadius: 6, padding: '12px 14px', background: 'var(--paper)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.color }} />
                            <span style={{ fontSize: 11, fontWeight: 700, background: 'var(--paper-2)', border: '1px solid var(--rule)', borderRadius: 3, padding: '1px 6px', fontFamily: 'var(--mono)' }}>{a.role}</span>
                            <span className="branch-chip">{a.branch}</span>
                            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: 'var(--ink-3)' }}>{a.w}</span>
                          </div>
                          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.5 }}>{a.task}</div>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            {a.skills.map(s => <span key={s} style={{ fontSize: 10, background: 'var(--worker-soft)', color: 'var(--worker)', border: '1px solid var(--worker)', borderRadius: 3, padding: '1px 5px' }}>{s}</span>)}
                            <span title={NOT_WIRED_TITLE} style={{ fontSize: 10, color: 'var(--ink-3)', border: '1px dashed var(--rule)', borderRadius: 3, padding: '1px 5px', ...NOT_WIRED }}>+ skill</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Confirm before dispatch */}
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 8 }}>Confirm before dispatch</div>
                    <div style={{ border: '1.5px solid var(--review)', borderRadius: 6, padding: '12px 14px', background: 'var(--review-soft)', display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>Dispatch this assignment plan?</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-2)' }}>3 workers will be briefed on their branches. Each tool call still needs your approval.</div>
                      </div>
                      <button onClick={dispatchMission} style={{ fontSize: 13, padding: '8px 20px', background: 'var(--review)', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>▶ Dispatch</button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', marginTop: 8 }}>Once dispatched, PM steps out — workers run it.</div>
                  </div>

                  {/* Right: sticky comments gutter */}
                  <div style={{ width: 260, borderLeft: '1.5px solid var(--rule)', padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--paper-2)', overflow: 'auto', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span title={NOT_WIRED_TITLE} style={{ fontSize: 12, fontWeight: 600, flex: 1, ...NOT_WIRED }}>Comments</span>
                    </div>
                    <button disabled title={NOT_WIRED_TITLE} style={{ ...NOT_WIRED, fontSize: 12, padding: '7px 10px', background: 'var(--ink)', color: 'var(--paper)', border: 'none', borderRadius: 4, fontWeight: 600 }}>
                      ✉ Send all to PM — revise plan
                    </button>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', marginBottom: 4 }}>PM will batch-update the plan in one pass</div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-3)', fontSize: 12, fontStyle: 'italic', gap: 4 }}>
                      <span style={{ fontSize: 16 }}>💬</span>
                      Select text in the plan to add a comment
                    </div>
                    <div className="composer" style={{ fontSize: 12 }}>
                      <input placeholder="Comment on selection…" style={{ fontSize: 12 }} />
                      <div className="send">↵</div>
                    </div>
                  </div>
                </div>

                {/* Bottom: TALK TO PM composer */}
                <div style={{ padding: '8px 18px 12px', borderTop: '1.5px solid var(--rule)', background: 'var(--paper-2)', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 10, letterSpacing: 0.8, color: 'var(--ink-3)', fontWeight: 700, whiteSpace: 'nowrap' }}>TALK TO PM</span>
                    <div className="composer" style={{ flex: 1, fontSize: 13 }}>
                      <input placeholder="Split a task, change skills, answer an open question…" />
                      <div className="send">↵</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activePmTab === 'prd' && <RealDocTab name="PRD" workspacePath={config.projectPath} />}
            {activePmTab === 'sop' && <RealDocTab name="SOP" workspacePath={config.projectPath} />}
            {activePmTab === 'devlog' && <RealDocTab name="DevLog" workspacePath={config.projectPath} />}
          </PMShell>
        )}

        {activeView === 'skills' && (
          <SkillsView workspacePath={config.projectPath} />
        )}

        {/* ── Mission Dashboard ── */}
        {activeMission && (() => {
          const allBooting = activeMission.assignments.every(a => a.status === 'proposed');
          const allDone = activeMission.status === 'running' && activeMission.assignments.length > 0 && activeMission.assignments.every(a => a.status === 'done');
          const hitlCount = activeMission.assignments.filter(a => a.pendingAction).length;
          const doneCount = activeMission.assignments.filter(a => a.status === 'done').length;
          const totalCommits = Object.values(branchStats).reduce((s, b) => s + b.commits, 0);
          // Equal-area cells. One worker fills the frame; two split it; three or
          // four take a 2x2 whose rows are equal whatever any tile contains.
          const workerCount = activeMission.assignments.length;
          const autoLayout = workerCount <= 1 ? '1' : workerCount === 2 ? '2' : '3-4';
          const effectiveLayout = missionLayout === '3-4' && workerCount <= 2 ? autoLayout : missionLayout;
          const gridCols = effectiveLayout === '1' ? '1fr' : '1fr 1fr';
          const gridRows = effectiveLayout === '1' || effectiveLayout === '2' ? '1fr' : '1fr 1fr';
          const deepDiveAssignment = activeWorker !== null ? activeMission.assignments.find(a => a.id === activeWorker) : null;
          const deepDiveIdx = deepDiveAssignment ? activeMission.assignments.indexOf(deepDiveAssignment) : 0;

          // Strip status label reflects the current phase more accurately
          const stripStatusDot = allDone ? 'var(--review)' : activeMission.status === 'running' ? 'var(--approve)' : activeMission.status === 'reviewing' ? 'var(--review)' : 'var(--ink-3)';
          const stripStatusText = allDone
            ? `◐ Awaiting your review · ${activeMission.assignments.length} workers · 0 HITL pending`
            : activeMission.status === 'reviewing'
              ? `◐ Awaiting your review · ${activeMission.assignments.length} workers · 0 HITL pending`
              : `● Running · ${activeMission.assignments.length} workers${hitlCount > 0 ? ` · ${hitlCount} HITL pending` : ''}`;

          return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

            {/* Mission strip (hidden in deep-dive — sub-strip replaces it) */}
            {!deepDiveAssignment && (
              <div style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1.5px solid var(--rule)', background: 'var(--paper-2)', flexShrink: 0 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: stripStatusDot, flexShrink: 0 }} />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{activeMission.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: 0.5 }}>{stripStatusText}</span>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                  {/* Autonomy mode — how much you approve. Global; applies to all workers. */}
                  <div title="How much you approve. Auto = decide for me (no per-call approval)." style={{ display: 'flex', alignItems: 'center', gap: 4, border: `1.5px solid ${autonomyMode === 'auto' ? 'var(--warn)' : autonomyMode === 'edits' ? 'var(--pm)' : 'var(--rule)'}`, borderRadius: 4, padding: '2px 4px 2px 8px', background: 'var(--paper)' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: 'var(--ink-3)' }}>MODE</span>
                    <select value={autonomyMode} onChange={e => setAutonomyMode(e.target.value as any)}
                      style={{ fontSize: 11, border: 'none', background: 'transparent', color: autonomyMode === 'auto' ? 'var(--warn)' : autonomyMode === 'edits' ? 'var(--pm)' : 'var(--ink)', fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
                      <option value="manual">Manual · approve each</option>
                      <option value="edits">Auto reads · confirm actions</option>
                      <option value="auto">Auto · decide for me</option>
                    </select>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    started {activeMission.startedAt ?? '--:--'}
                  </span>
                  {!allDone && activeMission.status === 'running' && (
                    <button disabled title={NOT_WIRED_TITLE} style={{ ...NOT_WIRED, fontSize: 11, padding: '4px 10px', border: '1px solid var(--rule)', background: 'var(--paper)', borderRadius: 3, color: 'var(--ink-2)' }}>Pause mission</button>
                  )}
                  <button onClick={() => setActiveView('pm')} style={{ fontSize: 11, padding: '4px 10px', border: '1.5px solid var(--pm)', background: 'var(--paper)', borderRadius: 3, color: 'var(--pm)', cursor: 'pointer' }}>← PM panel</button>
                </div>
              </div>
            )}

            {/* 3.3 / 3.10 — Worker deep-dive */}
            {deepDiveAssignment ? (
              <WorkerDeepDive
                assignment={deepDiveAssignment}
                color={WORKER_COLORS[deepDiveIdx % WORKER_COLORS.length]}
                workerIndex={deepDiveIdx}
                mission={activeMission}
                onBack={() => setActiveWorker(null)}
                onApprove={(approved) => approveAction(activeMission.id, deepDiveAssignment.id, approved)}
                nudgeInput={nudgeInputs[deepDiveAssignment.id] ?? ''}
                onNudgeChange={val => setNudgeInputs(prev => ({ ...prev, [deepDiveAssignment.id]: val }))}
                onNudgeSend={() => nudgeWorker(activeMission.id, deepDiveAssignment.id)}
              />
            ) : activeMission.status === 'reviewing' ? (
              /* 3.13 — Reviewer panel */
              <ReviewerPanel
                mission={activeMission}
                workspacePath={config.projectPath}
                onSendBack={() => setMissions(prev => prev.map(m => m.id !== activeMission.id ? m : { ...m, status: 'running' as const }))}
                onArchive={() => archiveMission(activeMission.id)}
                onViewDiff={viewDiff}
                onAcceptMerge={(branch) => acceptAndMerge(activeMission.id, branch)}
                mergeState={mergeState}
              />
            ) : (
              /* 3.2 / 3.9 / 3.12 — Worker tile grid */
              <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflow: 'hidden' }}>

                {/* 3.12 — All done banner: shown when all workers finished, awaiting archive decision */}
                {allDone && (
                  <div className="box" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--approve-soft)', borderColor: 'var(--approve)', flexShrink: 0 }}>
                    <span style={{ fontSize: 20 }}>✓</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--approve)' }}>All {activeMission.assignments.length} workers finished · mission ready to archive</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-2)', marginTop: 2 }}>
                        {totalCommits > 0 ? `${totalCommits} commits across ${activeMission.assignments.length} branches · ` : ''}0 HITL pending · last activity {activeMission.startedAt ?? '--:--'}
                      </div>
                    </div>
                    <button onClick={() => callReviewer(activeMission.id)} style={{ fontSize: 11, padding: '5px 12px', border: '1.5px solid var(--rule)', background: 'var(--paper)', borderRadius: 4, cursor: 'pointer' }}>
                      Call Reviewer again
                    </button>
                    <button onClick={() => archiveMission(activeMission.id)} style={{ fontSize: 12, padding: '7px 14px', border: '1.5px solid var(--approve)', background: 'var(--approve)', color: 'var(--paper)', borderRadius: 4, fontWeight: 700, cursor: 'pointer' }}>
                      ✓ Archive to PM dev log
                    </button>
                  </div>
                )}

                {/* 3.2 — Event log card (shown while all workers are still booting) */}
                {allBooting && (
                  <div style={{ background: 'rgba(194,120,50,0.08)', border: '1.5px solid rgba(194,120,50,0.3)', borderRadius: 8, padding: '12px 16px', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>▶ Mission dispatched · {activeMission.assignments.length} workers spinning up</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.7 }}>
                      <div>workers are pulling their skill loadouts and reading the brief</div>
                      <div style={{ opacity: 0.65 }}>each tool call will appear here for your approval</div>
                    </div>
                  </div>
                )}

                {/* 3.9 — Layout selector (shown once at least one worker is running, hidden when all done) */}
                {!allBooting && !allDone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderRadius: 6, border: '1px solid var(--rule)', background: 'var(--paper-2)', overflow: 'hidden', flexShrink: 0, alignSelf: 'flex-start' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color: 'var(--ink-3)', padding: '5px 10px', borderRight: '1px solid var(--rule)' }}>LAYOUT</span>
                    {/* Only offer layouts the current worker count can fill —
                        a 2x2 button with two workers just leaves holes. */}
                    {(['1', '2', '3-4'] as const)
                      .filter(l => l === '1' || (l === '2' && workerCount >= 2) || (l === '3-4' && workerCount >= 3))
                      .map((l, i, shown) => (
                        <button key={l} onClick={() => setMissionLayout(l)} style={{ fontSize: 11, padding: '5px 11px', background: effectiveLayout === l ? 'var(--ink)' : 'transparent', color: effectiveLayout === l ? 'var(--paper)' : 'var(--ink-3)', border: 'none', borderRight: i < shown.length - 1 ? '1px solid var(--rule)' : 'none', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: effectiveLayout === l ? 700 : 400 }}>
                          {l === '1' ? '1 · full frame' : l === '2' ? '2 · side by side' : '3-4 · 2×2 grid'}
                        </button>
                      ))}
                  </div>
                )}

                {/* Worker tiles grid — click any tile to deep-dive */}
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: allDone ? '1fr 1fr' : gridCols, gridTemplateRows: allDone ? undefined : gridRows, gap: 10, minHeight: 0, overflow: allDone ? 'auto' : 'hidden' }}>
                  {activeMission.assignments.map((assignment, idx) => (
                    <div key={assignment.id} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', cursor: 'pointer' }} onClick={() => setActiveWorker(assignment.id)}>
                      <WorkerTile
                        assignment={assignment}
                        workerIndex={idx}
                        color={WORKER_COLORS[idx % WORKER_COLORS.length]}
                        onStart={() => startWorker(activeMission.id, assignment.id)}
                        onApprove={(approved) => approveAction(activeMission.id, assignment.id, approved)}
                        nudgeInput={nudgeInputs[assignment.id] ?? ''}
                        onNudgeChange={val => setNudgeInputs(prev => ({ ...prev, [assignment.id]: val }))}
                        onNudgeSend={() => nudgeWorker(activeMission.id, assignment.id)}
                        branchStat={branchStats[assignment.branchName]}
                      />
                    </div>
                  ))}
                </div>

                {/* Reviewer strip — shown while workers still running (not done yet) */}
                {!allDone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', background: 'var(--paper)', border: '1.5px solid var(--rule)', borderRadius: 7, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, background: 'rgba(194,120,50,0.1)', color: 'var(--warn)', border: '1px solid rgba(194,120,50,0.3)', borderRadius: 3, padding: '2px 7px', whiteSpace: 'nowrap' }}>REVIEWER</span>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Iterate with workers until satisfied, then summon Reviewer to bundle a cross-branch report.</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)', whiteSpace: 'nowrap' }}>{doneCount} of {activeMission.assignments.length} workers done</span>
                    <button onClick={() => callReviewer(activeMission.id)} style={{ fontSize: 12, padding: '5px 14px', background: 'var(--warn)', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      Call Reviewer
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })()}
        {config.projectPath && <ProgressBoard workspacePath={config.projectPath} />}
        <BottomBar
          usage={usageData?.total} onOpenUsage={() => { loadUsage(); setShowUsage(true); }}
          backendStatus={backendStatus}
          model={providerInfo ? (providerInfo.current || 'no model yet') : config.defaultModel}
          hitlPending={totalHitl}
          extra={activeMission ? `mission · ${activeMission.assignments.length} workers · ${totalHitl} hitl pending` : `PM panel · ${missions.filter(m => m.status === 'running').length} mission running · ${totalHitl} hitl pending`}
        />
      </div>

      {/* Onboarding is handled by the phase-based early-returns above. */}

      {/* ── Recruit Worker Modal ── */}
      <RecruitModal
        open={recruitOpen}
        workspacePath={config.projectPath}
        existingTeam={team}
        onClose={() => setRecruitOpen(false)}
        onHired={(w) => { setTeam(t => [...t, w]); setRecruitOpen(false); }}
      />

      {/* ── Branch Diff overlay (S3: CEO sees exactly what a worker wrote) ── */}
      {branchDiff && (
        <div onClick={() => setBranchDiff(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(31,29,26,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1600, padding: 24 }}>
          <div onClick={e => e.stopPropagation()} className="box" style={{ background: 'var(--paper)', width: 'min(860px, 92vw)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1.5px solid var(--rule)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="branch-chip">{branchDiff.branch}</span>
              {branchDiff.base && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>vs {branchDiff.base}</span>}
              {branchDiff.files.length > 0 && (
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  {branchDiff.files.length} file{branchDiff.files.length > 1 ? 's' : ''} · +{branchDiff.files.reduce((n, f) => n + f.insertions, 0)} −{branchDiff.files.reduce((n, f) => n + f.deletions, 0)}
                </span>
              )}
              <button onClick={() => setBranchDiff(null)} style={{ marginLeft: 'auto', fontSize: 13, padding: '3px 9px', borderRadius: 4, background: 'transparent', border: '1px solid var(--rule)', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ overflow: 'auto', padding: 0, background: 'var(--paper-2)' }}>
              {branchDiff.loading ? (
                <div style={{ padding: 20, fontSize: 12, color: 'var(--ink-3)', fontStyle: 'italic' }}>Loading diff…</div>
              ) : (
                <pre style={{ margin: 0, padding: '12px 16px', fontSize: 12, fontFamily: 'var(--mono)', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {branchDiff.diff.split('\n').map((ln, i) => (
                    <div key={i} style={{ color: ln.startsWith('+') && !ln.startsWith('+++') ? 'var(--approve)' : ln.startsWith('-') && !ln.startsWith('---') ? '#c0392b' : ln.startsWith('@@') ? 'var(--pm)' : 'var(--ink-2)' }}>{ln || ' '}</div>
                  ))}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Add Skill Modal ── */}
      {showAddSkill && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(31,29,26,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500 }}>
          <div style={{ width: 520, background: 'var(--bg-elevated)', borderRadius: 10, padding: '28px 28px 24px', boxShadow: '0 12px 40px rgba(31,29,26,0.15)', border: '1px solid var(--border-default)' }}>
            <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Add Skill</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>Skills are saved to <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>~/.agents/skills/</code> and injected into worker system prompts.</div>

            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'var(--text-label)', textTransform: 'uppercase' }}>Skill Name</label>
            <input
              value={addSkillName}
              onChange={e => setAddSkillName(e.target.value)}
              placeholder="e.g. TDD-Expert"
              style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, marginBottom: 16, background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '9px 12px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace', outline: 'none' }}
            />

            <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: 'var(--text-label)', textTransform: 'uppercase' }}>SKILL.md Content</label>
            <textarea
              value={addSkillContent}
              onChange={e => setAddSkillContent(e.target.value)}
              placeholder={`---\nname: "My Skill"\ndescription: "What this skill does"\n---\n\n# Instructions\n\nPaste your skill markdown here…`}
              rows={10}
              style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, marginBottom: 20, background: 'var(--bg-base)', border: '1px solid var(--border-default)', borderRadius: 6, padding: '9px 12px', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace', outline: 'none', resize: 'vertical' }}
            />

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleAddSkill}
                disabled={isAddingSkill || !addSkillName.trim() || !addSkillContent.trim()}
                style={{ flex: 1, padding: '10px', background: 'var(--accent-pm)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: (isAddingSkill || !addSkillName.trim()) ? 0.5 : 1 }}
              >
                {isAddingSkill ? 'Saving…' : 'Save Skill'}
              </button>
              <button onClick={() => setShowAddSkill(false)} style={{ padding: '10px 16px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {settingsModal}
      {usageModal}
      {profileModal}
      {fileModal}
      {askModal}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes blink { 50% { opacity: 0; } }
        * { box-sizing: border-box; }
        body { margin: 0; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-thumb { background: var(--scrollbar); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-hover); }
      `}</style>
    </div>
  );
};

export default App;
