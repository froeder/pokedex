import { Grid2X2, LibraryBig, LogOut, Plus, UserCircle } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function AppShell() {
  const { isDemoMode, logout, user } = useAuth();

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
          <div className="user-chip">
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
