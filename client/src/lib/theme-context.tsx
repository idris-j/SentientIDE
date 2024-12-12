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
    const storedVariant = localStorage.getItem('theme-variant');
    return (storedVariant === 'professional' || storedVariant === 'vibrant') ? storedVariant : 'professional';
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
        
        // Extract HSL values from the color strings
        const extractHSL = (hslString: string) => {
          const match = hslString.match(/hsl\(([^)]+)\)/);
          return match ? match[1] : hslString;
        };

        // Update primary theme color and related variables
        root.style.setProperty('--primary', extractHSL(selectedPreset.primary));
        root.style.setProperty('--primary-foreground', effectiveTheme === 'light' ? '0 0% 100%' : '0 0% 0%');
        
        // Update accent colors
        root.style.setProperty('--accent', extractHSL(selectedPreset.accent));
        root.style.setProperty('--accent-foreground', effectiveTheme === 'light' ? '0 0% 0%' : '0 0% 100%');
        
        // Update secondary colors
        root.style.setProperty('--secondary', extractHSL(selectedPreset.secondary));
        root.style.setProperty('--secondary-foreground', effectiveTheme === 'light' ? '0 0% 0%' : '0 0% 100%');

        // Update other theme-related variables
        root.style.setProperty('--background', effectiveTheme === 'light' ? '0 0% 100%' : '0 0% 10%');
        root.style.setProperty('--foreground', effectiveTheme === 'light' ? '0 0% 0%' : '0 0% 100%');
        root.style.setProperty('--muted', effectiveTheme === 'light' ? '0 0% 96%' : '0 0% 20%');
        root.style.setProperty('--muted-foreground', effectiveTheme === 'light' ? '0 0% 45%' : '0 0% 65%');
        
        // Update radius
        root.style.setProperty('--radius', `${selectedPreset.radius}rem`);

        // Log theme update details
        console.log('Updating theme:', {
          variant,
          theme: effectiveTheme,
          selectedPreset
        });

        // Update theme.json through API
        const response = await fetch('/api/theme', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            variant,
            primary: selectedPreset.primary,
            appearance: theme,
            radius: selectedPreset.radius,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update theme configuration');
        }

        // Log successful theme update
        console.log('Theme updated successfully');
      } catch (error) {
        console.error('Failed to update theme:', error);
        // Reset to default theme if update fails
        if (variant !== 'professional') {
          setVariant('professional');
        }
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
