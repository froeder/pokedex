import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';
import type { CatalogCard, PriceQuote } from '../types';
import {
  getFirebaseErrorCode,
  isPermissionError,
} from '../utils/firebaseErrors';

const CACHE_TTL_MS = 44 * 60 * 60 * 1000;
const PRICE_CACHE_VERSION = 4;
const UNAVAILABLE_TTL_MS = 15 * 60 * 1000;
const FUNCTION_UNAVAILABLE_KEY = 'pokedex:price-function-unavailable-until';

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

export function isPriceQuoteFresh(
  quote: Pick<PriceQuote, 'expiresAt' | 'fetchedAt'>,
) {
  const expiresAt = quote.expiresAt
    ? new Date(quote.expiresAt).getTime()
    : new Date(quote.fetchedAt).getTime() + CACHE_TTL_MS;

  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
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
    cacheVersion: PRICE_CACHE_VERSION,
    fetchedAt,
    expiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    variants: [
      {
        label: 'Estimativa local',
        minimum,
        average,
        maximum,
      },
    ],
  };
}

function createUnavailableQuote(
  card: CatalogCard,
  error?: unknown,
): PriceQuote {
  const fetchedAt = new Date().toISOString();
  const message = error instanceof Error ? error.message : undefined;

  return {
    cardId: card.id,
    cardName: card.name,
    collectionId: card.collectionId,
    currency: 'BRL',
    source: 'Unavailable',
    cached: false,
    cacheVersion: PRICE_CACHE_VERSION,
    unavailableReason:
      message ?? 'A Liga Pokémon não retornou cotação para esta carta.',
    fetchedAt,
    expiresAt: new Date(Date.now() + UNAVAILABLE_TTL_MS).toISOString(),
    variants: [],
  };
}

function isRecoverablePriceError(error: unknown) {
  const code = getFirebaseErrorCode(error);
  if (
    code &&
    [
      'functions/deadline-exceeded',
      'functions/internal',
      'functions/not-found',
      'functions/permission-denied',
      'functions/resource-exhausted',
      'functions/unavailable',
    ].includes(code)
  ) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  return /HTTP\s*(403|429|5\d\d)|Liga Pokémon|cotação/i.test(message);
}

function isPriceFunctionCoolingDown() {
  const unavailableUntil = Number(
    window.sessionStorage.getItem(FUNCTION_UNAVAILABLE_KEY),
  );

  return Number.isFinite(unavailableUntil) && Date.now() < unavailableUntil;
}

function rememberUnavailablePriceFunction() {
  window.sessionStorage.setItem(
    FUNCTION_UNAVAILABLE_KEY,
    String(Date.now() + UNAVAILABLE_TTL_MS),
  );
}

export async function getCardPrice(card: CatalogCard): Promise<PriceQuote> {
  if (!db || !functions) {
    return createDemoQuote(card);
  }

  try {
    const cacheSnapshot = await getDoc(doc(db, 'priceCache', card.id));
    if (cacheSnapshot.exists()) {
      const cachedQuote = normalizeQuote(cacheSnapshot.data());

      if (
        cachedQuote.cacheVersion === PRICE_CACHE_VERSION &&
        isPriceQuoteFresh(cachedQuote)
      ) {
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

  if (isPriceFunctionCoolingDown()) {
    return createUnavailableQuote(
      card,
      new Error('A função de cotação está temporariamente indisponível.'),
    );
  }

  try {
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
        tcgdexSetId: card.tcgdexSetId,
      },
    });

    return normalizeQuote(response.data as Record<string, unknown>);
  } catch (error) {
    if (isRecoverablePriceError(error)) {
      rememberUnavailablePriceFunction();
      return createUnavailableQuote(card, error);
    }

    throw error;
  }
}
