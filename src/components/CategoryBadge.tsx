import { getCategoryColor } from '@/lib/categories';

export function CategoryBadge({ category }: { category: string | null }) {
  const color = getCategoryColor(category);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-muted"
    >
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {category || 'Uncategorized'}
    </span>
  );
}

export function QuadrantBadge({ quadrant }: { quadrant: string | null }) {
  if (!quadrant) return null;
  const colors: Record<string, string> = {
    'Do Now': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    'Schedule': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'Delegate': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    'Delete': 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
  };
  return (
    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${colors[quadrant] || ''}`}>
      {quadrant}
    </span>
  );
}
