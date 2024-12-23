import { createContext, useContext, useEffect, useState } from 'react';

type ThemeAppearance = 'light' | 'dark' | 'system';
type ThemeVariant = 'modern-dark' | 'vibrant-dark' | 'minimal-dark' | 'professional-dark';

interface ThemeContextType {
  theme: ThemeAppearance;
  setTheme: (theme: ThemeAppearance) => void;
  variant: ThemeVariant;
  setVariant: (variant: ThemeVariant) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeAppearance>(() => {
    const storedTheme = localStorage.getItem('theme') as ThemeAppearance;
    return storedTheme || 'dark';
  });

  const [variant, setVariant] = useState<ThemeVariant>(() => {
    const storedVariant = localStorage.getItem('theme-variant') as ThemeVariant;
    return storedVariant || 'modern-dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    let effectiveTheme: 'light' | 'dark' = theme === 'system' 
      ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      : theme;

    root.classList.add(effectiveTheme);
    localStorage.setItem('theme', theme);
    localStorage.setItem('theme-variant', variant);

    const updateThemeVariables = (presets: any) => {
      const vars = presets[variant];
      if (!vars) return;

      Object.entries(vars).forEach(([key, value]) => {
        if (key === 'radius') {
          root.style.setProperty('--radius', `${value}rem`);
        } else {
          root.style.setProperty(`--${key}`, value as string);
        }
      });
    };

    const updateTheme = async () => {
      try {
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
            radius: 0.5
          },
          'vibrant-dark': {
            background: '230 15% 12%',
            foreground: '230 10% 97%',
            card: '230 15% 14%',
            'card-foreground': '230 10% 98%',
            popover: '230 15% 13%',
            'popover-foreground': '230 10% 98%',
            primary: '230 90% 65%',
            'primary-foreground': '230 10% 98%',
            secondary: '230 15% 17%',
            'secondary-foreground': '230 10% 97%',
            muted: '230 15% 16%',
            'muted-foreground': '230 10% 70%',
            accent: '230 15% 17%',
            'accent-foreground': '230 10% 97%',
            border: '230 15% 17%',
            input: '230 15% 17%',
            ring: '230 90% 65%',
            'editor-bg': '230 15% 13%',
            'editor-line': '230 15% 15%',
            'editor-selection': '230 35% 30%',
            'editor-gutter': '230 15% 14%',
            'editor-highlight': '230 15% 17%',
            'sidebar-background': '230 15% 11%',
            'sidebar-foreground': '230 10% 90%',
            'sidebar-border': '230 15% 17%',
            'sidebar-hover': '230 15% 15%',
            radius: 0.75
          },
          'minimal-dark': {
            background: '0 0% 10%',
            foreground: '0 0% 97%',
            card: '0 0% 12%',
            'card-foreground': '0 0% 98%',
            popover: '0 0% 11%',
            'popover-foreground': '0 0% 98%',
            primary: '0 0% 85%',
            'primary-foreground': '0 0% 9%',
            secondary: '0 0% 15%',
            'secondary-foreground': '0 0% 97%',
            muted: '0 0% 14%',
            'muted-foreground': '0 0% 70%',
            accent: '0 0% 15%',
            'accent-foreground': '0 0% 97%',
            border: '0 0% 15%',
            input: '0 0% 15%',
            ring: '0 0% 85%',
            'editor-bg': '0 0% 11%',
            'editor-line': '0 0% 13%',
            'editor-selection': '0 0% 20%',
            'editor-gutter': '0 0% 12%',
            'editor-highlight': '0 0% 15%',
            'sidebar-background': '0 0% 9%',
            'sidebar-foreground': '0 0% 90%',
            'sidebar-border': '0 0% 15%',
            'sidebar-hover': '0 0% 13%',
            radius: 0.25
          },
          'professional-dark': {
            background: '225 15% 11%',
            foreground: '225 10% 97%',
            card: '225 15% 13%',
            'card-foreground': '225 10% 98%',
            popover: '225 15% 12%',
            'popover-foreground': '225 10% 98%',
            primary: '225 80% 65%',
            'primary-foreground': '225 10% 98%',
            secondary: '225 15% 16%',
            'secondary-foreground': '225 10% 97%',
            muted: '225 15% 15%',
            'muted-foreground': '225 10% 70%',
            accent: '225 15% 16%',
            'accent-foreground': '225 10% 97%',
            border: '225 15% 16%',
            input: '225 15% 16%',
            ring: '225 80% 65%',
            'editor-bg': '225 15% 12%',
            'editor-line': '225 15% 14%',
            'editor-selection': '225 30% 25%',
            'editor-gutter': '225 15% 13%',
            'editor-highlight': '225 15% 16%',
            'sidebar-background': '225 15% 10%',
            'sidebar-foreground': '225 10% 90%',
            'sidebar-border': '225 15% 16%',
            'sidebar-hover': '225 15% 14%',
            radius: 0.375
          }
        };

        updateThemeVariables(presets);

        await fetch('/api/theme', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            variant,
            appearance: theme,
            presets: presets[variant],
          }),
        });
      } catch (error) {
        console.error('Failed to update theme:', error);
      }
    };

    updateTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        root.classList.remove('light', 'dark');
        root.classList.add(mediaQuery.matches ? 'dark' : 'light');
        updateTheme();
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme, variant]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, variant, setVariant }}>
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