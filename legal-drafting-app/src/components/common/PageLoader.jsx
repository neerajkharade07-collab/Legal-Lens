import './PageLoader.css';

export function PageLoader() {
  return (
    <div className="page-loader" role="status">
      <span className="page-loader__spinner" aria-hidden="true" />
      <span className="visually-hidden">Loading page…</span>
    </div>
  );
}
