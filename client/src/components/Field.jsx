import { useId, useState } from 'react';
import Icon from './Icon.jsx';

export default function Field({ label, error, hint, as: Control = 'input', type = 'text', ...props }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const isPassword = type === 'password';
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;

  const control = (
    <Control id={id} className="input" type={isPassword && shown ? 'text' : type} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />
  );

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isPassword ? (
        <div className="input-wrap">
          {control}
          <button type="button" className="input-toggle" aria-pressed={shown} aria-label={shown ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} onClick={() => setShown(!shown)}>
            <Icon name={shown ? 'eyeOff' : 'eye'} size={18} />
          </button>
        </div>
      ) : control}
      {hint && !error && <p id={`${id}-hint`} className="field-hint">{hint}</p>}
      {error && <p id={`${id}-error`} className="field-error"><Icon name="alert" size={15} />{error}</p>}
    </div>
  );
}
