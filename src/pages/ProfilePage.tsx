import { LibraryBig, Mail, Sparkles, UserCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { subscribeToUserCards } from '../services/collectionService';
import type { UserCard } from '../types';

export function ProfilePage() {
  const { user } = useAuth();
  const [cards, setCards] = useState<UserCard[]>([]);

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
