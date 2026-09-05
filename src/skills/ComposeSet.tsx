// Screen 13b — Compose Set.
// Build a reusable skill set (not bound to a worker) → POST /api/saved-sets.
// Drag skills from the library into 6 slots. Name + description + save target.

import React, { useEffect, useMemo, useState } from 'react';
import type { Skill, RolePreset } from '../chaperoneTypes';
import { SkillCard, EmptySlot, Label, EmptyBlock } from './SkillCard';
import { createSavedSet } from './api';

const SLOT_COUNT = 6;
const MAX_SKILLS = 8;

export function ComposeSet({
  skills,
  rolePresets,
  workspacePath,
  initialSkillIds,
  onSaved,
  onCancel,
}: {
  skills: Skill[];
  rolePresets: RolePreset[];
  workspacePath: string;
  initialSkillIds?: string[]; // e.g. seeded from a worker's loadout draft
  onSaved: () => void; // refresh saved-sets + return to library
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState<string[]>(initialSkillIds ?? []);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [target, setTarget] = useState<'private' | 'shared'>('private');
  const [seedPreset, setSeedPreset] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (initialSkillIds) setPicked(initialSkillIds.slice(0, MAX_SKILLS));
  }, [initialSkillIds]);

  const skillById = useMemo(() => {
    const m = new Map<string, Skill>();
    skills.forEach((s) => m.set(s.id, s));
    return m;
  }, [skills]);

  const add = (id: string) =>
    setPicked((p) => (p.includes(id) || p.length >= MAX_SKILLS ? p : [...p, id]));
  const remove = (id: string) => setPicked((p) => p.filter((x) => x !== id));

  const filteredLib = useMemo(() => {
    const q = search.trim().toLowerCase();
    return skills.filter((s) => !q || `${s.name} ${s.description} ${s.category}`.toLowerCase().includes(q));
  }, [skills, search]);

  const canSave = name.trim().length > 0 && picked.length >= 1 && !saving;

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const id = e.dataTransfer.getData('text/skill-id');
    if (id) add(id);
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const { ok } = await createSavedSet(workspacePath, {
      label: name.trim(),
      skillIds: picked,
      owner: 'you',
      // description / target / seedPreset are passed through; backend may ignore
      // extras it doesn't model yet.
      ...( { description: description.trim(), target, seedPresetId: seedPreset || undefined } as any ),
    });
    setSaving(false);
    if (ok) onSaved();
    else setError('Save failed — is the backend running on :3005?');
  };

  // slot view: picked skills fill slots, remaining are empty
  const slots: (string | null)[] = [];
  for (let i = 0; i < Math.max(SLOT_COUNT, picked.length); i++) slots.push(picked[i] ?? null);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--paper-2)' }}>
      {/* mode breadcrumb + name */}
      <div style={{ borderBottom: '1.5px solid var(--rule)', background: 'var(--paper-2)' }}>
        <div style={{ padding: '8px 16px 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--ink-3)' }}>
          <span className="mono">Skills</span>
          <span>›</span>
          <span style={{ color: 'var(--ink-2)', fontWeight: 600 }}>Compose new set</span>
        </div>
        <div style={{ padding: '8px 16px 10px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 99, background: 'var(--review)', color: 'var(--paper)', fontWeight: 700, letterSpacing: 0.5 }}>
            MODE · COMPOSE SET
          </span>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 220 }}>
            <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>Set name</span>
            <div className="composer" style={{ padding: '4px 8px', maxWidth: 360, marginTop: 2 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Backend · v2 (rate-limited)" />
            </div>
          </div>
          <span style={{ fontSize: 10, color: 'var(--ink-3)', maxWidth: 260, textAlign: 'right', lineHeight: 1.4 }}>
            Not bound to a worker. Save → appears in library, can be applied to any worker.
          </span>
        </div>
      </div>

      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflow: 'hidden' }}>
        {/* compose slot row */}
        <div
          className="box"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{ padding: '14px 16px', background: 'var(--paper)', display: 'flex', flexDirection: 'column', gap: 10, borderColor: dragOver ? 'var(--pm)' : undefined }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', letterSpacing: 0.4, textTransform: 'uppercase' }}>
              Skills in this set
            </span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>· min 1 · suggested 4-6 · max {MAX_SKILLS}</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-2)' }}>
              {picked.length} of {Math.max(SLOT_COUNT, picked.length)} picked
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(SLOT_COUNT, picked.length)}, 1fr)`, gap: 8 }}>
            {slots.map((id, i) =>
              id ? (
                <SkillCard key={id} skill={skillById.get(id)} equipped draggable={false} onRemove={() => remove(id)} />
              ) : (
                <EmptySlot key={`slot-${i}`}>slot {i + 1}</EmptySlot>
              )
            )}
          </div>
        </div>

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14, minHeight: 0 }}>
          {/* library */}
          <div className="box" style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', background: 'var(--paper)' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1.5px solid var(--rule)', background: 'var(--paper-2)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Skill library</span>
              <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}>· drag in to build this set</span>
              <div className="composer" style={{ marginLeft: 'auto', padding: '3px 8px', maxWidth: 180, fontSize: 11 }}>
                <span style={{ fontSize: 11 }}>🔍</span>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="search" />
              </div>
            </div>
            {skills.length === 0 ? (
              <div style={{ padding: 24 }}>
                <EmptyBlock title="No skills yet" hint="Add skills to your library before composing a set." />
              </div>
            ) : (
              <div
                className="wf-scroll"
                style={{ flex: 1, overflow: 'auto', padding: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 8, alignContent: 'start' }}
              >
                {filteredLib.map((s) => {
                  const inSet = picked.includes(s.id);
                  return (
                    <SkillCard
                      key={s.id}
                      skill={s}
                      equipped={inSet}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/skill-id', s.id)}
                      onClick={() => (inSet ? remove(s.id) : add(s.id))}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* set options */}
          <div className="box wf-scroll" style={{ padding: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto', background: 'var(--paper)' }}>
            <div style={{ padding: '8px 12px', borderBottom: '1.5px solid var(--rule)', background: 'var(--paper-2)', fontSize: 12, fontWeight: 600 }}>
              Set options
            </div>
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Label>
                  Description <small style={{ color: 'var(--ink-3)' }}>· optional</small>
                </Label>
                <div className="composer" style={{ padding: '6px 8px' }}>
                  <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Hardened backend stack · rate limits + sec audit" />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Label>Save target</Label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <ChoiceRow active={target === 'private'} label="Private · only you" hint="visible only in your library" onClick={() => setTarget('private')} />
                  <ChoiceRow active={target === 'shared'} label="Shared · this workspace" hint="other teammates can apply" onClick={() => setTarget('shared')} />
                  <ChoiceRow disabled label="Publish to Skill community" hint="future · global library" />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Label>Optionally · seed onto a role preset</Label>
                <select
                  value={seedPreset}
                  onChange={(e) => setSeedPreset(e.target.value)}
                  style={{ fontFamily: 'var(--sans)', fontSize: 11, padding: '6px 8px', borderRadius: 4, border: '1.5px solid var(--rule)', background: 'var(--paper)', color: 'var(--ink)' }}
                >
                  <option value="">— don't seed onto a role —</option>
                  {rolePresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.role} (default for new {p.role} workers)
                    </option>
                  ))}
                </select>
                {rolePresets.length === 0 && (
                  <span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--hand)' }}>no role presets defined yet</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* save bar */}
      <div style={{ borderTop: '1.5px solid var(--rule)', background: 'var(--paper)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: error ? 'var(--warn)' : 'var(--ink-3)' }}>
          {error
            ? error
            : picked.length === 0
            ? 'Set is unsaved · pick at least 1 skill to save'
            : `Set is unsaved · ${picked.length} skill${picked.length === 1 ? '' : 's'} picked${name.trim() ? '' : ' · name it to save'}`}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn" onClick={onCancel} style={{ fontSize: 11, padding: '6px 14px', borderRadius: 4, border: '1.5px solid var(--rule)', background: 'var(--paper)', color: 'var(--ink-2)', cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            className="btn"
            onClick={handleSave}
            disabled={!canSave}
            style={{
              fontSize: 12,
              padding: '6px 16px',
              borderRadius: 4,
              border: '1.5px solid var(--review)',
              background: canSave ? 'var(--review)' : 'var(--rule-soft)',
              color: 'var(--paper)',
              fontWeight: 700,
              cursor: canSave ? 'pointer' : 'not-allowed',
              opacity: canSave ? 1 : 0.7,
            }}
          >
            {saving ? 'Saving…' : '✓ Save set'}
          </button>
        </span>
      </div>
    </div>
  );
}

function ChoiceRow({ active, disabled, label, hint, onClick }: { active?: boolean; disabled?: boolean; label: string; hint: string; onClick?: () => void }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        padding: '6px 8px',
        borderRadius: 3,
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: active ? 'var(--pm-soft)' : 'var(--paper)',
        border: active ? '1.5px solid var(--pm)' : '1px solid var(--rule-soft)',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: 99,
            background: active ? 'var(--pm)' : 'var(--paper)',
            border: `1.5px solid ${active ? 'var(--pm)' : 'var(--rule-soft)'}`,
            display: 'inline-block',
            flex: '0 0 auto',
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 600, color: active ? 'var(--pm)' : 'var(--ink)' }}>{label}</span>
        {disabled && <span style={{ marginLeft: 'auto', fontSize: 9, fontFamily: 'var(--mono)', color: 'var(--ink-3)' }}>soon</span>}
      </div>
      <span style={{ fontSize: 10, color: 'var(--ink-3)', paddingLeft: 18 }}>{hint}</span>
    </div>
  );
}
