import { memo, type PointerEvent, type WheelEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";
import { createBundledHighlighter, createSingletonShorthands } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

export type DocumentViewerFormat = "markdown" | "code" | "text";
export type DocumentViewerFitMode = "none" | "width";

export interface DocumentViewerState {
  zoom: number;
  fit: DocumentViewerFitMode;
}

export interface DocumentDescriptor {
  id: string;
  relativePath: string;
  displayName: string;
  format: DocumentViewerFormat;
  language: string | null;
}

export const DOCUMENT_VIEWER_DEFAULT_STATE: DocumentViewerState = {
  zoom: 1,
  fit: "none",
};

const DOCUMENT_ZOOM_MIN = 0.5;
const DOCUMENT_ZOOM_MAX = 2.5;
const CODE_LANGUAGE_BY_EXTENSION: Record<string, string> = {
  ".py": "python",
  ".ts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "jsx",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".java": "java",
  ".scala": "scala",
  ".rs": "rust",
  ".md": "markdown",
  ".mjs": "javascript",
  ".cjs": "javascript",
};

const CODE_FENCE_LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  py: "python",
  yml: "yaml",
  rs: "rust",
};

const createFocusedHighlighter = createBundledHighlighter({
  langs: {
    python: () => import("@shikijs/langs/python"),
    typescript: () => import("@shikijs/langs/typescript"),
    tsx: () => import("@shikijs/langs/tsx"),
    javascript: () => import("@shikijs/langs/javascript"),
    jsx: () => import("@shikijs/langs/jsx"),
    json: () => import("@shikijs/langs/json"),
    yaml: () => import("@shikijs/langs/yaml"),
    java: () => import("@shikijs/langs/java"),
    scala: () => import("@shikijs/langs/scala"),
    rust: () => import("@shikijs/langs/rust"),
    markdown: () => import("@shikijs/langs/markdown"),
  },
  themes: {
    "github-light": () => import("@shikijs/themes/github-light"),
    "github-dark": () => import("@shikijs/themes/github-dark"),
  },
  engine: () => createJavaScriptRegexEngine(),
});

const focusedHighlighter = createSingletonShorthands(createFocusedHighlighter);

export function documentDescriptorForPath(relativePath: string): DocumentDescriptor {
  const displayName = relativePath.split("/").pop() || relativePath;
  const extension = extensionForPath(relativePath);
  const language = CODE_LANGUAGE_BY_EXTENSION[extension] ?? null;
  const format = extension === ".md" || extension === ".markdown"
    ? "markdown"
    : language
      ? "code"
      : "text";
  return {
    id: `surface:${relativePath}`,
    relativePath,
    displayName,
    format,
    language: format === "code" ? language : null,
  };
}

export function DocumentViewer({
  descriptor,
  content,
  state = DOCUMENT_VIEWER_DEFAULT_STATE,
  onZoomIn,
  onZoomOut,
  onReset,
  onFitWidth,
}: {
  descriptor: DocumentDescriptor;
  content: string;
  state?: DocumentViewerState;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onReset?: () => void;
  onFitWidth?: () => void;
}) {
  const zoom = Math.min(DOCUMENT_ZOOM_MAX, Math.max(DOCUMENT_ZOOM_MIN, state.zoom));
  const hasControls = Boolean(onZoomIn || onZoomOut || onReset || onFitWidth);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const zoomAnchorRef = useRef<{ x: number; y: number; centerX: number; centerY: number } | null>(null);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const updateZoomLayout = () => {
      const layoutWidth = `${Math.max(1, viewport.clientWidth / zoom)}px`;
      if (content.style.getPropertyValue("--document-viewer-layout-width") !== layoutWidth) {
        content.style.setProperty("--document-viewer-layout-width", layoutWidth);
      }
      const marginRight = `${content.offsetWidth * (zoom - 1)}px`;
      const marginBottom = `${content.offsetHeight * (zoom - 1)}px`;
      if (content.style.marginRight !== marginRight) content.style.marginRight = marginRight;
      if (content.style.marginBottom !== marginBottom) content.style.marginBottom = marginBottom;
    };
    updateZoomLayout();
    const observer = new ResizeObserver(updateZoomLayout);
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [descriptor.id, content, zoom]);

  useLayoutEffect(() => {
    const anchor = zoomAnchorRef.current;
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!anchor || !viewport || !content) return;
    const contentRect = content.getBoundingClientRect();
    const targetX = contentRect.left + anchor.x * zoom;
    const targetY = contentRect.top + anchor.y * zoom;
    const deltaX = targetX - anchor.centerX;
    const deltaY = targetY - anchor.centerY;
    const scrollParent = nearestScrollableParent(viewport);
    const xScroller = canScrollAxis(viewport, "x") ? viewport : scrollParent;
    const yScroller = scrollParent ?? (canScrollAxis(viewport, "y") ? viewport : null);
    if (xScroller) xScroller.scrollLeft += deltaX;
    if (yScroller) yScroller.scrollTop += deltaY;
    zoomAnchorRef.current = null;
  }, [zoom]);

  function preserveViewportCenterForZoom() {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const scrollParent = nearestScrollableParent(viewport);
    const observationRect = (scrollParent ?? viewport).getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const centerX = observationRect.left + observationRect.width / 2;
    const centerY = observationRect.top + observationRect.height / 2;
    zoomAnchorRef.current = {
      x: (centerX - contentRect.left) / zoom,
      y: (centerY - contentRect.top) / zoom,
      centerX,
      centerY,
    };
  }

  function requestZoomIn() {
    preserveViewportCenterForZoom();
    onZoomIn?.();
  }

  function requestZoomOut() {
    preserveViewportCenterForZoom();
    onZoomOut?.();
  }

  function beginPan(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !viewportRef.current) return;
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: viewportRef.current.scrollLeft,
      scrollTop: viewportRef.current.scrollTop,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePan(event: PointerEvent<HTMLDivElement>) {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId || !viewportRef.current) return;
    viewportRef.current.scrollLeft = pan.scrollLeft - (event.clientX - pan.startX);
    viewportRef.current.scrollTop = pan.scrollTop - (event.clientY - pan.startY);
  }

  function endPan(event: PointerEvent<HTMLDivElement>) {
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const canScrollY = viewport.scrollHeight > viewport.clientHeight;
    if (canScrollY) return;
    const scrollParent = nearestScrollableParent(viewport);
    if (!scrollParent) return;
    event.preventDefault();
    scrollParent.scrollBy({ left: event.deltaX, top: event.deltaY });
  }

  return (
    <section className="document-viewer" aria-label={`Document viewer ${descriptor.displayName}`}>
      {hasControls ? (
        <div className="document-viewer__toolbar" aria-label="Document toolbar">
          <div className="document-viewer__path" title={descriptor.relativePath}>
            {descriptor.relativePath}
          </div>
          <div className="document-viewer__toolbar-controls" aria-label="Document zoom controls">
            <button type="button" className="navigator-mode-toggle document-viewer__control" onClick={requestZoomOut} disabled={zoom <= DOCUMENT_ZOOM_MIN} aria-label="Zoom out document">
              <span aria-hidden="true">-</span>
            </button>
            <span className="document-viewer__zoom">{Math.round(zoom * 100)}%</span>
            <button type="button" className="navigator-mode-toggle document-viewer__control" onClick={requestZoomIn} disabled={zoom >= DOCUMENT_ZOOM_MAX} aria-label="Zoom in document">
              <span aria-hidden="true">+</span>
            </button>
            <button type="button" className="navigator-mode-toggle document-viewer__control" onClick={onFitWidth} aria-pressed={state.fit === "width"} aria-label="Fit document to width">
              <span aria-hidden="true">Fit</span>
            </button>
            <button type="button" className="navigator-mode-toggle document-viewer__control" onClick={onReset} aria-label="Reset document zoom">
              <span aria-hidden="true">1:1</span>
            </button>
          </div>
        </div>
      ) : null}
      <div
        ref={viewportRef}
        className={`document-viewer__viewport${state.fit === "width" ? " is-fit-width" : ""}`}
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onWheel={handleWheel}
      >
        <div
          ref={contentRef}
          className="document-viewer__content"
          style={{ transform: `scale(${zoom})` }}
        >
          {descriptor.format === "markdown" ? (
            <MarkdownDocumentContent descriptorId={descriptor.id} content={content} />
          ) : descriptor.format === "code" ? (
            <CodeBlock source={content} language={descriptor.language ?? "text"} />
          ) : (
            <pre className="markdown-viewer__code-block">{content}</pre>
          )}
        </div>
      </div>
    </section>
  );
}

function nearestScrollableParent(element: HTMLElement) {
  let current = element.parentElement;
  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    const canScrollY = /(auto|scroll)/.test(overflowY) && current.scrollHeight > current.clientHeight;
    if (canScrollY) return current;
    current = current.parentElement;
  }
  return null;
}

function canScrollAxis(element: HTMLElement, axis: "x" | "y") {
  return axis === "x"
    ? element.scrollWidth > element.clientWidth
    : element.scrollHeight > element.clientHeight;
}

export const MarkdownDocumentContent = memo(function MarkdownDocumentContent({ descriptorId, content }: { descriptorId: string; content: string }) {
  let codeBlockIndex = 0;
  return (
    <div className="markdown-viewer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }) {
            const language = normalizeCodeLanguage(className?.replace(/^language-/, "") ?? "");
            const source = String(children).replace(/\n$/, "");
            if (!inline && language === "mermaid") {
              const blockIndex = codeBlockIndex;
              codeBlockIndex += 1;
              return <MermaidDiagram descriptorId={descriptorId} blockIndex={blockIndex} source={source} />;
            }
            if (inline) {
              return (
                <code className="markdown-viewer__inline-code" {...props}>
                  {children}
                </code>
              );
            }
            const blockIndex = codeBlockIndex;
            codeBlockIndex += 1;
            return <CodeBlock source={source} language={language || "text"} blockKey={`${descriptorId}:${blockIndex}`} />;
          },
          a({ href, children, ...props }) {
            return (
              <a href={href} target="_blank" rel="noreferrer" {...props}>
                {children}
              </a>
            );
          },
          table({ children, ...props }) {
            return (
              <div className="markdown-viewer__table-wrap">
                <table {...props}>{children}</table>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

function CodeBlock({ source, language, blockKey }: { source: string; language: string; blockKey?: string }) {
  const normalizedLanguage = normalizeCodeLanguage(language);
  const appTheme = useDocumentTheme();
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function highlight() {
      setFailed(false);
      setHtml(null);
      if (!normalizedLanguage || normalizedLanguage === "text" || normalizedLanguage === "mermaid") {
        setFailed(true);
        return;
      }
      try {
        const rendered = await focusedHighlighter.codeToHtml(source, {
          lang: normalizedLanguage as never,
          theme: appTheme === "light" ? "github-light" : "github-dark",
        });
        if (!cancelled) setHtml(rendered);
      } catch {
        if (!cancelled) setFailed(true);
      }
    }
    void highlight();
    return () => {
      cancelled = true;
    };
  }, [appTheme, blockKey, normalizedLanguage, source]);

  if (html && !failed) {
    return <div className="document-viewer__highlight" dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return (
    <pre className="markdown-viewer__code-block">
      <code className={normalizedLanguage ? `language-${normalizedLanguage}` : undefined}>{source}</code>
    </pre>
  );
}

function useDocumentTheme() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme ?? "dark-blue");

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.dataset.theme ?? "dark-blue");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

function MermaidDiagram({ descriptorId, blockIndex, source }: { descriptorId: string; blockIndex: number; source: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const renderId = useMemo(() => `oman-mermaid-${stableHash(`${descriptorId}:${blockIndex}:${source}`)}`, [blockIndex, descriptorId, source]);

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      try {
        setError(null);
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: document.documentElement.dataset.theme?.startsWith("dark") ? "dark" : "neutral",
          flowchart: { htmlLabels: false },
        });
        const { svg } = await mermaid.render(renderId, source);
        if (cancelled || !hostRef.current) return;
        hostRef.current.innerHTML = svg;
        normalizeMermaidSvg(hostRef.current);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      }
    }

    void renderDiagram();

    return () => {
      cancelled = true;
      if (hostRef.current) hostRef.current.innerHTML = "";
    };
  }, [renderId, source]);

  if (error) {
    return (
      <div className="markdown-viewer__mermaid-error">
        <strong>Mermaid render failed</strong>
        <small>{error}</small>
        <pre className="markdown-viewer__code-block">{source}</pre>
      </div>
    );
  }

  return <div ref={hostRef} className="markdown-viewer__mermaid" data-render-id={renderId} />;
}

function normalizeMermaidSvg(host: HTMLDivElement) {
  const svg = host.querySelector("svg");
  if (!(svg instanceof SVGSVGElement)) return;
  const viewBoxWidth = svg.viewBox.baseVal.width;
  if (Number.isFinite(viewBoxWidth) && viewBoxWidth > 0) {
    svg.style.width = `${viewBoxWidth}px`;
  }
}

function extensionForPath(path: string) {
  const match = path.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function normalizeCodeLanguage(language: string) {
  const normalized = language.trim().toLowerCase();
  return CODE_FENCE_LANGUAGE_ALIASES[normalized] ?? normalized;
}

function stableHash(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}
