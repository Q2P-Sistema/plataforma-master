import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function applyTheme(theme: Theme): void {
  const resolved = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem('atlas-theme') as Theme) ?? 'system';
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('atlas-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const icons: Record<Theme, string> = {
    light: '☀️',
    dark: '🌙',
    system: '💻',
  };

  const next: Record<Theme, Theme> = {
    light: 'dark',
    dark: 'system',
    system: 'light',
  };

  return (
    <button
      onClick={() => setTheme(next[theme])}
      className="p-2 rounded-md hover:bg-atlas-border transition-colors text-sm"
      title={`Tema: ${theme}`}
      aria-label={`Mudar tema (atual: ${theme})`}
    >
      {icons[theme]}
    </button>
  );
}
