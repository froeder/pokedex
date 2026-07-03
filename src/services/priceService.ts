import { doc, getDoc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase/config';
import type { CatalogCard, PriceQuote, PriceVariant } from '../types';
import {
  getFirebaseErrorCode,
  isPermissionError,
} from '../utils/firebaseErrors';

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PRICE_CACHE_VERSION = 4;
const UNAVAILABLE_TTL_MS = 15 * 60 * 1000;
const FUNCTION_UNAVAILABLE_KEY = 'pokedex:price-function-unavailable-until';
const USE_LIGA_PRICE_API = false;
const TCGDEX_API_URL = 'https://api.tcgdex.net/v2';
const FRANKFURTER_API_URL = 'https://api.frankfurter.dev/v2';

type ExchangeCurrency = 'EUR' | 'USD';

type FirestoreTimestamp = {
  toDate?: () => Date;
  seconds?: number;
};

type ExchangeRateCacheEntry = {
  rate: number;
  expiresAt: number;
};

type FrankfurterRateResponse = {
  rate?: number;
};

type TcgDexCardmarketPricing = {
  unit?: string;
  updated?: string;
  avg?: number;
  low?: number;
  trend?: number;
  avg1?: number;
  avg7?: number;
  avg30?: number;
  'avg-holo'?: number;
  'low-holo'?: number;
  'trend-holo'?: number;
  'avg1-holo'?: number;
  'avg7-holo'?: number;
  'avg30-holo'?: number;
};

type TcgDexTcgPlayerVariant = {
  lowPrice?: number;
  midPrice?: number;
  highPrice?: number;
  marketPrice?: number;
  directLowPrice?: number;
};

type TcgDexTcgPlayerPricing = {
  unit?: string;
  updated?: string;
  [variant: string]: string | TcgDexTcgPlayerVariant | undefined;
};

type TcgDexCardDetail = {
  id?: string;
  name?: string;
  pricing?: {
    cardmarket?: TcgDexCardmarketPricing;
    tcgplayer?: TcgDexTcgPlayerPricing;
  };
};

const exchangeRateCache = new Map<ExchangeCurrency, ExchangeRateCacheEntry>();

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

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Não foi possível carregar ${url}.`);
  }

  return response.json() as Promise<T>;
}

export function isPriceQuoteFresh(
  quote: Pick<PriceQuote, 'expiresAt' | 'fetchedAt'>,
) {
  const expiresAt = quote.expiresAt
    ? new Date(quote.expiresAt).getTime()
    : new Date(quote.fetchedAt).getTime() + CACHE_TTL_MS;

  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

export function canReusePriceQuote(
  quote: Pick<PriceQuote, 'expiresAt' | 'fetchedAt' | 'source'>,
) {
  const reusableSource =
    quote.source === 'LigaPokemon' ||
    quote.source === 'TCGdex' ||
    quote.source === 'Demo';

  return reusableSource && isPriceQuoteFresh(quote);
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

function convertToBRL(value: number | undefined, rate: number) {
  if (typeof value !== 'number') {
    return undefined;
  }

  return Number((value * rate).toFixed(2));
}

function hasQuotedValue(variant: PriceVariant) {
  return (
    typeof variant.minimum === 'number' ||
    typeof variant.average === 'number' ||
    typeof variant.maximum === 'number'
  );
}

function pickPrimaryPrice(variants: PriceVariant[]) {
  const variantWithAverage = variants.find(
    (variant) => typeof variant.average === 'number',
  );

  if (variantWithAverage?.average) {
    return {
      price: variantWithAverage.average,
      priceType: 'average' as const,
    };
  }

  const variantWithMinimum = variants.find(
    (variant) => typeof variant.minimum === 'number',
  );

  if (variantWithMinimum?.minimum) {
    return {
      price: variantWithMinimum.minimum,
      priceType: 'minimum' as const,
    };
  }

  return {
    price: undefined,
    priceType: undefined,
  };
}

function getTcgDexCardUrl(card: CatalogCard, language: string) {
  const tcgdexSetId = card.tcgdexSetId ?? card.collectionId;

  return `${TCGDEX_API_URL}/${language}/sets/${encodeURIComponent(
    tcgdexSetId,
  )}/${encodeURIComponent(card.number)}`;
}

async function getExchangeRate(currency: ExchangeCurrency) {
  const cachedRate = exchangeRateCache.get(currency);

  if (cachedRate && Date.now() < cachedRate.expiresAt) {
    return cachedRate.rate;
  }

  const response = await fetchJson<FrankfurterRateResponse>(
    `${FRANKFURTER_API_URL}/rate/${currency}/BRL`,
  );

  if (typeof response.rate !== 'number') {
    throw new Error(`Frankfurter não retornou câmbio ${currency}/BRL.`);
  }

  exchangeRateCache.set(currency, {
    rate: response.rate,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return response.rate;
}

async function fetchTcgDexCard(card: CatalogCard) {
  const preferredLanguage = card.imageUrl.includes('/pt/') ? 'pt' : 'en';
  const languages = [...new Set([preferredLanguage, 'en'])];
  let lastError: unknown;

  for (const language of languages) {
    const url = getTcgDexCardUrl(card, language);

    try {
      return {
        detail: await fetchJson<TcgDexCardDetail>(url),
        url,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Não foi possível consultar a TCGdex.');
}

async function getCardmarketVariants(
  pricing: TcgDexCardmarketPricing | undefined,
) {
  if (!pricing) {
    return [];
  }

  const rate = await getExchangeRate('EUR');
  const variants: PriceVariant[] = [
    {
      label: 'Cardmarket',
      minimum: convertToBRL(pricing.low, rate),
      average: convertToBRL(
        pricing.trend ?? pricing.avg ?? pricing.avg30,
        rate,
      ),
    },
    {
      label: 'Cardmarket Holo',
      minimum: convertToBRL(pricing['low-holo'], rate),
      average: convertToBRL(
        pricing['trend-holo'] ?? pricing['avg-holo'] ?? pricing['avg30-holo'],
        rate,
      ),
    },
  ];

  return variants.filter(hasQuotedValue);
}

function isTcgPlayerVariant(
  value: string | TcgDexTcgPlayerVariant | undefined,
): value is TcgDexTcgPlayerVariant {
  return Boolean(value && typeof value === 'object');
}

function getTcgPlayerVariantLabel(key: string) {
  const labels: Record<string, string> = {
    normal: 'TCGplayer Normal',
    holofoil: 'TCGplayer Holo',
    holo: 'TCGplayer Holo',
    reverse: 'TCGplayer Reverso',
    'reverse-holofoil': 'TCGplayer Reverso',
    reverseHolofoil: 'TCGplayer Reverso',
  };

  return labels[key] ?? `TCGplayer ${key}`;
}

async function getTcgPlayerVariants(
  pricing: TcgDexTcgPlayerPricing | undefined,
) {
  if (!pricing) {
    return [];
  }

  const rate = await getExchangeRate('USD');
  const variants: PriceVariant[] = [];

  for (const [key, value] of Object.entries(pricing)) {
    if (!isTcgPlayerVariant(value)) {
      continue;
    }

    variants.push({
      label: getTcgPlayerVariantLabel(key),
      minimum: convertToBRL(value.lowPrice ?? value.directLowPrice, rate),
      average: convertToBRL(value.marketPrice ?? value.midPrice, rate),
      maximum: convertToBRL(value.highPrice, rate),
    });
  }

  return variants.filter(hasQuotedValue);
}

function getLatestIsoDate(...values: Array<string | undefined>) {
  const latest = values
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter(Number.isFinite)
    .sort((first, second) => second - first)[0];

  return typeof latest === 'number'
    ? new Date(latest).toISOString()
    : new Date().toISOString();
}

async function getTcgDexPriceQuote(
  card: CatalogCard,
): Promise<PriceQuote | null> {
  const { detail, url } = await fetchTcgDexCard(card);
  const pricing = detail.pricing;

  if (!pricing) {
    return null;
  }

  const [cardmarketResult, tcgplayerResult] = await Promise.allSettled([
    getCardmarketVariants(pricing.cardmarket),
    getTcgPlayerVariants(pricing.tcgplayer),
  ]);
  const variants = [
    ...(cardmarketResult.status === 'fulfilled' ? cardmarketResult.value : []),
    ...(tcgplayerResult.status === 'fulfilled' ? tcgplayerResult.value : []),
  ];

  if (!variants.length) {
    return null;
  }

  const primaryPrice = pickPrimaryPrice(variants);
  const fetchedAt = getLatestIsoDate(
    pricing.cardmarket?.updated,
    pricing.tcgplayer?.updated,
  );

  return {
    cardId: card.id,
    cardName: detail.name ?? card.name,
    collectionId: card.collectionId,
    currency: 'BRL',
    source: 'TCGdex',
    url,
    cached: false,
    cacheVersion: PRICE_CACHE_VERSION,
    fetchedAt,
    expiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    variants,
    ...primaryPrice,
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

async function savePriceQuoteToCache(cardId: string, quote: PriceQuote) {
  if (!db) {
    return;
  }

  try {
    await setDoc(
      doc(db, 'priceCache', cardId),
      {
        ...quote,
        cached: Boolean(quote.cached),
        fetchedAt: quote.fetchedAt,
        expiresAt: quote.expiresAt,
      },
      { merge: true },
    );
  } catch {
    // Ignore cache persistence errors and keep the UI usable.
  }
}

export async function getCardPrice(card: CatalogCard): Promise<PriceQuote> {
  if (!db || !functions) {
    try {
      return (await getTcgDexPriceQuote(card)) ?? createDemoQuote(card);
    } catch {
      return createDemoQuote(card);
    }
  }

  try {
    const cacheSnapshot = await getDoc(doc(db, 'priceCache', card.id));
    if (cacheSnapshot.exists()) {
      const cachedQuote = normalizeQuote(cacheSnapshot.data());

      if (
        cachedQuote.cacheVersion === PRICE_CACHE_VERSION &&
        canReusePriceQuote(cachedQuote)
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

  try {
    const tcgDexQuote = await getTcgDexPriceQuote(card);

    if (tcgDexQuote) {
      await savePriceQuoteToCache(card.id, tcgDexQuote);
      return tcgDexQuote;
    }
  } catch {
    return createDemoQuote(card);
  }

  if (!USE_LIGA_PRICE_API || isPriceFunctionCoolingDown()) {
    return createDemoQuote(card);
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

    const normalizedQuote = normalizeQuote(
      response.data as Record<string, unknown>,
    );
    await savePriceQuoteToCache(card.id, normalizedQuote);

    return normalizedQuote;
  } catch (error) {
    if (isRecoverablePriceError(error)) {
      rememberUnavailablePriceFunction();
      return createDemoQuote(card);
    }

    throw error;
  }
}
