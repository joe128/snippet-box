import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useStore } from '../store';
import type { TagCount } from '../types';
import { SnippetGrid } from '../components/Snippet';
import { EmptyState } from '../components/UI';

type Sort = 'updated' | 'created' | 'title';

export const Library = () => {
  const { snippets, loading } = useStore();
  const [tags, setTags] = useState<TagCount[]>([]);
  const [params, setParams] = useSearchParams();
  const active = params.get('tag');
  const sort = (params.get('sort') as Sort) || 'updated';

  useEffect(() => {
    api.tags().then(setTags).catch(() => setTags([]));
  }, [snippets]);

  const visible = useMemo(() => {
    const list = active ? snippets.filter(s => s.tags.includes(active)) : [...snippets];
    const by: Record<Sort, (a: (typeof list)[0], b: (typeof list)[0]) => number> = {
      updated: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
      created: (a, b) => b.createdAt.localeCompare(a.createdAt),
      title: (a, b) => a.title.localeCompare(b.title)
    };
    return list.sort(by[sort]);
  }, [snippets, active, sort]);

  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  if (!loading && snippets.length === 0) {
    return <EmptyState title='Your library is empty' text='Snippets you create will show up here.' />;
  }

  return (
    <div className='library'>
      <aside className='sidebar card'>
        <div className='sidebar-head'>
          <h2>Tags</h2>
          <span className='muted small'>{snippets.length} snippets</span>
        </div>
        <ul className='tag-list'>
          <li>
            <button className={!active ? 'active' : ''} onClick={() => update('tag', null)}>
              <span>All</span>
              <span className='count'>{snippets.length}</span>
            </button>
          </li>
          {tags.map(tag => (
            <li key={tag.name}>
              <button
                className={active === tag.name ? 'active' : ''}
                onClick={() => update('tag', active === tag.name ? null : tag.name)}
              >
                <span>#{tag.name}</span>
                <span className='count'>{tag.count}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <section>
        <div className='toolbar'>
          <h1>{active ? `#${active}` : 'All snippets'}</h1>
          <select className='input select' value={sort} onChange={e => update('sort', e.target.value)} aria-label='Sort'>
            <option value='updated'>Recently updated</option>
            <option value='created'>Newest</option>
            <option value='title'>Title A–Z</option>
          </select>
        </div>
        <SnippetGrid snippets={visible} />
      </section>
    </div>
  );
};
