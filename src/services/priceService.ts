import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';
import type { CatalogCard, PriceQuote } from '../types';
import { isPermissionError } from '../utils/firebaseErrors';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type FirestoreTimestamp = {
  toDate?: () => Date;
  seconds?: number;
};

function toIsoDate(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  const timestamp = value as FirestoreTimestamp | undefined;
  if (timestamp?.toDate) {
    return timestamp.toDate().toISOString();
  }

  if (typeof timestamp?.seconds === 'number') {
    return new Date(timestamp.seconds * 1000).toISOString();
  }

  return new Date().toISOString();
}

function normalizeQuote(rawQuote: Record<string, unknown>): PriceQuote {
  return {
    ...(rawQuote as Omit<PriceQuote, 'fetchedAt'>),
    fetchedAt: toIsoDate(rawQuote.fetchedAt),
    expiresAt: rawQuote.expiresAt ? toIsoDate(rawQuote.expiresAt) : undefined,
  };
}

function isFresh(fetchedAt: string) {
  return Date.now() - new Date(fetchedAt).getTime() < CACHE_TTL_MS;
}

function createDemoQuote(card: CatalogCard): PriceQuote {
  const seed = [...card.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const minimum = Number(((seed % 90) + 4.9).toFixed(2));
  const average = Number((minimum * 1.42).toFixed(2));
  const maximum = Number((average * 1.75).toFixed(2));
  const fetchedAt = new Date().toISOString();

  return {
    cardId: card.id,
    cardName: card.name,
    collectionId: card.collectionId,
    currency: 'BRL',
    source: 'Demo',
    price: average,
    priceType: 'average',
    cached: false,
    fetchedAt,
    expiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    variants: [
      {
        label: 'Referencia local',
        minimum,
        average,
        maximum,
      },
    ],
  };
}

export async function getCardPrice(card: CatalogCard): Promise<PriceQuote> {
  if (!db || !functions) {
    return createDemoQuote(card);
  }

  try {
    const cacheSnapshot = await getDoc(doc(db, 'priceCache', card.id));
    if (cacheSnapshot.exists()) {
      const cachedQuote = normalizeQuote(cacheSnapshot.data());

      if (isFresh(cachedQuote.fetchedAt)) {
        return {
          ...cachedQuote,
          cached: true,
        };
      }
    }
  } catch (error) {
    if (!isPermissionError(error)) {
      throw error;
    }
  }

  const getMarketPrice = httpsCallable(functions, 'getCardMarketPrice');
  const response = await getMarketPrice({
    card: {
      id: card.id,
      name: card.name,
      searchName: card.searchName,
      collectionId: card.collectionId,
      collectionName: card.collectionName,
      ligaSetCode: card.ligaSetCode,
      number: card.number,
      printedTotal: card.printedTotal,
    },
  });

  return normalizeQuote(response.data as Record<string, unknown>);
}
