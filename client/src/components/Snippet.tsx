import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, Pin } from 'lucide-react';
import { useStore } from '../store';
import type { Snippet } from '../types';
import { copyText, fromNow, highlightLanguage, languageHue } from '../utils';
import { useToast } from './Toast';

export const LanguageBadge = ({ language }: { language: string }) => (
  <span className='lang-badge' style={{ '--hue': languageHue(language) } as React.CSSProperties}>
    <span className='dot' />
    {language}
  </span>
);

interface CopyProps {
  text: string;
  label?: string;
  className?: string;
  toastText?: string;
}

export const CopyButton = ({ text, label = 'Copy', className = 'btn btn-ghost btn-sm', toastText }: CopyProps) => {
  const [done, setDone] = useState(false);
  const toast = useToast();

  const onClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await copyText(text);
      setDone(true);
      if (toastText) toast(toastText);
      setTimeout(() => setDone(false), 1500);
    } catch {
      toast('Clipboard not available', 'error');
    }
  };

  return (
    <button type='button' className={className} onClick={onClick} title={label}>
      {done ? <Check size={15} /> : <Copy size={15} />}
      <span>{done ? 'Copied' : label}</span>
    </button>
  );
};

export const PinButton = ({ snippet }: { snippet: Snippet }) => {
  const { togglePin } = useStore();

  return (
    <button
      type='button'
      className={`icon-btn ${snippet.isPinned ? 'pinned' : ''}`}
      aria-pressed={snippet.isPinned}
      title={snippet.isPinned ? 'Unpin' : 'Pin to home'}
      onClick={e => {
        e.preventDefault();
        e.stopPropagation();
        togglePin(snippet);
      }}
    >
      <Pin size={16} fill={snippet.isPinned ? 'currentColor' : 'none'} />
    </button>
  );
};

export const SnippetCard = ({ snippet }: { snippet: Snippet }) => {
  const preview = snippet.code.split('\n').slice(0, 6).join('\n');

  return (
    <Link to={`/snippet/${snippet.id}`} className='card snippet-card'>
      <div className='snippet-card-head'>
        <LanguageBadge language={snippet.language} />
        <PinButton snippet={snippet} />
      </div>
      <h3 className='snippet-card-title'>{snippet.title}</h3>
      {snippet.description && <p className='muted clamp-2'>{snippet.description}</p>}
      <pre className='code-preview'>
        <code>{preview}</code>
      </pre>
      <div className='snippet-card-foot'>
        <span className='muted small'>Updated {fromNow(snippet.updatedAt)}</span>
        <CopyButton text={snippet.code} toastText='Code copied' />
      </div>
    </Link>
  );
};

export const SnippetGrid = ({ snippets }: { snippets: Snippet[] }) => (
  <div className='grid'>
    {snippets.map(s => (
      <SnippetCard key={s.id} snippet={s} />
    ))}
  </div>
);

/**
 * highlight.js is loaded lazily (it is the biggest dependency) and applied to
 * a text node React rendered itself - no dangerouslySetInnerHTML involved.
 */
export const CodeBlock = ({ code, language }: { code: string; language: string }) => {
  const ref = useRef<HTMLElement>(null);
  const lang = highlightLanguage(language);
  const lines = code.split('\n').length;

  useEffect(() => {
    let cancelled = false;
    const el = ref.current;
    if (!el) return;

    el.textContent = code;
    delete el.dataset.highlighted;

    import('highlight.js').then(({ default: hljs }) => {
      if (!cancelled) hljs.highlightElement(el);
    });

    return () => {
      cancelled = true;
    };
  }, [code, lang]);

  return (
    <div className='code-block'>
      <div className='line-numbers' aria-hidden>
        {Array.from({ length: lines }, (_, i) => (
          <span key={i}>{i + 1}</span>
        ))}
      </div>
      <pre>
        <code ref={ref} className={`language-${lang}`} />
      </pre>
    </div>
  );
};

/**
 * Raw HTML in markdown is NOT rendered (skipHtml, no rehype-raw) and
 * react-markdown's default urlTransform drops javascript:/data: links.
 */
export const Markdown = ({ children }: { children: string }) => (
  <div className='markdown'>
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      components={{
        a: ({ node, ...props }) => <a {...props} target='_blank' rel='noopener noreferrer' />
      }}
    >
      {children}
    </ReactMarkdown>
  </div>
);
