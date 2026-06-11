import React, { useState, useEffect, useRef } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';

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
}

interface Skill { id: number; name: string; source: string; category: string; description?: string; }

// ─── Constants ───────────────────────────────────────────────────────────────

const WORKER_COLORS = ['#5d8aa8', '#87a36d', '#c98a5a', '#a86970', '#9b7ec8', '#6aab9e'];

// ─── Shared primitives — 1-to-1 port of wf-shared.jsx ───────────────────────

/* Mission rail with NO project yet — dashed AC + dashed green ＋.
   1-to-1 port of EmptyMissionRail in wf-onboarding.jsx.                       */
function EmptyMissionRail() {
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
      }}>AC</div>
      <div style={{ width: 28, height: 1, background: 'rgba(255,255,255,0.08)' }} />
      <div title="Open or create your first project" style={{
        width: 44, height: 44, borderRadius: 22, border: '1.5px dashed #6e8b54',
        color: '#6e8b54', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 300, boxShadow: '0 0 0 4px rgba(110,139,84,0.10)',
      }}>＋</div>
      <div style={{ flex: 1 }} />
      <div style={{
        width: 36, height: 36, color: '#6e6a60', display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: 16,
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

function SidePmItem({ active }: { active: boolean }) {
  return (
    <div style={{ marginTop:2,marginBottom:2,padding:'5px 10px',borderRadius:4,background:active?'var(--pm-soft)':'transparent',borderLeft:active?'2px solid var(--pm)':'2px solid transparent',display:'flex',alignItems:'center',gap:6,fontSize:12,fontWeight:600,color:active?'var(--pm)':'var(--ink-2)' }}>
      <span style={{ width:6,height:6,borderRadius:'50%',background:'var(--pm)',display:'inline-block' }} />
      <span>PM</span>
    </div>
  );
}

function Sidebar_Empty({ workspacePath: _wp }: { workspacePath: string }) {
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
        <SideBottomRow icon={IcoProfile} label="Profile" />
        <SideBottomRow icon={IcoSettings} label="Settings" />
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
function MissionRail({ projectName, onProjectClick, onNewProject, onSettings }: {
  projectName: string;
  onProjectClick: () => void;
  onNewProject: () => void;
  onSettings: () => void;
}) {
  // M0: single project. Rail shows one circle for the current project.
  // Missions within the project live in the sidebar, not here.
  // Future: multi-project = one circle per project (per chat3.md decision).
  const label = (projectName.match(/[a-zA-Z]/g) || ['A', 'C']).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      width: 60,
      background: '#1a1816',
      borderRight: '1.5px solid var(--rule)',
      padding: '10px 0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      flex: '0 0 auto',
    }}>
      <div title={`${projectName} (current project)`} style={{ position: 'relative', width: 44, height: 44 }} onClick={onProjectClick}>
        <div style={{
          position: 'absolute', left: -10, top: 6, bottom: 6, width: 3,
          background: 'var(--paper)', borderRadius: '0 3px 3px 0',
        }} />
        <div style={{
          width: 44, height: 44,
          borderRadius: 12,
          background: '#5a6cff',
          color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13,
          border: '2px solid var(--paper)',
          cursor: 'pointer',
        }}>{label}</div>
      </div>
      <div
        onClick={onNewProject}
        title="Open another project (soon)"
        style={{
          width: 44, height: 44, borderRadius: 22,
          border: '1.5px dashed #6e8b54',
          color: '#6e8b54',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 300, cursor: 'pointer',
        }}
      >＋</div>
      <div style={{ flex: 1 }} />
      <div
        onClick={onSettings}
        title="Settings"
        style={{
          width: 36, height: 36, borderRadius: '50%',
          color: '#6e6a60', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, cursor: 'pointer',
        }}
      >⚙</div>
    </div>
  );
}

/* Sidebar — Workspace / Team (PM + Depts) / Missions / Skills.
   Active item = inverted dark pill. Green-outlined ＋ buttons.                 */
function Sidebar({
  workspacePath: _wp, onOpenWorkspace: _ow, realFiles: _rf, onRefreshFiles: _or, isLoadingFiles: _il,
  activeView, onSelectPm, missions, onSelectMission, skills: _sk, onAddSkill, onNewMission,
}: {
  workspacePath: string; onOpenWorkspace: () => void; realFiles: string[]; onRefreshFiles: () => void;
  isLoadingFiles: boolean; activeView: string; onSelectPm: () => void; missions: Mission[];
  onSelectMission: (id: string) => void; skills: Skill[]; onAddSkill: () => void; onNewMission: () => void;
}) {
  const isPmActive = activeView === 'pm';
  const activeMissionId = activeView !== 'pm' ? activeView : null;
  const isTeamActive = isPmActive;
  const isMissionsActive = !!activeMissionId;

  return (
    <div className="wf-side">
      <div style={{ display:'flex',flexDirection:'column',gap:2 }}>
        {/* Files */}
        <SideNavRow icon={IcoFiles} label="Files" expanded={false} />

        {/* Team */}
        <SideNavRow icon={IcoTeam} label="Team" active={isTeamActive} expanded addable addColor="var(--paper)" onAdd={onNewMission} />
        <SidePmItem active={isPmActive} />

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
        <SideNavRow icon={IcoSkills} label="Skills" expanded={false} addable onAdd={onAddSkill} />
      </div>

      <div style={{ flex:1 }} />
      <div style={{ display:'flex',flexDirection:'column',gap:2,paddingTop:8 }}>
        <SideBottomRow icon={IcoProfile} label="Profile" />
        <SideBottomRow icon={IcoSettings} label="Settings" />
      </div>
    </div>
  );
}

/* TopBar — mission title + pending/branches/cost chips on the right. */
function TopBar({ title, pending = 0, branches = 0, model = 'gemini-2.5-flash', startedAt }: {
  title: string; pending?: number; branches?: number; model?: string; startedAt?: string;
}) {
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
      <div className="chip pm"><span className="dot" />{model}</div>
    </div>
  );
}

/* BottomBar — mono status footer. */
function BottomBar({ backendStatus, model, hitlPending, extra }: {
  backendStatus: 'online' | 'offline'; model: string; hitlPending: number; extra?: string;
}) {
  return (
    <div className="wf-bottom">
      <span>
        <span className="ind" style={{ background: backendStatus === 'online' ? 'var(--approve)' : 'var(--warn)' }} />
        backend: {backendStatus === 'online' ? 'ok' : 'down'}
      </span>
      <span>model: {model}</span>
      <span>hitl: pending {hitlPending}</span>
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
    <div style={{ background: 'var(--paper)', border: `1.5px solid ${isDone ? 'var(--approve)' : 'var(--rule)'}`, borderRadius: 8, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
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
              <span style={{ cursor: 'pointer', textDecoration: 'underline' }}>view branch diff</span>
              <span>·</span>
              <span style={{ cursor: 'pointer', textDecoration: 'underline' }}>view chat history</span>
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
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button onClick={() => onApprove(true)} style={{ fontSize: 11, padding: '3px 12px', background: 'var(--approve)', color: '#fff', border: 'none', borderRadius: 3, fontWeight: 600, cursor: 'pointer' }}>Approve</button>
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
        <button style={{ fontSize: 11, padding: '3px 10px', background: 'var(--paper)', border: '1px solid var(--rule)', borderRadius: 4, cursor: 'pointer', color: 'var(--ink-2)', fontFamily: 'var(--sans)' }}>⏸ Pause</button>
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
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--pm)', cursor: 'pointer' }}>edit loadout ↗</span>
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

function ReviewerPanel({ mission, workspacePath, onSendBack, onArchive }: {
  mission: Mission;
  workspacePath: string;
  onSendBack: () => void;
  onArchive: () => void;
}) {
  const [activeFilter, setActiveFilter] = useState<'bug' | 'note' | 'bloat' | 'missing' | null>(null);
  const [activeBranchTab, setActiveBranchTab] = useState<string>('cross');
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
          ).join('\n')}\n\n_Generated by Canopy_`
        : '_Generated by Canopy_';
      try {
        const res = await fetch('http://localhost:3005/api/create-pr', {
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
          {/* Diff content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px', fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.6, color: 'var(--ink-2)' }}>
            <div style={{ color: 'var(--ink-3)', marginBottom: 4 }}>@@ -10,8 +10,20 @@</div>
            <div style={{ background: 'transparent', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ flex: 1 }}> import React from 'react';</span></div>
            <div style={{ background: 'var(--approve-soft)', color: 'var(--approve)', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ flex: 1 }}>+ import {'{ useTheme }'} from '../hooks/useTheme';</span><span style={{ fontSize: 9, padding: '0 5px', borderRadius: 2, fontWeight: 700, background: WORKER_COLORS[0], color: '#fff' }}>W1</span></div>
            <div style={{ background: 'var(--approve-soft)', color: 'var(--approve)', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ flex: 1 }}>+ import {'{ useHotkeys }'} from '../hooks/useHotkeys';</span><span style={{ fontSize: 9, padding: '0 5px', borderRadius: 2, fontWeight: 700, background: WORKER_COLORS[2], color: '#fff' }}>W3</span></div>
            <div style={{ background: 'transparent', color: 'var(--ink-2)' }}> </div>
            <div style={{ background: 'transparent', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ flex: 1 }}> function Header() {'{'}</span></div>
            <div style={{ background: 'var(--approve-soft)', color: 'var(--approve)', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ flex: 1 }}>+   const [theme, toggleTheme] = useTheme();</span><span style={{ fontSize: 9, padding: '0 5px', borderRadius: 2, fontWeight: 700, background: WORKER_COLORS[0], color: '#fff' }}>W1</span></div>
            <div style={{ background: 'var(--approve-soft)', color: 'var(--approve)', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ flex: 1 }}>+   useHotkeys(shortcuts);</span><span style={{ fontSize: 9, padding: '0 5px', borderRadius: 2, fontWeight: 700, background: WORKER_COLORS[2], color: '#fff' }}>W3</span></div>
            <div style={{ margin: '6px 0 6px 24px', padding: '6px 8px', borderRadius: 4, background: 'var(--pm-soft)', border: '1px solid var(--pm)', fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--pm)', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <span>ℹ</span>
              <span><strong>Reviewer:</strong> both branches add imports in the same hunk — trivial rebase, no conflict.</span>
            </div>
            <div style={{ background: 'transparent', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ flex: 1 }}>   return (</span></div>
            <div style={{ background: 'transparent', color: 'var(--ink-2)', display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ flex: 1 }}>     &lt;header className={'{"header " + theme}'}&gt;</span></div>
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

const App: React.FC = () => {
  // Persisted
  const [config, setConfig] = useLocalStorage('ac_config', {
    googleKey: '', projectPath: '', defaultModel: 'gemini-2.5-flash',
  });
  const [skills, setSkills] = useState<Skill[]>([]);
  const [missions, setMissions] = useLocalStorage<Mission[]>('ac_missions', []);

  // Session state
  const [pmMessages, setPmMessages] = useState<Message[]>([{
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

  // UI
  const [activeView, setActiveView] = useState<'pm' | string>('pm');
  const [activePmTab, setActivePmTab] = useState<'chat' | 'prd' | 'sop' | 'devlog'>('chat');
  // PM sub-screen within chat: idle (3.1/3.6) → briefing (3.7) → plan (3.8)
  const [pmScreen, setPmScreen] = useState<'idle' | 'briefing' | 'plan'>('idle');
  const [pmBriefInput, setPmBriefInput] = useState('');
  const [briefingAnswers, setBriefingAnswers] = useState<{ scope: string; who: string; store: string }>({ scope: '', who: '', store: '' });
  const [missionLayout, setMissionLayout] = useState<'1' | '2' | '3-4'>('3-4');
  const [activeWorker, setActiveWorker] = useState<number | null>(null);
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
  const [showSettings, setShowSettings] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ─── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetch('http://localhost:3005/api/status')
      .then(res => res.ok ? setBackendStatus('online') : setBackendStatus('offline'))
      .catch(() => setBackendStatus('offline'));
  }, []);

  useEffect(() => {
    if (backendStatus !== 'online') return;
    fetch('http://localhost:3005/api/skills')
      .then(r => r.json())
      .then(data => {
        if (data.skills) setSkills(data.skills.map((s: any, i: number) => ({
          id: i, name: s.name, source: 'Local', category: 'Universal', description: s.description,
        })));
      })
      .catch(() => {});
  }, [backendStatus]);

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
          `http://localhost:3005/api/branch-status?workspacePath=${encodeURIComponent(config.projectPath)}&branches=${encodeURIComponent(JSON.stringify(branches))}`
        );
        const data = await res.json();
        if (data.branches) setBranchStats(data.branches);
      } catch {}
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, [activeView, config.projectPath]);

  // ─── Handlers ────────────────────────────────────────────────────────────────

  const refreshFiles = async () => {
    setIsLoadingFiles(true);
    try {
      const res = await fetch(`http://localhost:3005/api/files?path=${encodeURIComponent(config.projectPath)}`);
      const data = await res.json();
      if (data.files) setRealFiles(data.files);
    } finally { setIsLoadingFiles(false); }
  };

  const openWorkspace = () => {
    const path = prompt('Enter project workspace path:', config.projectPath);
    if (path !== null) setConfig({ ...config, projectPath: path });
  };

  const sendPmMessage = async () => {
    if (!pmInput.trim() || isPmThinking) return;
    const userMsg: Message = { role: 'user', content: pmInput };
    setPmMessages(prev => [...prev, userMsg]);
    const currentInput = pmInput;
    setPmInput('');
    setIsPmThinking(true);
    try {
      const apiHistory = pmMessages
        .filter((_, i) => i > 0)
        .map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));

      const res = await fetch('http://localhost:3005/api/ceo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: currentInput, history: apiHistory, files: realFiles }),
      });
      const data = await res.json();
      if (data.text) {
        setPmMessages(prev => [...prev, { role: 'model', content: data.text, groundingSources: data.groundingSources }]);
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
    setActiveView(mission.id);
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
    const es = new EventSource(`http://localhost:3005/api/execute-mission?${qs}`);
    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'log') {
        updateAssignment(missionId, assignmentId, a => ({ ...a, logs: [...a.logs, data.log] }));
      } else if (data.type === 'require_approval') {
        updateAssignment(missionId, assignmentId, { pendingAction: { tool: data.tool, args: data.args } });
      }
    };
    es.addEventListener('end', () => es.close());
    es.onerror = () => es.close();
  };

  const approveAction = async (missionId: string, assignmentId: number, approved: boolean) => {
    updateAssignment(missionId, assignmentId, { pendingAction: undefined });
    await fetch('http://localhost:3005/api/approve-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: assignmentId, approved }),
    });
  };

  const nudgeWorker = async (missionId: string, assignmentId: number) => {
    const message = nudgeInputs[assignmentId]?.trim();
    if (!message) return;
    setNudgeInputs(prev => ({ ...prev, [assignmentId]: '' }));
    updateAssignment(missionId, assignmentId, a => ({ ...a, logs: [...a.logs, `> [YOU] ${message}`] }));
    try {
      const res = await fetch(`http://localhost:3005/api/panel/${assignmentId}/nudge`, {
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
    const es = new EventSource(`http://localhost:3005/api/reviewer?${qs}`);
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

  const archiveMission = (missionId: string) => {
    const mission = missions.find(m => m.id === missionId);
    const name = mission?.name ?? 'mission';
    setMissions(prev => prev.map(m => m.id !== missionId ? m : { ...m, status: 'done' as const }));
    setActiveView('pm');
    setDevLogNew(true);
    setSelectedLogEntryIdx(0);
    setArchiveToast(name);
    setPrdPendingEdits([
      { id: 'feat-1', section: 'Features', content: `**Dark mode** toggle — persisted per-device. Completed in mission "${name}".`, status: 'pending' },
      { id: 'feat-2', section: 'Features', content: `**JSON export** from header menu. Excludes archived by default; "include archived" toggle available.`, status: 'pending' },
      { id: 'nongoal-1', section: 'Non-goals', content: `**No native installer** — web app only. Decision recorded in dev log.`, status: 'pending' },
    ]);
    setTimeout(() => setArchiveToast(null), 5000);
    setPmMessages(prev => [...prev, {
      role: 'model',
      content: `Got the report. I've written entry "${name}" to Dev log.md and queued **3 PRD edits** for your review. Open the PRD.md tab when ready.`,
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
    fetch('http://localhost:3005/api/init-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: trimmed }),
    }).catch(() => {});
    if (key && key.trim() && key.trim() !== config.googleKey) {
      fetch('http://localhost:3005/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleKey: key.trim() }),
      }).catch(() => {});
    }
  };

  const handleStartFromScratch = () => {
    const p = window.prompt('Where should I create your new project?\n(I will mkdir if needed and create .agent-company/ inside)', 'C:\\Users\\linzh\\Desktop\\IDE\\new-project');
    if (p && p.trim()) enterProject(p, onbKey);
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
      await fetch('http://localhost:3005/api/add-skill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addSkillName.trim(), content: addSkillContent.trim() }),
      });
      setShowAddSkill(false);
      setAddSkillName('');
      setAddSkillContent('');
      const res = await fetch('http://localhost:3005/api/skills');
      const data = await res.json();
      if (data.skills) setSkills(data.skills.map((s: any, i: number) => ({
        id: i, name: s.name, source: 'Local', category: 'Universal', description: s.description,
      })));
    } catch {}
    setIsAddingSkill(false);
  };

  const saveSettings = async () => {
    await fetch('http://localhost:3005/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ googleKey: config.googleKey }),
    });
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
  if (onboardingPhase === 'welcome') {
    const onChooseFolder = () => {
      const p = window.prompt('Enter project workspace path:', onbPath || 'C:\\Users\\linzh\\Desktop\\IDE\\agent-company');
      if (p && p.trim()) {
        const trimmed = p.trim();
        setOnbPath(trimmed);
        setConfig({ ...config, projectPath: trimmed });
        setOnboardingPhase('scan');
      }
    };
    return (
      <div className="wf" style={{ flexDirection: 'row', height: '100vh' }}>
        <EmptyMissionRail />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div className="wf-topbar">
            <div style={{ fontWeight: 600, fontSize: 14 }}>Canopy</div>
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
            backendStatus={backendStatus}
            model={config.defaultModel}
            hitlPending={0}
            extra="no project · waiting for you to choose"
          />
        </div>
      </div>
    );
  }

  // ── Screen 1.2 · PM analyzes folder (Path B) ─────────────────────────────
  if (onboardingPhase === 'scan') {
    const projectLabel = (config.projectPath || onbPath).split(/[\\/]/).pop() || 'project';
    const onUserReply = (choice: 'all' | 'prd' | 'skip') => {
      if (choice === 'skip') {
        setDocsReady(false);
        setOnboardingPhase('ready');
      } else {
        setDocsChoice(choice);
        setDocsStep(0);
        setOnboardingPhase('docs');
      }
    };
    return (
      <div className="wf" style={{ flexDirection: 'row', height: '100vh' }}>
        <MissionRail
          projectName={projectLabel}
          onProjectClick={() => {}}
          onNewProject={() => {}}
          onSettings={() => setShowSettings(true)}
        />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <TopBar title={`PM · just opened ~/${projectLabel}`} model={config.defaultModel} />
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            <Sidebar_Empty workspacePath={config.projectPath || onbPath} />
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
                      Hey — you just pointed me at ~/{projectLabel}. Let me poke around a bit so I know what the next step is.
                    </div>
                  </div>

                  {/* Tool calls */}
                  <div className="box-soft" style={{ padding: '10px 12px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div><span style={{ color: 'var(--approve)' }}>✓</span> read_file <span style={{ color: 'var(--pm)' }}>README.md</span></div>
                    <div><span style={{ color: 'var(--approve)' }}>✓</span> read_file <span style={{ color: 'var(--pm)' }}>package.json</span></div>
                    <div><span style={{ color: 'var(--approve)' }}>✓</span> run_shell <span style={{ color: 'var(--pm)' }}>tree -L 2 src/</span></div>
                    <div><span style={{ color: 'var(--approve)' }}>✓</span> read_file <span style={{ color: 'var(--pm)' }}>src/App.tsx</span> <span style={{ color: 'var(--ink-3)' }}>· first 80 lines</span></div>
                  </div>

                  {/* PM question */}
                  <div className="box" style={{ padding: '10px 14px', background: 'var(--paper)', maxWidth: 560 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm)', marginBottom: 4 }}>PM</div>
                    <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                      Okay — I can see your project. I don't see a <span className="mono" style={{ fontSize: 11 }}>PRD.md</span>, <span className="mono" style={{ fontSize: 11 }}>SOP.md</span>, or <span className="mono" style={{ fontSize: 11 }}>Dev log.md</span> at the root. Those are the three files I use as long-term memory across missions — without them I'll have to re-derive context from the code every time.
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.55, marginTop: 8 }}>
                      Want me to draft them now? I can write a first pass from what I just read, then you approve each one before it lands on disk.
                    </div>
                  </div>

                  {/* Reply chips */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span onClick={() => onUserReply('all')} className="branch-chip" style={{ cursor: 'pointer', background: 'var(--pm-soft)', borderColor: 'var(--pm)', color: 'var(--pm)', fontWeight: 600, fontSize: 11, padding: '5px 12px' }}>
                      Yes — draft all three
                    </span>
                    <span onClick={() => onUserReply('prd')} className="branch-chip" style={{ cursor: 'pointer', fontSize: 11, padding: '5px 12px' }}>
                      Just PRD for now
                    </span>
                    <span onClick={() => onUserReply('skip')} className="branch-chip" style={{ cursor: 'pointer', fontSize: 11, padding: '5px 12px' }}>
                      Skip — start working
                    </span>
                  </div>

                  <div style={{ fontFamily: 'var(--hand)', fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>↓ or just type a reply</div>

                  {/* Reply input */}
                  <div className="composer" style={{ padding: '10px 12px', maxWidth: 560 }}>
                    <span style={{ color: 'var(--ink-3)' }}>reply to PM…</span>
                    <span className="send">↵</span>
                  </div>
                </div>
              </div>
            </PMShell>
          </div>
          <BottomBar backendStatus={backendStatus} model={config.defaultModel} hitlPending={0} extra="PM · just opened folder · awaiting your reply" />
        </div>
      </div>
    );
  }

  // ── Screen 1.3 · PM drafts docs — HITL per file ───────────────────────────
  if (onboardingPhase === 'docs') {
    const projectLabel = (config.projectPath || onbPath).split(/[\\/]/).pop() || 'project';
    const docList = docsChoice === 'prd' ? ['PRD.md'] : ['PRD.md', 'SOP.md', 'Dev log.md'];
    const currentDoc = docList[docsStep];
    const docDescriptions: Record<string, string> = {
      'PRD.md': 'Product: A project — Goals, non-goals, stack, open questions',
      'SOP.md': 'Coding style, test conventions, branch naming, commit format',
      'Dev log.md': 'Empty file — first entry gets written after the first Reviewer report',
    };
    const approveDoc = () => {
      if (docsStep < docList.length - 1) {
        setDocsStep(s => s + 1);
      } else {
        setDocsReady(true);
        enterProject(config.projectPath || onbPath, onbKey);
        setOnboardingPhase('ready');
      }
    };
    const skipAll = () => {
      setDocsReady(false);
      enterProject(config.projectPath || onbPath, onbKey);
      setOnboardingPhase('ready');
    };
    const approveAll = () => {
      setDocsReady(true);
      enterProject(config.projectPath || onbPath, onbKey);
      setOnboardingPhase('ready');
    };
    return (
      <div className="wf" style={{ flexDirection: 'row', height: '100vh' }}>
        <MissionRail
          projectName={projectLabel}
          onProjectClick={() => {}}
          onNewProject={() => {}}
          onSettings={() => setShowSettings(true)}
        />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <TopBar title={`PM · drafting initial docs · ${docsStep + 1} of ${docList.length}`} model={config.defaultModel} />
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            <Sidebar_Empty workspacePath={config.projectPath || onbPath} />
            <PMShell activeTab="chat" onTabChange={() => {}} runningMissions={[]} missionsMemoryCount={0} onSelectMission={() => {}} hideDocs>
              <div className="wf-scroll" style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '14px 18px' }}>
                <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>

                  {/* User reply */}
                  <div className="box" style={{ padding: '10px 14px', background: 'var(--paper-2)', alignSelf: 'flex-end', maxWidth: 400 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 4 }}>You</div>
                    <div style={{ fontSize: 13 }}>{docsChoice === 'all' ? 'Yes — draft all three.' : 'Just PRD for now.'}</div>
                  </div>

                  {/* PM response */}
                  <div className="box" style={{ padding: '10px 14px', background: 'var(--paper)', maxWidth: 560 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm)', marginBottom: 4 }}>PM</div>
                    <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                      Got it. I'll do them one at a time so you can edit each before it lands on disk. Starting with <span className="mono" style={{ fontSize: 11 }}>PRD.md</span>.
                    </div>
                  </div>

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

                  {/* HITL card for current doc */}
                  <div className="hitl">
                    <div className="hitl-head">
                      <span>⏸</span>
                      <span>APPROVAL NEEDED · write_file</span>
                      <span style={{ marginLeft: 'auto', color: 'var(--ink-3)', fontWeight: 400 }}>{currentDoc} · new file</span>
                    </div>
                    <div className="hitl-cmd">{docDescriptions[currentDoc]}</div>
                    <div className="hitl-actions">
                      <button className="btn approve" onClick={approveDoc}>✓ Approve &amp; write</button>
                      <button className="btn" style={{ background: 'var(--paper)', border: '1.5px solid var(--rule)', color: 'var(--ink)' }}>Edit before write…</button>
                      <button className="btn reject" onClick={docsStep < docList.length - 1 ? () => setDocsStep(s => s + 1) : skipAll}>Skip this one</button>
                    </div>
                  </div>

                  {/* Next steps preview */}
                  {docList.slice(docsStep + 1).map(doc => (
                    <div key={doc} style={{ fontSize: 11, color: 'var(--ink-3)', fontFamily: 'var(--mono)', paddingLeft: 4 }}>
                      ○ next · {doc} {doc === 'Dev log.md' ? '— empty file, populated after first mission' : ''}
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
          <BottomBar backendStatus={backendStatus} model={config.defaultModel} hitlPending={1} extra={`PM · drafting ${currentDoc} · awaiting approval · ${docsStep + 1} of ${docList.length}`} />
        </div>
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
          projectName={config.projectPath.split(/[\\/]/).pop() || 'Canopy'}
          onProjectClick={() => {}}
          onNewProject={() => {}}
          onSettings={() => setShowSettings(true)}
        />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <TopBar title={docsReady ? 'PM · ready · what shall we build first?' : 'PM · waiting for your first brief'} model={config.defaultModel} />
          <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            <Sidebar_Empty workspacePath={config.projectPath} />
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
              {activePmTab === 'prd' && <PMTab_PRD edits={prdPendingEdits} onApprove={sec => setPrdPendingEdits(prev => prev.map(e => e.section === sec ? {...e, status: 'approved' as const} : e))} onReject={sec => setPrdPendingEdits(prev => prev.map(e => e.section === sec ? {...e, status: 'rejected' as const} : e))} onApproveAll={() => setPrdPendingEdits(prev => prev.map(e => ({...e, status: 'approved' as const})))} onRejectAll={() => setPrdPendingEdits(prev => prev.map(e => ({...e, status: 'rejected' as const})))} activeSection={activePrdSection} onSectionChange={setActivePrdSection} />}
              {activePmTab === 'sop' && <PMTab_SOP activeSection={activeSopSection} onSectionChange={setActiveSopSection} />}
              {activePmTab === 'devlog' && <PMTab_DevLog archivedMissions={missions.filter(m => m.status === 'done')} selectedIdx={selectedLogEntryIdx} onSelectIdx={setSelectedLogEntryIdx} editMode={devLogEditMode} onToggleEdit={() => setDevLogEditMode(v => !v)} />}
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
            backendStatus={backendStatus}
            model={config.defaultModel}
            hitlPending={0}
            extra={docsReady ? 'project ready · 0 missions · PM idle' : 'blank project · waiting for your first brief'}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--paper)', color: 'var(--ink)', overflow: 'hidden', fontFamily: 'var(--sans)', fontSize: 13 }}>

      <MissionRail
        projectName={config.projectPath ? (config.projectPath.split(/[\\/]/).pop() || 'Canopy') : 'Canopy'}
        onProjectClick={() => setActiveView('pm')}
        onNewProject={() => alert('Multi-project support coming soon. For now, one project per workspace.')}
        onSettings={() => setShowSettings(true)}
      />

      <Sidebar
        workspacePath={config.projectPath}
        onOpenWorkspace={openWorkspace}
        realFiles={realFiles}
        onRefreshFiles={refreshFiles}
        isLoadingFiles={isLoadingFiles}
        activeView={activeView}
        onSelectPm={() => setActiveView('pm')}
        missions={missions}
        onSelectMission={(id) => setActiveView(id)}
        skills={skills}
        onAddSkill={() => setShowAddSkill(true)}
        onNewMission={() => setActiveView('pm')}
      />

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--paper)', minWidth: 0 }}>
        <TopBar
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
          model={config.defaultModel}
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
                    {/* First message — context-aware welcome (only when no additional messages exist) */}
                    {pmMessages.length === 1 && (
                      <div style={{ alignSelf: 'flex-start', maxWidth: '82%' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm)', marginBottom: 4 }}>PM</div>
                        <div className="box" style={{ background: 'var(--paper)', padding: '10px 14px', borderRadius: 8, fontSize: 14, lineHeight: 1.6, maxWidth: 580 }}>
                          {runningMissions.length > 0
                            ? <>Welcome back. <strong>{runningMissions.length} mission{runningMissions.length > 1 ? 's' : ''}</strong> running. New briefs queue behind {runningMissions.length > 1 ? 'them' : 'it'}.</>
                            : "Starting fresh. Tell me what to build, fix, or refactor and I'll draft a plan."}
                        </div>
                      </div>
                    )}
                    {/* Additional PM messages (e.g. post-archive notification) */}
                    {pmMessages.slice(1).map((msg, i) => {
                      const isModel = msg.role === 'model';
                      const isArchiveMsg = isModel && msg.content.includes('Dev log.md');
                      return (
                        <div key={i} style={{ alignSelf: isModel ? 'flex-start' : 'flex-end', maxWidth: '82%' }}>
                          {isModel && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--pm)', marginBottom: 4 }}>PM</div>}
                          {!isModel && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', marginBottom: 4 }}>You</div>}
                          <div className="box" style={{ background: isModel ? 'var(--paper)' : 'var(--paper-2)', padding: '10px 14px', maxWidth: 580, borderColor: isModel ? 'var(--pm)' : 'var(--rule)' }}>
                            <div style={{ fontSize: 13, lineHeight: 1.55 }}>
                              {msg.content.split('**').map((part, j) => j % 2 === 1 ? <strong key={j}>{part}</strong> : part)}
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
                    <div ref={chatEndRef} />
                  </div>
                </div>
                <div style={{ padding: '10px 18px 14px', borderTop: '1.5px solid var(--rule)', background: 'var(--paper-2)', flexShrink: 0 }}>
                  <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="composer" style={{ fontSize: 13 }}>
                      <input value={pmInput} onChange={e => setPmInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && pmInput.trim()) { setPmBriefInput(pmInput); setPmInput(''); setPmScreen('briefing'); setBriefingAnswers({ scope: '', who: '', store: '' }); } }}
                        placeholder={runningMissions.length > 0 ? 'New brief — will queue behind running missions…' : "What's our first mission?"}
                      />
                      <div className="send" onClick={() => { if (pmInput.trim()) { setPmBriefInput(pmInput); setPmInput(''); setPmScreen('briefing'); setBriefingAnswers({ scope: '', who: '', store: '' }); } }}>↵</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(runningMissions.length > 0
                        ? ['Scope screens for design', 'Update PRD', 'Summarize dev log', 'Plan a new mission', 'Audit current missions']
                        : ['Plan a feature', 'Plan a refactor', 'Audit the codebase', 'Set up CI']
                      ).map(chip => (
                        <span key={chip} onClick={() => { setPmBriefInput(chip); setPmScreen('briefing'); setBriefingAnswers({ scope: '', who: '', store: '' }); }}
                          style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, border: '1px solid var(--rule)', background: 'var(--paper)', color: 'var(--ink-2)', cursor: 'pointer' }}
                        >{chip}</span>
                      ))}
                    </div>
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
                        <button style={{ fontSize: 13, padding: '8px 14px', background: 'transparent', color: 'var(--ink-2)', border: '1.5px solid var(--rule)', borderRadius: 4, cursor: 'pointer' }}>Keep refining</button>
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
                            <span style={{ fontSize: 10, color: 'var(--ink-3)', border: '1px dashed var(--rule)', borderRadius: 3, padding: '1px 5px', cursor: 'pointer' }}>+ skill</span>
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
                      <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>0 open comments</span>
                    </div>
                    <button style={{ fontSize: 12, padding: '7px 10px', background: 'var(--ink)', color: 'var(--paper)', border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer', opacity: 0.4 }}>
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

            {activePmTab === 'prd' && (
              <PMTab_PRD
                edits={prdPendingEdits}
                onApprove={sec => setPrdPendingEdits(prev => prev.map(e => e.section === sec ? { ...e, status: 'approved' as const } : e))}
                onReject={sec => setPrdPendingEdits(prev => prev.map(e => e.section === sec ? { ...e, status: 'rejected' as const } : e))}
                onApproveAll={() => setPrdPendingEdits(prev => prev.map(e => ({ ...e, status: 'approved' as const })))}
                onRejectAll={() => setPrdPendingEdits(prev => prev.map(e => ({ ...e, status: 'rejected' as const })))}
                activeSection={activePrdSection}
                onSectionChange={setActivePrdSection}
              />
            )}
            {activePmTab === 'sop' && (
              <PMTab_SOP
                activeSection={activeSopSection}
                onSectionChange={setActiveSopSection}
              />
            )}
            {activePmTab === 'devlog' && (
              <PMTab_DevLog
                archivedMissions={missions.filter(m => m.status === 'done')}
                selectedIdx={selectedLogEntryIdx}
                onSelectIdx={setSelectedLogEntryIdx}
                editMode={devLogEditMode}
                onToggleEdit={() => setDevLogEditMode(v => !v)}
              />
            )}
          </PMShell>
        )}

        {/* ── Mission Dashboard ── */}
        {activeMission && (() => {
          const allBooting = activeMission.assignments.every(a => a.status === 'proposed');
          const allDone = activeMission.status === 'running' && activeMission.assignments.length > 0 && activeMission.assignments.every(a => a.status === 'done');
          const hitlCount = activeMission.assignments.filter(a => a.pendingAction).length;
          const doneCount = activeMission.assignments.filter(a => a.status === 'done').length;
          const totalCommits = Object.values(branchStats).reduce((s, b) => s + b.commits, 0);
          const gridCols = missionLayout === '1' ? '1fr' : '1fr 1fr';
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
                  <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                    started {activeMission.startedAt ?? '--:--'} · branch base: main
                  </span>
                  {!allDone && activeMission.status === 'running' && (
                    <button style={{ fontSize: 11, padding: '4px 10px', border: '1px solid var(--rule)', background: 'var(--paper)', borderRadius: 3, color: 'var(--ink-2)', cursor: 'pointer' }}>Pause mission</button>
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
                    {(['1', '2', '3-4'] as const).map((l, i) => (
                      <button key={l} onClick={() => setMissionLayout(l)} style={{ fontSize: 11, padding: '5px 11px', background: missionLayout === l ? 'var(--ink)' : 'transparent', color: missionLayout === l ? 'var(--paper)' : 'var(--ink-3)', border: 'none', borderRight: i < 2 ? '1px solid var(--rule)' : 'none', cursor: 'pointer', fontFamily: 'var(--sans)', fontWeight: missionLayout === l ? 700 : 400 }}>
                        {l === '1' ? '1 · full frame' : l === '2' ? '2 · split half/half' : `3-4 · 2×2 grid${missionLayout === '3-4' ? ' · current' : ''}`}
                      </button>
                    ))}
                  </div>
                )}

                {/* Worker tiles grid — click any tile to deep-dive */}
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: allDone ? '1fr 1fr' : gridCols, gap: 10, minHeight: 0, overflow: 'auto' }}>
                  {activeMission.assignments.map((assignment, idx) => (
                    <div key={assignment.id} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, cursor: 'pointer' }} onClick={() => setActiveWorker(assignment.id)}>
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
        <BottomBar
          backendStatus={backendStatus}
          model={config.defaultModel}
          hitlPending={totalHitl}
          extra={activeMission ? `mission · ${activeMission.assignments.length} workers · ${totalHitl} hitl pending` : `PM panel · ${missions.filter(m => m.status === 'running').length} mission running · ${totalHitl} hitl pending`}
        />
      </div>

      {/* Onboarding is handled by the phase-based early-returns above. */}

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

      {/* ── Settings Modal ── */}
      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: 460, background: 'var(--bg-elevated)', borderRadius: 10, padding: '28px 28px 24px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', border: '1px solid var(--border-default)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Settings</div>
            <label style={{ fontSize: 11, color: 'var(--text-label)', fontWeight: 700, letterSpacing: 1 }}>GEMINI API KEY</label>
            <input
              type="password"
              value={config.googleKey}
              onChange={e => setConfig({ ...config, googleKey: e.target.value })}
              style={{ width: '100%', background: 'var(--bg-base)', border: '1px solid var(--border-default)', padding: '11px 14px', color: 'var(--text-primary)', marginTop: 8, borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}
              placeholder="AIza…"
            />
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 5 }}>Saved locally to .env file.</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={saveSettings} style={{ flex: 1, background: 'var(--accent-pm)', color: '#fff', border: 'none', padding: 12, borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Save</button>
              <button onClick={() => setShowSettings(false)} style={{ padding: '12px 18px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-strong)', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

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
