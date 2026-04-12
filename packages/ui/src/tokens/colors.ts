export const colors = {
  light: {
    '--atlas-bg': '#F2EDE4',
    '--atlas-card': '#FFFFFF',
    '--atlas-text': '#1a1a2e',
    '--atlas-muted': '#6b7280',
    '--atlas-border': '#d6d0c4',
  },
  dark: {
    '--atlas-bg': '#1a1a2e',
    '--atlas-card': '#16213e',
    '--atlas-text': '#e4e7e0',
    '--atlas-muted': '#9ca3af',
    '--atlas-border': '#2d3748',
  },
  accent: {
    acxe: '#0077cc',
    q2p: '#1a9944',
    warn: '#d97706',
    crit: '#dc2626',
    ndf: '#7c3aed',
    success: '#059669',
  },
} as const;

export const cssVarsLight = Object.entries(colors.light)
  .map(([k, v]) => `${k}: ${v};`)
  .join('\n  ');

export const cssVarsDark = Object.entries(colors.dark)
  .map(([k, v]) => `${k}: ${v};`)
  .join('\n  ');
