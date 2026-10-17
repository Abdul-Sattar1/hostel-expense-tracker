import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

let scriptPromise;
const loadScript = () => (scriptPromise ??= new Promise((resolve, reject) => {
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true;
  s.onload = resolve;
  s.onerror = () => { scriptPromise = null; reject(new Error('Google sign-in could not be loaded.')); };
  document.head.append(s);
}));

// Google's own button (Google Identity Services). It returns a signed ID token which the server verifies;
// nothing in the browser is trusted. Hidden when the server has no GOOGLE_CLIENT_ID configured.
// With `onCredential` it hands the verified-by-Google credential to the caller (for re-confirmation)
// instead of signing in.
export default function GoogleButton({ onError, onCredential }) {
  const { google } = useAuth();
  const box = useRef(null);
  const [clientId, setClientId] = useState(null);
  const handlers = useRef({});
  handlers.current = { google, onError, onCredential };

  useEffect(() => {
    api('/auth/config').then((d) => setClientId(d.googleClientId), () => {});
  }, []);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: ({ credential }) => {
          handlers.current.onError('');
          if (handlers.current.onCredential) handlers.current.onCredential(credential);
          else handlers.current.google(credential).catch((err) => handlers.current.onError(err.message));
        },
      });
      window.google.accounts.id.renderButton(box.current, {
        type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular',
        width: Math.min(400, Math.max(200, box.current.offsetWidth)),
      });
    }, (err) => handlers.current.onError(err.message));
    return () => { cancelled = true; };
  }, [clientId]);

  if (!clientId) return null;
  return (
    <>
      <div ref={box} className="google-btn" />
      {!onCredential && <p className="or-divider"><span>or</span></p>}
    </>
  );
}
