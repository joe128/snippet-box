import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';

type Kind = 'success' | 'error';
type Toast = { id: number; text: string; kind: Kind };
type Notify = (text: string, kind?: Kind) => void;

const ToastContext = createContext<Notify>(() => {});

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback<Notify>((text, kind = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, text, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className='toasts' role='status' aria-live='polite'>
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            {t.kind === 'success' ? <CircleCheck size={16} /> : <CircleAlert size={16} />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
