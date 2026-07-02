import { LibraryBig } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AuthLayout({ children, subtitle, title }: AuthLayoutProps) {
  const { isDemoMode } = useAuth();

  return (
    <main className="auth-screen">
      <section className="auth-panel" aria-label={title}>
        <div className="auth-brand">
          <div className="auth-logo">
            <LibraryBig size={30} aria-hidden="true" />
          </div>
          <div>
            <strong>Pokédex TCG BR</strong>
            <span>Pokémon TCG em português e R$</span>
          </div>
        </div>

        <div className="auth-heading">
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>

        {isDemoMode ? (
          <div className="setup-notice">
            Sem `.env` Firebase: os dados desta sessão ficam no navegador.
          </div>
        ) : null}

        {children}
      </section>
    </main>
  );
}
