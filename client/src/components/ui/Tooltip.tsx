import type { ReactNode } from 'react';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  /** Stretch to fill the available width so a truncated child's ellipsis still works. */
  block?: boolean;
  className?: string;
}

export default function Tooltip({ content, children, block = false, className = '' }: TooltipProps) {
  return (
    <span className={`tooltip-anchor${block ? ' tooltip-anchor--block' : ''}${className ? ` ${className}` : ''}`}>
      {children}
      <span className="tooltip-bubble" role="tooltip">{content}</span>
    </span>
  );
}
