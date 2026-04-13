import { useState, type PropsWithChildren, type ReactNode } from "react";

type WidgetFrameProps = PropsWithChildren<{
  eyebrow: string;
  title: string;
  summary: string;
  badge?: ReactNode;
  actions?: ReactNode;
  defaultCollapsed?: boolean;
}>;

export function WidgetFrame({
  eyebrow,
  title,
  summary,
  badge,
  actions,
  defaultCollapsed = false,
  children,
}: WidgetFrameProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <section className="panel panel--context widget-frame">
      <div className="widget-frame__header">
        <div className="widget-frame__title">
          <div>
            <span className="panel__eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <p>{summary}</p>
        </div>

        <div className="widget-frame__actions">
          {badge ? <div className="widget-frame__badge">{badge}</div> : null}
          {actions}
          <button
            type="button"
            className="navigator-mode-toggle widget-frame__toggle"
            onClick={() => setCollapsed((current) => !current)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
            title={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          >
            <span aria-hidden="true">{collapsed ? "⌄" : "⌃"}</span>
          </button>
        </div>
      </div>

      {!collapsed ? <div className="widget-frame__body">{children}</div> : null}
    </section>
  );
}
