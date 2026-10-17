import Icon from './Icon.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const OPTIONS = [
  { value: 'system', icon: 'monitor', label: 'System theme' },
  { value: 'light', icon: 'sun', label: 'Light theme' },
  { value: 'dark', icon: 'moon', label: 'Dark theme' },
];

export default function ThemeToggle() {
  const { preference, choose } = useTheme();
  return (
    <div className="theme-toggle" role="group" aria-label="Color theme">
      {OPTIONS.map((o) => (
        <button key={o.value} type="button" aria-pressed={preference === o.value} aria-label={o.label} title={o.label} onClick={() => choose(o.value)}>
          <Icon name={o.icon} size={16} />
        </button>
      ))}
    </div>
  );
}
