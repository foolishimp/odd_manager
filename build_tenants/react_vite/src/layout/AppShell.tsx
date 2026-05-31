import type { PropsWithChildren } from "react";
import type { ThemeMode } from "../lib/types";

type AppShellProps = PropsWithChildren<{
  theme: ThemeMode;
  onToggleTheme: () => void;
  shellTitle: string;
  shellSubtitle: string;
  error: string | null;
}>;

export function AppShell({
  theme,
  onToggleTheme,
  shellTitle,
  shellSubtitle,
  error,
  children,
}: AppShellProps) {
  const themeToggleLabel = theme === "light"
    ? "Switch to dark grey mode"
    : theme === "dark-grey"
      ? "Switch to dark blue mode"
      : "Switch to light mode";

  return (
    <div className="shell shell--sidecar">
      <header className="shell__header">
        <div className="shell__title">
          <div>
            <span className="shell__control-label">Odd Manager</span>
            <h1>{shellTitle}</h1>
            <p>{shellSubtitle}</p>
          </div>
        </div>

        <div className="shell__control-actions">
          <button
            type="button"
            className="secondary shell__icon-button"
            onClick={onToggleTheme}
            title={themeToggleLabel}
            aria-label={themeToggleLabel}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="shell__icon-svg">
              <path
                d="M9 18h6m-5 3h4m-6.5-6.2A6.5 6.5 0 1 1 18.5 10c0 2.1-1 3.5-2.1 4.8-.8.9-1.4 1.7-1.6 2.7h-5.6c-.2-1-.8-1.8-1.6-2.7C6.5 13.5 5.5 12.1 5.5 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {error ? <div className="shell__error">{error}</div> : null}
      </header>

      {children}
    </div>
  );
}
