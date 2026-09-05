// Screen 13a — Worker Loadout editor.
// Pick a worker, drag skills from the library into equipped slots (soft cap),
// apply a saved set with a diff preview, SAVE-GATED:
//   - draft state lives locally; nothing persists until "Save · apply to W#"
//   - Save → PUT /api/team/:id { patch: { loadout } }
//   - Discard reverts to the worker's committed loadout
//   - "Save as new set" hands the current draft up to the compose flow

import React, { useEffect, useMemo, useState } from 'react';
import type { Skill, SavedSet, Worker } from '../chaperoneTypes';
import { SkillCard, SkillChip, EmptyBlock } from './SkillCard';
import { updateWorker } from './api';

const SOFT_CAP = 10;

export function WorkerLoadout({
  workers,
  skills,
  savedSets,
  workspacePath,
  initialWorkerId,
  onSavedSetFromDraft,
  onWorkerUpdated,
}: {
  workers: Worker[];
  skills: Skill[];
  savedSets: SavedSet[];
  workspacePath: string;
  initialWorkerId?: string;
  // hand current equipped draft to the Compose-Set flow
  onSavedSetFromDraft?: (skillIds: string[]) => void;
  // notify parent a worker was persisted (so it can refetch team)
  onWorkerUpdated?: (worker: Worker) => void;
}) {
  const [workerId, setWorkerId] = useState<string | undefined>(initialWorkerId ?? workers[0]?.id);
  const worker = useMemo(() => workers.find((w) => w.id === workerId), [workers, workerId]);

  // committed (server) loadout vs. local draft
  const committed = worker?.loadout ?? [];
  const [draft, setDraft] = useState<string[]>(committed);
  const [tab, setTab] = useState<'library' | 'sets'>('library');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingSet, setPendingSet] = useState<SavedSet | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  // reset draft whenever the selected worker (or its committed loadout) changes
  useEffect(() => {
    setDraft(worker?.loadout ?? []);
    setPendingSet(null);
    setSaveMsg(null);
  }, [workerId, worker?.loadout]);

  const skillById = useMemo(() => {
    const m = new Map<string, Skill>();
    skills.forEach((s) => m.set(s.id, s));
    return m;
  }, [skills]);

  const added = draft.filter((id) => !committed.includes(id));
  const removed = committed.filter((id) => !draft.includes(id));
  const dirty = added.length + removed.length > 0;

  const equip = (id: string) => {
    setDraft((d) => (d.includes(id) ? d : [...d, id]));
  };
  const unequip = (id: string) => setDraft((d) => d.filter((x) => x !== id));

  const filteredLib = useMemo(() => {
    const q = search.trim().toLowerCase();
    return skills.filter((s) => !q || `${s.name} ${s.description} ${s.category}`.toLowerCase().includes(q));
  }, [skills, search]);

  const onDropToEquipped = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const id = e.dataTransfer.getData('text/skill-id');
    if (id) equip(id);
  };

  const discard = () => {
    setDraft(committed);
    setPendingSet(null);
    setSaveMsg(null);
  };

  const save = async () => {
    if (!worker || !dirty) return;
    setSaving(true);
    setSaveMsg(null);
    const { ok, worker: updated } = await updateWorker(workspacePath, worker.id, { loadout: draft });
    setSaving(false);
    if (ok) {
      setSaveMsg('saved');
      if (updated) onWorkerUpdated?.(updated);
      else onWorkerUpdated?.({ ...worker, loadout: draft });
    } else {
      setSaveMsg('save failed — backend offline?');
    }
  };

  // ── apply saved set: stage a diff, then confirm ─────────────────────────────
  const stageSet = (set: SavedSet) => setPendingSet(set);
  const applyPendingSet = (mode: 'replace' | 'merge') => {
    if (!pendingSet) return;
    setDraft((d) => {
      if (mode === 'replace') return [...pendingSet.skillIds];
      const merged = [...d];
      pendingSet.skillIds.forEach((id) => !merged.includes(id) && merged.push(id));
      return merged;
    });
    setPendingSet(null);
    setTab('library');
  };

  // ── empty state: no workers at all ──────────────────────────────────────────
  if (workers.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-2)', padding: 24 }}>
        <EmptyBlock title="No workers yet" hint="Recruit a worker from the Team view, then come back here to equip their skills." />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--paper-2)' }}>
      {/* header: worker picker + identity + mode hint */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1.5px solid var(--rule)',
          background: 'var(--paper-2)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ width: 10, height: 10, borderRadius: 99, background: worker ? 'var(--w1)' : 'var(--ink-3)' }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--ink-3)' }}>
            <span className="mono">Team</span>
            <span>›</span>
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              style={{ fontFamily: 'var(--mono)', fontSize: 11, padding: '2px 4px', border: '1px solid var(--rule-soft)', borderRadius: 3, background: 'var(--paper)', color: 'var(--ink)' }}
            >
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.id} · {w.displayName}
                </option>
              ))}
            </select>
            <span>›</span>
            <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>Loadout</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, marginTop: 1 }}>
            {worker ? `${worker.id} · ${worker.displayName}` : 'Select a worker'}
            {worker && (
              <span style={{ fontWeight: 400, color: 'var(--ink-3)', fontSize: 11, marginLeft: 4 }}>
                {worker.role} · ⎇ {worker.branchPrefix}
              </span>
            )}
          </div>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)' }}>
          Changes apply to {worker?.id ?? 'this worker'}'s next tool call. Save to commit · discard to revert.
        </span>
      </div>

      <div className="wf-scroll" style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0, overflow: 'auto' }}>
        {/* equipped frame */}
        <section
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDropToEquipped}
          style={{
            background: 'var(--paper-2)',
            border: `1.5px solid ${dragOver ? 'var(--pm)' : 'var(--rule)'}`,
            borderRadius: 10,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            position: 'relative',
            boxShadow: '0 1px 0 rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Equipped
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              {draft.length} skill{draft.length === 1 ? '' : 's'} · drag in to equip · ✕ to unequip
              {draft.length > SOFT_CAP && (
                <span style={{ color: 'var(--review)', marginLeft: 6 }}>· over soft cap of {SOFT_CAP}</span>
              )}
            </span>

            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {dirty ? (
                <span style={{ fontSize: 10, color: 'var(--review)', display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 99, background: 'var(--review)' }} />
                  {added.length + removed.length} unsaved
                  <span style={{ color: 'var(--ink-3)', fontFamily: 'var(--mono)', fontSize: 10, fontWeight: 400, marginLeft: 4 }}>
                    {added.map((id) => `+ ${skillById.get(id)?.name ?? id}`).join(' ')}{' '}
                    {removed.map((id) => `− ${skillById.get(id)?.name ?? id}`).join(' ')}
                  </span>
                </span>
              ) : (
                <span style={{ fontSize: 10, color: saveMsg === 'saved' ? 'var(--approve)' : 'var(--ink-3)', fontWeight: 600 }}>
                  {saveMsg === 'saved' ? '✓ saved' : 'no unsaved changes'}
                </span>
              )}
              <button
                className="btn"
                onClick={discard}
                disabled={!dirty}
                style={{ fontSize: 11, padding: '5px 12px', borderRadius: 4, background: 'var(--paper)', color: 'var(--ink-2)', border: '1.5px solid var(--rule-soft)', cursor: dirty ? 'pointer' : 'default', opacity: dirty ? 1 : 0.5 }}
              >
                ↶ Discard
              </button>
              <button
                className="btn"
                onClick={() => onSavedSetFromDraft?.(draft)}
                disabled={draft.length === 0}
                title="Save the current skills as a reusable set"
                style={{ fontSize: 11, padding: '5px 12px', borderRadius: 4, background: 'var(--paper)', color: 'var(--pm)', border: '1.5px solid var(--pm)', fontWeight: 600, cursor: draft.length ? 'pointer' : 'default', opacity: draft.length ? 1 : 0.5 }}
              >
                ⊞ Save as new set
              </button>
              <button
                className="btn"
                onClick={save}
                disabled={!dirty || saving}
                style={{ fontSize: 12, padding: '5px 14px', borderRadius: 4, background: dirty ? 'var(--approve)' : 'var(--rule-soft)', color: 'var(--paper)', border: '1.5px solid var(--approve)', fontWeight: 700, cursor: dirty && !saving ? 'pointer' : 'default', opacity: dirty ? 1 : 0.6 }}
              >
                {saving ? 'Saving…' : `✓ Save · apply to ${worker?.id ?? ''}`}
              </button>
            </span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'stretch' }}>
            {draft.map((id) => (
              <SkillChip key={id} skill={skillById.get(id) ?? { id, name: id, description: '', category: 'Universal', source: 'you' }} onRemove={() => unequip(id)} />
            ))}
            <div
              style={{
                minWidth: 110,
                padding: '5px 10px',
                borderRadius: 99,
                border: '1.5px dashed var(--rule-soft)',
                color: 'var(--ink-3)',
                fontFamily: 'var(--hand)',
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              ＋ drop skill here
            </div>
          </div>
        </section>

        {/* library + saved sets tabs */}
        <section className="box" style={{ background: 'var(--paper)', display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px', borderBottom: '1.5px solid var(--rule)' }}>
            <LoadoutTab label="Library" active={tab === 'library'} onClick={() => setTab('library')} />
            <LoadoutTab label="Apply saved set" badge={String(savedSets.length)} active={tab === 'sets'} onClick={() => setTab('sets')} />
            {tab === 'library' && (
              <div className="composer" style={{ marginLeft: 'auto', margin: '6px 0', padding: '4px 8px', maxWidth: 220, fontSize: 11 }}>
                <span style={{ fontSize: 11 }}>🔍</span>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="search library" />
              </div>
            )}
          </div>

          {tab === 'library' ? (
            skills.length === 0 ? (
              <div style={{ padding: 24 }}>
                <EmptyBlock title="No skills to equip" hint="Add skills to your library first, then drag them onto this worker." />
              </div>
            ) : (
              <div
                className="wf-scroll"
                style={{ flex: 1, overflow: 'auto', padding: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8, alignContent: 'start' }}
              >
                {filteredLib.map((s) => {
                  const isEquipped = draft.includes(s.id);
                  return (
                    <SkillCard
                      key={s.id}
                      skill={s}
                      equipped={isEquipped}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/skill-id', s.id)}
                      onClick={() => (isEquipped ? unequip(s.id) : equip(s.id))}
                    />
                  );
                })}
              </div>
            )
          ) : (
            <ApplySetPanel
              savedSets={savedSets}
              skillById={skillById}
              pendingSet={pendingSet}
              draft={draft}
              committed={committed}
              onStage={stageSet}
              onCancel={() => setPendingSet(null)}
              onApply={applyPendingSet}
            />
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Apply saved set, with a diff preview before committing to draft ─────────
function ApplySetPanel({
  savedSets,
  skillById,
  pendingSet,
  draft,
  onStage,
  onCancel,
  onApply,
}: {
  savedSets: SavedSet[];
  skillById: Map<string, Skill>;
  pendingSet: SavedSet | null;
  draft: string[];
  committed: string[];
  onStage: (set: SavedSet) => void;
  onCancel: () => void;
  onApply: (mode: 'replace' | 'merge') => void;
}) {
  if (savedSets.length === 0) {
    return (
      <div style={{ padding: 24 }}>
        <EmptyBlock title="No saved sets" hint="Compose a reusable set first, then apply it to any worker here." />
      </div>
    );
  }

  if (pendingSet) {
    const willAdd = pendingSet.skillIds.filter((id) => !draft.includes(id));
    const mergeKeeps = draft;
    const replaceRemoves = draft.filter((id) => !pendingSet.skillIds.includes(id));
    return (
      <div className="wf-scroll" style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700 }}>
          Apply “{pendingSet.label}” <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· preview</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <DiffCol title="Replace" hint="equipped becomes exactly this set">
            {pendingSet.skillIds.map((id) => (
              <DiffRow key={id} sign={draft.includes(id) ? '=' : '+'} name={skillById.get(id)?.name ?? id} />
            ))}
            {replaceRemoves.map((id) => (
              <DiffRow key={'r' + id} sign="−" name={skillById.get(id)?.name ?? id} />
            ))}
          </DiffCol>
          <DiffCol title="Merge" hint="keep current, add new from set">
            {mergeKeeps.map((id) => (
              <DiffRow key={'k' + id} sign="=" name={skillById.get(id)?.name ?? id} />
            ))}
            {willAdd.map((id) => (
              <DiffRow key={'a' + id} sign="+" name={skillById.get(id)?.name ?? id} />
            ))}
          </DiffCol>
        </div>

        <div style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--hand)' }}>
          this only stages the change into the draft — you still Save to commit
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={onCancel} style={{ fontSize: 11, padding: '6px 14px', borderRadius: 4, border: '1.5px solid var(--rule)', background: 'var(--paper)', cursor: 'pointer' }}>
            Cancel
          </button>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => onApply('merge')} style={{ fontSize: 11, padding: '6px 14px', borderRadius: 4, border: '1.5px solid var(--pm)', background: 'var(--paper)', color: 'var(--pm)', fontWeight: 600, cursor: 'pointer' }}>
              Merge into draft
            </button>
            <button className="btn" onClick={() => onApply('replace')} style={{ fontSize: 11, padding: '6px 14px', borderRadius: 4, border: '1.5px solid var(--approve)', background: 'var(--approve)', color: 'var(--paper)', fontWeight: 700, cursor: 'pointer' }}>
              Replace draft
            </button>
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="wf-scroll" style={{ flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {savedSets.map((set) => (
        <div key={set.id} className="box-soft" style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--paper-2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <strong style={{ fontSize: 12, flex: 1 }}>{set.label}</strong>
            <span style={{ fontSize: 9, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>by {set.owner}</span>
            <button className="btn" onClick={() => onStage(set)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 3, background: 'var(--paper)', color: 'var(--pm)', border: '1px solid var(--pm)', fontWeight: 600, cursor: 'pointer' }}>
              Preview & apply
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
            {set.skillIds.map((id) => (
              <span key={id} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 2, background: 'var(--paper)', border: '1px solid var(--rule-soft)', color: 'var(--ink-2)', fontFamily: 'var(--mono)' }}>
                {skillById.get(id)?.name ?? id}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DiffCol({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="box-soft" style={{ padding: '8px 10px', background: 'var(--paper)', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 700 }}>{title}</div>
      <div style={{ fontSize: 9, color: 'var(--ink-3)' }}>{hint}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>{children}</div>
    </div>
  );
}

function DiffRow({ sign, name }: { sign: '+' | '−' | '='; name: string }) {
  const color = sign === '+' ? 'var(--approve)' : sign === '−' ? 'var(--warn)' : 'var(--ink-3)';
  return (
    <div style={{ fontSize: 11, fontFamily: 'var(--mono)', color, display: 'flex', gap: 6 }}>
      <span style={{ width: 10 }}>{sign}</span>
      <span style={{ color: sign === '=' ? 'var(--ink-2)' : color }}>{name}</span>
    </div>
  );
}

function LoadoutTab({ label, active, badge, onClick }: { label: string; active?: boolean; badge?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '8px 12px',
        fontSize: 12,
        fontWeight: active ? 700 : 500,
        color: active ? 'var(--ink)' : 'var(--ink-3)',
        borderBottom: active ? '2px solid var(--ink)' : '2px solid transparent',
        marginBottom: -1.5,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span>{label}</span>
      {badge && badge !== '0' && (
        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 99, background: 'var(--paper-2)', color: 'var(--ink-2)', fontFamily: 'var(--mono)', fontWeight: 700 }}>
          {badge}
        </span>
      )}
    </div>
  );
}
