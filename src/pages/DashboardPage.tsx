import { Download, LoaderCircle, Plus, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CardDetailsModal } from '../components/CardDetailsModal';
import { CardGrid } from '../components/CardGrid';
import { EmptyState } from '../components/EmptyState';
import { useAuth } from '../hooks/useAuth';
import {
  loadCatalogCollections,
  loadCollectionCards,
} from '../services/catalogService';
import {
  removeUserCard,
  subscribeToUserCards,
  updateUserCardPriceQuote,
  updateUserCardQuantity,
} from '../services/collectionService';
import { getCardPrice } from '../services/priceService';
import type { CatalogCard, PriceQuote, TcgCollection, UserCard } from '../types';
import { getFriendlyFirebaseError } from '../utils/firebaseErrors';
import { formatBRL } from '../utils/formatters';
import { getCollectionPriceSummary, getQuoteUnitPrice } from '../utils/pricing';

type VisualExportCard = Pick<
  CatalogCard,
  'collectionName' | 'imageUrl' | 'name' | 'number' | 'printedTotal'
> & {
  unitPrice?: number;
};

type VisualExportSummaryItem = {
  label: string;
  value: number;
  note?: string;
};

type VisualExportGroup = {
  title: string;
  cards: VisualExportCard[];
  total?: number;
  note?: string;
};

function normalizeCollectionKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '');
}

function escapeCsvField(value: string | number) {
  const stringValue = String(value);

  if (!/[",\n\r]/.test(stringValue)) {
    return stringValue;
  }

  return `"${stringValue.replace(/"/g, '""')}"`;
}

function getExportFileName(
  collectionName: string,
  suffix: string,
  extension: 'csv' | 'html',
) {
  const normalizedName = collectionName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `pokedex-${normalizedName || 'colecao'}-${suffix}.${extension}`;
}

function escapeHtml(value: string | number) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCardArtworkUrl(card: Pick<CatalogCard, 'imageUrl'>) {
  if (!card.imageUrl) {
    return '';
  }

  if (/\.(webp|png|jpe?g)$/i.test(card.imageUrl)) {
    return card.imageUrl;
  }

  return `${card.imageUrl}/high.webp`;
}

function getCardNumberValue(value: string) {
  const numberMatch = value.match(/\d+/);

  return numberMatch ? Number(numberMatch[0]) : null;
}

function isSpecialCollectionCard(
  card: Pick<CatalogCard, 'number' | 'printedTotal'>,
) {
  const cardNumber = getCardNumberValue(card.number);
  const printedTotal = getCardNumberValue(card.printedTotal);

  if (cardNumber == null || printedTotal == null) {
    return false;
  }

  return cardNumber > printedTotal;
}

function sortCardsForExport<T extends Pick<CatalogCard, 'name' | 'number'>>(
  cards: T[],
) {
  return [...cards].sort(
    (first, second) =>
      first.number.localeCompare(second.number, 'pt-BR', { numeric: true }) ||
      first.name.localeCompare(second.name, 'pt-BR'),
  );
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results: R[] = [];
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    }),
  );

  return results;
}

function downloadCardsCsv(
  cards: Pick<CatalogCard, 'name' | 'number' | 'collectionName'>[],
  fileName: string,
) {
  const rows = [
    ['Nome', 'Numero', 'Colecao'],
    ...cards.map((card) => [card.name, card.number, card.collectionName]),
  ];
  const csv = rows
    .map((row) => row.map((cell) => escapeCsvField(cell)).join(','))
    .join('\n');
  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function downloadCardsHtml(
  cards: VisualExportCard[],
  fileName: string,
  title: string,
  summary?: {
    label: string;
    value: number;
    note?: string;
    items?: VisualExportSummaryItem[];
  },
  groups?: VisualExportGroup[],
) {
  const generatedAt = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date());
  const getCardsHtml = (nextCards: VisualExportCard[]) => nextCards
    .map(
      (card) => {
        const artworkUrl = getCardArtworkUrl(card);

        return `
        <article class="card">
          ${
            artworkUrl
              ? `<img src="${escapeHtml(artworkUrl)}" alt="${escapeHtml(card.name)}" loading="lazy">`
              : `<div class="image-placeholder">${escapeHtml(card.name)}</div>`
          }
          <div class="card-info">
            <strong>${escapeHtml(card.name)}</strong>
            <span>${escapeHtml(card.collectionName)} #${escapeHtml(card.number)}/${escapeHtml(card.printedTotal)}</span>
            ${
              typeof card.unitPrice === 'number'
                ? `<em>${escapeHtml(formatBRL(card.unitPrice))}</em>`
                : ''
            }
          </div>
        </article>`;
      },
    )
    .join('');
  const cardsHtml = getCardsHtml(cards);
  const groupedCardsHtml = groups
    ?.map(
      (group) => `
      <section class="card-group">
        <div class="group-heading">
          <div>
            <h2>${escapeHtml(group.title)}</h2>
            <p>${group.cards.length} cartas${group.note ? ` · ${escapeHtml(group.note)}` : ''}</p>
          </div>
          ${
            typeof group.total === 'number'
              ? `<strong>${escapeHtml(formatBRL(group.total))}</strong>`
              : ''
          }
        </div>
        <div class="grid">
          ${getCardsHtml(group.cards)}
        </div>
      </section>`,
    )
    .join('');
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color: #18212b;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    body {
      margin: 0;
      background: #f6f2ea;
    }

    .page {
      width: min(1120px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 42px;
    }

    header {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 22px;
      border-bottom: 1px solid #ded7ca;
      padding-bottom: 16px;
    }

    h1 {
      margin: 0 0 6px;
      color: #c43d3d;
      font-size: 1.85rem;
      line-height: 1.15;
    }

    p {
      margin: 0;
      color: #667085;
      font-size: 0.92rem;
      font-weight: 700;
    }

    button {
      min-height: 40px;
      border: 1px solid #c43d3d;
      border-radius: 8px;
      padding: 0 14px;
      background: #c43d3d;
      color: #ffffff;
      font: inherit;
      font-weight: 900;
      cursor: pointer;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
      gap: 12px;
    }

    .card-group {
      display: grid;
      gap: 12px;
      margin-top: 22px;
    }

    .card-group:first-of-type {
      margin-top: 0;
    }

    .group-heading {
      display: flex;
      align-items: end;
      justify-content: space-between;
      gap: 12px;
      break-inside: avoid;
      border: 1px solid #ded7ca;
      border-radius: 8px;
      padding: 12px 14px;
      background: #fffdf8;
    }

    h2 {
      margin: 0 0 4px;
      color: #18212b;
      font-size: 1.12rem;
    }

    .group-heading strong {
      color: #c43d3d;
      font-size: 1.12rem;
      white-space: nowrap;
    }

    .card {
      display: grid;
      gap: 8px;
      break-inside: avoid;
      border: 1px solid #ded7ca;
      border-radius: 8px;
      padding: 10px;
      background: #fffdf8;
    }

    img {
      width: 100%;
      aspect-ratio: 245 / 337;
      object-fit: contain;
      filter: drop-shadow(0 8px 10px rgb(24 33 43 / 16%));
    }

    .image-placeholder {
      display: grid;
      width: 100%;
      aspect-ratio: 245 / 337;
      place-items: center;
      border: 1px dashed #cfc7b9;
      border-radius: 8px;
      color: #667085;
      text-align: center;
      font-size: 0.86rem;
      font-weight: 800;
    }

    .card-info {
      display: grid;
      gap: 4px;
    }

    em {
      display: block;
      margin-top: 2px;
      color: #c43d3d;
      font-size: 0.82rem;
      font-style: normal;
      font-weight: 950;
    }

    .summary {
      display: grid;
      gap: 4px;
      margin-top: 22px;
      border: 1px solid #ded7ca;
      border-radius: 8px;
      padding: 16px;
      background: #fffdf8;
      break-inside: avoid;
    }

    .summary span {
      color: #667085;
      font-size: 0.86rem;
      font-weight: 850;
    }

    .summary strong {
      color: #c43d3d;
      font-size: 1.45rem;
    }

    .summary-list {
      display: grid;
      gap: 8px;
      margin-top: 8px;
    }

    .summary-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border-top: 1px solid #eee4d5;
      padding-top: 8px;
    }

    .summary-item strong {
      font-size: 1.08rem;
      white-space: nowrap;
    }

    .summary p {
      margin-top: 4px;
      font-size: 0.82rem;
    }

    strong {
      font-size: 0.86rem;
      line-height: 1.25;
    }

    span {
      color: #667085;
      font-size: 0.74rem;
      font-weight: 800;
      line-height: 1.3;
    }

    @media print {
      body {
        background: #ffffff;
      }

      .page {
        width: auto;
        padding: 0;
      }

      button {
        display: none;
      }

      .grid {
        grid-template-columns: repeat(5, 1fr);
        gap: 10px;
      }

      .card-group {
        margin-top: 14px;
      }

      .group-heading {
        padding: 8px 10px;
      }

      h2 {
        font-size: 0.95rem;
      }

      .card {
        gap: 6px;
        padding: 8px;
        border-radius: 6px;
      }

      strong {
        font-size: 0.78rem;
      }

      span {
        font-size: 0.68rem;
      }

      em {
        font-size: 0.72rem;
      }

      .summary {
        margin-top: 12px;
        padding: 10px;
      }
    }
  </style>
</head>
<body>
  <main class="page">
    <header>
      <div>
        <h1>${escapeHtml(title)}</h1>
        <p>${cards.length} cartas · gerado em ${escapeHtml(generatedAt)}</p>
      </div>
      <button type="button" onclick="window.print()">Imprimir / salvar PDF</button>
    </header>
    ${
      groupedCardsHtml
        ? groupedCardsHtml
        : `<section class="grid">
            ${cardsHtml}
          </section>`
    }
    ${
      summary
        ? `<section class="summary">
            <span>${escapeHtml(summary.label)}</span>
            <strong>${escapeHtml(formatBRL(summary.value))}</strong>
            ${
              summary.items?.length
                ? `<div class="summary-list">
                    ${summary.items
                      .map(
                        (item) => `
                        <div class="summary-item">
                          <span>${escapeHtml(item.label)}${item.note ? ` · ${escapeHtml(item.note)}` : ''}</span>
                          <strong>${escapeHtml(formatBRL(item.value))}</strong>
                        </div>`,
                      )
                      .join('')}
                  </div>`
                : ''
            }
            ${summary.note ? `<p>${escapeHtml(summary.note)}</p>` : ''}
          </section>`
        : ''
    }
  </main>
</body>
</html>`;
  const blob = new Blob([html], {
    type: 'text/html;charset=utf-8',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
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
  const [exportingMissingVisual, setExportingMissingVisual] = useState(false);
  const [syncingCollectionPrices, setSyncingCollectionPrices] = useState<{
    completed: number;
    failed: number;
    total: number;
  } | null>(null);
  const [loadedCatalogCollection, setLoadedCatalogCollection] = useState<{
    collectionId: string;
    collection: TcgCollection | null;
  } | null>(null);

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
        const ownedCount = new Set(group.cards.map((card) => card.id)).size;
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

  useEffect(() => {
    if (!activeCollectionId) {
      return undefined;
    }

    let ignore = false;

    loadCollectionCards(activeCollectionId)
      .then((collection) => {
        if (!ignore) {
          setLoadedCatalogCollection({
            collectionId: activeCollectionId,
            collection,
          });
        }
      })
      .catch(() => {
        if (!ignore) {
          setLoadedCatalogCollection({
            collectionId: activeCollectionId,
            collection: null,
          });
        }
      });

    return () => {
      ignore = true;
    };
  }, [activeCollectionId]);

  const activeCatalogCollection =
    loadedCatalogCollection?.collectionId === activeCollectionId
      ? loadedCatalogCollection.collection
      : null;
  const loadingActiveCatalog = Boolean(
    activeCollectionId &&
      loadedCatalogCollection?.collectionId !== activeCollectionId,
  );

  const ownedCardsForExport = useMemo(
    () => sortCardsForExport(activeCollection?.cards ?? []),
    [activeCollection],
  );

  const missingCardsForExport = useMemo(() => {
    const ownedIds = new Set(activeCollection?.cards.map((card) => card.id) ?? []);

    return sortCardsForExport(
      (activeCatalogCollection?.cards ?? []).filter(
        (card) => !ownedIds.has(card.id),
      ),
    );
  }, [activeCatalogCollection, activeCollection]);

  const activeCollectionName =
    activeCatalogCollection?.name ?? activeCollection?.name ?? 'Coleção';
  const activeCollectionPriceSummary = useMemo(
    () => getCollectionPriceSummary(activeCollection?.cards ?? []),
    [activeCollection],
  );

  function handleExportOwnedCards() {
    downloadCardsCsv(
      ownedCardsForExport,
      getExportFileName(activeCollectionName, 'tenho', 'csv'),
    );
  }

  function handleExportMissingCards() {
    downloadCardsCsv(
      missingCardsForExport,
      getExportFileName(activeCollectionName, 'faltantes', 'csv'),
    );
  }

  function handleExportOwnedCardsHtml() {
    downloadCardsHtml(
      ownedCardsForExport,
      getExportFileName(activeCollectionName, 'tenho-visual', 'html'),
      `Cartas que tenho - ${activeCollectionName}`,
    );
  }

  async function handleExportMissingCardsHtml() {
    setExportingMissingVisual(true);
    setError('');

    try {
      const pricedCards = await mapWithConcurrency(
        missingCardsForExport,
        4,
        async (card) => {
          try {
            const quote = await getCardPrice(card);
            return {
              ...card,
              unitPrice: getQuoteUnitPrice(quote),
            };
          } catch {
            return {
              ...card,
              unitPrice: undefined,
            };
          }
        },
      );
      const totalToComplete = pricedCards.reduce(
        (total, card) =>
          typeof card.unitPrice === 'number' ? total + card.unitPrice : total,
        0,
      );
      const commonCards = pricedCards.filter(
        (card) => !isSpecialCollectionCard(card),
      );
      const specialCards = pricedCards.filter(isSpecialCollectionCard);
      const commonTotal = commonCards.reduce(
        (total, card) =>
          typeof card.unitPrice === 'number' ? total + card.unitPrice : total,
        0,
      );
      const specialTotal = specialCards.reduce(
        (total, card) =>
          typeof card.unitPrice === 'number' ? total + card.unitPrice : total,
        0,
      );
      const commonUnquotedCount = commonCards.filter(
        (card) => typeof card.unitPrice !== 'number',
      ).length;
      const specialUnquotedCount = specialCards.filter(
        (card) => typeof card.unitPrice !== 'number',
      ).length;
      const unquotedCount = pricedCards.filter(
        (card) => typeof card.unitPrice !== 'number',
      ).length;

      downloadCardsHtml(
        pricedCards,
        getExportFileName(activeCollectionName, 'faltantes-visual', 'html'),
        `Cartas faltantes - ${activeCollectionName}`,
        {
          label: 'Total estimado para completar',
          value: totalToComplete,
          items: [
            {
              label: 'Faltantes comuns',
              value: commonTotal,
              note:
                commonUnquotedCount > 0
                  ? `${commonUnquotedCount} sem cotação`
                  : undefined,
            },
            {
              label: 'Faltantes especiais',
              value: specialTotal,
              note:
                specialUnquotedCount > 0
                  ? `${specialUnquotedCount} sem cotação`
                  : undefined,
            },
          ],
          note:
            unquotedCount > 0
              ? `${unquotedCount} carta(s) ficaram sem cotação.`
              : 'Cálculo usando o primeiro preço mínimo de cada carta.',
        },
        [
          {
            title: 'Comuns',
            cards: commonCards,
            total: commonTotal,
            note: 'numeração dentro do total da coleção',
          },
          {
            title: 'Especiais',
            cards: specialCards,
            total: specialTotal,
            note: 'numeração acima do total da coleção',
          },
        ],
      );
    } catch (exportError) {
      setError(getFriendlyFirebaseError(exportError));
    } finally {
      setExportingMissingVisual(false);
    }
  }

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
        setCards((currentCards) =>
          currentCards.map((card) =>
            card.id === cardId ? { ...card, priceQuote } : card,
          ),
        );
        setSelectedCard((currentCard) =>
          currentCard?.id === cardId
            ? { ...currentCard, priceQuote }
            : currentCard,
        );
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

  async function handleSyncCollectionPrices() {
    if (!user || !activeCollection?.cards.length || syncingCollectionPrices) {
      return;
    }

    const cardsToSync = [...activeCollection.cards];

    setError('');
    setSyncingCollectionPrices({
      completed: 0,
      failed: 0,
      total: cardsToSync.length,
    });

    let failed = 0;

    await mapWithConcurrency(cardsToSync, 3, async (card) => {
      try {
        const priceQuote = await getCardPrice(card, { forceRefresh: true });
        await updateUserCardPriceQuote(user.uid, card.id, priceQuote);

        setCards((currentCards) =>
          currentCards.map((currentCard) =>
            currentCard.id === card.id
              ? { ...currentCard, priceQuote }
              : currentCard,
          ),
        );
        setSelectedCard((currentCard) =>
          currentCard?.id === card.id
            ? { ...currentCard, priceQuote }
            : currentCard,
        );
      } catch {
        failed += 1;
      } finally {
        setSyncingCollectionPrices((currentSync) =>
          currentSync
            ? {
                ...currentSync,
                completed: currentSync.completed + 1,
                failed,
              }
            : currentSync,
        );
      }
    });

    setSyncingCollectionPrices(null);

    if (failed > 0) {
      setError(`${failed} carta(s) não tiveram a cotação sincronizada.`);
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
            <div className="dashboard-collection-metrics">
              <span>
                {activeCollection?.ownedCount ?? cards.length} cartas nesta coleção
              </span>
              <strong>
                {activeCollection?.completion != null
                  ? `${activeCollection.completion}% concluído`
                  : '—'}
              </strong>
            </div>

            <div className="dashboard-export-actions">
              <button
                className="secondary-action compact"
                type="button"
                disabled={
                  !activeCollection?.cards.length ||
                  Boolean(syncingCollectionPrices)
                }
                onClick={() => void handleSyncCollectionPrices()}
              >
                {syncingCollectionPrices ? (
                  <LoaderCircle className="spin" size={16} aria-hidden="true" />
                ) : (
                  <RefreshCw size={16} aria-hidden="true" />
                )}
                {syncingCollectionPrices
                  ? `Sincronizando ${syncingCollectionPrices.completed}/${syncingCollectionPrices.total}`
                  : 'Sincronizar cotações'}
              </button>
              <button
                className="secondary-action compact"
                type="button"
                disabled={ownedCardsForExport.length === 0}
                onClick={handleExportOwnedCards}
              >
                <Download size={16} aria-hidden="true" />
                Exportar tenho
              </button>
              <button
                className="secondary-action compact"
                type="button"
                disabled={ownedCardsForExport.length === 0}
                onClick={handleExportOwnedCardsHtml}
              >
                <Download size={16} aria-hidden="true" />
                Visual tenho
              </button>
              <button
                className="secondary-action compact"
                type="button"
                disabled={loadingActiveCatalog || !activeCatalogCollection}
                onClick={handleExportMissingCards}
              >
                <Download size={16} aria-hidden="true" />
                Exportar faltantes
              </button>
              <button
                className="secondary-action compact"
                type="button"
                disabled={
                  loadingActiveCatalog ||
                  !activeCatalogCollection ||
                  exportingMissingVisual
                }
                onClick={() => void handleExportMissingCardsHtml()}
              >
                {exportingMissingVisual ? (
                  <LoaderCircle className="spin" size={16} aria-hidden="true" />
                ) : (
                  <Download size={16} aria-hidden="true" />
                )}
                {exportingMissingVisual ? 'Cotando...' : 'Visual faltantes'}
              </button>
            </div>
          </div>

          <CardGrid
            cards={activeCollection?.cards ?? []}
            removingId={removingId}
            onRemove={(cardId) => void handleRemove(cardId)}
            onSelect={setSelectedCard}
          />

          <section
            className="collection-value-summary"
            aria-label="Valor total da coleção"
          >
            <div>
              <span>Total sem repetidas</span>
              <strong>
                {formatBRL(activeCollectionPriceSummary.totalUnique)}
              </strong>
            </div>
            <div>
              <span>Total contando repetidas</span>
              <strong>
                {formatBRL(activeCollectionPriceSummary.totalWithCopies)}
              </strong>
            </div>
            <p>
              {activeCollectionPriceSummary.unquotedCardCount > 0
                ? `${activeCollectionPriceSummary.unquotedCardCount} carta(s) sem cotação salva`
                : 'Todas as cartas desta coleção têm cotação salva'}
            </p>
          </section>
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
