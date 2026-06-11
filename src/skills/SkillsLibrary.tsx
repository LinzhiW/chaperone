// Screen 11 — Skills Library.
// Card grid + search + category filter + sort + source badges + saved-sets rail.
// Source skills are REAL (GET /api/skills). Empty states when nothing exists.

import { useMemo, useState } from 'react';
import type { Skill, SavedSet, Worker } from '../canopyTypes';
import { LibrarySkillCard, EmptyBlock } from './SkillCard';
import { colorForSkill } from './api';

export { EmptyBlock };

type SortKey = 'used' | 'newest' | 'role';

export function SkillsLibrary({
  skills,
  savedSets,
  workers,
  loading,
  onNewSkill,
  onComposeSet,
  onApplySet,
  onEditSet,
  onDuplicateSet,
}: {
  skills: Skill[];
  savedSets: SavedSet[];
  workers: Worker[];
  loading?: boolean;
  onNewSkill: () => void;
  onComposeSet: () => void;
  onApplySet: (set: SavedSet) => void;
  onEditSet?: (set: SavedSet) => void;
  onDuplicateSet?: (set: SavedSet) => void;
}) {
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState('All');
  const [sourceFilter, setSourceFilter] = useState<'any' | Skill['source']>('any');
  const [sort, setSort] = useState<SortKey>('used');

  const skillById = useMemo(() => {
    const m = new Map<string, Skill>();
    skills.forEach((s) => m.set(s.id, s));
    return m;
  }, [skills]);

  // usage count per skill id, derived from real worker loadouts
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    workers.forEach((w) => (w.loadout || []).forEach((id) => m.set(id, (m.get(id) || 0) + 1)));
    return m;
  }, [workers]);

  // categories present in the real data
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    skills.forEach((s) => counts.set(s.category, (counts.get(s.category) || 0) + 1));
    const cats = [{ id: 'All', count: skills.length }];
    [...counts.keys()].sort().forEach((c) => cats.push({ id: c, count: counts.get(c)! }));
    return cats;
  }, [skills]);

  // search supports "source:you" / "frontend" / plain text — parsed from the query
  const filtered = useMemo(() => {
    let q = query.trim().toLowerCase();
    let qSource: Skill['source'] | null = null;
    let qCat: string | null = null;
    const srcMatch = q.match(/source:(\w+)/);
    if (srcMatch) {
      const v = srcMatch[1];
      qSource = v === 'github' ? 'github' : v === 'you' || v === 'mine' ? 'you' : v === 'built-in' || v === 'builtin' ? 'built-in' : null;
      q = q.replace(/source:\w+/, '').trim();
    }
    const catNames = categories.map((c) => c.id.toLowerCase());
    if (q && catNames.includes(q)) {
      qCat = categories.find((c) => c.id.toLowerCase() === q)!.id;
      q = '';
    }

    let out = skills.filter((s) => {
      if (activeCat !== 'All' && s.category !== activeCat) return false;
      if (qCat && s.category !== qCat) return false;
      if (sourceFilter !== 'any' && s.source !== sourceFilter) return false;
      if (qSource && s.source !== qSource) return false;
      if (q && !(`${s.name} ${s.description} ${s.category}`.toLowerCase().includes(q))) return false;
      return true;
    });

    out = [...out];
    if (sort === 'used') out.sort((a, b) => (usage.get(b.id) || 0) - (usage.get(a.id) || 0));
    else if (sort === 'newest') out.reverse(); // newest-added last in the array
    else if (sort === 'role') out.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    return out;
  }, [skills, query, activeCat, sourceFilter, sort, categories, usage]);

  const counts = useMemo(() => {
    const bySource = { 'built-in': 0, you: 0, github: 0 } as Record<Skill['source'], number>;
    skills.forEach((s) => (bySource[s.source] = (bySource[s.source] || 0) + 1));
    const equippedWorkers = workers.filter((w) => (w.loadout || []).length > 0).length;
    return { bySource, equippedWorkers };
  }, [skills, workers]);

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, background: 'var(--paper-2)' }}>
      {/* Category rail */}
      <CategoryRail categories={categories} activeCat={activeCat} onPick={setActiveCat} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--paper-2)' }}>
        {/* Page head */}
        <div
          style={{
            padding: '12px 18px',
            borderBottom: '1.5px solid var(--rule)',
            background: 'var(--paper)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: '0 0 auto' }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>
              Skill library · {activeCat}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              {skills.length} skill{skills.length === 1 ? '' : 's'}
              {skills.length > 0 && (
                <>
                  {' · '}
                  {counts.bySource['built-in']} built-in · {counts.bySource.you} yours · {counts.bySource.github} from GitHub
                  {' · '}used by {counts.equippedWorkers} worker{counts.equippedWorkers === 1 ? '' : 's'}
                </>
              )}
            </div>
          </div>
          <div className="composer" style={{ padding: '8px 12px', flex: 1, maxWidth: 460, marginLeft: 'auto' }}>
            <span style={{ fontSize: 12 }}>🔍</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search skills · or type a category like frontend / source:you"
            />
          </div>
          <button
            className="btn"
            onClick={onNewSkill}
            style={{
              fontSize: 12,
              padding: '7px 14px',
              background: 'var(--approve)',
              color: 'var(--paper)',
              border: '1.5px solid var(--approve)',
              borderRadius: 4,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ＋ New skill
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Grid area */}
          <div className="wf-scroll" style={{ flex: 1, overflow: 'auto', padding: 14 }}>
            {/* Active filters + sort strip */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 700 }}>
                Showing
              </span>
              <span
                onClick={() => setActiveCat('All')}
                style={{
                  fontSize: 11,
                  padding: '3px 9px',
                  borderRadius: 99,
                  cursor: 'pointer',
                  background: 'var(--ink)',
                  color: 'var(--paper)',
                  fontWeight: 600,
                }}
              >
                {activeCat === 'All' ? 'All categories' : activeCat}
              </span>
              <span style={{ display: 'inline-flex', border: '1px solid var(--rule-soft)', borderRadius: 99, overflow: 'hidden' }}>
                {(['any', 'built-in', 'you', 'github'] as const).map((s) => (
                  <span
                    key={s}
                    onClick={() => setSourceFilter(s)}
                    style={{
                      fontSize: 11,
                      padding: '3px 9px',
                      cursor: 'pointer',
                      background: sourceFilter === s ? 'var(--pm-soft)' : 'var(--paper)',
                      color: sourceFilter === s ? 'var(--pm)' : 'var(--ink-2)',
                      fontWeight: sourceFilter === s ? 600 : 400,
                    }}
                  >
                    {s === 'any' ? 'any source' : s === 'github' ? 'GitHub' : s}
                  </span>
                ))}
              </span>

              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--ink-3)', letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: 700 }}>
                  Sort
                </span>
                <span style={{ display: 'inline-flex', border: '1.5px solid var(--rule)', borderRadius: 4, overflow: 'hidden' }}>
                  <SortChip label="Most used" active={sort === 'used'} onClick={() => setSort('used')} />
                  <SortChip label="Newest" active={sort === 'newest'} onClick={() => setSort('newest')} />
                  <SortChip label="By role" active={sort === 'role'} onClick={() => setSort('role')} />
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>· {filtered.length} results</span>
              </span>
            </div>

            {/* Grid / empty states */}
            {loading ? (
              <EmptyBlock title="Loading skills…" hint="Reading your skill library." />
            ) : skills.length === 0 ? (
              <EmptyBlock
                title="No skills yet"
                hint="Your library is empty. Import a .md file, pull one from GitHub, or paste raw markdown."
                cta="＋ Add your first skill"
                onCta={onNewSkill}
              />
            ) : filtered.length === 0 ? (
              <EmptyBlock title="No matches" hint="Nothing matches the current search and filters." />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                {filtered.map((s) => (
                  <LibrarySkillCard key={s.id} skill={s} usedByCount={usage.get(s.id) || 0} />
                ))}
              </div>
            )}
          </div>

          {/* Saved sets rail */}
          <SavedSetsRail
            savedSets={savedSets}
            skillById={skillById}
            onComposeSet={onComposeSet}
            onApplySet={onApplySet}
            onEditSet={onEditSet}
            onDuplicateSet={onDuplicateSet}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Category rail (left) ───────────────────────────────────────────────────
function CategoryRail({
  categories,
  activeCat,
  onPick,
}: {
  categories: { id: string; count: number }[];
  activeCat: string;
  onPick: (c: string) => void;
}) {
  return (
    <div
      style={{
        width: 200,
        flex: '0 0 auto',
        background: 'var(--paper-2)',
        borderRight: '1.5px solid var(--rule)',
        padding: '12px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        overflow: 'auto',
      }}
      className="wf-scroll"
    >
      <div style={{ fontSize: 9, color: 'var(--ink-3)', fontFamily: 'var(--mono)', letterSpacing: 0.5, padding: '2px 4px 6px' }}>
        by category
      </div>
      {categories.map((c) => (
        <div
          key={c.id}
          onClick={() => onPick(c.id)}
          style={{
            padding: '4px 8px',
            borderRadius: 3,
            fontSize: 11,
            cursor: 'pointer',
            background: c.id === activeCat ? 'var(--ink)' : 'transparent',
            color: c.id === activeCat ? 'var(--paper)' : 'var(--ink-2)',
            fontWeight: c.id === activeCat ? 600 : 500,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ flex: 1 }}>{c.id}</span>
          <span style={{ fontSize: 9, fontFamily: 'var(--mono)', color: c.id === activeCat ? 'var(--paper)' : 'var(--ink-3)' }}>
            {c.count}
          </span>
        </div>
      ))}
      {categories.length <= 1 && (
        <div style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--hand)', padding: '8px 4px', lineHeight: 1.4 }}>
          categories appear here as you add skills
        </div>
      )}
    </div>
  );
}

// ─── Saved sets rail (right) ────────────────────────────────────────────────
function SavedSetsRail({
  savedSets,
  skillById,
  onComposeSet,
  onApplySet,
  onEditSet,
  onDuplicateSet,
}: {
  savedSets: SavedSet[];
  skillById: Map<string, Skill>;
  onComposeSet: () => void;
  onApplySet: (set: SavedSet) => void;
  onEditSet?: (set: SavedSet) => void;
  onDuplicateSet?: (set: SavedSet) => void;
}) {
  return (
    <div
      style={{
        flex: '0 0 240px',
        borderLeft: '1.5px solid var(--rule)',
        background: 'var(--paper)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div style={{ padding: '12px 14px', borderBottom: '1.5px solid var(--rule)', background: 'var(--paper-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Saved sets</span>
          <span style={{ fontSize: 10, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>· {savedSets.length}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.4 }}>
          Reusable skill combos. Apply to any worker in one click.
        </div>
      </div>

      <div style={{ padding: '10px 14px', borderBottom: '1px dashed var(--rule-soft)' }}>
        <button
          className="btn"
          onClick={onComposeSet}
          style={{
            width: '100%',
            fontSize: 12,
            padding: '8px 12px',
            borderRadius: 4,
            background: 'var(--pm)',
            color: 'var(--paper)',
            border: '1.5px solid var(--pm)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 14 }}>⊞</span>
          <span>Compose a new set</span>
        </button>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 4, textAlign: 'center', fontFamily: 'var(--hand)' }}>
          pick 4-6 skills → save as a loadout
        </div>
      </div>

      <div className="wf-scroll" style={{ flex: 1, overflow: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {savedSets.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--ink-3)', fontFamily: 'var(--hand)', padding: '12px 6px', textAlign: 'center', lineHeight: 1.4 }}>
            no saved sets yet — compose one above
          </div>
        ) : (
          savedSets.map((set) => (
            <div
              key={set.id}
              className="box-soft"
              style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--paper-2)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <strong style={{ fontSize: 12, flex: 1 }}>{set.label}</strong>
                <span style={{ fontSize: 9, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>by {set.owner}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {set.skillIds.map((id) => {
                  const s = skillById.get(id);
                  const color = s ? colorForSkill(s) : 'var(--ink-3)';
                  return (
                    <span
                      key={id}
                      style={{
                        fontSize: 9,
                        padding: '1px 5px',
                        borderRadius: 2,
                        background: (s ? color : 'var(--rule-soft)') + (s ? '20' : ''),
                        color: s ? color : 'var(--ink-3)',
                        fontFamily: 'var(--mono)',
                        fontWeight: 600,
                      }}
                    >
                      {s ? s.name : id}
                    </span>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                <button
                  className="btn"
                  onClick={() => onApplySet(set)}
                  style={{ flex: 1, fontSize: 10, padding: '3px 6px', borderRadius: 3, background: 'var(--paper)', color: 'var(--pm)', border: '1px solid var(--pm)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Apply to worker…
                </button>
                <button
                  className="btn"
                  onClick={() => onEditSet?.(set)}
                  style={{ fontSize: 10, padding: '3px 6px', borderRadius: 3, background: 'var(--paper)', color: 'var(--ink-2)', border: '1px solid var(--rule-soft)', cursor: 'pointer' }}
                >
                  ✎
                </button>
                <button
                  className="btn"
                  onClick={() => onDuplicateSet?.(set)}
                  title="duplicate"
                  style={{ fontSize: 10, padding: '3px 6px', borderRadius: 3, background: 'var(--paper)', color: 'var(--ink-3)', border: '1px solid var(--rule-soft)', cursor: 'pointer' }}
                >
                  ⎘
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SortChip({ label, active, onClick }: { label: string; active?: boolean; onClick?: () => void }) {
  return (
    <span
      onClick={onClick}
      style={{
        padding: '4px 10px',
        fontSize: 11,
        fontWeight: active ? 700 : 500,
        cursor: 'pointer',
        background: active ? 'var(--ink)' : 'var(--paper)',
        color: active ? 'var(--paper)' : 'var(--ink-2)',
        borderRight: '1px solid var(--rule)',
      }}
    >
      {label}
    </span>
  );
}

