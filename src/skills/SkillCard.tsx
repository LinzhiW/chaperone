// Skills UI — shared skill primitives.
// 1:1 port of the design's SkillCard / LibrarySkillCard / SkillChip / EmptySlot
// (.design/agent-company/project/wf-skills.jsx + wf-skills-data.jsx).
// Colors come from api.colorForSkill — the backend doesn't store them.

import React from 'react';
import type { Skill } from '../canopyTypes';
import { colorForSkill, sourceIcon, sourceLabel } from './api';

function skillColor(skill: Skill): string {
  return skill.color ?? colorForSkill(skill);
}

// ─── SkillCard — reusable in library / slot / loadout / compose ──────────────
export function SkillCard({
  skill,
  equipped,
  draggable = true,
  onRemove,
  compact,
  onDragStart,
  onClick,
}: {
  skill: Skill | null | undefined;
  equipped?: boolean;
  draggable?: boolean;
  onRemove?: () => void;
  compact?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onClick?: () => void;
}) {
  if (!skill) return null;
  const color = skillColor(skill);
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      style={{
        position: 'relative',
        border: `1.5px solid ${equipped ? color : 'var(--rule-soft)'}`,
        borderRadius: 4,
        background: equipped ? color + '12' : 'var(--paper)',
        padding: compact ? '5px 7px' : '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? 2 : 4,
        cursor: draggable ? 'grab' : onClick ? 'pointer' : 'default',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {draggable && <span style={{ color: 'var(--ink-3)', fontSize: 10 }}>⋮⋮</span>}
        <span
          style={{
            fontSize: compact ? 10 : 11.5,
            fontWeight: 600,
            color,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {skill.name}
        </span>
        {onRemove && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            title="remove"
            style={{ fontSize: 11, color: 'var(--ink-3)', cursor: 'pointer' }}
          >
            ×
          </span>
        )}
      </div>
      {!compact && (
        <div
          style={{
            fontSize: 10,
            color: 'var(--ink-3)',
            lineHeight: 1.35,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {skill.description}
        </div>
      )}
      {!compact && (
        <div style={{ display: 'flex', gap: 4, fontSize: 9, color: 'var(--ink-3)', marginTop: 'auto' }}>
          <span style={{ fontFamily: 'var(--mono)' }}>{skill.category}</span>
          <span>·</span>
          <span style={{ fontFamily: 'var(--mono)' }}>{sourceLabel(skill.source)}</span>
        </div>
      )}
    </div>
  );
}

// ─── LibrarySkillCard — bigger card used in the Library grid (screen 11) ─────
export function LibrarySkillCard({
  skill,
  usedByCount,
  onClick,
  onDragStart,
  draggable,
}: {
  skill: Skill;
  usedByCount?: number;
  onClick?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  draggable?: boolean;
}) {
  const color = skillColor(skill);
  return (
    <div
      className="box"
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      style={{
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        background: 'var(--paper)',
        borderColor: color + '80',
        cursor: draggable ? 'grab' : onClick ? 'pointer' : 'default',
        minHeight: 110,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: color }} />
        <strong
          style={{
            fontSize: 12,
            color,
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {skill.name}
        </strong>
        <span style={{ fontSize: 9, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>
          {sourceIcon(skill.source)} {sourceLabel(skill.source)}
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.45, minHeight: 32 }}>
        {skill.description}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 'auto',
          paddingTop: 4,
          borderTop: '1px dashed var(--rule-soft)',
        }}
      >
        <span style={{ fontSize: 9, color: 'var(--ink-3)', fontFamily: 'var(--mono)' }}>{skill.category}</span>
        {usedByCount !== undefined && (
          <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--ink-3)' }}>
            {usedByCount === 0 ? 'unused' : `used by ${usedByCount} worker${usedByCount === 1 ? '' : 's'}`}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── SkillChip — compact equipped chip (loadout, screen 13a) ────────────────
export function SkillChip({
  skill,
  onRemove,
  onDragStart,
}: {
  skill: Skill | null | undefined;
  onRemove?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
}) {
  if (!skill) return null;
  const color = skillColor(skill);
  return (
    <span
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 8px 5px 10px',
        borderRadius: 99,
        background: color + '12',
        border: `1.5px solid ${color}`,
        color,
        fontSize: 11.5,
        fontWeight: 600,
        cursor: onDragStart ? 'grab' : 'default',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 99, background: color }} />
      <span>{skill.name}</span>
      {onRemove && (
        <span
          onClick={onRemove}
          title="unequip"
          style={{ fontSize: 12, color: 'var(--ink-3)', cursor: 'pointer', padding: '0 2px', borderRadius: 99, lineHeight: 1 }}
        >
          ×
        </span>
      )}
    </span>
  );
}

// ─── EmptySlot — dashed placeholder for compose / loadout drops ─────────────
export function EmptySlot({ children }: { children?: React.ReactNode }) {
  return (
    <div
      style={{
        border: '1.5px dashed var(--rule-soft)',
        borderRadius: 4,
        background: 'rgba(31,29,26,0.02)',
        padding: '8px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--ink-3)',
        fontSize: 11,
        fontFamily: 'var(--hand)',
        minHeight: 60,
      }}
    >
      {children || 'drop skill here'}
    </div>
  );
}

// ─── Small shared form primitives (Label / FakeInput parity) ────────────────
export function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 600 }}>{children}</span>;
}

// ─── EmptyBlock — clean empty/loading state, used across every screen ───────
export function EmptyBlock({
  title,
  hint,
  cta,
  onCta,
}: {
  title: string;
  hint: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <div
      className="box-dash"
      style={{
        padding: '40px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        textAlign: 'center',
        color: 'var(--ink-3)',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-2)' }}>{title}</div>
      <div style={{ fontSize: 12, maxWidth: 360, lineHeight: 1.5 }}>{hint}</div>
      {cta && onCta && (
        <button
          className="btn"
          onClick={onCta}
          style={{
            marginTop: 6,
            fontSize: 12,
            padding: '7px 14px',
            borderRadius: 4,
            background: 'var(--approve)',
            color: 'var(--paper)',
            border: '1.5px solid var(--approve)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {cta}
        </button>
      )}
    </div>
  );
}
