// Screen 12 — Skill Import / New.
// Modal with 3 tabs: Upload .md / GitHub link / Paste raw → POST /api/add-skill.
// Rendered as an overlay; caller controls open/close + provides workers for the
// "equip immediately" select. All fields functional; submits real content.

import React, { useRef, useState } from 'react';
import type { Skill, Worker } from '../canopyTypes';
import { addSkill, slugify } from './api';
import { Label } from './SkillCard';

type Tab = 'upload' | 'github' | 'paste';

const CATEGORIES = ['Frontend', 'Backend', 'Mobile', 'Testing', 'DevOps', 'Data', 'Workflow', 'Universal'];

export function SkillImport({
  workers,
  onClose,
  onSaved,
}: {
  workers: Worker[];
  onClose: () => void;
  onSaved: () => void; // refresh library after a successful save
}) {
  const [tab, setTab] = useState<Tab>('upload');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Universal');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [equipOn, setEquipOn] = useState('');
  const [fileName, setFileName] = useState('');
  const [fetchNote, setFetchNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const source: Skill['source'] = tab === 'github' ? 'github' : 'you';
  const canSave = name.trim().length > 0 && content.trim().length > 0 && !saving;

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const text = await f.text();
    setContent(text);
    if (!name.trim()) setName(f.name.replace(/\.md$/i, ''));
  };

  const onFetchGithub = async () => {
    setError(null);
    const url = githubUrl.trim();
    if (!url) return;
    setFetchNote('fetching…');
    // Convert blob URLs to raw.githubusercontent for direct .md fetch.
    const raw = url
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob/', '/');
    try {
      const res = await fetch(raw);
      if (!res.ok) throw new Error(String(res.status));
      const text = await res.text();
      setContent(text);
      const lines = text.split('\n').length;
      setFetchNote(`✓ fetched · ${lines} lines`);
      if (!name.trim()) {
        const base = url.split('/').pop()?.replace(/\.md$/i, '') ?? '';
        setName(base);
      }
    } catch {
      setFetchNote(null);
      setError('Could not fetch that URL. Paste the raw markdown instead, or check the link.');
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const { ok } = await addSkill({
      name: name.trim(),
      content: content.trim(),
      category,
      description: description.trim(),
      source,
      githubUrl: tab === 'github' ? githubUrl.trim() : undefined,
      equipOn: equipOn || null,
    });
    setSaving(false);
    if (ok) {
      onSaved();
      onClose();
    } else {
      setError('Save failed — is the backend running on :3005?');
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '30px 20px',
        overflow: 'auto',
        zIndex: 50,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)' }} onClick={onClose} />

      <div
        className="box"
        style={{
          position: 'relative',
          zIndex: 2,
          width: 720,
          maxWidth: '100%',
          background: 'var(--paper)',
          borderColor: 'var(--rule)',
          borderRadius: 6,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
          maxHeight: '100%',
        }}
      >
        {/* header */}
        <div
          style={{
            padding: '12px 18px',
            borderBottom: '1.5px solid var(--rule)',
            background: 'var(--paper-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700 }}>＋ New skill</span>
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>· lands in your library, usable by any worker</span>
          <span onClick={onClose} style={{ marginLeft: 'auto', fontSize: 14, color: 'var(--ink-3)', cursor: 'pointer' }}>
            ×
          </span>
        </div>

        {/* tabs */}
        <div style={{ padding: '10px 18px 0', display: 'flex', gap: 4, borderBottom: '1.5px solid var(--rule)' }}>
          <ImportTab label="Upload .md" active={tab === 'upload'} onClick={() => setTab('upload')} />
          <ImportTab label="GitHub link" active={tab === 'github'} onClick={() => setTab('github')} />
          <ImportTab label="Paste raw" active={tab === 'paste'} onClick={() => setTab('paste')} />
        </div>

        <div className="wf-scroll" style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto' }}>
          {/* source input per tab */}
          {tab === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Label>Upload a .md file <small style={{ color: 'var(--ink-3)' }}>· becomes the skill content</small></Label>
              <input ref={fileRef} type="file" accept=".md,.markdown,text/markdown,text/plain" onChange={onPickFile} style={{ display: 'none' }} />
              <div
                className="box-soft"
                onClick={() => fileRef.current?.click()}
                style={{
                  padding: '18px 12px',
                  background: 'var(--paper-2)',
                  textAlign: 'center',
                  cursor: 'pointer',
                  fontSize: 12,
                  color: 'var(--ink-2)',
                  borderStyle: 'dashed',
                }}
              >
                {fileName ? (
                  <span className="mono" style={{ color: 'var(--approve)' }}>✓ {fileName}</span>
                ) : (
                  <span>Click to choose a .md file</span>
                )}
              </div>
            </div>
          )}

          {tab === 'github' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Label>GitHub URL · single .md file</Label>
              <div className="composer" style={{ padding: '8px 10px', fontFamily: 'var(--mono)' }}>
                <input
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onFetchGithub()}
                  placeholder="github.com/team/skills/blob/main/owasp-checklist.md"
                  style={{ fontFamily: 'var(--mono)' }}
                />
                <span className="send" title="fetch" onClick={onFetchGithub} style={{ cursor: 'pointer' }}>
                  ↓
                </span>
              </div>
              {fetchNote && <div style={{ fontSize: 10, color: 'var(--approve)' }}>{fetchNote}</div>}
            </div>
          )}

          {tab === 'paste' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Label>Paste raw markdown</Label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="# My skill&#10;&#10;Instructions injected into the worker's system prompt…"
                style={{
                  minHeight: 120,
                  resize: 'vertical',
                  border: '1.5px solid var(--rule)',
                  borderRadius: 4,
                  background: 'var(--paper)',
                  padding: '10px 12px',
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  lineHeight: 1.55,
                  color: 'var(--ink)',
                  outline: 'none',
                }}
              />
            </div>
          )}

          {/* name + category */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Label>
                Name <small style={{ color: 'var(--ink-3)' }}>· what workers see when equipping</small>
              </Label>
              <div className="composer" style={{ padding: '7px 10px' }}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="OWASP-checklist" />
              </div>
              {name.trim() && (
                <span style={{ fontSize: 9, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>id: {slugify(name)}</span>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <Label>Category</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  fontFamily: 'var(--sans)',
                  fontSize: 12,
                  padding: '8px 10px',
                  borderRadius: 4,
                  border: '1.5px solid var(--rule)',
                  background: 'var(--paper)',
                  color: 'var(--ink)',
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Label>
              Short description <small style={{ color: 'var(--ink-3)' }}>· shown on card</small>
            </Label>
            <div className="composer" style={{ padding: '7px 10px' }}>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Top 10 review · sanitization · rate limit · cors."
              />
            </div>
          </div>

          {/* content preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Label>
              Content preview <small style={{ color: 'var(--ink-3)' }}>· injected into worker's system prompt</small>
            </Label>
            <div
              className="box-soft wf-scroll"
              style={{
                padding: '10px 12px',
                background: 'var(--paper-2)',
                maxHeight: 130,
                overflow: 'auto',
                fontFamily: 'var(--mono)',
                fontSize: 11,
                lineHeight: 1.55,
                color: 'var(--ink-2)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {content.trim() ? content : <span style={{ color: 'var(--ink-3)' }}>— no content yet —</span>}
            </div>
          </div>

          {/* equip immediately */}
          <div
            style={{
              padding: '8px 10px',
              background: 'var(--pm-soft)',
              border: '1px solid var(--pm)',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--pm)' }}>★ Equip immediately on:</span>
            <select
              value={equipOn}
              onChange={(e) => setEquipOn(e.target.value)}
              style={{ fontFamily: 'var(--sans)', fontSize: 11, padding: '3px 6px', borderRadius: 3, border: '1px solid var(--pm)', background: 'var(--paper)' }}
            >
              <option value="">nobody (save to library only)</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.id} · {w.displayName}
                </option>
              ))}
            </select>
            {workers.length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'var(--hand)' }}>
                no workers yet — recruit one to equip
              </span>
            )}
          </div>

          {error && <div style={{ fontSize: 11, color: 'var(--warn)' }}>{error}</div>}
        </div>

        {/* footer */}
        <div
          style={{
            padding: '10px 18px',
            borderTop: '1.5px solid var(--rule)',
            background: 'var(--paper-2)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            {tab === 'github' ? 'Source · GitHub' : tab === 'upload' ? 'Source · uploaded file' : 'Source · pasted'}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              className="btn"
              onClick={onClose}
              style={{ fontSize: 11, padding: '6px 14px', borderRadius: 4, border: '1.5px solid var(--rule)', background: 'var(--paper)', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              className="btn"
              onClick={handleSave}
              disabled={!canSave}
              style={{
                fontSize: 11,
                padding: '6px 14px',
                borderRadius: 4,
                border: '1.5px solid var(--approve)',
                background: canSave ? 'var(--approve)' : 'var(--rule-soft)',
                color: 'var(--paper)',
                fontWeight: 700,
                cursor: canSave ? 'pointer' : 'not-allowed',
                opacity: canSave ? 1 : 0.7,
              }}
            >
              {saving ? 'Saving…' : 'Save to library'}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

function ImportTab({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '8px 14px',
        background: active ? 'var(--paper)' : 'transparent',
        border: active ? '1.5px solid var(--rule)' : '1.5px solid transparent',
        borderBottom: active ? '1.5px solid var(--paper)' : '1.5px solid transparent',
        marginBottom: -1.5,
        borderRadius: '4px 4px 0 0',
        fontSize: 12,
        fontWeight: active ? 600 : 500,
        color: active ? 'var(--ink)' : 'var(--ink-3)',
        cursor: 'pointer',
      }}
    >
      {label}
    </div>
  );
}
