import Icon from './Icon.jsx';

const ICONS = { info: 'info', success: 'check', warning: 'alert', error: 'alert' };

export default function Alert({ tone = 'info', children, ...props }) {
  return (
    <div className={`alert alert-${tone}`} {...props}>
      <Icon name={ICONS[tone]} size={18} />
      <div>{children}</div>
    </div>
  );
}
