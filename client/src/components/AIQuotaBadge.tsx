import { useEffect, useState } from 'react';
import { getAiQuotaStatus } from '../services/aiService';
import type { AiQuotaStatus } from '../services/aiService';

const POLL_INTERVAL_MS = 60_000;

export default function AIQuotaBadge() {
  const [status, setStatus] = useState<AiQuotaStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      try {
        const data = await getAiQuotaStatus();
        if (!cancelled) setStatus(data);
      } catch {
        // silently ignore — badge is non-critical
      }
    }

    fetch();
    const id = setInterval(fetch, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!status) return null;

  const isExhausted = status.remaining === 0;
  const isWarning = status.warning;

  const colorClass = isExhausted
    ? 'ai-quota-badge--exhausted'
    : isWarning
    ? 'ai-quota-badge--warning'
    : 'ai-quota-badge--ok';

  const label = isExhausted
    ? `AI limit reached`
    : `AI ${status.count}/${status.limit}`;

  return (
    <span
      className={`ai-quota-badge ${colorClass}`}
      title={`AI quota: ${status.count}/${status.limit} used (${status.percentUsed}%). Resets ${new Date(status.resetAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC`}
      aria-label={`AI quota: ${status.count} of ${status.limit} daily requests used`}
    >
      {label}
    </span>
  );
}
