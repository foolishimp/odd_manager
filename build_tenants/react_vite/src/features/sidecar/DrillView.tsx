// DrillView — SHARED master-detail layout primitive (sprint W8), not a ticket
// widget. It renders horizontal lanes of cards (one horizontally scrollable
// row per lane, lanes stacked) with a detail pane below filling the remaining
// height. The Ticket Board is instantiation #1; the same primitive is
// intended to later drill into overlays, graph functions, and graph types
// from admitted run projections — keep the API generic (ids, labels, badges,
// tones) and keep all domain meaning in the instantiating feature.
//
// Governance (UX_METHOD):
//   - View = f(State): this component is pure over its props. Selection is
//     product state and lives in the owning reducer (§5); DrillView only
//     reports intent through onSelect.
//   - Keyboard parity (§11): cards are real <button> elements (tab/enter
//     operable); ArrowLeft/ArrowRight move focus between cards inside a lane.
//   - Honest empty state: when no lane carries any card, the caller-supplied
//     emptyMessage renders instead of an empty husk.
//
// Styling: generic `sidecar-drill-*` classes in src/app/styles.css.
// Instantiations may add a modifier class through `className`
// (e.g. `sidecar-ticket-board`).

import type { KeyboardEvent, ReactNode } from 'react';

export type DrillTone = 'ok' | 'warn' | 'fail' | 'neutral';

export interface DrillBadge {
  label: string;
  // Class-suffix discriminator (sanitized before use), e.g. 'type' or
  // 'status-active'. Purely presentational; carries no domain semantics here.
  kind: string;
}

export interface DrillCard {
  id: string;
  title: string;
  subtitle?: string;
  badges?: DrillBadge[];
  tone?: DrillTone;
}

export interface DrillLane {
  id: string;
  label: string;
  items: DrillCard[];
}

export interface DrillViewProps {
  lanes: DrillLane[];
  // Reducer-owned selection (product state). null = nothing drilled into.
  selectedId: string | null;
  onSelect: (id: string) => void;
  renderDetail: (id: string) => ReactNode;
  // Rendered when every lane is empty (honest empty state).
  emptyMessage: ReactNode;
  // Rendered in the detail pane while nothing is selected.
  detailPlaceholder?: ReactNode;
  // Accessible name for the whole drill region.
  label?: string;
  // Extra class for the instantiation (e.g. 'sidecar-ticket-board').
  className?: string;
}

function drillClassSuffix(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
}

// Optional keyboard affordance beyond tab/enter parity: arrows walk the
// focused lane. Pure DOM focus movement — no product state involved.
function handleLaneStripKeyDown(event: KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  const cards = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('.sidecar-drill__card'));
  const activeIndex = cards.findIndex((card) => card === document.activeElement);
  if (activeIndex === -1) return;
  const nextIndex = event.key === 'ArrowRight' ? activeIndex + 1 : activeIndex - 1;
  if (nextIndex < 0 || nextIndex >= cards.length) return;
  event.preventDefault();
  cards[nextIndex].focus();
}

export function DrillView({
  lanes,
  selectedId,
  onSelect,
  renderDetail,
  emptyMessage,
  detailPlaceholder,
  label,
  className,
}: DrillViewProps) {
  const rootClassName = `sidecar-drill${className ? ` ${className}` : ''}`;
  const hasAnyCard = lanes.some((lane) => lane.items.length > 0);
  if (!hasAnyCard) {
    return (
      <div className={rootClassName} role="region" aria-label={label ?? 'Drill view'}>
        <div className="sidecar-inspector__empty sidecar-drill__empty">{emptyMessage}</div>
      </div>
    );
  }
  return (
    <div className={rootClassName} role="region" aria-label={label ?? 'Drill view'}>
      <div className="sidecar-drill__lanes">
        {lanes.map((lane) => (
          <section key={lane.id} className="sidecar-drill__lane" aria-label={`${lane.label} lane`}>
            <div className="sidecar-drill__lane-label">
              <span className="sidecar-drill__lane-name">{lane.label}</span>
              <span className="sidecar-drill__lane-count">({lane.items.length})</span>
            </div>
            {lane.items.length === 0 ? (
              <div className="sidecar-drill__lane-empty">No entries in this lane.</div>
            ) : (
              <div className="sidecar-drill__lane-strip" onKeyDown={handleLaneStripKeyDown}>
                {lane.items.map((card) => {
                  const selected = card.id === selectedId;
                  const tone = card.tone ?? 'neutral';
                  return (
                    <button
                      key={card.id}
                      type="button"
                      className={`sidecar-drill__card sidecar-drill__card--${tone}${selected ? ' is-selected' : ''}`}
                      aria-pressed={selected}
                      onClick={() => onSelect(card.id)}
                    >
                      {card.subtitle && <span className="sidecar-drill__card-subtitle">{card.subtitle}</span>}
                      <span className="sidecar-drill__card-title">{card.title}</span>
                      {card.badges && card.badges.length > 0 && (
                        <span className="sidecar-drill__card-badges">
                          {card.badges.map((badge) => (
                            <span
                              key={`${badge.kind}:${badge.label}`}
                              className={`summary-pill sidecar-drill__badge sidecar-drill__badge--${drillClassSuffix(badge.kind)}`}
                            >
                              {badge.label}
                            </span>
                          ))}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>
      <div className="sidecar-drill__detail" aria-label={label ? `${label} detail` : 'Drill detail'}>
        {selectedId !== null
          ? renderDetail(selectedId)
          : <div className="sidecar-inspector__empty sidecar-drill__detail-placeholder">{detailPlaceholder ?? 'Select a card to inspect it.'}</div>}
      </div>
    </div>
  );
}
