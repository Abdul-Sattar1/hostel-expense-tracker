import { useRef, useState } from 'react';

// Small controlled-form helper: validates a field on blur (once it has a value),
// re-validates while an error is showing, and validates everything on submit.
// onValid may be async; a thrown error (e.g. ApiError) is shown as field and form errors.
export default function useForm(initial, validate) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const busy = useRef(false);

  const check = (next, names) => {
    const all = validate(next);
    setErrors((prev) => ({ ...prev, ...Object.fromEntries(names.map((n) => [n, all[n] || ''])) }));
    return all;
  };

  const bind = (name) => ({
    name,
    value: values[name],
    error: errors[name],
    onChange: (e) => {
      const next = { ...values, [name]: e.target.value };
      setValues(next);
      if (errors[name]) check(next, [name]);
    },
    onBlur: () => values[name] && check(values, [name]),
  });

  // Change several fields at once (e.g. reset category when the type changes).
  const set = (patch) => {
    setValues({ ...values, ...patch });
    setErrors((prev) => ({ ...prev, ...Object.fromEntries(Object.keys(patch).map((n) => [n, ''])) }));
  };

  const handleSubmit = (onValid) => async (e) => {
    e.preventDefault();
    if (busy.current) return;
    const all = check(values, Object.keys(initial));
    if (Object.values(all).some(Boolean)) return;
    busy.current = true;
    setSubmitting(true);
    setFormError('');
    try {
      await onValid(values);
    } catch (err) {
      setErrors((prev) => ({ ...prev, ...err.errors }));
      setFormError(err.message);
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  const reset = () => {
    setValues(initial);
    setErrors({});
  };

  return { bind, set, values, handleSubmit, reset, submitting, formError };
}
