'use client';

import {
  Sparkles,
  Wrench,
  Hammer,
  Coffee,
  Utensils,
  Leaf,
  Scissors,
  HeartPulse,
  Dumbbell,
  Phone,
  Calendar,
  Globe,
  Camera,
  MessageCircle,
  Star,
  CheckCircle2,
  Zap,
  Truck,
  Home,
  Shield,
  Brush,
  Sun,
  Flame,
  Award,
  Users,
  MapPin,
  Mail,
  type LucideIcon,
} from 'lucide-react';

/**
 * Map the small Lucide icon set the prompt is allowed to pick from to the
 * actual components. Unknown names fall back to `Sparkles` so the renderer
 * never crashes on a surprise string from the model.
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  Sparkles,
  Wrench,
  Hammer,
  Coffee,
  Utensils,
  Leaf,
  Scissors,
  HeartPulse,
  Dumbbell,
  Phone,
  Calendar,
  Globe,
  Camera,
  MessageCircle,
  Star,
  CheckCircle2,
  Zap,
  Truck,
  Home,
  Shield,
  Brush,
  Sun,
  Flame,
  Award,
  Users,
  MapPin,
  Mail,
};

export function resolveIcon(name?: string): LucideIcon {
  if (!name) return Sparkles;
  return ICON_MAP[name] ?? Sparkles;
}
