import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";

type MarkdownDocumentProps = {
  content: string;
};

export function MarkdownDocument({ content }: MarkdownDocumentProps) {
  return (
    <div className="markdown-viewer">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ inline, className, children, ...props }) {
            const language = className?.replace(/^language-/, "") ?? "";
            const source = String(children).replace(/\n$/, "");
            if (!inline && language === "mermaid") {
              return <MermaidDiagram source={source} />;
            }
            if (inline) {
              return (
                <code className="markdown-viewer__inline-code" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <pre className="markdown-viewer__code-block">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          a({ href, children, ...props }) {
            return (
              <a href={href} target="_blank" rel="noreferrer" {...props}>
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function MermaidDiagram({ source }: { source: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const renderId = useMemo(() => `oman-mermaid-${Math.random().toString(36).slice(2)}`, []);

  useEffect(() => {
    let cancelled = false;

    async function renderDiagram() {
      try {
        setError(null);
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: document.documentElement.dataset.theme?.startsWith("dark") ? "dark" : "neutral",
        });
        const { svg, bindFunctions } = await mermaid.render(renderId, source);
        if (cancelled || !hostRef.current) {
          return;
        }
        hostRef.current.innerHTML = svg;
        bindFunctions?.(hostRef.current);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      }
    }

    void renderDiagram();

    return () => {
      cancelled = true;
      if (hostRef.current) {
        hostRef.current.innerHTML = "";
      }
    };
  }, [renderId, source]);

  if (error) {
    return (
      <div className="markdown-viewer__mermaid-error">
        <strong>Mermaid render failed</strong>
        <pre className="markdown-viewer__code-block">{source}</pre>
      </div>
    );
  }

  return <div ref={hostRef} className="markdown-viewer__mermaid" />;
}
