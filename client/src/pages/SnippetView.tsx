import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { api } from '../api';
import { useStore } from '../store';
import type { Snippet } from '../types';
import { formatDate, fromNow, searchValue } from '../utils';
import { CodeBlock, CopyButton, LanguageBadge, Markdown, PinButton } from '../components/Snippet';
import { ConfirmDialog, EmptyState } from '../components/UI';
import { useToast } from '../components/Toast';

export const SnippetView = () => {
  const id = Number(useParams().id);
  const { snippets, remove } = useStore();
  const [snippet, setSnippet] = useState<Snippet | null>(null);
  const [error, setError] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  // Prefer the store copy (stays in sync with pin toggles), fall back to fetching
  const cached = snippets.find(s => s.id === id);

  useEffect(() => {
    if (cached) return;
    api.get(id).then(setSnippet).catch(() => setError(true));
  }, [id, cached]);

  const current = cached || snippet;

  if (error) return <EmptyState title='Snippet not found' text='It may have been deleted.' action={false} />;
  if (!current) return <div className='skeleton' />;

  const onDelete = async () => {
    try {
      await remove(current.id);
      navigate('/snippets');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <article className='snippet-view'>
      <Link to='/snippets' className='back'>
        <ArrowLeft size={16} /> Library
      </Link>

      <header className='snippet-header'>
        <div>
          <div className='row'>
            <LanguageBadge language={current.language} />
            <span className='muted small' title={formatDate(current.updatedAt)}>
              Updated {fromNow(current.updatedAt)}
            </span>
          </div>
          <h1>{current.title}</h1>
          {current.description && <p className='muted lead'>{current.description}</p>}
          <div className='row wrap'>
            {current.tags.map(tag => (
              <Link
                key={tag}
                to={`/?q=${encodeURIComponent(`tags:${searchValue(tag)}`)}`}
                className='chip chip-link'
                title={`Search snippets tagged #${tag}`}
              >
                #{tag}
              </Link>
            ))}
          </div>
        </div>
        <div className='snippet-actions'>
          <PinButton snippet={current} />
          <Link to={`/editor/${current.id}`} className='btn btn-ghost btn-sm'>
            <Pencil size={15} /> Edit
          </Link>
          <button className='btn btn-ghost btn-sm danger-text' onClick={() => setConfirm(true)}>
            <Trash2 size={15} /> Delete
          </button>
        </div>
      </header>

      <div className='card code-card'>
        <div className='code-card-head'>
          <span className='muted small mono'>{current.language}</span>
          <div className='row'>
            <a className='btn btn-ghost btn-sm' href={api.rawUrl(current.id)} target='_blank' rel='noopener noreferrer'>
              <ExternalLink size={15} /> Raw
            </a>
            <CopyButton text={api.rawUrl(current.id)} label='Raw URL' toastText='Raw URL copied' />
            <CopyButton text={current.code} label='Copy code' className='btn btn-primary btn-sm' toastText='Code copied' />
          </div>
        </div>
        <CodeBlock code={current.code} language={current.language} />
      </div>

      {current.docs && (
        <section className='card docs-card'>
          <h2 className='section-title'>Documentation</h2>
          <Markdown>{current.docs}</Markdown>
        </section>
      )}

      <p className='muted small meta'>
        Created {formatDate(current.createdAt)} · Last updated {formatDate(current.updatedAt)}
      </p>

      <ConfirmDialog
        open={confirm}
        title='Delete snippet?'
        text={`"${current.title}" will be removed permanently.`}
        confirmLabel='Delete'
        onConfirm={onDelete}
        onClose={() => setConfirm(false)}
      />
    </article>
  );
};
