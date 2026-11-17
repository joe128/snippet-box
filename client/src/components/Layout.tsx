import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, Library, Moon, Plus, Search, Sun } from 'lucide-react';

type Theme = 'dark' | 'light';

const storedTheme = (): Theme => {
  try {
    const t = localStorage.getItem('theme');
    if (t === 'dark' || t === 'light') return t;
  } catch {
    // storage blocked - fall back to system preference
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

export const Layout = () => {
  const [theme, setTheme] = useState<Theme>(storedTheme);
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Ctrl/Cmd+K -> search, N -> new snippet
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('input, textarea, select, [contenteditable]');
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        navigate('/');
        setTimeout(() => document.getElementById('search')?.focus(), 0);
      } else if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && e.key === 'n') {
        navigate('/editor');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return (
    <>
      <header className='topbar'>
        <div className='topbar-inner'>
          <Link to='/' className='brand'>
            <span className='brand-mark'>{'</>'}</span>
            <span>Snippet Box</span>
          </Link>
          <nav className='nav'>
            <NavLink to='/' end>
              <Home size={16} />
              <span>Home</span>
            </NavLink>
            <NavLink to='/snippets'>
              <Library size={16} />
              <span>Library</span>
            </NavLink>
          </nav>
          <div className='topbar-actions'>
            <button
              className='btn btn-ghost btn-sm hide-sm'
              onClick={() => {
                navigate('/');
                setTimeout(() => document.getElementById('search')?.focus(), 0);
              }}
              title='Search (Ctrl+K)'
            >
              <Search size={15} />
              <kbd>Ctrl K</kbd>
            </button>
            <button
              className='icon-btn'
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              title='Toggle theme'
              aria-label='Toggle theme'
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <Link to='/editor' className='btn btn-primary btn-sm'>
              <Plus size={16} />
              <span className='hide-sm'>New</span>
            </Link>
          </div>
        </div>
      </header>
      <main className='container'>
        <Outlet />
      </main>
    </>
  );
};
