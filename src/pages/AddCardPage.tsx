import {
  Check,
  CircleCheck,
  Info,
  LoaderCircle,
  Plus,
  Search,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CardArtwork } from '../components/CardArtwork';
import { CardDetailsModal } from '../components/CardDetailsModal';
import { getTypeClass, getTypeLabel } from '../data/catalog';
import { useAuth } from '../hooks/useAuth';
import {
  hydrateCatalogCard,
  loadCatalogCollections,
  loadCollectionCards,
} from '../services/catalogService';
import {
  addUserCard,
  subscribeToUserCards,
} from '../services/collectionService';
import type { CatalogCard, TcgCollection } from '../types';
import { getFriendlyFirebaseError } from '../utils/firebaseErrors';

function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getCollectionText(collection: TcgCollection) {
  return normalizeSearch(
    [
      collection.name,
      collection.shortName,
      collection.serie,
      collection.releaseYear,
      collection.ligaSetCode,
    ].join(' '),
  );
}

function getCardText(card: CatalogCard) {
  return normalizeSearch(
    [
      card.name,
      card.searchName,
      card.number,
      card.printedTotal,
      card.rarity,
      card.types.join(' '),
    ].join(' '),
  );
}

export function AddCardPage() {
  const { user } = useAuth();
  const [collections, setCollections] = useState<TcgCollection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [activeCollection, setActiveCollection] =
    useState<TcgCollection | null>(null);
  const [collectionQuery, setCollectionQuery] = useState('');
  const [cardQuery, setCardQuery] = useState('');
  const [selectedCard, setSelectedCard] = useState<CatalogCard | null>(null);
  const [ownedQuantities, setOwnedQuantities] = useState<Record<string, number>>(
    {},
  );
  const [cardQuantities, setCardQuantities] = useState<Record<string, number>>(
    {},
  );
  const [addingId, setAddingId] = useState<string>();
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [loadingCards, setLoadingCards] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ id: number; message: string } | null>(
    null,
  );
  const cardSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setToast(null);
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    let ignore = false;

    loadCatalogCollections()
      .then((nextCollections) => {
        if (ignore) {
          return;
        }

        const firstCollectionId = nextCollections[0]?.id ?? '';
        setCollections(nextCollections);
        setSelectedCollectionId((currentId) => {
          if (currentId) {
            return currentId;
          }

          return firstCollectionId;
        });
        setLoadingCards(Boolean(firstCollectionId));
      })
      .catch((catalogError: unknown) => {
        if (!ignore) {
          const message =
            catalogError instanceof Error
              ? catalogError.message
              : 'Não foi possível carregar o catálogo.';
          setError(message);
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoadingCollections(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    return subscribeToUserCards(
      user.uid,
      (cards) => {
        setOwnedQuantities(
          Object.fromEntries(cards.map((card) => [card.id, card.quantity ?? 1])),
        );
      },
      (subscriptionError) => {
        setError(getFriendlyFirebaseError(subscriptionError));
      },
    );
  }, [user]);

  useEffect(() => {
    if (!selectedCollectionId) {
      return undefined;
    }

    let ignore = false;

    loadCollectionCards(selectedCollectionId)
      .then((collection) => {
        if (!ignore) {
          setActiveCollection(collection);
        }
      })
      .catch((collectionError: unknown) => {
        if (!ignore) {
          const message =
            collectionError instanceof Error
              ? collectionError.message
              : 'Não foi possível carregar as cartas da coleção.';
          setError(message);
          setActiveCollection(null);
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoadingCards(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [selectedCollectionId]);

  const selectedCollection = useMemo(
    () =>
      activeCollection ??
      collections.find((collection) => collection.id === selectedCollectionId) ??
      null,
    [activeCollection, collections, selectedCollectionId],
  );

  const filteredCollections = useMemo(() => {
    const normalizedQuery = normalizeSearch(collectionQuery.trim());
    const nextCollections = [...collections].sort((first, second) =>
      first.name.localeCompare(second.name, 'pt-BR'),
    );

    if (!normalizedQuery) {
      return nextCollections;
    }

    return nextCollections.filter((collection) =>
      getCollectionText(collection).includes(normalizedQuery),
    );
  }, [collectionQuery, collections]);

  const filteredCards = useMemo(() => {
    const cards = activeCollection?.cards ?? [];
    const normalizedQuery = normalizeSearch(cardQuery.trim());
    const nextCards = [...cards].sort((first, second) =>
      first.name.localeCompare(second.name, 'pt-BR'),
    );

    if (!normalizedQuery) {
      return nextCards;
    }

    return nextCards.filter((card) => getCardText(card).includes(normalizedQuery));
  }, [activeCollection, cardQuery]);

  async function handleAddCard(card: CatalogCard) {
    if (!user || addingId) {
      return;
    }

    const normalizedQuantity = Math.max(
      1,
      Math.floor(cardQuantities[card.id] || 1),
    );

    setAddingId(card.id);
    setError('');

    try {
      const hydratedCard = await hydrateCatalogCard(card);
      await addUserCard(user.uid, hydratedCard, normalizedQuantity);
      setToast({
        id: Date.now(),
        message:
          normalizedQuantity > 1
            ? `${normalizedQuantity} cartas de ${hydratedCard.name} adicionadas.`
            : `${hydratedCard.name} adicionada à coleção.`,
      });
      setCardQuery('');
      window.requestAnimationFrame(() => {
        cardSearchInputRef.current?.focus();
      });
      setOwnedQuantities((currentQuantities) => ({
        ...currentQuantities,
        [card.id]: (currentQuantities[card.id] ?? 0) + normalizedQuantity,
      }));
    } catch (addError) {
      setError(getFriendlyFirebaseError(addError));
    } finally {
      cardSearchInputRef.current?.focus();
      setAddingId(undefined);
    }
  }

  function handleSelectCollection(collectionId: string) {
    if (collectionId === selectedCollectionId) {
      return;
    }

    setActiveCollection(null);
    setCardQuery('');
    setError('');
    setLoadingCards(true);
    setSelectedCollectionId(collectionId);
  }

  return (
    <div className="page-stack">
      {toast ? (
        <div className="toast-region" role="status" aria-live="polite">
          <div className="app-toast" key={toast.id}>
            <CircleCheck size={20} aria-hidden="true" />
            <span>{toast.message}</span>
          </div>
        </div>
      ) : null}

      <section className="page-header">
        <div>
          <span className="eyebrow">Catálogo</span>
          <h1>Adicionar carta</h1>
        </div>
      </section>

      {error ? <div className="form-error">{error}</div> : null}

      <section className="catalog-layout">
        <aside className="collection-panel" aria-labelledby="collection-title">
          <div className="collection-panel-header">
            <div>
              <span className="eyebrow">Coleção</span>
              <strong id="collection-title">{selectedCollection?.shortName || selectedCollection?.name || 'Selecione'}</strong>
            </div>
            <span>{collections.length} no catálogo</span>
          </div>

          <label className="search-field collection-search">
            <Search size={18} aria-hidden="true" />
            <input
              aria-label="Buscar coleções"
              placeholder="Buscar coleção"
              type="search"
              value={collectionQuery}
              onChange={(event) => setCollectionQuery(event.target.value)}
            />
          </label>

          <label className="collection-select-wrapper">
            <span className="sr-only">Selecionar coleção</span>
            <div className="collection-select-shell">
              <select
                className="collection-select"
                value={selectedCollectionId}
                onChange={(event) => handleSelectCollection(event.target.value)}
              >
                {loadingCollections ? (
                  <option value="">Carregando coleções...</option>
                ) : null}

                {!loadingCollections && filteredCollections.length === 0 ? (
                  <option value="">Nenhuma coleção encontrada</option>
                ) : null}

                {filteredCollections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.shortName || collection.name} · {collection.serie} · {collection.releaseYear}
                  </option>
                ))}
              </select>
              {selectedCollection?.symbolUrl ? (
                <img
                  className="collection-select-symbol"
                  src={`${selectedCollection.symbolUrl}.webp`}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <span className="collection-select-symbol collection-select-placeholder" />
              )}
            </div>
          </label>
        </aside>

        <section className="catalog-panel" aria-live="polite">
          <div className="catalog-toolbar">
            <div>
              <span className="eyebrow">
                {selectedCollection?.serie ?? 'Coleção'}
              </span>
              <h2>{selectedCollection?.name ?? 'Selecione uma coleção'}</h2>
            </div>

            <label className="search-field">
              <Search size={18} aria-hidden="true" />
              <input
                ref={cardSearchInputRef}
                aria-label="Buscar cartas"
                disabled={!activeCollection || loadingCards}
                placeholder="Buscar carta ou número"
                type="search"
                value={cardQuery}
                onChange={(event) => setCardQuery(event.target.value)}
              />
            </label>
          </div>

          {selectedCollection ? (
            <div className="catalog-summary">
              <span>
                {selectedCollection.cardCount} cartas ·{' '}
                {selectedCollection.ligaSetCode}
              </span>
              <span>{filteredCards.length} exibidas</span>
            </div>
          ) : null}

          {loadingCards ? (
            <div className="panel-loader">Carregando cartas...</div>
          ) : null}

          {!loadingCards && activeCollection && filteredCards.length === 0 ? (
            <div className="empty-state catalog-empty">
              <div className="empty-icon">
                <Search size={26} aria-hidden="true" />
              </div>
              <h2>Nenhuma carta encontrada</h2>
              <p>Tente buscar por nome, número ou raridade.</p>
            </div>
          ) : null}

          {!loadingCards && filteredCards.length > 0 ? (
            <div className="catalog-card-list">
              {filteredCards.map((card) => {
                const ownedQuantity = ownedQuantities[card.id] ?? 0;
                const isAdded = ownedQuantity > 0;
                const isAdding = addingId === card.id;

                return (
                  <article className="catalog-card" key={card.id}>
                    <button
                      className="catalog-card-open"
                      type="button"
                      onClick={() => setSelectedCard(card)}
                    >
                      <CardArtwork card={card} />

                      <div className="catalog-card-copy">
                        <div>
                          <h3>{card.name}</h3>
                          <p>
                            #{card.number}/{card.printedTotal}
                            {card.rarity ? ` · ${card.rarity}` : ''}
                          </p>
                        </div>

                        {card.types.length ? (
                          <div className="type-list" aria-label="Tipo">
                            {card.types.map((type) => (
                              <span
                                className={`type-pill type-${getTypeClass(type)}`}
                                key={type}
                              >
                                {getTypeLabel(type)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <span className="catalog-card-hint">
                        <Info size={15} aria-hidden="true" />
                        Ver detalhes
                      </span>
                    </button>

                    <div className="catalog-card-actions">
                      <label className="quantity-field">
                        <span>Qtd.</span>
                        <input
                          aria-label={`Quantidade de ${card.name}`}
                          min="1"
                          step="1"
                          type="number"
                          value={cardQuantities[card.id] ?? 1}
                          onChange={(event) => {
                            const nextValue = Number.parseInt(
                              event.target.value || '1',
                              10,
                            );
                            setCardQuantities((currentQuantities) => ({
                              ...currentQuantities,
                              [card.id]:
                                Number.isFinite(nextValue) && nextValue > 0
                                  ? nextValue
                                  : 1,
                            }));
                          }}
                        />
                      </label>

                      <button
                        className={`secondary-action ${isAdded ? 'success' : ''}`}
                        disabled={isAdding}
                        type="button"
                        onClick={() => void handleAddCard(card)}
                      >
                        {isAdding ? (
                          <LoaderCircle
                            className="spin"
                            size={18}
                            aria-hidden="true"
                          />
                        ) : isAdded ? (
                          <Check size={18} aria-hidden="true" />
                        ) : (
                          <Plus size={18} aria-hidden="true" />
                        )}
                        {isAdding
                          ? 'Adicionando...'
                          : isAdded
                            ? 'Adicionar mais'
                            : 'Adicionar'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      </section>

      {selectedCard ? (
        <CardDetailsModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
        />
      ) : null}
    </div>
  );
}
