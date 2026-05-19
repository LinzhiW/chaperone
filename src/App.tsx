import React, { useState, useEffect, useRef } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import {
  Settings, Folder, ChevronDown, ChevronRight, Send, ShieldCheck,
  RefreshCw, CheckCircle, AlertCircle, Plus, Terminal,
} from 'lucide-react';

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

interface Mission {
  id: string;
  name: string;
  status: 'running' | 'reviewing' | 'done';
  assignments: Assignment[];
}

interface Skill { id: number; name: string; source: string; category: string; description?: string; }

// ─── Constants ───────────────────────────────────────────────────────────────

const WORKER_COLORS = ['#5d8aa8', '#87a36d', '#c98a5a', '#a86970', '#9b7ec8', '#6aab9e'];

// ─── Sidebar helpers ─────────────────────────────────────────────────────────

function SidebarSection({ title, addable, children }: {
  title: string; addable?: boolean; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginTop: 18 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px', marginBottom: 8, cursor: 'pointer', userSelect: 'none' }}
      >
        <span style={{ color: '#7d808a', transition: 'transform .15s', display: 'inline-block', transform: open ? '' : 'rotate(-90deg)' }}>
          <ChevronDown size={12} />
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: '#8a8d97', textTransform: 'uppercase' }}>{title}</span>
        {addable && (
          <span style={{ marginLeft: 'auto', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3ba55d', cursor: 'pointer', borderRadius: '50%' }}>
            <Plus size={13} />
          </span>
        )}
      </div>
      {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 4px' }}>{children}</div>}
    </div>
  );
}

function DeptGroup({ name, workers }: { name: string; workers: string[] }) {
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#e6e7ea', padding: '2px 6px' }}>{name}</div>
      {workers.map(w => (
        <div key={w} style={{ fontSize: 13, color: '#5a5c66', padding: '1px 6px 1px 24px' }}>– {w}</div>
      ))}
    </div>
  );
}

// ─── Worker Tile ─────────────────────────────────────────────────────────────

function WorkerTile({ assignment, color, missionId, onStart, onApprove, nudgeInput, onNudgeChange, onNudgeSend }: {
  assignment: Assignment;
  color: string;
  missionId: string;
  onStart: () => void;
  onApprove: (approved: boolean) => void;
  nudgeInput: string;
  onNudgeChange: (val: string) => void;
  onNudgeSend: () => void;
}) {
  const statusLabel = assignment.status === 'running'
    ? assignment.pendingAction ? '⏸ waiting' : '● running'
    : assignment.status === 'done' ? '○ done' : '○ idle';
  const statusColor = assignment.status === 'running'
    ? assignment.pendingAction ? '#c97a3a' : '#3ba55d'
    : '#5a5c66';

  return (
    <div style={{ background: '#232529', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#2a2c33', flexShrink: 0 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: 12, color: '#e6e7ea' }}>{assignment.agentId}</span>
        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#5a5c66' }}>⎇ {assignment.branchName}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10, padding: '1px 6px', borderRadius: 3, background: assignment.pendingAction ? '#2d2210' : assignment.status === 'running' ? '#0f2d1a' : 'transparent', border: `1px solid ${statusColor}`, color: statusColor }}>{statusLabel}</span>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0, overflow: 'hidden' }}>
        {assignment.status === 'proposed' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 8px', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: '#7d808a', textAlign: 'center', lineHeight: 1.5 }}>{assignment.task}</div>
            {assignment.skillLoadout.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
                {assignment.skillLoadout.map(s => (
                  <span key={s} style={{ fontSize: 10, background: 'rgba(91,108,242,0.15)', color: '#a78bfa', border: '1px solid rgba(91,108,242,0.3)', borderRadius: 3, padding: '1px 6px' }}>{s}</span>
                ))}
              </div>
            )}
            <button onClick={onStart} style={{ fontSize: 11, padding: '5px 14px', background: '#3ba55d', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer', marginTop: 4 }}>
              ▶ Brief &amp; start
            </button>
          </div>
        ) : (
          <>
            {/* Stream log */}
            <div style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#7d808a', lineHeight: 1.55, overflow: 'auto', maxHeight: 200 }}>
              {assignment.logs.map((line, i) => (
                <div key={i} style={{ color: line.includes('[EXEC]') ? '#e8c643' : line.includes('[OUTPUT]') ? '#5b8fa8' : line.includes('[FINAL]') ? '#3ba55d' : '#7d808a', marginBottom: 1 }}>{line}</div>
              ))}
              {assignment.status === 'running' && !assignment.pendingAction && (
                <span style={{ display: 'inline-block', width: 6, height: 12, background: '#e6e7ea', animation: 'blink 1s step-end infinite', verticalAlign: 'text-bottom' }} />
              )}
            </div>

            {/* HITL card */}
            {assignment.pendingAction && (
              <div style={{ border: '1.5px solid #c97a3a', background: '#1e1508', borderRadius: 4, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: '#c97a3a' }}>
                  <ShieldCheck size={13} /> Tool call awaiting approval
                  <span style={{ marginLeft: 'auto', color: '#7d808a', fontWeight: 400, fontFamily: 'JetBrains Mono, monospace' }}>{assignment.pendingAction.tool}</span>
                </div>
                <pre style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, background: '#0f0f0f', padding: '6px 8px', borderRadius: 3, border: '1px dashed rgba(255,255,255,0.1)', color: '#e6e7ea', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {typeof assignment.pendingAction.args === 'object'
                    ? Object.entries(assignment.pendingAction.args).map(([k, v]) => `${k}: ${v}`).join('\n')
                    : String(assignment.pendingAction.args)}
                </pre>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => onApprove(true)} style={{ fontSize: 11, padding: '3px 12px', background: '#3ba55d', color: '#fff', border: 'none', borderRadius: 3, fontWeight: 600, cursor: 'pointer' }}>Approve</button>
                  <button onClick={() => onApprove(false)} style={{ fontSize: 11, padding: '3px 12px', background: 'transparent', color: '#f23f43', border: '1px solid #f23f43', borderRadius: 3, cursor: 'pointer' }}>Reject</button>
                  <span style={{ fontSize: 10, color: '#5a5c66', padding: '3px 6px', fontFamily: 'JetBrains Mono, monospace', alignSelf: 'center' }}>y / n</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Worker composer (nudge) */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '6px 8px', background: '#1f2125', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <input
          value={nudgeInput}
          onChange={e => onNudgeChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && nudgeInput.trim() && onNudgeSend()}
          placeholder={assignment.status === 'proposed' ? 'Start worker first…' : `talk to ${assignment.agentId}…`}
          disabled={assignment.status === 'proposed'}
          style={{ flex: 1, background: '#25272d', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 3, padding: '4px 8px', fontSize: 11, color: '#e6e7ea', outline: 'none', opacity: assignment.status === 'proposed' ? 0.4 : 1 }}
        />
        <div
          onClick={() => nudgeInput.trim() && onNudgeSend()}
          style={{ width: 20, height: 18, background: nudgeInput.trim() ? '#5b6cf2' : '#2a2c33', color: '#e6e7ea', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, cursor: nudgeInput.trim() ? 'pointer' : 'default', transition: 'background .15s' }}
        >↵</div>
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

  // UI
  const [activeView, setActiveView] = useState<'pm' | string>('pm');
  const [activePmTab, setActivePmTab] = useState<'chat' | 'prd' | 'sop' | 'devlog'>('chat');
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
    const mission: Mission = {
      id: `mission-${Date.now()}`,
      name: pendingAssignments.map(a => a.agentId).join(' · '),
      status: 'running',
      assignments: pendingAssignments,
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
  const totalHitl = missions.reduce((n, m) => n + m.assignments.filter(a => a.pendingAction).length, 0);
  const runningMissions = missions.filter(m => m.status === 'running');

  // ─── Render ──────────────────────────────────────────────────────────────────

  const PM_TABS = [
    { id: 'chat',   label: 'Chat' },
    { id: 'prd',    label: 'PRD.md' },
    { id: 'sop',    label: 'SOP.md' },
    { id: 'devlog', label: 'Dev log.md', badge: undefined as string | undefined },
  ];

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#1b1c20', color: '#e6e7ea', overflow: 'hidden', fontFamily: 'Inter, -apple-system, sans-serif', fontSize: 14 }}>

      {/* ── Rail ── */}
      <div style={{ width: 72, background: '#17181c', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0 12px', gap: 8, borderRight: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#6477ff,#5b6cf2 50%,#7c6dff)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, letterSpacing: 0.5 }}>AC</div>
        <div style={{ width: 36, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        <div
          title="New mission"
          style={{ width: 48, height: 48, borderRadius: '50%', background: '#2a2c33', color: '#3ba55d', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', transition: 'border-radius .15s' }}
          onMouseEnter={e => (e.currentTarget.style.borderRadius = '16px')}
          onMouseLeave={e => (e.currentTarget.style.borderRadius = '50%')}
        ><Plus size={22} /></div>
        <div style={{ flex: 1 }} />
        <div
          onClick={() => setShowSettings(true)}
          style={{ width: 48, height: 48, color: '#5a5c66', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', borderRadius: 12, transition: 'background .15s,color .15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#b3b5bd'; }}
          onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#5a5c66'; }}
        ><Settings size={22} /></div>
      </div>

      {/* ── Sidebar ── */}
      <div style={{ width: 240, background: '#1f2125', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>Dashboard</div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '10px 12px 20px' }}>

          {/* Workspace */}
          <div
            onClick={openWorkspace}
            style={{ padding: '10px 12px', background: '#25272d', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 4 }}
          >
            <Folder size={18} color="#7d808a" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.4, color: '#8a8d97', textTransform: 'uppercase', marginBottom: 2 }}>Workspace</div>
              <div style={{ fontSize: 13, color: '#b3b5bd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {config.projectPath ? config.projectPath.split(/[\\/]/).pop() : 'Open Folder…'}
              </div>
            </div>
            <ChevronDown size={14} color="#5a5c66" />
          </div>

          {/* Project files */}
          {realFiles.length > 0 && (
            <div style={{ padding: '4px 8px 8px', display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0', marginBottom: 2 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: '#5a5c66', textTransform: 'uppercase' }}>Files</span>
                <span onClick={refreshFiles} style={{ marginLeft: 'auto', cursor: 'pointer', color: '#5a5c66' }}><RefreshCw size={11} style={{ animation: isLoadingFiles ? 'spin 1s linear infinite' : '' }} /></span>
              </div>
              {realFiles.slice(0, 6).map(f => (
                <div key={f} style={{ fontSize: 12, color: '#5a5c66', padding: '2px 4px', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 10 }}>·</span>{f}
                </div>
              ))}
            </div>
          )}

          {/* TEAM */}
          <SidebarSection title="Team" addable>
            <div
              onClick={() => setActiveView('pm')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 4, cursor: 'pointer', background: activeView === 'pm' ? 'rgba(255,255,255,0.05)' : 'transparent' }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#5b6cf2', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: activeView === 'pm' ? '#e6e7ea' : '#b3b5bd' }}>PM</span>
              <span title="Talk to PM" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 3, background: 'rgba(91,108,242,0.15)', color: '#5b6cf2', fontSize: 12 }}>💬</span>
            </div>
            <DeptGroup name="Frontend Dept" workers={['ui-worker']} />
            <DeptGroup name="Backend Dept"  workers={['api-worker']} />
          </SidebarSection>

          {/* MISSIONS */}
          <SidebarSection title="Missions" addable>
            {missions.length === 0 && (
              <div style={{ padding: '4px 8px', fontSize: 13, color: '#5a5c66', fontStyle: 'italic' }}>No missions yet</div>
            )}
            {missions.map(m => {
              const mHitl = m.assignments.filter(a => a.pendingAction).length;
              return (
                <div
                  key={m.id}
                  onClick={() => setActiveView(m.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 4, cursor: 'pointer', background: activeView === m.id ? 'rgba(255,255,255,0.05)' : 'transparent' }}
                >
                  <span style={{ fontSize: 11, color: m.status === 'running' ? '#3ba55d' : '#7d808a' }}>{m.status === 'running' ? '●' : '◐'}</span>
                  <span style={{ flex: 1, fontSize: 13, color: activeView === m.id ? '#e6e7ea' : '#b3b5bd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                  {mHitl > 0 && (
                    <span style={{ minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: '#c97a3a', color: '#fff', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{mHitl}</span>
                  )}
                </div>
              );
            })}
            <div style={{ padding: '4px 8px', fontSize: 13, color: '#5a5c66', fontStyle: 'italic', cursor: 'pointer' }}>＋ new mission</div>
          </SidebarSection>

          {/* SKILLS */}
          <SidebarSection title={`Skills ${skills.length > 0 ? `(${skills.length})` : ''}`} addable>
            <div style={{ background: '#2a2c33', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 200, overflow: 'auto' }}>
              {skills.length === 0 && (
                <div style={{ fontSize: 12, color: '#5a5c66', fontStyle: 'italic', padding: '4px 2px' }}>Loading from ~/.agents/skills…</div>
              )}
              {skills.map(s => (
                <div key={s.id} title={s.description || s.name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#b3b5bd', padding: '2px 2px', cursor: 'default' }}>
                  <CheckCircle size={11} color="#3ba55d" style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                </div>
              ))}
            </div>
          </SidebarSection>
        </div>

        {/* Bottom status bar */}
        <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', background: '#17181c', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#5a5c66', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: backendStatus === 'online' ? '#3ba55d' : '#f23f43', marginRight: 4 }} />
            {backendStatus}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{config.defaultModel}</span>
          {totalHitl > 0 && <span style={{ color: '#c97a3a', flexShrink: 0 }}>⏸ {totalHitl}</span>}
        </div>
      </div>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#1b1c20', minWidth: 0 }}>

        {/* ── PM Panel ── */}
        {activeView === 'pm' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

            {/* Identity bar */}
            <div style={{ padding: '12px 20px 0', borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#1f2125', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#5b6cf2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11, letterSpacing: 0.5 }}>PM</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Project Orchestrator</div>
                  <div style={{ fontSize: 11, color: '#5a5c66' }}>plans · tracks · never executes</div>
                </div>
                <div style={{ marginLeft: 'auto', fontSize: 11, color: '#5a5c66' }}>
                  memory: {missions.length} missions
                </div>
              </div>

              {/* Tab strip */}
              <div style={{ display: 'flex', gap: 2 }}>
                {PM_TABS.map(t => (
                  <div
                    key={t.id}
                    onClick={() => setActivePmTab(t.id as any)}
                    style={{
                      padding: '7px 14px 8px',
                      borderRadius: '4px 4px 0 0',
                      border: '1px solid transparent',
                      borderBottom: 'none',
                      background: t.id === activePmTab ? '#1b1c20' : 'transparent',
                      borderColor: t.id === activePmTab ? 'rgba(255,255,255,0.08)' : 'transparent',
                      fontSize: 12,
                      fontWeight: t.id === activePmTab ? 600 : 400,
                      color: t.id === activePmTab ? '#e6e7ea' : '#7d808a',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontFamily: t.id !== 'chat' ? 'JetBrains Mono, monospace' : undefined,
                    }}
                  >
                    {t.label}
                    {t.badge && <span style={{ background: '#c97a3a', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 99 }}>{t.badge}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Running missions banner */}
            {runningMissions.length > 0 && (
              <div style={{ margin: '12px 20px 0', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(59,165,93,0.08)', border: '1px solid rgba(59,165,93,0.25)', borderRadius: 6, flexShrink: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3ba55d' }} />
                <span style={{ fontSize: 12, color: '#3ba55d' }}><strong>{runningMissions.length}</strong> mission{runningMissions.length > 1 ? 's' : ''} running — PM doesn't intervene unless you ask</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  {runningMissions.map(m => (
                    <span key={m.id} onClick={() => setActiveView(m.id)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', cursor: 'pointer', color: '#b3b5bd' }}>{m.name} ›</span>
                  ))}
                </div>
              </div>
            )}

            {/* Tab body: Chat */}
            {activePmTab === 'chat' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {/* Scrollable messages */}
                <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
                  <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {pmMessages.map((m, i) => {
                      const cleanContent = m.role === 'model'
                        ? m.content.replace(/<<<TASK_PLAN>>>[\s\S]*?<<<END_TASK_PLAN>>>/g, '📋 Mission plan drafted — see below.')
                        : m.content;
                      return (
                        <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '82%' }}>
                          {m.role === 'model' && (
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#5b6cf2', marginBottom: 4 }}>PM</div>
                          )}
                          <div style={{ background: m.role === 'user' ? '#2d3163' : '#25272d', padding: '10px 14px', borderRadius: 10, fontSize: 14, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                            {cleanContent}
                          </div>
                        </div>
                      );
                    })}
                    {isPmThinking && (
                      <div style={{ alignSelf: 'flex-start', color: '#5a5c66', fontSize: 12, padding: '0 4px' }}>PM is reading the project…</div>
                    )}

                    {/* Mission Plan dispatch card */}
                    {pendingAssignments.length > 0 && (
                      <div style={{ background: '#25272d', border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, background: 'rgba(91,108,242,0.15)', color: '#a78bfa', border: '1px solid rgba(91,108,242,0.3)', borderRadius: 3, padding: '1px 6px' }}>PLAN</span>
                          <span style={{ fontWeight: 600, fontSize: 14 }}>Mission Plan · {pendingAssignments.length} assignments</span>
                          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#5a5c66' }}>v1 · just drafted</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {pendingAssignments.map((a, idx) => (
                            <div key={a.id} style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '10px 12px', background: '#2a2c33', display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: WORKER_COLORS[idx % WORKER_COLORS.length] }} />
                                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, background: '#1b1c20', color: '#e6e7ea', borderRadius: 3, padding: '1px 6px' }}>{a.agentId}</span>
                                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#5a5c66' }}>⎇ {a.branchName}</span>
                              </div>
                              <div style={{ fontSize: 13, color: '#b3b5bd' }}>{a.task}</div>
                              {a.skillLoadout.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                  {a.skillLoadout.map(s => (
                                    <span key={s} style={{ fontSize: 10, background: 'rgba(167,139,250,0.1)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)', borderRadius: 3, padding: '1px 5px' }}>{s}</span>
                                  ))}
                                  <span style={{ fontSize: 10, color: '#5a5c66', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 3, padding: '1px 5px', cursor: 'pointer' }}>+ skill</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {/* Dispatch confirm */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'rgba(201,122,58,0.08)', border: '1.5px solid rgba(201,122,58,0.4)', borderRadius: 6 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>Dispatch this assignment plan?</div>
                            <div style={{ fontSize: 11, color: '#7d808a', marginTop: 2 }}>{pendingAssignments.length} workers will be briefed on their branches. Each tool call still needs your approval.</div>
                          </div>
                          <button onClick={dispatchMission} style={{ fontSize: 13, padding: '8px 20px', background: '#c97a3a', color: '#fff', border: 'none', borderRadius: 5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>▶ Dispatch</button>
                        </div>
                        <div style={{ fontSize: 11, color: '#5a5c66', textAlign: 'center' }}>Once dispatched, PM steps out — workers run it.</div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                </div>

                {/* Sticky composer */}
                <div style={{ padding: '10px 20px 16px', borderTop: '1px solid rgba(255,255,255,0.06)', background: '#1f2125', flexShrink: 0 }}>
                  <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#25272d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px 10px 16px' }}>
                      <input
                        value={pmInput}
                        onChange={e => setPmInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendPmMessage()}
                        placeholder="Brief PM on a goal, refine PRD, plan a new mission…"
                        style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#e6e7ea', fontFamily: 'inherit', fontSize: 14 }}
                      />
                      <div onClick={sendPmMessage} style={{ color: '#7d808a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, transition: 'color .15s, background .15s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#e6e7ea'; }} onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = '#7d808a'; }}>
                        <Send size={18} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {['Plan a new mission', 'Update PRD', 'Summarize dev log', 'Audit missions'].map(chip => (
                        <span key={chip} onClick={() => setPmInput(chip)} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#7d808a', cursor: 'pointer' }}>{chip}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Other tabs — placeholder */}
            {activePmTab !== 'chat' && (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5a5c66', fontSize: 13, fontStyle: 'italic' }}>
                {activePmTab}.md — PM will generate this after first mission
              </div>
            )}
          </div>
        )}

        {/* ── Mission Dashboard ── */}
        {activeMission && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>

            {/* Mission strip */}
            <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.06)', background: '#1f2125', flexShrink: 0 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: activeMission.status === 'running' ? '#3ba55d' : '#c97a3a' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{activeMission.name}</div>
                <div style={{ fontSize: 10, color: '#5a5c66', letterSpacing: 0.5 }}>
                  {activeMission.status === 'running' ? '● Running' : '◐ Awaiting your review'} · {activeMission.assignments.length} workers · {activeMission.assignments.filter(a => a.pendingAction).length} HITL pending
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: '#5a5c66' }}>branch base: main</span>
                <button style={{ fontSize: 11, padding: '4px 10px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', borderRadius: 4, color: '#7d808a', cursor: 'pointer' }}>Pause mission</button>
                <button onClick={() => setActiveView('pm')} style={{ fontSize: 11, padding: '4px 10px', border: '1.5px solid #5b6cf2', background: 'transparent', borderRadius: 4, color: '#5b6cf2', cursor: 'pointer' }}>← PM panel</button>
              </div>
            </div>

            {/* Worker tile grid */}
            <div style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflow: 'hidden' }}>
              <div style={{ flex: 1, display: 'grid', gridTemplateColumns: activeMission.assignments.length === 1 ? '1fr' : '1fr 1fr', gap: 12, minHeight: 0, overflow: 'auto' }}>
                {activeMission.assignments.map((assignment, idx) => (
                  <WorkerTile
                    key={assignment.id}
                    assignment={assignment}
                    missionId={activeMission.id}
                    color={WORKER_COLORS[idx % WORKER_COLORS.length]}
                    onStart={() => startWorker(activeMission.id, assignment.id)}
                    onApprove={(approved) => approveAction(activeMission.id, assignment.id, approved)}
                    nudgeInput={nudgeInputs[assignment.id] ?? ''}
                    onNudgeChange={val => setNudgeInputs(prev => ({ ...prev, [assignment.id]: val }))}
                    onNudgeSend={() => nudgeWorker(activeMission.id, assignment.id)}
                  />
                ))}
              </div>

              {/* Reviewer strip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#1f2125', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, background: 'rgba(201,122,58,0.12)', color: '#c97a3a', border: '1px solid rgba(201,122,58,0.3)', borderRadius: 3, padding: '2px 6px' }}>REVIEWER</span>
                <span style={{ fontSize: 12, color: '#7d808a' }}>Iterate with workers until satisfied, then summon Reviewer to bundle a cross-branch report.</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: '#5a5c66' }}>{activeMission.assignments.filter(a => a.status === 'done').length} of {activeMission.assignments.length} workers done</span>
                <button style={{ fontSize: 12, padding: '5px 14px', background: '#c97a3a', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer' }}>Call Reviewer</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Settings Modal ── */}
      {showSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: 460, background: '#25272d', borderRadius: 10, padding: '28px 28px 24px', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>Settings</div>
            <label style={{ fontSize: 11, color: '#8a8d97', fontWeight: 700, letterSpacing: 1 }}>GEMINI API KEY</label>
            <input
              type="password"
              value={config.googleKey}
              onChange={e => setConfig({ ...config, googleKey: e.target.value })}
              style={{ width: '100%', background: '#1b1c20', border: '1px solid rgba(255,255,255,0.08)', padding: '11px 14px', color: '#e6e7ea', marginTop: 8, borderRadius: 6, fontFamily: 'JetBrains Mono, monospace', fontSize: 13 }}
              placeholder="AIza…"
            />
            <div style={{ fontSize: 11, color: '#5a5c66', marginTop: 5 }}>Saved locally to .env file.</div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={saveSettings} style={{ flex: 1, background: '#5b6cf2', color: '#fff', border: 'none', padding: 12, borderRadius: 6, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>Save</button>
              <button onClick={() => setShowSettings(false)} style={{ padding: '12px 18px', background: 'transparent', color: '#7d808a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
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
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.12); }
      `}</style>
    </div>
  );
};

export default App;
