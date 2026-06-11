// Skills UI — public surface for App.tsx integration.
//
// Wire <SkillsView/> into App where you render the main pane. It owns its own
// data loading (skills / team / saved-sets / role-presets) and an internal tab
// router across the 4 screens (Library → Import → Loadout → Compose Set).
//
// Minimal wiring:
//   <SkillsView workspacePath={config.projectPath} />
//
// See SkillsView props (SkillsViewProps) for optional hooks (external tab
// control, "open loadout for worker X", notify-on-change).

export { SkillsView } from './SkillsView';
export type { SkillsViewProps, SkillsTab } from './SkillsView';

// Individual screens + primitives, exported in case you want to compose them
// into App's own chrome instead of using the bundled SkillsView.
export { SkillsLibrary } from './SkillsLibrary';
export { SkillImport } from './SkillImport';
export { WorkerLoadout } from './WorkerLoadout';
export { ComposeSet } from './ComposeSet';
export { SkillCard, LibrarySkillCard, SkillChip, EmptySlot, Label } from './SkillCard';

export * as skillsApi from './api';
