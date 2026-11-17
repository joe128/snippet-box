import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pin, Search, X } from 'lucide-react';
import { api } from '../api';
import { useStore } from '../store';
import type { Snippet } from '../types';
import { parseSearch } from '../utils';
import { SnippetGrid } from '../components/Snippet';
import { EmptyState } from '../components/UI';

export const Home = () => {
  const { snippets, loading } = useStore();
  const [params, setParams] = useSearchParams();
  const [input, setInput] = useState(() => params.get('q') || '');
  const [results, setResults] = useState<Snippet[] | null>(null);

  // Follow external navigation, e.g. clicking a tag in the detail view
  const urlQuery = params.get('q') || '';
  useEffect(() => {
    setInput(urlQuery);
  }, [urlQuery]);

  const updateInput = (value: string) => {
    setInput(value);
    setParams(value ? { q: value } : {}, { replace: true });
  };

  // Debounced live search
  useEffect(() => {
    const query = parseSearch(input);
    if (!query.query && !query.tags.length && !query.languages.length) {
      setResults(null);
      return;
    }

    const timer = setTimeout(() => {
      api.search(query).then(setResults).catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [input, snippets]);

  if (!loading && snippets.length === 0) {
    return <EmptyState title='No snippets yet' text='Create your first snippet to start building your library.' />;
  }

  const pinned = snippets.filter(s => s.isPinned);
  const recent = snippets.slice(0, 6);

  return (
    <>
      <section className='hero'>
        <h1>Find a snippet</h1>
        <div className='search'>
          <Search size={18} className='search-icon' />
          <input
            id='search'
            autoFocus
            autoComplete='off'
            spellCheck={false}
            placeholder='Search title, description or code…'
            value={input}
            onChange={e => updateInput(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && updateInput('')}
          />
          {input && (
            <button className='icon-btn' onClick={() => updateInput('')} aria-label='Clear search'>
              <X size={16} />
            </button>
          )}
        </div>
        <p className='muted small'>
          Filters: <code>lang:bash</code> <code>tags:docker,ci</code> · <kbd>Esc</kbd> clears
        </p>
      </section>

      {results ? (
        <section>
          <h2 className='section-title'>
            {results.length} result{results.length === 1 ? '' : 's'}
          </h2>
          {results.length ? (
            <SnippetGrid snippets={results} />
          ) : (
            <EmptyState title='Nothing found' text='Try a different query or filter.' action={false} />
          )}
        </section>
      ) : (
        <>
          {pinned.length > 0 && (
            <section>
              <h2 className='section-title'>
                <Pin size={16} /> Pinned
              </h2>
              <SnippetGrid snippets={pinned} />
            </section>
          )}
          <section>
            <h2 className='section-title'>Recently updated</h2>
            <SnippetGrid snippets={recent} />
          </section>
        </>
      )}
    </>
  );
};
