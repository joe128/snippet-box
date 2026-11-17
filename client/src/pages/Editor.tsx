import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { api } from '../api';
import { useStore } from '../store';
import type { NewSnippet } from '../types';
import { languages } from '../data/languages.json';
import { CodeBlock, Markdown } from '../components/Snippet';
import { TagInput } from '../components/UI';
import { useToast } from '../components/Toast';

const empty: NewSnippet = {
  title: '',
  description: '',
  language: '',
  code: '',
  docs: '',
  isPinned: false,
  tags: []
};

type Tab = 'write' | 'preview';

/** Tab inserts two spaces instead of leaving the textarea */
const indentOnTab = (e: KeyboardEvent<HTMLTextAreaElement>, set: (v: string) => void) => {
  if (e.key !== 'Tab' || e.shiftKey) return;
  e.preventDefault();
  const el = e.currentTarget;
  const { selectionStart: s, selectionEnd: end, value } = el;
  set(value.slice(0, s) + '  ' + value.slice(end));
  requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
};

export const Editor = () => {
  const params = useParams();
  const id = params.id ? Number(params.id) : null;
  const { snippets, create, update } = useStore();
  const [form, setForm] = useState<NewSnippet>(empty);
  const [codeTab, setCodeTab] = useState<Tab>('write');
  const [docsTab, setDocsTab] = useState<Tab>('write');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (id === null) {
      setForm(empty);
      return;
    }
    const cached = snippets.find(s => s.id === id);
    const load = cached ? Promise.resolve(cached) : api.get(id);
    load
      .then(({ title, description, language, code, docs, isPinned, tags }) =>
        setForm({ title, description, language, code, docs, isPinned, tags: tags.filter(t => t !== language.toLowerCase()) })
      )
      .catch(() => navigate('/snippets'));
    // only on id change - don't overwrite user edits when the store refreshes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const tagSuggestions = useMemo(() => [...new Set(snippets.flatMap(s => s.tags))].sort(), [snippets]);

  const set = <K extends keyof NewSnippet>(key: K, value: NewSnippet[K]) => setForm(f => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = id === null ? await create(form) : await update(id, form);
      navigate(`/snippet/${saved.id}`);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className='editor' onSubmit={submit}>
      <div className='toolbar'>
        <div>
          {id !== null && (
            <Link to={`/snippet/${id}`} className='back'>
              <ArrowLeft size={16} /> Back to snippet
            </Link>
          )}
          <h1>{id === null ? 'New snippet' : 'Edit snippet'}</h1>
        </div>
        <button className='btn btn-primary' type='submit' disabled={saving}>
          <Save size={16} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className='editor-grid'>
        <div className='card form-card'>
          <label className='field'>
            <span>Title</span>
            <input
              className='input'
              required
              maxLength={200}
              value={form.title}
              placeholder='Recursively copy all files'
              onChange={e => set('title', e.target.value)}
            />
          </label>
          <label className='field'>
            <span>Description</span>
            <input
              className='input'
              maxLength={1000}
              value={form.description}
              placeholder='Bash script to copy all files from src to dest'
              onChange={e => set('description', e.target.value)}
            />
          </label>
          <label className='field'>
            <span>Language</span>
            <input
              className='input'
              required
              maxLength={50}
              list='languages'
              value={form.language}
              placeholder='bash'
              onChange={e => set('language', e.target.value)}
            />
            <datalist id='languages'>
              {languages.map(l => (
                <option key={l.name} value={l.aliases[0]}>
                  {l.name}
                </option>
              ))}
            </datalist>
          </label>
          <div className='field'>
            <label htmlFor='tags'>Tags</label>
            <TagInput value={form.tags} onChange={tags => set('tags', tags)} suggestions={tagSuggestions} />
            <small className='muted'>Press Enter or comma to add. The language is added automatically.</small>
          </div>
          <label className='switch'>
            <input type='checkbox' checked={form.isPinned} onChange={e => set('isPinned', e.target.checked)} />
            <span className='switch-track' />
            <span>Pin to home</span>
          </label>
        </div>

        <div className='stack'>
          <div className='card'>
            <TabHeader title='Code' tab={codeTab} onTab={setCodeTab} />
            {codeTab === 'write' ? (
              <textarea
                className='input code-input'
                required
                spellCheck={false}
                rows={16}
                value={form.code}
                placeholder='cp -r ./src ./dest'
                onChange={e => set('code', e.target.value)}
                onKeyDown={e => indentOnTab(e, v => set('code', v))}
              />
            ) : (
              <CodeBlock code={form.code || ' '} language={form.language} />
            )}
          </div>

          <div className='card'>
            <TabHeader title='Documentation' hint='Markdown' tab={docsTab} onTab={setDocsTab} />
            {docsTab === 'write' ? (
              <textarea
                className='input'
                rows={8}
                value={form.docs}
                placeholder='`-r` flag stands for `--recursive`'
                onChange={e => set('docs', e.target.value)}
              />
            ) : (
              <div className='preview'>{form.docs ? <Markdown>{form.docs}</Markdown> : <p className='muted'>Nothing to preview</p>}</div>
            )}
          </div>
        </div>
      </div>
    </form>
  );
};

const TabHeader = ({ title, hint, tab, onTab }: { title: string; hint?: string; tab: Tab; onTab: (t: Tab) => void }) => (
  <div className='tab-header'>
    <h2 className='section-title'>
      {title} {hint && <span className='muted small'>{hint}</span>}
    </h2>
    <div className='segmented' role='tablist'>
      {(['write', 'preview'] as Tab[]).map(t => (
        <button key={t} type='button' role='tab' aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => onTab(t)}>
          {t === 'write' ? 'Write' : 'Preview'}
        </button>
      ))}
    </div>
  </div>
);
