import { Link } from 'react-router-dom';
import usePageTitle from '../hooks/usePageTitle.js';

export default function NotFound() {
  usePageTitle('Page not found');
  return (
    <section className="page-hero">
      <div className="container">
        <p className="eyebrow">404</p>
        <h1>We couldn't find that page.</h1>
        <p className="lead">The address may be mistyped or the page may have moved.</p>
        <Link to="/" className="btn btn-primary">Back to Home</Link>
      </div>
    </section>
  );
}
