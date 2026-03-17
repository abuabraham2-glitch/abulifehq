export const CATEGORY_COLORS: Record<string, string> = {
  Business: '#2563EB',
  Home: '#D97706',
  Personal: '#7C3AED',
  Family: '#059669',
  Yardwork: '#65A30D',
  Fraternity: '#EC4899',
  Health: '#DC2626',
  Buffer: '#9CA3AF',
};

export const CATEGORIES = Object.keys(CATEGORY_COLORS).filter(c => c !== 'Buffer');

export const QUADRANTS = ['Do Now', 'Schedule', 'Delegate', 'Delete'] as const;

export const QUADRANT_COLORS: Record<string, string> = {
  'Do Now': '#DC2626',
  Schedule: '#2563EB',
  Delegate: '#059669',
  Delete: '#9CA3AF',
};

export const QUADRANT_LABELS: Record<string, string> = {
  'Do Now': 'Important & Urgent',
  Schedule: 'Important & Not Urgent',
  Delegate: 'Not Important & Urgent',
  Delete: 'Not Important & Not Urgent',
};

export function getCategoryColor(cat?: string | null): string {
  return CATEGORY_COLORS[cat || ''] || CATEGORY_COLORS.Buffer;
}

export function getQuadrantColor(q?: string | null): string {
  return QUADRANT_COLORS[q || ''] || QUADRANT_COLORS.Delete;
}

export function calcQuadrant(importance?: string | null, urgency?: string | null): string {
  if (importance === 'Important' && urgency === 'Urgent') return 'Do Now';
  if (importance === 'Important' && urgency === 'Not Urgent') return 'Schedule';
  if (importance === 'Not Important' && urgency === 'Urgent') return 'Delegate';
  return 'Delete';
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export const MOTIVATIONAL_PHRASES = [
  "Small steps lead to big changes.",
  "You're doing better than you think.",
  "Progress, not perfection.",
  "One thing at a time.",
  "Trust the process.",
  "Your future self will thank you.",
  "Focus on what matters most.",
  "Every task completed is a win.",
  "You've got this, Abu.",
  "Clarity comes from action.",
  "Breathe. Plan. Execute.",
  "Today is full of potential.",
  "Consistency beats intensity.",
];

export function getRandomPhrase(): string {
  return MOTIVATIONAL_PHRASES[Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length)];
}
