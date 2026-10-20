"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Shows Markdown (task details). Raw HTML is never rendered and unsafe links are dropped
 * (react-markdown's defaults); links open in a new tab. GitHub-style extras work too:
 * checklists (- [ ] / - [x]), tables, ~~strikethrough~~ and bare links.
 */
export function Markdown({ children, className = "" }: { children: string; className?: string }) {
  return (
    <div className={`text-sm leading-relaxed text-(--color-text-primary) space-y-2 break-words ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h3 className="text-base font-bold mt-3 first:mt-0">{children}</h3>,
          h2: ({ children }) => <h4 className="text-sm font-bold mt-3 first:mt-0">{children}</h4>,
          h3: ({ children }) => <h5 className="text-sm font-semibold mt-2 first:mt-0">{children}</h5>,
          p: ({ children }) => <p>{children}</p>,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-(--color-secondary) underline underline-offset-2 break-all">{children}</a>
          ),
          ul: ({ children, className }) => (
            <ul className={className?.includes("contains-task-list") ? "space-y-1" : "list-disc pl-5 space-y-1"}>{children}</ul>
          ),
          ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
          li: ({ children, className }) => (
            <li className={className?.includes("task-list-item") ? "flex items-start gap-2 list-none" : undefined}>{children}</li>
          ),
          input: ({ checked }) => (
            <input type="checkbox" checked={!!checked} readOnly disabled className="mt-0.5 h-4 w-4 shrink-0 accent-(--color-primary)" />
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-(--color-border-strong) pl-3 text-(--color-text-secondary)">{children}</blockquote>
          ),
          code: ({ children, className }) => className
            ? <code className="block whitespace-pre overflow-x-auto rounded-md bg-(--color-surface-overlay) p-3 font-mono text-xs">{children}</code>
            : <code className="rounded bg-(--color-surface-overlay) px-1 py-0.5 font-mono text-xs">{children}</code>,
          pre: ({ children }) => <pre className="whitespace-pre-wrap">{children}</pre>,
          table: ({ children }) => <div className="overflow-x-auto"><table className="text-left text-xs border-collapse">{children}</table></div>,
          th: ({ children }) => <th className="border border-(--color-border) px-2 py-1 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-(--color-border) px-2 py-1">{children}</td>,
          hr: () => <hr className="border-(--color-border)" />,
          img: ({ alt }) => <span className="text-(--color-text-secondary)">[image: {alt}]</span>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
