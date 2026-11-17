import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X } from 'lucide-react';

export const EmptyState = ({ title, text, action = true }: { title: string; text: string; action?: boolean }) => (
  <div className='empty'>
    <div className='empty-icon'>{'{ }'}</div>
    <h2>{title}</h2>
    <p className='muted'>{text}</p>
    {action && (
      <Link to='/editor' className='btn btn-primary'>
        <Plus size={16} /> New snippet
      </Link>
    )}
  </div>
);

interface ConfirmProps {
  open: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmDialog = ({ open, title, text, confirmLabel, onConfirm, onClose }: ConfirmProps) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className='dialog' onClose={onClose}>
      <h3>{title}</h3>
      <p className='muted'>{text}</p>
      <div className='dialog-actions'>
        <button className='btn btn-ghost' onClick={onClose}>
          Cancel
        </button>
        <button className='btn btn-danger' onClick={onConfirm} autoFocus>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
};

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
}

export const TagInput = ({ value, onChange, suggestions }: TagInputProps) => {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const tags = raw
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter((t, i, all) => t && !value.includes(t) && all.indexOf(t) === i);
    if (tags.length) onChange([...value, ...tags]);
    setDraft('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className='tag-input input'>
      {value.map(tag => (
        <span key={tag} className='chip'>
          {tag}
          <button type='button' aria-label={`Remove ${tag}`} onClick={() => onChange(value.filter(t => t !== tag))}>
            <X size={12} />
          </button>
        </span>
      ))}
      <input
        id='tags'
        list='tag-suggestions'
        value={draft}
        placeholder={value.length ? '' : 'automation, files, loop'}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => draft && add(draft)}
      />
      <datalist id='tag-suggestions'>
        {suggestions.map(s => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
};
