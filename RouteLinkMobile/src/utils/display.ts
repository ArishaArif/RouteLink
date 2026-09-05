import { palette, heatRamp } from '../constants/theme';
import type { HeatTier, SlotType, HazardSeverity } from '../types';

export function normalizeSeverity(raw: string): HazardSeverity {
  const s = String(raw).toLowerCase();
  if (s === 'high' || s === 'critical' || s === 'severe') return 'high';
  if (s === 'medium' || s === 'moderate') return 'medium';
  return 'low';
}

export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export const heatTierMeta: Record<
  HeatTier,
  { label: string; recommendation: string; icon: 'snow-outline' | 'sunny-outline' | 'flame-outline' }
> = {
  cool: {
    label: 'Cool',
    recommendation: 'Comfortable for outdoor activities all day',
    icon: 'snow-outline',
  },
  mild: {
    label: 'Mild',
    recommendation: 'Good conditions for most outdoor plans',
    icon: 'sunny-outline',
  },
  warm: {
    label: 'Warm',
    recommendation: 'Plan shade breaks and stay hydrated',
    icon: 'sunny-outline',
  },
  hot: {
    label: 'Hot',
    recommendation: 'Hot — outdoor morning recommended',
    icon: 'flame-outline',
  },
  extreme: {
    label: 'Extreme heat',
    recommendation: 'Extreme heat — indoor rest recommended',
    icon: 'flame-outline',
  },
};

export const slotTypeMeta: Record<SlotType, { label: string; icon: 'walk-outline' | 'sunny-outline' | 'home-outline' | 'airplane-outline' | 'shuffle-outline' }> = {
  outdoor_active: { label: 'Outdoor active', icon: 'walk-outline' },
  outdoor_light: { label: 'Light outdoor', icon: 'sunny-outline' },
  indoor_rest: { label: 'Indoor rest', icon: 'home-outline' },
  travel: { label: 'Travel', icon: 'airplane-outline' },
  mixed: { label: 'Mixed schedule', icon: 'shuffle-outline' },
};

export const hazardSeverityMeta: Record<
  HazardSeverity,
  {
    label: string;
    color: string;
    softColor: string;
    icon: 'checkmark-circle' | 'warning' | 'alert-circle';
    shape: 'circle' | 'triangle' | 'octagon';
  }
> = {
  low: {
    label: 'Low risk',
    color: palette.teal[400],
    softColor: 'rgba(29, 158, 117, 0.15)',
    icon: 'checkmark-circle',
    shape: 'circle',
  },
  medium: {
    label: 'Moderate risk',
    color: palette.amber[400],
    softColor: 'rgba(239, 159, 39, 0.15)',
    icon: 'warning',
    shape: 'triangle',
  },
  high: {
    label: 'High risk',
    color: palette.danger[500],
    softColor: 'rgba(226, 75, 74, 0.15)',
    icon: 'alert-circle',
    shape: 'octagon',
  },
};

export const bookingStatusMeta: Record<
  'requested' | 'confirmed' | 'cancelled' | 'completed',
  { label: string; color: string; softColor: string; icon: 'time' | 'checkmark-circle' | 'close-circle' | 'flag' }
> = {
  requested: { label: 'Requested', color: palette.teal[300], softColor: 'rgba(29, 158, 117, 0.15)', icon: 'time' },
  confirmed: { label: 'Confirmed', color: palette.teal[400], softColor: 'rgba(29, 158, 117, 0.15)', icon: 'checkmark-circle' },
  cancelled: { label: 'Cancelled', color: palette.danger[500], softColor: 'rgba(226, 75, 74, 0.15)', icon: 'close-circle' },
  completed: { label: 'Completed', color: palette.amber[400], softColor: 'rgba(239, 159, 39, 0.15)', icon: 'flag' },
};

export function formatPrice(price: number | string | null | undefined): string {
  const n = parseNumber(price);
  if (n === null) return 'Rs. —';
  return `Rs. ${Math.round(n).toLocaleString('en-PK')}`;
}

export function formatDate(dateString: string): string {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return dateString;
  return d.toLocaleDateString('en-PK', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDistance(km: number | string | null | undefined): string {
  const n = parseNumber(km);
  if (n === null) return '— km';
  return `${n.toFixed(1)} km`;
}

export function heatTierColor(tier: HeatTier | null | undefined): string {
  if (!tier) return heatRamp.mild;
  return heatRamp[tier];
}

export function formatRelativeTime(isoString: string): string {
  const then = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' });
}

export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return `${startDate} – ${endDate}`;
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startStr = start.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' });
  const endStr = end.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' });
  if (sameMonth) {
    return `${start.getDate()}–${endStr}`;
  }
  return `${startStr} – ${endStr}`;
}
