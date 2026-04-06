/**
 * Inline script that runs before React hydration to set the correct
 * theme class on <html>, preventing a flash of wrong theme.
 */
export function ThemeScript() {
  const script = `
(function() {
  try {
    var theme = localStorage.getItem('kickoff_theme') || 'system';
    var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.add(isDark ? 'dark' : 'light');
    document.documentElement.classList.remove(isDark ? 'light' : 'dark');
  } catch(e) {
    document.documentElement.classList.add('dark');
  }
})();
`;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: script }}
      suppressHydrationWarning
    />
  );
}
