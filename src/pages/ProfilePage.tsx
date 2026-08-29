import {
  LibraryBig,
  LoaderCircle,
  LogOut,
  Mail,
  RotateCcw,
  Sparkles,
  UserCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import {
  resetUserCollection,
  subscribeToUserCards,
} from '../services/collectionService';
import type { UserCard } from '../types';
import { getFriendlyFirebaseError } from '../utils/firebaseErrors';

export function ProfilePage() {
  const { logout, user } = useAuth();
  const [cards, setCards] = useState<UserCard[]>([]);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetMessage, setResetMessage] = useState('');

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    return subscribeToUserCards(user.uid, setCards);
  }, [user]);

  const cardCount = cards.length;
  const uniqueCollections = useMemo(
    () => new Set(cards.map((card) => card.collectionId)).size,
    [cards],
  );
  const totalQuantity = useMemo(
    () => cards.reduce((total, card) => total + (card.quantity ?? 1), 0),
    [cards],
  );

  async function handleResetCollection() {
    if (!user || resetting || cardCount === 0) {
      return;
    }

    const confirmed = window.confirm(
      'Isso vai apagar todas as cartas salvas e zerar suas coleções. Deseja continuar?',
    );

    if (!confirmed) {
      return;
    }

    setResetting(true);
    setResetError('');
    setResetMessage('');

    try {
      await resetUserCollection(user.uid);
      setResetMessage('Coleções resetadas. Você pode começar do começo.');
    } catch (error) {
      setResetError(getFriendlyFirebaseError(error));
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <span className="eyebrow">Perfil</span>
          <h1>Seu perfil</h1>
        </div>
      </section>

      <section className="profile-card">
        <div className="profile-identity">
          <div className="profile-avatar" aria-hidden="true">
            <UserCircle size={54} />
          </div>
          <div>
            <h2>{user?.displayName || 'Usuário'}</h2>
            <p>{user?.email || 'Sem e-mail cadastrado'}</p>
          </div>
        </div>

        <div className="profile-stats">
          <div>
            <span>Total de cartas</span>
            <strong>{cardCount}</strong>
          </div>
          <div>
            <span>Unidades salvas</span>
            <strong>{totalQuantity}</strong>
          </div>
          <div>
            <span>Coleções</span>
            <strong>{uniqueCollections}</strong>
          </div>
        </div>

        {resetError ? <div className="form-error">{resetError}</div> : null}
        {resetMessage ? (
          <div className="success-message">{resetMessage}</div>
        ) : null}

        <div className="profile-actions">
          <button
            className="secondary-action subtle-danger"
            type="button"
            disabled={resetting || cardCount === 0}
            onClick={() => void handleResetCollection()}
          >
            {resetting ? (
              <LoaderCircle className="spin" size={18} aria-hidden="true" />
            ) : (
              <RotateCcw size={18} aria-hidden="true" />
            )}
            {resetting ? 'Resetando...' : 'Resetar app'}
          </button>
          <button
            className="secondary-action subtle-danger"
            type="button"
            onClick={() => void logout()}
          >
            <LogOut size={18} aria-hidden="true" />
            Sair
          </button>
        </div>
      </section>

      <section className="profile-highlights">
        <article className="profile-highlight-card">
          <div className="profile-highlight-icon">
            <LibraryBig size={24} />
          </div>
          <div>
            <h3>Biblioteca</h3>
            <p>Suas cartas ficam organizadas por coleção para você acompanhar a evolução da sua coleção.</p>
          </div>
        </article>

        <article className="profile-highlight-card">
          <div className="profile-highlight-icon">
            <Sparkles size={24} />
          </div>
          <div>
            <h3>Resumo</h3>
            <p>Veja rapidamente quantas cartas você já adicionou e quantas unidades foram registradas.</p>
          </div>
        </article>

        <article className="profile-highlight-card">
          <div className="profile-highlight-icon">
            <Mail size={24} />
          </div>
          <div>
            <h3>Conta</h3>
            <p>Seu perfil é identificado pelo e-mail e nome exibidos acima, para manter tudo vinculado.</p>
          </div>
        </article>
      </section>
    </div>
  );
}
