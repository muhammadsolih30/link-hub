import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

const ThemeToggle = () => {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="fixed bottom-5 right-5 z-40 rounded-full bg-background/90 shadow-lg backdrop-blur"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Kunduzgi rejimga o‘tish' : 'Tungi rejimga o‘tish'}
      title={isDark ? 'Kunduzgi rejim' : 'Tungi rejim'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
};

export default ThemeToggle;
