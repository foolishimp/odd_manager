import { memo, type WheelEvent as ReactWheelEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";
import { createBundledHighlighter, createSingletonShorthands } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

export type DocumentViewerFormat = "markdown" | "code" | "html" | "pdf" | "text";
export type DocumentViewerFitMode = "none" | "width";
export type DocumentViewerScrollMode = "internal" | "outer";

export interface DocumentViewerState {
  zoom: number;
  fit: DocumentViewerFitMode;
}

export interface DocumentDescriptor {
  id: string;
  relativePath: string;
  displayName: string;
  mediaType: string;
  format: DocumentViewerFormat;
  language: string | null;
}

export const DOCUMENT_VIEWER_DEFAULT_STATE: DocumentViewerState = {
  zoom: 1,
  fit: "none",
};

const DOCUMENT_ZOOM_MIN = 0.5;
const DOCUMENT_ZOOM_MAX = 2.5;
const DOCUMENT_PINCH_ZOOM_SENSITIVITY = 0.002;
const DOCUMENT_PINCH_ZOOM_MAX_STEP = 0.22;
const CODE_LANGUAGE_BY_EXTENSION: Record<string, string> = {
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
  yml: "yaml",
  rs: "rust",
};

const createFocusedHighlighter = createBundledHighlighter({
  langs: {
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
  let format: DocumentViewerFormat = "text";
  if (extension === ".md" || extension === ".markdown") {
    format = "markdown";
  } else if (extension === ".html" || extension === ".htm") {
    format = "html";
  } else if (extension === ".pdf") {
    format = "pdf";
  } else if (language) {
    format = "code";
  }
  return {
    id: `surface:${relativePath}`,
    relativePath,
    displayName,
    mediaType: mediaTypeForDocumentFormat(format, extension),
    format,
    language: format === "code" ? language : null,
  };
}

export function DocumentViewer({
  descriptor,
  content,
  sourceUrl,
  state = DOCUMENT_VIEWER_DEFAULT_STATE,
  scrollMode = "internal",
  followAppends = false,
  onZoomIn,
  onZoomOut,
  onZoomBy,
  onReset,
  onFitWidth,
}: {
  descriptor: DocumentDescriptor;
  content: string;
  sourceUrl?: string;
  state?: DocumentViewerState;
  scrollMode?: DocumentViewerScrollMode;
  followAppends?: boolean;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomBy?: (delta: number) => void;
  onReset?: () => void;
  onFitWidth?: () => void;
}) {
  const zoom = Math.min(DOCUMENT_ZOOM_MAX, Math.max(DOCUMENT_ZOOM_MIN, state.zoom));
  const hasControls = Boolean(onZoomIn || onZoomOut || onReset || onFitWidth);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const zoomAnchorRef = useRef<{ x: number; y: number; centerX: number; centerY: number } | null>(null);
  const embedded = descriptor.format === "html" || descriptor.format === "pdf";
  const viewerClassName = `document-viewer${scrollMode === "outer" ? " document-viewer--outer-scroll" : ""}`;

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

  useLayoutEffect(() => {
    if (!followAppends) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    const scrollParent = nearestScrollableParent(viewport);
    const yScroller = scrollParent ?? (canScrollAxis(viewport, "y") ? viewport : null);
    if (!yScroller) return;
    yScroller.scrollTop = yScroller.scrollHeight;
  }, [descriptor.id, content, followAppends, zoom]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !onZoomBy || descriptor.format === "pdf") return;
    const handleNativeWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (handlePinchZoom(event.deltaY, event.clientX, event.clientY, () => event.preventDefault())) {
        event.stopPropagation();
      }
    };
    viewport.addEventListener("wheel", handleNativeWheel, { passive: false, capture: true });
    return () => viewport.removeEventListener("wheel", handleNativeWheel, { capture: true });
  }, [descriptor.format, onZoomBy, zoom]);

  function preserveViewportPointForZoom(clientX?: number, clientY?: number) {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const scrollParent = nearestScrollableParent(viewport);
    const observationRect = (scrollParent ?? viewport).getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const centerX = Number.isFinite(clientX) ? clamp(clientX ?? 0, observationRect.left, observationRect.right) : observationRect.left + observationRect.width / 2;
    const centerY = Number.isFinite(clientY) ? clamp(clientY ?? 0, observationRect.top, observationRect.bottom) : observationRect.top + observationRect.height / 2;
    zoomAnchorRef.current = {
      x: (centerX - contentRect.left) / zoom,
      y: (centerY - contentRect.top) / zoom,
      centerX,
      centerY,
    };
  }

  function requestZoomIn() {
    preserveViewportPointForZoom();
    onZoomIn?.();
  }

  function requestZoomOut() {
    preserveViewportPointForZoom();
    onZoomOut?.();
  }

  function handlePinchZoom(deltaY: number, clientX: number, clientY: number, preventDefault: () => void) {
    if (!onZoomBy || descriptor.format === "pdf") return false;
    const delta = clamp(-deltaY * DOCUMENT_PINCH_ZOOM_SENSITIVITY, -DOCUMENT_PINCH_ZOOM_MAX_STEP, DOCUMENT_PINCH_ZOOM_MAX_STEP);
    if (Math.abs(delta) < 0.001) return false;
    preventDefault();
    preserveViewportPointForZoom(clientX, clientY);
    onZoomBy(delta);
    return true;
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
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
    <section className={viewerClassName} aria-label={`Document viewer ${descriptor.displayName}`}>
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
        onWheel={handleWheel}
      >
        <div
          ref={contentRef}
          className={`document-viewer__content${embedded ? " document-viewer__content--embedded" : ""}`}
          style={{ transform: `scale(${zoom})` }}
        >
          {descriptor.format === "markdown" ? (
            <MarkdownDocumentContent descriptorId={descriptor.id} content={content} />
          ) : descriptor.format === "html" ? (
            <HtmlDocumentContent
              descriptor={descriptor}
              content={content}
              onPinchZoom={(event, frame) => {
                const frameRect = frame.getBoundingClientRect();
                return handlePinchZoom(
                  event.deltaY,
                  frameRect.left + event.clientX,
                  frameRect.top + event.clientY,
                  () => event.preventDefault(),
                );
              }}
            />
          ) : descriptor.format === "pdf" ? (
            <PdfDocumentContent descriptor={descriptor} sourceUrl={sourceUrl} />
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
  const style = window.getComputedStyle(element);
  const overflow = axis === "x" ? style.overflowX : style.overflowY;
  if (!/(auto|scroll)/.test(overflow)) return false;
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

function HtmlDocumentContent({
  descriptor,
  content,
  onPinchZoom,
}: {
  descriptor: DocumentDescriptor;
  content: string;
  onPinchZoom?: (event: WheelEvent, frame: HTMLIFrameElement) => boolean;
}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !onPinchZoom) return;
    let cleanupFrameWheel: (() => void) | null = null;

    const bindFrameWheel = () => {
      cleanupFrameWheel?.();
      cleanupFrameWheel = null;
      const frameWindow = frame.contentWindow;
      if (!frameWindow) return;
      const handleFrameWheel = (event: WheelEvent) => {
        if ((event.ctrlKey || event.metaKey) && onPinchZoom(event, frame)) {
          event.stopPropagation();
        }
      };
      frameWindow.addEventListener("wheel", handleFrameWheel, { passive: false, capture: true });
      cleanupFrameWheel = () => frameWindow.removeEventListener("wheel", handleFrameWheel, { capture: true });
    };

    frame.addEventListener("load", bindFrameWheel);
    bindFrameWheel();

    return () => {
      frame.removeEventListener("load", bindFrameWheel);
      cleanupFrameWheel?.();
    };
  }, [content, onPinchZoom]);

  return (
    <iframe
      ref={frameRef}
      className="document-viewer__embed-frame document-viewer__html-frame"
      title={`HTML document ${descriptor.displayName}`}
      sandbox="allow-same-origin"
      referrerPolicy="no-referrer"
      srcDoc={content}
    />
  );
}

function PdfDocumentContent({ descriptor, sourceUrl }: { descriptor: DocumentDescriptor; sourceUrl?: string }) {
  if (!sourceUrl) {
    return (
      <div className="document-viewer__embed-fallback">
        PDF preview requires a raw surface URL for {descriptor.relativePath}.
      </div>
    );
  }
  return (
    <iframe
      className="document-viewer__embed-frame document-viewer__pdf-frame"
      title={`PDF document ${descriptor.displayName}`}
      src={sourceUrl}
    />
  );
}

function CodeBlock({ source, language, blockKey }: { source: string; language: string; blockKey?: string }) {
  const normalizedLanguage = normalizeCodeLanguage(language);
  const compact = isCompactMarkdownCodeBlock(source, normalizedLanguage);
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
    return <div className={`document-viewer__highlight${compact ? " is-compact" : ""}`} dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return (
    <pre className={`markdown-viewer__code-block${compact ? " is-compact" : ""}`}>
      <code className={normalizedLanguage ? `language-${normalizedLanguage}` : undefined}>{source}</code>
    </pre>
  );
}

function isCompactMarkdownCodeBlock(source: string, language: string | null) {
  if (language && language !== "text") return false;
  const trimmed = source.trim();
  if (!trimmed || trimmed.includes("\n")) return false;
  return trimmed.length <= 96;
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

function mediaTypeForDocumentFormat(format: DocumentViewerFormat, extension: string) {
  if (format === "html") return "text/html";
  if (format === "pdf") return "application/pdf";
  if (format === "markdown") return "text/markdown";
  if (extension === ".json") return "application/json";
  if (extension === ".yaml" || extension === ".yml") return "application/yaml";
  return "text/plain";
}

function normalizeCodeLanguage(language: string) {
  const normalized = language.trim().toLowerCase();
  return CODE_FENCE_LANGUAGE_ALIASES[normalized] ?? normalized;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function stableHash(value: string) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}
