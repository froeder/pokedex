const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2/options');
const admin = require('firebase-admin');
const { extractStructuredPriceVariants } = require('./priceParser');

admin.initializeApp();
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 5 });

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const UNAVAILABLE_CACHE_TTL_MS = 15 * 60 * 1000;
const PRICE_CACHE_VERSION = 2;

function ensureString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function timestampToIso(value) {
  if (!value) {
    return new Date().toISOString();
  }

  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value).toISOString();
}

function serializeQuote(quote, cached) {
  return {
    ...quote,
    cacheVersion: quote.cacheVersion ?? PRICE_CACHE_VERSION,
    cached,
    fetchedAt: timestampToIso(quote.fetchedAt),
    expiresAt: timestampToIso(quote.expiresAt),
  };
}

function buildLigaUrl(card) {
  const name = ensureString(card.searchName) || ensureString(card.name);
  const number = ensureString(card.number);
  const printedTotal = ensureString(card.printedTotal);
  const ligaSetCode = ensureString(card.ligaSetCode);
  const cardQuery =
    number && printedTotal ? `${name} (${number}/${printedTotal})` : name;

  const url = new URL('https://www.ligapokemon.com.br/');
  url.searchParams.set('card', cardQuery);
  url.searchParams.set('view', 'cards/card');

  if (ligaSetCode) {
    url.searchParams.set('ed', ligaSetCode);
  }

  if (number) {
    url.searchParams.set('num', number);
  }

  return url.toString();
}

async function fetchLigaPage(url) {
  const response = await fetch(url, {
    headers: {
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'accept-encoding': 'gzip, deflate, br',
      'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      referer: 'https://www.ligapokemon.com.br/',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'sec-fetch-site': 'same-origin',
      'upgrade-insecure-requests': '1',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new HttpsError(
      response.status === 404 ? 'not-found' : 'unavailable',
      `Liga Pokémon retornou HTTP ${response.status}.`,
      { url },
    );
  }

  return response.text();
}

function createUnavailableQuote(card, url, now, reason) {
  const cardId = ensureString(card?.id);
  const cardName = ensureString(card?.name);
  const collectionId = ensureString(card?.collectionId);

  return {
    cardId,
    cardName,
    collectionId,
    currency: 'BRL',
    source: 'Unavailable',
    url,
    cacheVersion: PRICE_CACHE_VERSION,
    unavailableReason: reason,
    fetchedAt: admin.firestore.Timestamp.fromMillis(now),
    expiresAt: admin.firestore.Timestamp.fromMillis(
      now + UNAVAILABLE_CACHE_TTL_MS,
    ),
    variants: [],
  };
}

function isRecoverableLigaError(error) {
  if (error instanceof HttpsError) {
    return [
      'deadline-exceeded',
      'internal',
      'not-found',
      'resource-exhausted',
      'unavailable',
    ].includes(error.code);
  }

  return error instanceof TypeError;
}

function pickPrimaryPrice(variants) {
  const variantWithAverage = variants.find(
    (variant) => typeof variant.average === 'number',
  );
  if (variantWithAverage) {
    return {
      price: variantWithAverage.average,
      priceType: 'average',
    };
  }

  const variantWithMinimum = variants.find(
    (variant) => typeof variant.minimum === 'number',
  );
  if (variantWithMinimum) {
    return {
      price: variantWithMinimum.minimum,
      priceType: 'minimum',
    };
  }

  return {
    price: undefined,
    priceType: undefined,
  };
}

exports.getCardMarketPrice = onCall(
  {
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'É necessário estar autenticado para consultar preços.',
      );
    }

    const card = request.data?.card;
    const cardId = ensureString(card?.id);
    const cardName = ensureString(card?.name);
    const collectionId = ensureString(card?.collectionId);

    if (!cardId || !cardName || !collectionId) {
      throw new HttpsError('invalid-argument', 'Dados da carta incompletos.');
    }

    const cacheRef = admin.firestore().collection('priceCache').doc(cardId);
    const cachedSnapshot = await cacheRef.get();
    const now = Date.now();

    if (cachedSnapshot.exists) {
      const cachedQuote = cachedSnapshot.data();
      const expiresAt = cachedQuote?.expiresAt?.toMillis?.() ?? 0;

      if (cachedQuote?.cacheVersion === PRICE_CACHE_VERSION && expiresAt > now) {
        return serializeQuote(cachedQuote, true);
      }
    }

    const url = buildLigaUrl(card);
    let quote;

    try {
      const html = await fetchLigaPage(url);
      const variants = extractStructuredPriceVariants(html, card);

      if (!variants.length) {
        throw new HttpsError(
          'not-found',
          'A Liga Pokémon não retornou cotação para esta carta.',
          { url },
        );
      }

      const primaryPrice = pickPrimaryPrice(variants);
      const fetchedAt = admin.firestore.Timestamp.fromMillis(now);
      const expiresAt = admin.firestore.Timestamp.fromMillis(now + CACHE_TTL_MS);
      quote = {
        cardId,
        cardName,
        collectionId,
        currency: 'BRL',
        source: 'LigaPokemon',
        url,
        cacheVersion: PRICE_CACHE_VERSION,
        fetchedAt,
        expiresAt,
        variants,
        ...primaryPrice,
      };
    } catch (priceError) {
      if (!isRecoverableLigaError(priceError)) {
        throw priceError;
      }

      quote = createUnavailableQuote(
        card,
        url,
        now,
        priceError instanceof Error
          ? priceError.message
          : 'Cotação indisponível na Liga Pokémon.',
      );
    }

    await cacheRef.set(quote, { merge: true });

    return serializeQuote(quote, false);
  },
);
