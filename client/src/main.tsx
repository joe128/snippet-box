import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { StoreProvider } from './store';
import { Layout } from './components/Layout';
import { EmptyState } from './components/UI';
import { Home } from './pages/Home';
import { Library } from './pages/Library';
import { SnippetView } from './pages/SnippetView';
import { Editor } from './pages/Editor';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <StoreProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path='snippets' element={<Library />} />
              <Route path='snippet/:id' element={<SnippetView />} />
              <Route path='editor/:id?' element={<Editor />} />
              <Route path='*' element={<EmptyState title='Page not found' text='This page does not exist.' action={false} />} />
            </Route>
          </Routes>
        </StoreProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
);
