import { Link } from 'react-router-dom';
import Icon from './Icon.jsx';
import { SITE } from '../utils/site.js';

export default function Logo() {
  return (
    <Link to="/" className="logo" aria-label={`${SITE.name} home`}>
      <span className="logo-mark"><Icon name="wallet" size={18} /></span>
      <span className="logo-text">{SITE.name}</span>
    </Link>
  );
}
