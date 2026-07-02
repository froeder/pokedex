import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CardDetailsModal } from '../components/CardDetailsModal';
import { CardGrid } from '../components/CardGrid';
import { EmptyState } from '../components/EmptyState';
import { useAuth } from '../hooks/useAuth';
import {
  removeUserCard,
  subscribeToUserCards,
} from '../services/collectionService';
import type { UserCard } from '../types';
import { getFriendlyFirebaseError } from '../utils/firebaseErrors';

export function DashboardPage() {
  const { user } = useAuth();
  const [cards, setCards] = useState<UserCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<UserCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState<string>();

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    return subscribeToUserCards(
      user.uid,
      (nextCards) => {
        setCards(nextCards);
        setLoading(false);
      },
      (subscriptionError) => {
        setError(getFriendlyFirebaseError(subscriptionError));
        setLoading(false);
      },
    );
  }, [user]);

  const collectionCount = useMemo(
    () => new Set(cards.map((card) => card.collectionId)).size,
    [cards],
  );

  async function handleRemove(cardId: string) {
    if (!user) {
      return;
    }

    setRemovingId(cardId);
    try {
      await removeUserCard(user.uid, cardId);
      if (selectedCard?.id === cardId) {
        setSelectedCard(null);
      }
    } finally {
      setRemovingId(undefined);
    }
  }

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <span className="eyebrow">Minha Pokédex</span>
          <h1>Cartas salvas</h1>
        </div>
        <Link className="primary-action" to="/adicionar">
          <Plus size={18} aria-hidden="true" />
          Adicionar carta
        </Link>
      </section>

      <section className="stat-strip" aria-label="Resumo da coleção">
        <div>
          <span>Cartas</span>
          <strong>{cards.length}</strong>
        </div>
        <div>
          <span>Coleções</span>
          <strong>{collectionCount}</strong>
        </div>
        <div>
          <span>Precificação</span>
          <strong>Liga Pokémon</strong>
        </div>
      </section>

      {error ? <div className="form-error">{error}</div> : null}

      {loading ? <div className="panel-loader">Carregando cartas...</div> : null}

      {!loading && cards.length === 0 ? <EmptyState /> : null}

      {!loading && cards.length > 0 ? (
        <CardGrid
          cards={cards}
          removingId={removingId}
          onRemove={(cardId) => void handleRemove(cardId)}
          onSelect={setSelectedCard}
        />
      ) : null}

      {selectedCard ? (
        <CardDetailsModal
          key={selectedCard.id}
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
        />
      ) : null}
    </div>
  );
}
