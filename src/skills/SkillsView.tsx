// Skills UI — bundled view with an internal tab router over the 4 screens.
//
// Owns shared data (skills / team / saved-sets / role-presets) and passes it to
// each screen. Everything is USER-DEFINED and starts EMPTY; all fetches degrade
// gracefully when the backend is offline. Save-gated edits live inside the
// individual screens (WorkerLoadout), not here.

import React, { useCallback, useEffect, useState } from 'react';
import type { Skill, SavedSet, Worker, RolePreset } from '../canopyTypes';
import { SkillsLibrary } from './SkillsLibrary';
import { SkillImport } from './SkillImport';
import { WorkerLoadout } from './WorkerLoadout';
import { ComposeSet } from './ComposeSet';
import { fetchSkills, fetchTeam, fetchSavedSets, fetchRolePresets } from './api';

export type SkillsTab = 'library' | 'loadout' | 'compose';

export interface SkillsViewProps {
  // The active workspace. Pass config.projectPath from App. Team / saved-sets /
  // role-presets are scoped to it; skills are global. Empty string is fine —
  // those lists just come back empty.
  workspacePath: string;
  // Optional controlled tab. Omit to let SkillsView manage its own tab state.
  tab?: SkillsTab;
  onTabChange?: (tab: SkillsTab) => void;
  // Open the loadout editor focused on a specific worker (e.g. from Team view).
  initialWorkerId?: string;
  // Fired after any successful mutation (skill added, set saved, worker saved)
  // so App can refresh anything it also shows.
  onDataChanged?: () => void;
}

export function SkillsView({
  workspacePath,
  tab: controlledTab,
  onTabChange,
  initialWorkerId,
  onDataChanged,
}: SkillsViewProps) {
  const [internalTab, setInternalTab] = useState<SkillsTab>('library');
  const tab = controlledTab ?? internalTab;
  const setTab = useCallback(
    (t: SkillsTab) => {
      setInternalTab(t);
      onTabChange?.(t);
    },
    [onTabChange],
  );

  const [skills, setSkills] = useState<Skill[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [savedSets, setSavedSets] = useState<SavedSet[]>([]);
  const [rolePresets, setRolePresets] = useState<RolePreset[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(true);

  // import modal overlay (screen 12) — rendered over whichever tab is active
  const [importOpen, setImportOpen] = useState(false);
  // worker the loadout editor should focus
  const [loadoutWorkerId, setLoadoutWorkerId] = useState<string | undefined>(initialWorkerId);
  // skills seeded into the compose flow (from "Save as new set" in loadout)
  const [composeSeed, setComposeSeed] = useState<string[] | undefined>(undefined);

  const loadSkills = useCallback(async () => {
    setLoadingSkills(true);
    setSkills(await fetchSkills());
    setLoadingSkills(false);
  }, []);
  const loadTeam = useCallback(async () => setWorkers(await fetchTeam(workspacePath)), [workspacePath]);
  const loadSets = useCallback(async () => setSavedSets(await fetchSavedSets(workspacePath)), [workspacePath]);
  const loadPresets = useCallback(async () => setRolePresets(await fetchRolePresets(workspacePath)), [workspacePath]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);
  useEffect(() => {
    loadTeam();
    loadSets();
    loadPresets();
  }, [loadTeam, loadSets, loadPresets]);

  useEffect(() => {
    if (initialWorkerId) {
      setLoadoutWorkerId(initialWorkerId);
      setTab('loadout');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialWorkerId]);

  const changed = useCallback(() => onDataChanged?.(), [onDataChanged]);

  // ── cross-screen actions ────────────────────────────────────────────────────
  const openCompose = (seed?: string[]) => {
    setComposeSeed(seed);
    setTab('compose');
  };
  const applySetToWorker = (_set: SavedSet) => {
    // route into the loadout editor; the user picks/confirms the worker + diff there
    setTab('loadout');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
      {/* lightweight tab strip — App may hide this and drive `tab` itself */}
      <SkillsTabStrip tab={tab} setTab={setTab} savedSetCount={savedSets.length} workerCount={workers.length} />

      {tab === 'library' && (
        <SkillsLibrary
          skills={skills}
          savedSets={savedSets}
          workers={workers}
          loading={loadingSkills}
          onNewSkill={() => setImportOpen(true)}
          onComposeSet={() => openCompose()}
          onApplySet={applySetToWorker}
          onEditSet={(set) => openCompose(set.skillIds)}
          onDuplicateSet={(set) => openCompose(set.skillIds)}
        />
      )}

      {tab === 'loadout' && (
        <WorkerLoadout
          workers={workers}
          skills={skills}
          savedSets={savedSets}
          workspacePath={workspacePath}
          initialWorkerId={loadoutWorkerId}
          onSavedSetFromDraft={(ids) => openCompose(ids)}
          onWorkerUpdated={(w) => {
            setWorkers((prev) => prev.map((x) => (x.id === w.id ? w : x)));
            changed();
          }}
        />
      )}

      {tab === 'compose' && (
        <ComposeSet
          skills={skills}
          rolePresets={rolePresets}
          workspacePath={workspacePath}
          initialSkillIds={composeSeed}
          onSaved={async () => {
            await loadSets();
            changed();
            setComposeSeed(undefined);
            setTab('library');
          }}
          onCancel={() => {
            setComposeSeed(undefined);
            setTab('library');
          }}
        />
      )}

      {importOpen && (
        <SkillImport
          workers={workers}
          onClose={() => setImportOpen(false)}
          onSaved={async () => {
            await Promise.all([loadSkills(), loadTeam()]);
            changed();
          }}
        />
      )}
    </div>
  );
}

function SkillsTabStrip({
  tab,
  setTab,
  savedSetCount,
  workerCount,
}: {
  tab: SkillsTab;
  setTab: (t: SkillsTab) => void;
  savedSetCount: number;
  workerCount: number;
}) {
  const tabs: { id: SkillsTab; label: string; badge?: string }[] = [
    { id: 'library', label: 'Library' },
    { id: 'loadout', label: 'Worker loadout', badge: workerCount ? String(workerCount) : undefined },
    { id: 'compose', label: 'Compose set', badge: savedSetCount ? String(savedSetCount) : undefined },
  ];
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: '0 16px',
        borderBottom: '1.5px solid var(--rule)',
        background: 'var(--paper-2)',
        flex: '0 0 auto',
      }}
    >
      {tabs.map((t) => (
        <div
          key={t.id}
          onClick={() => setTab(t.id)}
          style={{
            padding: '9px 14px',
            fontSize: 12,
            fontWeight: tab === t.id ? 700 : 500,
            color: tab === t.id ? 'var(--ink)' : 'var(--ink-3)',
            borderBottom: tab === t.id ? '2px solid var(--ink)' : '2px solid transparent',
            marginBottom: -1.5,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>{t.label}</span>
          {t.badge && (
            <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 99, background: 'var(--paper)', color: 'var(--ink-2)', fontFamily: 'var(--mono)', fontWeight: 700 }}>
              {t.badge}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
