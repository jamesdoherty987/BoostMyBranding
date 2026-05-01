/**
 * BoostMyBranding brand theme.
 * Single source of truth for colors, gradients, and fonts.
 */

export const brand = {
  name: 'BoostMyBranding',
  tagline: 'Social growth on autopilot',
  colors: {
    primary: '#48D886', // vivid green
    secondary: '#1D9CA1', // teal
    accent: '#FFEC3D', // electric yellow
    ink: '#0B1220',
    subtle: '#64748B',
    surface: '#FFFFFF',
    muted: '#F5F7FA',
  },
  gradients: {
    hero: 'linear-gradient(135deg, #48D886 0%, #1D9CA1 60%, #FFEC3D 100%)',
    cta: 'linear-gradient(90deg, #48D886 0%, #1D9CA1 100%)',
    aurora: 'radial-gradient(60% 80% at 20% 20%, rgba(72,216,134,0.35), transparent 60%), radial-gradient(50% 70% at 80% 30%, rgba(29,156,161,0.30), transparent 60%), radial-gradient(60% 60% at 50% 90%, rgba(255,236,61,0.25), transparent 60%)',
  },
  fonts: {
    heading:
      '"Geist", "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    body: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  },
} as const;

export type Brand = typeof brand;
