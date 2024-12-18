import { createContext, useContext, useEffect, useState } from 'react';

type ThemeAppearance = 'light' | 'dark' | 'system';
type ThemeVariant = 'professional' | 'vibrant' | 'minimal' | 'modern';

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
    return storedTheme || 'system';
  });

  const [variant, setVariant] = useState<ThemeVariant>(() => {
    const storedVariant = localStorage.getItem('theme-variant') as ThemeVariant;
    return storedVariant || 'professional';
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

    // Update CSS variables directly
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

    // Update theme.json when theme or variant changes
    const updateTheme = async () => {
      try {
        const presets = {
          professional: {
            primary: effectiveTheme === 'light' ? 'hsl(210 100% 50%)' : 'hsl(210 100% 60%)',
            secondary: effectiveTheme === 'light' ? 'hsl(210 40% 96%)' : 'hsl(210 40% 24%)',
            accent: effectiveTheme === 'light' ? 'hsl(210 40% 90%)' : 'hsl(210 40% 30%)',
            radius: 0.75
          },
          vibrant: {
            primary: effectiveTheme === 'light' ? 'hsl(280 100% 60%)' : 'hsl(280 100% 70%)',
            secondary: effectiveTheme === 'light' ? 'hsl(280 70% 96%)' : 'hsl(280 70% 24%)',
            accent: effectiveTheme === 'light' ? 'hsl(280 70% 90%)' : 'hsl(280 70% 30%)',
            radius: 1
          },
          minimal: {
            primary: effectiveTheme === 'light' ? 'hsl(0 0% 30%)' : 'hsl(0 0% 70%)',
            secondary: effectiveTheme === 'light' ? 'hsl(0 0% 96%)' : 'hsl(0 0% 24%)',
            accent: effectiveTheme === 'light' ? 'hsl(0 0% 90%)' : 'hsl(0 0% 30%)',
            radius: 0.25
          },
          modern: {
            primary: effectiveTheme === 'light' ? 'hsl(160 100% 45%)' : 'hsl(160 100% 55%)',
            secondary: effectiveTheme === 'light' ? 'hsl(160 70% 96%)' : 'hsl(160 70% 24%)',
            accent: effectiveTheme === 'light' ? 'hsl(160 70% 90%)' : 'hsl(160 70% 30%)',
            radius: 0.5
          }
        };

        await fetch('/api/theme', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            variant,
            primary: presets[variant].primary,
            secondary: presets[variant].secondary,
            accent: presets[variant].accent,
            appearance: theme,
            radius: presets[variant].radius,
          }),
        });
      } catch (error) {
        console.error('Failed to update theme:', error);
      }
    };

    updateTheme();

    // Listen for system theme changes
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        root.classList.remove('light', 'dark');
        root.classList.add(mediaQuery.matches ? 'dark' : 'light');
        updateTheme(); // Update theme variables when system theme changes
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme, variant]); // Add variant to dependencies

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
