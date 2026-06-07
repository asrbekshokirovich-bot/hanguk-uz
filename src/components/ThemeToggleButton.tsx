import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Compact one-click light/dark toggle (lucide Sun/Moon) for headers and nav
 * bars — the CRM topbar, the portal headers and the landing nav. Flips between
 * light and dark; the dropdown `ThemeToggle` (with a System option) is kept for
 * Settings. Theme state is owned by next-themes (`attribute="class"`), so this
 * only calls setTheme — the `.dark` class on <html> drives every token.
 */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      title="Toggle theme"
      aria-label="Toggle theme"
      className={cn('relative text-muted-foreground hover:text-foreground', className)}
    >
      <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

export default ThemeToggleButton;
