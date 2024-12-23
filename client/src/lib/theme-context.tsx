import { createContext, useContext, useEffect, useState } from 'react';

type ThemeAppearance = 'light' | 'dark' | 'system';
type ThemeVariant = 'modern-dark';

interface ThemeContextType {
  theme: ThemeAppearance;
  setTheme: (theme: ThemeAppearance) => void;
  variant: ThemeVariant;
  setVariant: (variant: ThemeVariant) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeAppearance>(
    (localStorage.getItem('theme') as ThemeAppearance) || 'dark'
  );
  const [variant] = useState<ThemeVariant>('modern-dark');

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }

    localStorage.setItem('theme', theme);

    const presets = {
      'modern-dark': {
        background: '220 13% 10%',
        foreground: '220 10% 97%',
        card: '220 13% 12%',
        'card-foreground': '220 10% 98%',
        popover: '220 13% 11%',
        'popover-foreground': '220 10% 98%',
        primary: '220 85% 60%',
        'primary-foreground': '220 10% 98%',
        secondary: '220 13% 15%',
        'secondary-foreground': '220 10% 97%',
        muted: '220 13% 14%',
        'muted-foreground': '220 10% 70%',
        accent: '220 13% 15%',
        'accent-foreground': '220 10% 97%',
        border: '220 13% 15%',
        input: '220 13% 15%',
        ring: '220 85% 60%',
        'editor-bg': '220 13% 11%',
        'editor-line': '220 13% 13%',
        'editor-selection': '220 30% 25%',
        'editor-gutter': '220 13% 12%',
        'editor-highlight': '220 13% 15%',
        'sidebar-background': '220 13% 9%',
        'sidebar-foreground': '220 10% 90%',
        'sidebar-border': '220 13% 15%',
        'sidebar-hover': '220 13% 13%',
      }
    };

    const updateThemeVariables = (vars: Record<string, string | number>) => {
      Object.entries(vars).forEach(([key, value]) => {
        if (key === 'radius') {
          root.style.setProperty('--radius', `${value}rem`);
        } else {
          root.style.setProperty(`--${key}`, value as string);
        }
      });
    };

    updateThemeVariables(presets['modern-dark']);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        root.classList.remove('light', 'dark');
        root.classList.add(mediaQuery.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  const value = {
    theme,
    setTheme,
    variant,
    setVariant: (v: ThemeVariant) => v // no-op since we only support one variant for now
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}