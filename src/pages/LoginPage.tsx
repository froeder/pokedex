import { LogIn } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(email, password);
    } catch (loginError) {
      const message =
        loginError instanceof Error
          ? loginError.message
          : 'Não foi possível entrar.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Acesse sua coleção e acompanhe o valor das suas cartas."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          E-mail
          <input
            autoComplete="email"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Senha
          <input
            autoComplete="current-password"
            required
            minLength={6}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? <div className="form-error">{error}</div> : null}

        <button className="primary-action full-width" disabled={loading}>
          <LogIn size={18} aria-hidden="true" />
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>

      <p className="auth-switch">
        Ainda não tem conta? <Link to="/cadastro">Criar cadastro</Link>
      </p>
    </AuthLayout>
  );
}
