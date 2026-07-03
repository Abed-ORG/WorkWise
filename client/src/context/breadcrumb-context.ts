import { createContext } from 'react';

export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export interface BreadcrumbContextValue {
  items: BreadcrumbItem[];
  setItems: (items: BreadcrumbItem[]) => void;
}

export const BreadcrumbContext = createContext<BreadcrumbContextValue | null>(null);
