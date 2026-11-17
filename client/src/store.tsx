import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';
import type { NewSnippet, Snippet } from './types';
import { useToast } from './components/Toast';

interface Store {
  snippets: Snippet[];
  loading: boolean;
  refresh: () => Promise<void>;
  create: (s: NewSnippet) => Promise<Snippet>;
  update: (id: number, s: NewSnippet) => Promise<Snippet>;
  remove: (id: number) => Promise<void>;
  togglePin: (s: Snippet) => Promise<void>;
}

const StoreContext = createContext<Store | null>(null);

export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const replace = (s: Snippet) =>
    setSnippets(prev => prev.map(p => (p.id === s.id ? s : p)));

  const refresh = useCallback(async () => {
    try {
      setSnippets(await api.list());
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const store: Store = {
    snippets,
    loading,
    refresh,
    create: async s => {
      const created = await api.create(s);
      setSnippets(prev => [created, ...prev]);
      toast('Snippet created');
      return created;
    },
    update: async (id, s) => {
      const updated = await api.update(id, s);
      replace(updated);
      toast('Snippet saved');
      return updated;
    },
    remove: async id => {
      await api.remove(id);
      setSnippets(prev => prev.filter(p => p.id !== id));
      toast('Snippet deleted');
    },
    togglePin: async s => {
      try {
        replace(await api.pin(s.id, !s.isPinned));
      } catch (e) {
        toast((e as Error).message, 'error');
      }
    }
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
};

export const useStore = () => {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside StoreProvider');
  return store;
};
