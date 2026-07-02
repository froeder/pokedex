import { UserPlus } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { useAuth } from '../hooks/useAuth';

export function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await register(email, password, name);
    } catch (registerError) {
      const message =
        registerError instanceof Error
          ? registerError.message
          : 'Não foi possível criar a conta.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Criar cadastro"
      subtitle="Organize suas cartas em uma Pokédex financeira."
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <label>
          Nome
          <input
            autoComplete="name"
            required
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
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
            autoComplete="new-password"
            required
            minLength={6}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error ? <div className="form-error">{error}</div> : null}

        <button className="primary-action full-width" disabled={loading}>
          <UserPlus size={18} aria-hidden="true" />
          {loading ? 'Criando...' : 'Criar conta'}
        </button>
      </form>

      <p className="auth-switch">
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </AuthLayout>
  );
}
