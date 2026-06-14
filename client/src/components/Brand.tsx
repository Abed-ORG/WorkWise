export function WorkWiseMark({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3.3 6.2 8.7 17.7 12 11.6l3.3 6.1 5.4-11.5" />
      <path d="m7.5 6.2 4.5 8.4 4.5-8.4" />
    </svg>
  );
}

export default function Brand({ compact = false, tagline = false }: { compact?: boolean; tagline?: boolean }) {
  return (
    <div className="brand-lockup">
      <span className="brand-mark"><WorkWiseMark className="brand-symbol" /></span>
      {!compact && (
        <span className="brand-copy">
          <span className="brand-name">WorkWise</span>
          {tagline && <span className="brand-tagline">Plan smart. Work wise.</span>}
        </span>
      )}
    </div>
  );
}
