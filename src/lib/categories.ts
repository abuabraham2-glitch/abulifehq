export const CATEGORY_COLORS: Record<string, string> = {
  'Business': '#2563EB',
  'Work': '#2563EB',
  'Home': '#D97706',
  'Personal': '#7C3AED',
  'Family': '#059669',
  'Yardwork': '#65A30D',
  'Fraternity': '#EC4899',
  'Health': '#DC2626',
  'Buffer': '#9CA3AF',
};

export const CATEGORIES = ['Business', 'Home', 'Personal', 'Family', 'Yardwork', 'Fraternity', 'Health'];

export const QUADRANTS = ['Do Now', 'Schedule', 'Delegate', 'Delete'] as const;

export const QUADRANT_COLORS: Record<string, { bg: string; text: string }> = {
  'Do Now': { bg: 'bg-red-500', text: 'text-white' },
  'Schedule': { bg: 'bg-blue-500', text: 'text-white' },
  'Delegate': { bg: 'bg-emerald-500', text: 'text-white' },
  'Delete': { bg: 'bg-gray-400', text: 'text-white' },
};

export function getCategoryColor(category: string | null): string {
  if (!category) return CATEGORY_COLORS['Buffer'];
  return CATEGORY_COLORS[category] || CATEGORY_COLORS['Buffer'];
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}
