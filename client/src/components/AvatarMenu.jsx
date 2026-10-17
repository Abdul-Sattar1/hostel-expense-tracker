import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import Icon from './Icon.jsx';

// Account menu behind the avatar: shows who is signed in, links to Settings, and logs out.
// Closes on Escape, on a click/tap outside, when focus leaves it, and on navigation.
export default function AvatarMenu({ user, onLogout, busy }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const trigger = useRef(null);
  const panelId = useId();
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => !root.current.contains(e.target) && setOpen(false);
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      trigger.current.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="user-menu" ref={root} onBlur={(e) => !root.current.contains(e.relatedTarget) && setOpen(false)}>
      <button ref={trigger} type="button" className="avatar-btn" aria-expanded={open} aria-controls={panelId} aria-label={`Account menu for ${user.name}`} onClick={() => setOpen(!open)}>
        <Avatar user={user} size={36} />
      </button>
      {open && (
        <div id={panelId} className="user-menu-panel" role="group" aria-label="Account">
          <div className="user-menu-head">
            <Avatar user={user} size={44} />
            <p><strong>{user.name}</strong><span>{user.email}</span></p>
          </div>
          <Link to="/app/settings" className="user-menu-item"><Icon name="settings" size={18} />Settings</Link>
          <button type="button" className="user-menu-item" onClick={onLogout} disabled={busy}><Icon name="logout" size={18} />{busy ? 'Logging out…' : 'Log out'}</button>
        </div>
      )}
    </div>
  );
}
