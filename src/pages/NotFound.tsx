import { useTranslation } from "react-i18next";
import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Home } from "lucide-react";

const NotFound = () => {
  const { t } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="flex justify-between items-center p-4">
        <div className="flex items-center gap-3">
          <img src="/logo.jpg" alt="Hanguk" className="h-10 w-10 rounded-lg object-cover" />
          <span className="text-xl font-bold text-primary">Hanguk</span>
        </div>
        <LanguageSwitcher />
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-center space-y-6">
          <h1 className="text-6xl font-bold text-primary">404</h1>
          <p className="text-xl text-muted-foreground">
            {t('errors.notFound')}
          </p>
          <p className="text-sm text-muted-foreground">
            {location.pathname}
          </p>
          <Button asChild>
            <Link to="/">
              <Home className="mr-2 h-4 w-4" />
              {t('navigation.home')}
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
};

export default NotFound;