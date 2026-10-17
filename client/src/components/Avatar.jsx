import { apiUrl } from '../api/client.js';

// The saved picture (private, served only to its owner), or the initial of the name as a default avatar.
// `v` changes whenever the picture changes so the browser never shows a stale copy.
export default function Avatar({ user, size = 40 }) {
  const style = { width: size, height: size, fontSize: size * 0.42 };
  if (user.avatarUpdatedAt) {
    return <img className="avatar" style={style} src={`${apiUrl('/profile/avatar')}?v=${encodeURIComponent(user.avatarUpdatedAt)}`} alt="" />;
  }
  return <span className="avatar" style={style} aria-hidden="true">{(user.name?.trim()[0] ?? '?').toUpperCase()}</span>;
}
