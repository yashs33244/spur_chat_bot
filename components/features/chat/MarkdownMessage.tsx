import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

type MarkdownMessageProps = {
  content: string;
  className?: string;
};

export function MarkdownMessage({ content, className }: MarkdownMessageProps) {
  return (
    <div className={cn('text-sm leading-relaxed', className)}>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="mb-2 text-base font-bold">{children}</h1>,
        h2: ({ children }) => <h2 className="mb-1.5 text-sm font-semibold">{children}</h2>,
        h3: ({ children }) => <h3 className="mb-1 text-sm font-medium">{children}</h3>,
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>,
        li: ({ children }) => <li className="text-sm">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
        em: ({ children }) => <em className="italic text-neutral-300">{children}</em>,
        code: ({ children, className: codeClass }) => {
          const isBlock = codeClass?.includes('language-');
          return isBlock ? (
            <code className="block rounded-md bg-black/30 px-3 py-2 font-mono text-xs text-neutral-200 overflow-x-auto whitespace-pre">
              {children}
            </code>
          ) : (
            <code className="rounded px-1 py-0.5 bg-black/30 font-mono text-xs text-sky-300">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <pre className="mb-2 overflow-x-auto rounded-md">{children}</pre>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-sky-500/50 pl-3 italic text-neutral-400 mb-2">
            {children}
          </blockquote>
        ),
        table: ({ children }) => (
          <div className="mb-2 overflow-x-auto rounded-md">
            <table className="w-full border-collapse text-xs">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="bg-white/5">{children}</thead>,
        tr: ({ children }) => <tr className="border-b border-white/5">{children}</tr>,
        th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-neutral-300">{children}</th>,
        td: ({ children }) => <td className="px-3 py-2 text-neutral-400">{children}</td>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-sky-400 underline underline-offset-2 hover:text-sky-300">
            {children}
          </a>
        ),
        hr: () => <hr className="my-3 border-white/10" />,
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}
