import { Download, Grid2X2, LibraryBig, LogOut, Plus, UserCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

type InstallPromptOutcome = {
  outcome: 'accepted' | 'dismissed';
  platform: string;
};

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<InstallPromptOutcome>;
  prompt: () => Promise<void>;
}

export function AppShell() {
  const { isDemoMode, logout, user } = useAuth();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-label="Pokédex TCG BR">
          <LibraryBig size={26} aria-hidden="true" />
          <div>
            <strong>Pokédex TCG BR</strong>
            <span>Portfólio nacional</span>
          </div>
        </div>

        <nav className="main-nav" aria-label="Principal">
          <NavLink to="/" end>
            <Grid2X2 size={18} aria-hidden="true" />
            Minha Pokédex
          </NavLink>
          <NavLink to="/adicionar">
            <Plus size={18} aria-hidden="true" />
            Adicionar
          </NavLink>
        </nav>

        <div className="account-area">
          {isDemoMode ? <span className="demo-badge">Demo local</span> : null}
          {installPrompt ? (
            <button
              className="icon-button"
              type="button"
              onClick={() => void handleInstall()}
              title="Instalar app"
              aria-label="Instalar app"
            >
              <Download size={18} aria-hidden="true" />
            </button>
          ) : null}
          <div className="user-chip" onClick={() => navigation.navigate('perfil')}>
            <UserCircle size={18} aria-hidden="true" />
            <span>{user?.displayName || user?.email}</span>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={() => void logout()}
            title="Sair"
            aria-label="Sair"
          >
            <LogOut size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
