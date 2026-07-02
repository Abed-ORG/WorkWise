export default function PageSkeleton({ variant = 'cards' }: { variant?: 'cards' | 'table' | 'board' }) {
  return <div className={`page-skeleton page-skeleton-${variant}`} role="status" aria-label="Loading content">
    <div className="skeleton h-12 w-72" />
    <div className="skeleton-row">{Array.from({ length: variant === 'board' ? 4 : 3 }, (_, index) => <div className={`skeleton ${variant === 'table' ? 'h-14' : 'h-32'}`} key={index} />)}</div>
    <div className={`skeleton ${variant === 'table' ? 'h-64' : 'h-80'}`} />
  </div>;
}
