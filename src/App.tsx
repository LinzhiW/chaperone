import React, { useState, useEffect, useRef } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { 
  Settings, X, Key, Folder, Cpu, FileCode, CheckCircle, 
  AlertCircle, RefreshCw, ChevronDown, ChevronRight, MessageSquare, 
  Zap, Building2, Terminal, Play, Send, ShieldCheck, PlusCircle, Plus
} from 'lucide-react';

// --- Types ---
interface Session { id: number; name: string; active: boolean; }
interface Skill { id: number; name: string; source: string; category: string; }
interface Task {
  id: number; agent: string; name: string; status: string; assignedSkills: number[];
  branchName?: string; skillLoadout?: string[];
  logs?: string[]; pendingAction?: { tool: string; args: any };
}

const App: React.FC = () => {
  // Persisted State
  const [sessions, setSessions] = useLocalStorage<Session[]>('ac_sessions', [{ id: 1, name: 'Default Session', active: true }]);
  const [skills, setSkills] = useLocalStorage<Skill[]>('ac_skills', [
    { id: 1, name: 'TDD-Expert', source: 'Local', category: 'Universal' },
    { id: 2, name: 'Cloud-Deploy', source: 'Local', category: 'Task-Specific' },
  ]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [config, setConfig] = useLocalStorage('ac_config', { googleKey: '', projectPath: '', defaultModel: 'gemini-1.5-pro' });

  // CEO Chat State
  const [ceoInput, setCeoInput] = useState('');
  const [ceoMessages, setCeoMessages] = useState<{ role: string; content: string; groundingSources?: { uri: string; title: string }[] }[]>([
    { role: 'model', content: "Welcome, CEO. I'm ready to orchestrate your project. What's our main objective for today?" }
  ]);
  const [isCeoThinking, setIsCeoThinking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // UI Minimization States
  const [isFilesMinimized, setIsFilesMinimized] = useState(false);
  const [isSessionsMinimized, setIsSessionsMinimized] = useState(false);
  const [isDeptsMinimized, setIsDeptsMinimized] = useState(false);
  const [isSkillsMinimized, setIsSkillsMinimized] = useState(false);

  // UI State
  const [showSettings, setShowSettings] = useState(false);
  const [realFiles, setRealFiles] = useState<string[]>([]);
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline'>('offline');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // --- Effects ---
  useEffect(() => {
    fetch('http://localhost:3005/api/status')
      .then(res => res.ok ? setBackendStatus('online') : setBackendStatus('offline'))
      .catch(() => setBackendStatus('offline'));
  }, []);

  useEffect(() => {
    if (config.projectPath && backendStatus === 'online') refreshFiles();
  }, [config.projectPath, backendStatus]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ceoMessages]);

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

  // --- Handlers ---
  const sendCeoMessage = async () => {
    if (!ceoInput.trim() || isCeoThinking) return;
    const userMsg = { role: 'user', content: ceoInput };
    setCeoMessages(prev => [...prev, userMsg]);
    const currentInput = ceoInput;
    setCeoInput('');
    setIsCeoThinking(true);

    try {
      // 过滤掉第一条由 model 发出的欢迎语，确保 history 以 user 开头
      const apiHistory = ceoMessages
        .filter((m, i) => i > 0) 
        .map(m => ({ 
          role: m.role === 'user' ? 'user' : 'model', 
          parts: [{ text: m.content }] 
        }));

      const res = await fetch('http://localhost:3005/api/ceo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: currentInput, 
          history: apiHistory,
          files: realFiles
        })
      });
      const data = await res.json();
      if (data.text) {
        setCeoMessages(prev => [...prev, { role: 'model', content: data.text, groundingSources: data.groundingSources }]);
        const planMatch = data.text.match(/<<<TASK_PLAN>>>([\s\S]*?)<<<END_TASK_PLAN>>>/);
        if (planMatch) {
          try {
            const parsed: { agent_id: string; task: string; branch_name: string; skill_loadout: string[] }[] = JSON.parse(planMatch[1].trim());
            const newTasks: Task[] = parsed.map(p => ({
              id: Date.now() + Math.random(),
              agent: p.agent_id,
              name: p.task,
              branchName: p.branch_name,
              skillLoadout: p.skill_loadout || [],
              status: 'PROPOSED',
              assignedSkills: [],
            }));
            setTasks(prev => [...prev, ...newTasks]);
          } catch { /* malformed JSON, ignore */ }
        }
      } else if (data.error) {
        setCeoMessages(prev => [...prev, { role: 'model', content: `[ERROR] ${data.error}` }]);
      }
    } catch (err) {
      setCeoMessages(prev => [...prev, { role: 'model', content: '[Connection Error] Is the backend running?' }]);
    } finally { setIsCeoThinking(false); }
  };

  const startMission = (taskId: number) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'EXECUTING', logs: [] } : t));
    const eventSource = new EventSource(`http://localhost:3005/api/execute-mission?workspacePath=${encodeURIComponent(config.projectPath)}&agent=${encodeURIComponent(task.agent)}&taskName=${encodeURIComponent(task.name)}&taskId=${taskId}`);
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'log') setTasks(prev => prev.map(t => t.id === taskId ? { ...t, logs: [...(t.logs || []), data.log] } : t));
      else if (data.type === 'require_approval') setTasks(prev => prev.map(t => t.id === taskId ? { ...t, pendingAction: { tool: data.tool, args: data.args } } : t));
    };
    eventSource.addEventListener('end', () => eventSource.close());
    eventSource.onerror = () => eventSource.close();
  };

  const approveAction = async (taskId: number, approved: boolean) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, pendingAction: undefined } : t));
    await fetch('http://localhost:3005/api/approve-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId, approved })
    });
  };

  const addSession = () => {
    const name = prompt('Enter session name:');
    if (name) setSessions([...sessions, { id: Date.now(), name, active: false }]);
  };

  const addSkill = () => {
    const name = prompt('Enter skill name:');
    if (name) {
      const category = window.confirm('Is this a Universal skill? (OK for Universal, Cancel for Task-Specific)') ? 'Universal' : 'Task-Specific';
      setSkills([...skills, { id: Date.now(), name, source: 'Manual', category }]);
    }
  };

  const toggleTaskSkill = (taskId: number, skillId: number) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, assignedSkills: t.assignedSkills.includes(skillId) ? t.assignedSkills.filter(id => id !== skillId) : [...t.assignedSkills, skillId] } : t));
  };

  const saveSettings = async () => {
    await fetch('http://localhost:3005/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ googleKey: config.googleKey }) });
    setShowSettings(false);
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#202225', color: 'white', overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>
      
      {/* 1. RESTORED Discord Rail */}
      <div style={{ width: '72px', background: '#1e1f22', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '12px', paddingBottom: '12px', borderRight: '1px solid #18191c', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div title="Current Project" style={{ width: '48px', height: '48px', background: '#5865f2', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white', cursor: 'pointer' }}>AC</div>
          <div style={{ width: '32px', height: '2px', background: '#35363c', borderRadius: '1px' }}></div>
          <div title="Add Project" style={{ width: '48px', height: '48px', background: '#313338', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#23a559', cursor: 'pointer', transition: 'all 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.borderRadius = '16px'} onMouseLeave={(e) => e.currentTarget.style.borderRadius = '50%'}><Plus size={24} /></div>
        </div>
        <div onClick={() => setShowSettings(true)} style={{ width: '48px', height: '48px', color: '#b5bac1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = 'white'} onMouseLeave={(e) => e.currentTarget.style.color = '#b5bac1'}><Settings size={26} /></div>
      </div>

      {/* 2. Middle Column */}
      <div style={{ width: '260px', background: '#2b2d31', borderRight: '1px solid #1e1f22', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '15px 20px', background: '#2b2d31', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #1e1f22' }}>
          <span style={{ fontSize: '16px' }}>📊</span> <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Dashboard</span>
        </div>
        <div onClick={openWorkspace} style={{ padding: '12px 16px', background: '#2b2d31', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', borderBottom: '1px solid #1e1f22' }}>
          <Folder size={16} color="#b5bac1" /><div style={{ flex: 1, overflow: 'hidden' }}><div style={{ fontSize: '10px', color: '#949ba4', fontWeight: 'bold' }}>WORKSPACE</div><div style={{ fontSize: '12px', color: '#dbdee1', overflow: 'hidden', textOverflow: 'ellipsis' }}>{config.projectPath ? config.projectPath.split(/[\\/]/).pop() : 'Open Folder...'}</div></div><ChevronDown size={14} color="#b5bac1" />
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {/* Sections with minimization */}
          <div style={{ padding: '12px 8px' }}>
            <div onClick={() => setIsFilesMinimized(!isFilesMinimized)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '4px 8px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#949ba4', display: 'flex', alignItems: 'center', gap: '4px' }}>{isFilesMinimized ? <ChevronRight size={12} /> : <ChevronDown size={12} />} PROJECT FILES</div>
              <RefreshCw size={12} color="#b5bac1" style={{ animation: isLoadingFiles ? 'spin 2s linear infinite' : '' }} onClick={(e) => { e.stopPropagation(); refreshFiles(); }} />
            </div>
            {!isFilesMinimized && config.projectPath && <div style={{ padding: '4px 8px' }}>{realFiles.slice(0, 8).map(f => <div key={f} style={{ fontSize: '12px', color: '#b5bac1', padding: '3px 0', display: 'flex', alignItems: 'center', gap: '6px' }}><FileCode size={14} /> {f}</div>)}</div>}
          </div>

          <div style={{ padding: '4px 8px' }}>
            <div onClick={() => setIsSessionsMinimized(!isSessionsMinimized)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '4px 8px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#949ba4', display: 'flex', alignItems: 'center', gap: '4px' }}>{isSessionsMinimized ? <ChevronRight size={12} /> : <ChevronDown size={12} />} SESSIONS</div>
              <PlusCircle size={14} color="#23a559" onClick={(e) => { e.stopPropagation(); addSession(); }} />
            </div>
            {!isSessionsMinimized && sessions.map(s => <div key={s.id} style={{ padding: '6px 20px', fontSize: '13px', color: s.active ? 'white' : '#949ba4', display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '6px', height: '6px', borderRadius: '50%', background: s.active ? '#5865f2' : '#4f545c' }} />{s.name}</div>)}
          </div>

          <div style={{ padding: '4px 8px' }}>
            <div onClick={() => setIsDeptsMinimized(!isDeptsMinimized)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '4px 8px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#949ba4', display: 'flex', alignItems: 'center', gap: '4px' }}>{isDeptsMinimized ? <ChevronRight size={12} /> : <ChevronDown size={12} />} DEPARTMENTS</div>
            </div>
            {!isDeptsMinimized && <div style={{ padding: '6px 20px', fontSize: '12px' }}><div style={{ fontWeight: 'bold' }}>Frontend Dept</div><div style={{ color: '#949ba4', marginLeft: '10px' }}>- ui-worker</div><div style={{ fontWeight: 'bold', marginTop: '5px' }}>Backend Dept</div><div style={{ color: '#949ba4', marginLeft: '10px' }}>- api-worker</div></div>}
          </div>

          <div style={{ padding: '4px 8px' }}>
            <div onClick={() => setIsSkillsMinimized(!isSkillsMinimized)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '4px 8px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '11px', color: '#949ba4', display: 'flex', alignItems: 'center', gap: '4px' }}>{isSkillsMinimized ? <ChevronRight size={12} /> : <ChevronDown size={12} />} SKILLS</div>
              <PlusCircle size={14} color="#23a559" onClick={(e) => { e.stopPropagation(); addSkill(); }} />
            </div>
            {!isSkillsMinimized && <div style={{ margin: '8px', padding: '10px', background: '#1e1f22', borderRadius: '4px', fontSize: '11px' }}>
              <div style={{ color: '#949ba4', marginBottom: '6px' }}>UNIVERSAL</div>
              {skills.filter(s => s.category === 'Universal').map(s => <div key={s.id} style={{ color: '#23a559', marginBottom: '4px' }}>✓ {s.name}</div>)}
              <div style={{ color: '#949ba4', margin: '10px 0 6px' }}>TASK POOL</div>
              {skills.filter(s => s.category === 'Task-Specific').map(s => <div key={s.id} style={{ color: '#b5bac1', marginBottom: '4px' }}>• {s.name}</div>)}
            </div>}
          </div>
        </div>
        <div style={{ background: '#232428', padding: '12px 15px', borderTop: '1px solid #1e1f22', fontSize: '11px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Backend:</span>{backendStatus === 'online' ? <CheckCircle size={12} color="#23a559" /> : <AlertCircle size={12} color="#f23f43" />}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}><span>Model:</span><span style={{ color: '#dbdee1' }}>{config.defaultModel}</span></div>
        </div>
      </div>

      {/* 3. Dashboard Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#313338', padding: '20px', gap: '20px' }}>
        
        {/* CEO ENLARGED CHAT */}
        <div style={{ background: '#2b2d31', borderRadius: '12px', border: '1px solid #1e1f22', display: 'flex', flexDirection: 'column', flex: tasks.length === 0 ? 0.8 : 0.4, transition: 'all 0.3s ease' }}>
          <div style={{ padding: '15px 20px', borderBottom: '1px solid #1e1f22', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', background: '#23a559', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>CEO</div>
            <span style={{ fontWeight: 'bold' }}>CEO Agent (Project Orchestrator)</span>
          </div>
          <div style={{ flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {ceoMessages.map((m, i) => {
              const cleanContent = m.role === 'model'
                ? m.content.replace(/<<<TASK_PLAN>>>[\s\S]*?<<<END_TASK_PLAN>>>/g, '📋 *Task plan generated — see cards below.*')
                : m.content;
              return (
                <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                  <div style={{ background: m.role === 'user' ? '#5865f2' : '#383a40', padding: '12px 16px', borderRadius: '12px', fontSize: '14px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                    {cleanContent}
                  </div>
                </div>
              );
            })}
            {isCeoThinking && <div style={{ color: '#949ba4', fontSize: '12px' }}>CEO is analyzing project files...</div>}
            <div ref={chatEndRef} />
          </div>
          <div style={{ padding: '15px', borderTop: '1px solid #1e1f22', position: 'relative' }}>
            <input 
              value={ceoInput} onChange={e => setCeoInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendCeoMessage()}
              placeholder="Discuss project roadmap with CEO..." 
              style={{ width: '100%', background: '#1e1f22', border: 'none', padding: '12px 40px 12px 16px', borderRadius: '8px', color: 'white', fontSize: '14px' }}
            />
            <Send size={18} color="#b5bac1" style={{ position: 'absolute', right: '25px', top: '25px', cursor: 'pointer' }} onClick={sendCeoMessage} />
          </div>
        </div>

        {/* Kanban Area with spacing */}
        <div style={{ flex: 1, overflowX: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '15px', color: '#949ba4', fontSize: '12px', fontWeight: 'bold' }}><Terminal size={16} /> ACTIVE MISSIONS</div>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
            <div style={{ minWidth: '320px', background: '#2b2d31', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '11px', color: '#949ba4', marginBottom: '15px', fontWeight: 'bold' }}>PROPOSED</div>
              {tasks.filter(t => t.status === 'PROPOSED').map(task => (
                <div key={task.id} style={{ background: '#313338', borderRadius: '8px', padding: '15px', border: '1px solid #1e1f22', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{task.agent}</div>
                    {task.branchName && (
                      <code style={{ fontSize: '10px', background: '#1e1f22', color: '#5865f2', padding: '2px 6px', borderRadius: '4px' }}>{task.branchName}</code>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#b5bac1', marginBottom: '10px' }}>{task.name}</div>
                  {task.skillLoadout && task.skillLoadout.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                      {task.skillLoadout.map(s => (
                        <span key={s} style={{ fontSize: '10px', background: '#2b2d31', color: '#23a559', padding: '2px 8px', borderRadius: '10px', border: '1px solid #23a559' }}>{s}</span>
                      ))}
                    </div>
                  )}
                  <button onClick={() => startMission(task.id)} style={{ width: '100%', background: '#23a559', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>▶ START MISSION</button>
                </div>
              ))}
            </div>

            <div style={{ minWidth: '450px', background: '#2b2d31', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '11px', color: '#949ba4', marginBottom: '15px', fontWeight: 'bold' }}>EXECUTING</div>
              {tasks.filter(t => t.status === 'EXECUTING').map(task => (
                <div key={task.id} style={{ background: '#000', borderRadius: '8px', padding: '12px', border: '1px solid #1e1f22', fontFamily: 'monospace', fontSize: '11px', minHeight: '300px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ color: '#23a559', fontWeight: 'bold' }}>{task.agent}@terminal:~$ {task.name}</div>
                  <div style={{ flex: 1, maxHeight: '400px', overflowY: 'auto' }}>
                    {task.logs?.map((log, i) => <div key={i} style={{ color: log.includes('[EXEC]') ? '#f1c40f' : '#dcddde', marginBottom: '2px' }}>{log}</div>)}
                  </div>
                  {task.pendingAction && (
                    <div style={{ background: '#1e1f22', padding: '12px', borderRadius: '6px', borderLeft: '4px solid #f1c40f', marginTop: '10px' }}>
                      <div style={{ color: '#f1c40f', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}><ShieldCheck size={14} /> ACTION REQUIRED</div>
                      <div style={{ color: '#fff', fontSize: '12px', marginBottom: '12px' }}>Call <code style={{ color: '#f1c40f' }}>{task.pendingAction.tool}</code> with: <div style={{ background: '#000', padding: '5px', marginTop: '5px', borderRadius: '4px', fontSize: '10px' }}>{JSON.stringify(task.pendingAction.args)}</div></div>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => approveAction(task.id, true)} style={{ background: '#23a559', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Approve</button>
                        <button onClick={() => approveAction(task.id, false)} style={{ background: '#f23f43', color: 'white', border: 'none', padding: '6px 15px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Deny</button>
                      </div>
                    </div>
                  )}
                  {!task.pendingAction && <div style={{ width: '8px', height: '14px', background: '#fff', animation: 'blink 1s step-end infinite' }}></div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ width: '450px', background: '#2b2d31', borderRadius: '8px', padding: '24px', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>
            <h2 style={{ margin: '0 0 20px 0', fontSize: '20px' }}>Global Settings</h2>
            <label style={{ fontSize: '11px', color: '#949ba4', fontWeight: 'bold' }}>GEMINI API KEY (Google AI Studio)</label>
            <input type="password" value={config.googleKey} onChange={e => setConfig({...config, googleKey: e.target.value})} style={{ width: '100%', background: '#1e1f22', border: '1px solid #1e1f22', padding: '12px', color: 'white', marginTop: '8px', borderRadius: '4px' }} placeholder="AIza..." />
            <div style={{ fontSize: '10px', color: '#949ba4', marginTop: '5px' }}>Your key is saved safely to local .env file.</div>
            <button onClick={saveSettings} style={{ width: '100%', background: '#5865f2', color: 'white', border: 'none', padding: '12px', marginTop: '24px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Save & Close</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes blink { 50% { opacity: 0; } }
        body { margin: 0; padding: 0; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
};

export default App;
