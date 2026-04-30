"use client";

/**
 * ThemeScript - Initializes theme from localStorage before React hydration
 * This prevents the flash of wrong theme on page load
 */
export default function ThemeScript() {
  const themeScript = `
    (function() {
      try {
        const stored = localStorage.getItem('deeptutor-theme');
        const root = document.documentElement;

        root.classList.remove('dark', 'theme-glass', 'theme-snow');

        if (stored === 'dark') {
          root.classList.add('dark');
          root.dataset.theme = 'dark';
          root.style.colorScheme = 'dark';
        } else if (stored === 'glass') {
          root.classList.add('dark', 'theme-glass');
          root.dataset.theme = 'glass';
          root.style.colorScheme = 'dark';
        } else if (stored === 'snow') {
          root.classList.add('theme-snow');
          root.dataset.theme = 'snow';
          root.style.colorScheme = 'light';
        } else if (stored === 'light') {
          root.dataset.theme = 'light';
          root.style.colorScheme = 'light';
        } else {
          root.classList.add('dark');
          root.dataset.theme = 'dark';
          root.style.colorScheme = 'dark';
          localStorage.setItem('deeptutor-theme', 'dark');
        }
      } catch (e) {
        // Silently fail - localStorage may be disabled
      }
    })();
  `;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: themeScript }}
      suppressHydrationWarning
    />
  );
}
