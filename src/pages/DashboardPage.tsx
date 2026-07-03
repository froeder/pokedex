import { LoaderCircle, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CardDetailsModal } from '../components/CardDetailsModal';
import { CardGrid } from '../components/CardGrid';
import { EmptyState } from '../components/EmptyState';
import { useAuth } from '../hooks/useAuth';
import { loadCatalogCollections } from '../services/catalogService';
import {
  removeUserCard,
  subscribeToUserCards,
  updateUserCardPriceQuote,
  updateUserCardQuantity,
} from '../services/collectionService';
import type { PriceQuote, TcgCollection, UserCard } from '../types';
import { getFriendlyFirebaseError } from '../utils/firebaseErrors';

function normalizeCollectionKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

export function DashboardPage() {
  const { user } = useAuth();
  const [cards, setCards] = useState<UserCard[]>([]);
  const [catalogCollections, setCatalogCollections] = useState<TcgCollection[]>(
    [],
  );
  const [selectedCard, setSelectedCard] = useState<UserCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState<string>();
  const [preferredCollectionId, setPreferredCollectionId] = useState('');

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

  useEffect(() => {
    let ignore = false;

    loadCatalogCollections()
      .then((nextCollections) => {
        if (!ignore) {
          setCatalogCollections(nextCollections);
        }
      })
      .catch(() => {
        if (!ignore) {
          setCatalogCollections([]);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const collectionCount = useMemo(
    () => new Set(cards.map((card) => card.collectionId)).size,
    [cards],
  );

  const groupedCollections = useMemo(() => {
    const groups = new Map<string, { collectionId: string; name: string; cards: UserCard[]; collection?: (typeof catalogCollections)[number] }>();

    cards.forEach((card) => {
      const directCollection = catalogCollections.find(
        (item) => item.id === card.collectionId,
      );
      const fallbackCollection = directCollection
        ? directCollection
        : catalogCollections.find(
            (item) =>
              normalizeCollectionKey(item.name) ===
                normalizeCollectionKey(card.collectionName ?? '') ||
              normalizeCollectionKey(item.shortName) ===
                normalizeCollectionKey(card.collectionName ?? ''),
          );

      const collectionId = fallbackCollection?.id ?? card.collectionId ?? 'unknown';
      const currentGroup = groups.get(collectionId) ?? {
        collectionId,
        name: card.collectionName ?? fallbackCollection?.name ?? 'Coleção',
        cards: [],
        collection: fallbackCollection,
      };

      currentGroup.cards.push(card);
      groups.set(collectionId, currentGroup);
    });

    return Array.from(groups.values())
      .map((group) => {
        const ownedCount = group.cards.reduce(
          (total, card) => total + (card.quantity ?? 1),
          0,
        );
        const totalCount =
          group.collection?.cardCount ??
          group.cards.find((c) => c.collectionCardCount != null)?.collectionCardCount;
        const completion = totalCount ? Math.round((ownedCount / totalCount) * 100) : null;

        return {
          collectionId: group.collectionId,
          name: group.name,
          cards: [...group.cards].sort((first, second) =>
            first.name.localeCompare(second.name, 'pt-BR'),
          ),
          ownedCount,
          totalCount,
          completion,
        };
      })
      .sort((first, second) =>
        first.name.localeCompare(second.name, 'pt-BR'),
      );
  }, [cards, catalogCollections]);

  const activeCollectionId = groupedCollections.some(
    (group) => group.collectionId === preferredCollectionId,
  )
    ? preferredCollectionId
    : groupedCollections[0]?.collectionId ?? '';

  const activeCollection = groupedCollections.find(
    (group) => group.collectionId === activeCollectionId,
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

  async function handleUpdateQuantity(cardId: string, quantity: number) {
    if (!user) {
      return;
    }

    try {
      await updateUserCardQuantity(user.uid, cardId, quantity);
      setCards((currentCards) =>
        currentCards.map((card) =>
          card.id === cardId ? { ...card, quantity } : card,
        ),
      );
      setSelectedCard((currentCard) =>
        currentCard?.id === cardId ? { ...currentCard, quantity } : currentCard,
      );
    } catch (updateError) {
      setError(getFriendlyFirebaseError(updateError));
    }
  }

  const handlePriceQuoteLoaded = useCallback(
    async (cardId: string, priceQuote: PriceQuote) => {
      if (!user) {
        return;
      }

      try {
        await updateUserCardPriceQuote(user.uid, cardId, priceQuote);
      } catch (priceSaveError) {
        setError(getFriendlyFirebaseError(priceSaveError));
      }
    },
    [user],
  );
  const selectedCardId = selectedCard?.id;
  const handleSelectedCardPriceQuoteLoaded = useCallback(
    async (priceQuote: PriceQuote) => {
      if (!selectedCardId) {
        return;
      }

      await handlePriceQuoteLoaded(selectedCardId, priceQuote);
    },
    [handlePriceQuoteLoaded, selectedCardId],
  );

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

      {loading ? (
        <div className="panel-loader">
          <LoaderCircle className="spin" size={18} aria-hidden="true" />
          Carregando cartas...
        </div>
      ) : null}

      {!loading && cards.length === 0 ? <EmptyState /> : null}

      {!loading && cards.length > 0 && groupedCollections.length > 0 ? (
        <>
          {groupedCollections.length > 0 ? (
            <div className="dashboard-tabs" role="tablist" aria-label="Coleções">
              {groupedCollections.map((group) => (
                <button
                  aria-selected={group.collectionId === activeCollectionId}
                  className={`dashboard-tab ${
                    group.collectionId === activeCollectionId ? 'active' : ''
                  }`}
                  key={group.collectionId}
                  role="tab"
                  type="button"
                  onClick={() => setPreferredCollectionId(group.collectionId)}
                >
                  <span>{group.name}</span>
                  <small>
                    {group.totalCount ? (
                      <>{group.ownedCount}/{group.totalCount} · {group.completion}%</>
                    ) : (
                      <>{group.ownedCount}/— · —</>
                    )}
                  </small>
                </button>
              ))}
            </div>
          ) : null}

          <div className="dashboard-collection-summary">
            <span>
              {activeCollection?.ownedCount ?? cards.length} cartas nesta coleção
            </span>
            <strong>
              {activeCollection?.completion != null
                ? `${activeCollection.completion}% concluído`
                : '—'}
            </strong>
          </div>

          <CardGrid
            cards={activeCollection?.cards ?? []}
            removingId={removingId}
            onRemove={(cardId) => void handleRemove(cardId)}
            onSelect={setSelectedCard}
          />
        </>
      ) : null}

      {selectedCard ? (
        <CardDetailsModal
          key={selectedCard.id}
          card={selectedCard}
          quantity={selectedCard.quantity ?? 1}
          onClose={() => setSelectedCard(null)}
          onPriceQuoteLoaded={handleSelectedCardPriceQuoteLoaded}
          onUpdateQuantity={(quantity) => void handleUpdateQuantity(selectedCard.id, quantity)}
        />
      ) : null}
    </div>
  );
}
