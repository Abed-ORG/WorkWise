import { useContext, useEffect } from 'react';
import { BreadcrumbContext } from '../context/breadcrumb-context';
import type { BreadcrumbItem } from '../context/breadcrumb-context';

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumbs({ items }: BreadcrumbsProps) {
  const breadcrumbs = useContext(BreadcrumbContext);
  const setBreadcrumbItems = breadcrumbs?.setItems;
  const itemSignature = items.map((item) => `${item.label}:${item.to ?? ''}`).join('|');

  useEffect(() => {
    setBreadcrumbItems?.(items);
    return () => setBreadcrumbItems?.([]);
  }, [itemSignature, setBreadcrumbItems]);

  return null;
}
