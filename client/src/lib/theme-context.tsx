import { createContext, useContext, useEffect, useState } from 'react';

type ThemeAppearance = 'light' | 'dark' | 'system';
type ThemeVariant = 'professional' | 'vibrant';

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

    // Update theme.json and CSS variables when theme or variant changes
    const updateTheme = async () => {
      try {
        const presets = {
          professional: {
            primary: effectiveTheme === 'light' ? 'hsl(210, 100%, 50%)' : 'hsl(210, 100%, 60%)',
            secondary: effectiveTheme === 'light' ? 'hsl(210, 40%, 96%)' : 'hsl(210, 40%, 24%)',
            accent: effectiveTheme === 'light' ? 'hsl(210, 40%, 90%)' : 'hsl(210, 40%, 30%)',
            radius: 0.75
          },
          vibrant: {
            primary: effectiveTheme === 'light' ? 'hsl(280, 100%, 60%)' : 'hsl(280, 100%, 70%)',
            secondary: effectiveTheme === 'light' ? 'hsl(280, 70%, 96%)' : 'hsl(280, 70%, 24%)',
            accent: effectiveTheme === 'light' ? 'hsl(280, 70%, 90%)' : 'hsl(280, 70%, 30%)',
            radius: 1
          }
        };

        // Update CSS custom properties
        const selectedPreset = presets[variant];
        
        // Update primary theme color and related variables
        root.style.setProperty('--primary', selectedPreset.primary);
        root.style.setProperty('--primary-foreground', effectiveTheme === 'light' ? 'hsl(0, 0%, 100%)' : 'hsl(0, 0%, 0%)');
        
        // Update accent colors
        root.style.setProperty('--accent', selectedPreset.accent);
        root.style.setProperty('--accent-foreground', effectiveTheme === 'light' ? '0 0% 0%' : '0 0% 100%');
        
        // Update secondary colors
        root.style.setProperty('--secondary', selectedPreset.secondary);
        root.style.setProperty('--secondary-foreground', effectiveTheme === 'light' ? '0 0% 0%' : '0 0% 100%');

        // Update other theme-related variables
        root.style.setProperty('--background', effectiveTheme === 'light' ? '0 0% 100%' : '0 0% 10%');
        root.style.setProperty('--foreground', effectiveTheme === 'light' ? '0 0% 0%' : '0 0% 100%');
        root.style.setProperty('--muted', effectiveTheme === 'light' ? '0 0% 96%' : '0 0% 20%');
        root.style.setProperty('--muted-foreground', effectiveTheme === 'light' ? '0 0% 45%' : '0 0% 65%');
        
        // Update radius
        root.style.setProperty('--radius', `${selectedPreset.radius}rem`);

        // Update theme.json through API
        await fetch('/api/theme', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            variant,
            primary: selectedPreset.primary,
            secondary: selectedPreset.secondary,
            accent: selectedPreset.accent,
            appearance: theme,
            radius: selectedPreset.radius,
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
        updateTheme(); // Update theme when system preference changes
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme, variant]); // Added variant to dependency array

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
