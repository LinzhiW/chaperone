// RecruitModal — "Recruit a worker" 3-step hire modal.
// 1:1 port of screen 14 (Recruit_Worker) from
// .design/agent-company/project/wf-recruit-hitl.jsx, wired to the live API.
//
// Steps: 1·Role (presets + custom) → 2·Skills (equip/swap/saved-set/skip) → 3·Identity.
// Footer: Cancel / "✓ Hire · add to team" → POST /api/team, then onHired(worker).
//
// Scope: self-contained under src/recruit/. Uses the existing CSS-var tokens and
// App.tsx inline-style conventions. No edits to App.tsx (parent wires open/close).

import React, { useEffect, useMemo, useState } from 'react';
import type { RolePreset, SavedSet, Skill, Worker } from '../chaperoneTypes';
import {
  PRESET_DESC,
  fetchRolePresets,
  fetchSavedSets,
  fetchSkills,
  nextWorkerLabel,
  postWorker,
} from './recruitData';

// ── Props ────────────────────────────────────────────────────────────────────
export interface RecruitModalProps {
  open: boolean;
  workspacePath: string;
  /** Current team — used only to preview the next free W# in step 3. */
  existingTeam?: Worker[];
  onClose: () => void;
  /** Called with the persisted Worker (server-assigned id) after a successful hire. */
  onHired: (worker: Worker) => void;
}

const CUSTOM_ID = '__custom__';

// ── Small presentational helpers (ported from the design) ────────────────────
function StepDot({ n, label, active, done }: { n: number; label: string; active?: boolean; done?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        width: 18, height: 18, borderRadius: 99, fontSize: 9, fontWeight: 700,
        background: active ? 'var(--pm)' : done ? 'var(--approve)' : 'var(--paper)',
        color: active || done ? 'var(--paper)' : 'var(--ink-3)',
        border: `1.5px solid ${active ? 'var(--pm)' : done ? 'var(--approve)' : 'var(--rule-soft)'}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>{done ? '✓' : n}</span>
      <span style={{ fontWeight: active ? 600 : 500, color: active ? 'var(--pm)' : 'var(--ink-3)' }}>{label}</span>
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 600 }}>{children}</span>;
}

function RoleCard({ preset, selected, skillById, onClick }: {
  preset: RolePreset; selected: boolean; skillById: (id: string) => Skill | undefined; onClick: () => void;
}) {
  return (
    <div onClick={onClick} style={{
      border: selected ? '1.5px solid var(--pm)' : '1.5px solid var(--rule-soft)',
      borderRadius: 4, padding: '10px 12px',
      background: selected ? 'var(--pm-soft)' : 'var(--paper)',
      display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer', position: 'relative',
    }}>
      {selected && (
        <span style={{ position: 'absolute', top: -8, right: 8, background: 'var(--pm)', color: 'var(--paper)', fontSize: 9, padding: '1px 6px', borderRadius: 99, fontWeight: 700 }}>SELECTED</span>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: preset.color || 'var(--ink-3)' }} />
        <strong style={{ fontSize: 12 }}>{preset.role}</strong>
        <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{preset.branchPrefix}…</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.4 }}>{PRESET_DESC[preset.id] ?? ''}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {preset.defaultSkillIds.map((id) => {
          const s = skillById(id);
          const c = s?.color || 'var(--ink-3)';
          return (
            <span key={id} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 2, background: c + '20', color: c, fontFamily: 'var(--mono)', fontWeight: 600 }}>{s?.name ?? id}</span>
          );
        })}
      </div>
    </div>
  );
}

// Compact equipped skill chip (mirrors SkillCard compact + onRemove).
function SkillSlot({ skill, onRemove }: { skill: Skill; onRemove: () => void }) {
  const c = skill.color || 'var(--ink-2)';
  return (
    <div style={{
      position: 'relative', border: `1.5px solid ${c}`, borderRadius: 4, background: c + '12',
      padding: '5px 7px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: 'var(--ink-3)', fontSize: 10 }}>⋮⋮</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: c, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill.name}</span>
        <span onClick={onRemove} title="unequip" style={{ fontSize: 11, color: 'var(--ink-3)', cursor: 'pointer' }}>×</span>
      </div>
    </div>
  );
}

function EmptySlot({ onClick }: { onClick: () => void }) {
  return (
    <div onClick={onClick} title="add a skill" style={{
      border: '1.5px dashed var(--rule-soft)', borderRadius: 4, background: 'rgba(31,29,26,0.02)',
      padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--ink-3)', fontSize: 11, fontFamily: 'var(--hand)', minHeight: 32, cursor: 'pointer',
    }}>+</div>
  );
}

// ── Main modal ───────────────────────────────────────────────────────────────
export default function RecruitModal({ open, workspacePath, existingTeam, onClose, onHired }: RecruitModalProps) {
  const [presets, setPresets] = useState<RolePreset[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [savedSets, setSavedSets] = useState<SavedSet[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [loadout, setLoadout] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [branchPrefix, setBranchPrefix] = useState('feat/');
  const [pickerOpen, setPickerOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load data each time the modal opens; reset wizard state.
  useEffect(() => {
    if (!open) return;
    setSelectedRoleId(null);
    setLoadout([]);
    setDisplayName('');
    setBranchPrefix('feat/');
    setPickerOpen(false);
    setError(null);
    setSubmitting(false);
    setLoading(true);
    let alive = true;
    Promise.all([
      fetchRolePresets(workspacePath),
      fetchSkills(workspacePath),
      fetchSavedSets(workspacePath),
    ]).then(([p, s, sets]) => {
      if (!alive) return;
      setPresets(p);
      setSkills(s);
      setSavedSets(sets);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [open, workspacePath]);

  const skillById = useMemo(() => {
    const m = new Map(skills.map((s) => [s.id, s]));
    return (id: string) => m.get(id);
  }, [skills]);

  const selectedPreset = useMemo(
    () => presets.find((p) => p.id === selectedRoleId) || null,
    [presets, selectedRoleId],
  );
  const isCustom = selectedRoleId === CUSTOM_ID;

  // Choosing a role pre-fills the loadout + branch prefix (step 2/3 defaults).
  function chooseRole(p: RolePreset) {
    setSelectedRoleId(p.id);
    setLoadout([...p.defaultSkillIds]);
    setBranchPrefix(p.branchPrefix);
    if (!displayName) setDisplayName(`${p.role} worker`);
  }
  function chooseCustom() {
    setSelectedRoleId(CUSTOM_ID);
    setLoadout([]);
    setBranchPrefix('feat/');
  }

  function removeSkill(id: string) {
    setLoadout((l) => l.filter((x) => x !== id));
  }
  function addSkill(id: string) {
    setLoadout((l) => (l.includes(id) ? l : [...l, id]));
    setPickerOpen(false);
  }
  function applySavedSet(set: SavedSet) {
    setLoadout([...set.skillIds]);
  }

  const roleName = isCustom ? 'Custom' : selectedPreset?.role ?? '';
  const dept = isCustom ? 'Engineering' : selectedPreset?.dept ?? 'Engineering';
  const nextLabel = nextWorkerLabel(existingTeam);
  const canHire = !!selectedRoleId && displayName.trim().length > 0 && !submitting;

  async function handleHire() {
    if (!canHire) return;
    setSubmitting(true);
    setError(null);
    const draft: Omit<Worker, 'id' | 'createdAt'> = {
      displayName: displayName.trim(),
      role: roleName || 'Custom',
      dept,
      branchPrefix: branchPrefix.trim() || 'feat/',
      loadout,
    };
    const worker = await postWorker(workspacePath, draft);
    if (worker) {
      onHired(worker);
      onClose();
    } else {
      setSubmitting(false);
      setError('Could not save worker — backend unreachable. Try again.');
    }
  }

  if (!open) return null;

  const step1Done = !!selectedRoleId;
  const step2Active = !!selectedRoleId; // skills become the focus once a role is picked

  // skills not already equipped — for the inline add-picker
  const available = skills.filter((s) => !loadout.includes(s.id));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recruit a worker"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
    >
      <div
        className="box"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 920, maxWidth: '100%', maxHeight: '90vh', background: 'var(--paper)',
          borderColor: 'var(--rule)', borderRadius: 6, display: 'flex', flexDirection: 'column',
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)', overflow: 'hidden',
        }}
      >
        {/* Header + step indicator */}
        <div style={{ padding: '12px 18px', borderBottom: '1.5px solid var(--rule)', background: 'var(--paper-2)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>＋ Recruit a worker</span>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>· pick role · choose skills · name them</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <StepDot n={1} label="Role" active={!step1Done} done={step1Done} /> ─
            <StepDot n={2} label="Skills" active={step2Active} /> ─
            <StepDot n={3} label="Name & ship" active={!!displayName.trim() && step1Done} />
          </div>
        </div>

        {/* Body: left = role presets, right = skills + identity */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0 }}>
          {/* Left: Step 1 · Role */}
          <div style={{ padding: '14px 18px', borderRight: '1.5px solid var(--rule)', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
            <Label>Step 1 · Role · pick a preset (or custom)</Label>
            <div className="wf-scroll" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, overflow: 'auto', paddingRight: 6 }}>
              {loading && <div style={{ gridColumn: 'span 2', fontSize: 11, color: 'var(--ink-3)' }}>Loading roles…</div>}
              {!loading && presets.length === 0 && (
                <div style={{ gridColumn: 'span 2', fontSize: 11, color: 'var(--ink-3)' }}>No role presets yet — use Custom below.</div>
              )}
              {presets.map((p) => (
                <RoleCard key={p.id} preset={p} selected={p.id === selectedRoleId} skillById={skillById} onClick={() => chooseRole(p)} />
              ))}
              <div
                onClick={chooseCustom}
                style={{
                  gridColumn: 'span 2',
                  border: isCustom ? '1.5px solid var(--pm)' : '1.5px dashed var(--rule-soft)',
                  borderRadius: 4, padding: '10px 12px',
                  background: isCustom ? 'var(--pm-soft)' : 'transparent',
                  color: isCustom ? 'var(--pm)' : 'var(--ink-3)', fontSize: 11,
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                }}
              >
                <span style={{ fontSize: 16 }}>＋</span>
                <span style={{ flex: 1 }}>Custom role · describe responsibilities yourself</span>
              </div>
            </div>
          </div>

          {/* Right: Step 2 · Skills + Step 3 · Identity */}
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflow: 'auto' }}>
            {/* Step 2 · Skills */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label>
                Step 2 · Skills{selectedPreset ? ` · ${loadout.length} slot${loadout.length === 1 ? '' : 's'} equipped by default for ${selectedPreset.role}` : ''}
              </Label>

              {!selectedRoleId && (
                <div style={{ fontSize: 11, color: 'var(--ink-3)', padding: '8px 0' }}>Pick a role on the left to pre-fill its skill set — or choose Custom and add your own.</div>
              )}

              {selectedRoleId && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                    {loadout.map((id) => {
                      const s = skillById(id);
                      if (!s) return null;
                      return <SkillSlot key={id} skill={s} onRemove={() => removeSkill(id)} />;
                    })}
                    {/* one always-available add slot + show picker inline */}
                    <EmptySlot onClick={() => setPickerOpen((v) => !v)} />
                  </div>

                  {pickerOpen && (
                    <div className="box-soft" style={{ padding: 8, display: 'flex', flexWrap: 'wrap', gap: 6, background: 'var(--paper)' }}>
                      {available.length === 0 && <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>All skills equipped.</span>}
                      {available.map((s) => {
                        const c = s.color || 'var(--ink-2)';
                        return (
                          <span
                            key={s.id}
                            onClick={() => addSkill(s.id)}
                            title={s.description}
                            style={{ cursor: 'pointer', fontSize: 10, fontWeight: 600, fontFamily: 'var(--mono)', padding: '3px 7px', borderRadius: 3, border: `1px solid ${c}`, color: c, background: c + '12' }}
                          >
                            + {s.name}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Apply saved set:</span>
                    {savedSets.map((set, i) => (
                      <span
                        key={set.id}
                        onClick={() => applySavedSet(set)}
                        className="branch-chip"
                        style={i === 0
                          ? { cursor: 'pointer', background: 'var(--pm-soft)', borderColor: 'var(--pm)', color: 'var(--pm)' }
                          : { cursor: 'pointer' }}
                      >{set.label}</span>
                    ))}
                    <span
                      onClick={() => setLoadout([])}
                      style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)', textDecoration: 'underline', cursor: 'pointer' }}
                    >skip / clear</span>
                  </div>
                </>
              )}
            </div>

            <hr style={{ width: '100%', border: 0, borderTop: '1px dashed var(--rule-soft)', margin: 0 }} />

            {/* Step 3 · Identity */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label>Step 3 · Identity</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>Display name</span>
                  <input
                    className="composer"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. api-worker · Auth & Sessions"
                    style={{ padding: '7px 10px', fontSize: 12, color: 'var(--ink)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>Will be assigned id</span>
                  <div className="composer" style={{ padding: '7px 10px' }}>
                    <span style={{ color: 'var(--ink-3)' }}>{nextLabel} (server assigns)</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>Branch prefix</span>
                  <input
                    className="composer"
                    value={branchPrefix}
                    onChange={(e) => setBranchPrefix(e.target.value)}
                    placeholder="feat/api-"
                    style={{ padding: '7px 10px', fontSize: 12, color: 'var(--ink)', fontFamily: 'var(--mono)' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>Goes to dept</span>
                  <div className="composer" style={{ padding: '7px 10px' }}>
                    <span style={{ color: 'var(--ink)' }}>{dept} (auto)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px', borderTop: '1.5px solid var(--rule)', background: 'var(--paper-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: error ? 'var(--warn)' : 'var(--ink-3)' }}>
            {error || 'Worker stays idle until you brief them with a mission.'}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              className="btn"
              onClick={onClose}
              style={{ fontSize: 11, padding: '6px 14px', borderRadius: 4, border: '1.5px solid var(--rule)', background: 'var(--paper)', cursor: 'pointer' }}
            >Cancel</button>
            <button
              className="btn"
              onClick={handleHire}
              disabled={!canHire}
              style={{
                fontSize: 11, padding: '6px 14px', borderRadius: 4,
                border: '1.5px solid var(--approve)', background: 'var(--approve)', color: 'var(--paper)', fontWeight: 700,
                cursor: canHire ? 'pointer' : 'not-allowed', opacity: canHire ? 1 : 0.5,
              }}
            >{submitting ? 'Hiring…' : '✓ Hire · add to team'}</button>
          </span>
        </div>
      </div>
    </div>
  );
}
