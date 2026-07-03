const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2/options');
const admin = require('firebase-admin');
const { extractStructuredPriceVariants } = require('./priceParser');

admin.initializeApp();
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 5 });

const CACHE_TTL_MS = 44 * 60 * 60 * 1000;
const UNAVAILABLE_CACHE_TTL_MS = 15 * 60 * 1000;
const EXCHANGE_RATE_TTL_MS = 60 * 60 * 1000;
const PRICE_CACHE_VERSION = 4;

let exchangeRateCache;

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
  return removeUndefinedFields({
    ...quote,
    cacheVersion: quote.cacheVersion ?? PRICE_CACHE_VERSION,
    cached,
    fetchedAt: timestampToIso(quote.fetchedAt),
    expiresAt: timestampToIso(quote.expiresAt),
  });
}

function removeUndefinedFields(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => removeUndefinedFields(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, removeUndefinedFields(item)]),
    );
  }

  return value;
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

function normalizeCardNumber(value) {
  const number = ensureString(value);
  return number || undefined;
}

function buildTcgdexCardId(card) {
  const explicitId = ensureString(card?.id);
  if (explicitId) {
    return explicitId;
  }

  const setId = ensureString(card?.tcgdexSetId) || ensureString(card?.collectionId);
  const number = normalizeCardNumber(card?.number);

  return setId && number ? `${setId}-${number}` : undefined;
}

function buildTcgdexApiUrl(card) {
  const cardId = buildTcgdexCardId(card);

  return cardId ? `https://api.tcgdex.net/v2/pt/cards/${cardId}` : undefined;
}

function buildTcgdexPageUrl(card) {
  const cardId = buildTcgdexCardId(card);

  return cardId ? `https://api.tcgdex.net/v2/pt/cards/${cardId}` : undefined;
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

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new HttpsError(
      response.status === 404 ? 'not-found' : 'unavailable',
      `TCGdex retornou HTTP ${response.status}.`,
      { url },
    );
  }

  return response.json();
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function convertToBrl(value, rate) {
  const number = toNumber(value);
  if (typeof number !== 'number' || typeof rate !== 'number') {
    return undefined;
  }

  return Number((number * rate).toFixed(2));
}

async function fetchExchangeRates() {
  const now = Date.now();
  if (exchangeRateCache && exchangeRateCache.expiresAt > now) {
    return exchangeRateCache.rates;
  }

  const rateLoaders = [
    async () => {
      const response = await fetch(
        'https://api.frankfurter.app/latest?from=EUR&to=BRL,USD',
      );
      if (!response.ok) {
        throw new Error(`Frankfurter HTTP ${response.status}`);
      }

      const data = await response.json();
      const eurBrl = toNumber(data?.rates?.BRL);
      const eurUsd = toNumber(data?.rates?.USD);

      return {
        EUR: eurBrl,
        USD: eurBrl && eurUsd ? eurBrl / eurUsd : undefined,
      };
    },
    async () => {
      const [eurResponse, usdResponse] = await Promise.all([
        fetch('https://open.er-api.com/v6/latest/EUR'),
        fetch('https://open.er-api.com/v6/latest/USD'),
      ]);
      if (!eurResponse.ok || !usdResponse.ok) {
        throw new Error(
          `ER API HTTP ${eurResponse.status}/${usdResponse.status}`,
        );
      }

      const [eurData, usdData] = await Promise.all([
        eurResponse.json(),
        usdResponse.json(),
      ]);

      return {
        EUR: toNumber(eurData?.rates?.BRL),
        USD: toNumber(usdData?.rates?.BRL),
      };
    },
    async () => {
      const response = await fetch(
        'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json',
      );
      if (!response.ok) {
        throw new Error(`currency-api HTTP ${response.status}`);
      }

      const data = await response.json();
      const eurBrl = toNumber(data?.eur?.brl);
      const eurUsd = toNumber(data?.eur?.usd);

      return {
        EUR: eurBrl,
        USD: eurBrl && eurUsd ? eurBrl / eurUsd : undefined,
      };
    },
  ];

  let rates;
  let lastError;

  for (const loadRates of rateLoaders) {
    try {
      rates = await loadRates();
      if (rates?.EUR && rates?.USD) {
        break;
      }
    } catch (error) {
      lastError = error;
    }
  }

  if (!rates?.EUR || !rates?.USD) {
    throw new HttpsError(
      'unavailable',
      lastError instanceof Error
        ? lastError.message
        : 'Cotação de câmbio indisponível para converter preços.',
    );
  }

  exchangeRateCache = {
    rates,
    expiresAt: now + EXCHANGE_RATE_TTL_MS,
  };

  return rates;
}

function createConvertedVariant(label, unit, rate, prices) {
  if (!rate) {
    return undefined;
  }

  const variant = {
    label,
    minimum: convertToBrl(prices.minimum, rate),
    average: convertToBrl(prices.average, rate),
    maximum: convertToBrl(prices.maximum, rate),
  };

  const hasPrice =
    typeof variant.minimum === 'number' ||
    typeof variant.average === 'number' ||
    typeof variant.maximum === 'number';

  if (!hasPrice) {
    return undefined;
  }

  return {
    ...variant,
    label: `${label} (${unit} convertido)`,
  };
}

function extractTcgdexPriceVariants(pricing, rates) {
  const variants = [];
  const cardmarket = pricing?.cardmarket;
  const tcgplayer = pricing?.tcgplayer;

  if (cardmarket) {
    const rate = rates[cardmarket.unit];
    const normal = createConvertedVariant('Cardmarket normal', cardmarket.unit, rate, {
      minimum: cardmarket.low,
      average: cardmarket.avg ?? cardmarket.trend,
    });
    const holo = createConvertedVariant('Cardmarket holo', cardmarket.unit, rate, {
      minimum: cardmarket['low-holo'],
      average: cardmarket['avg-holo'] ?? cardmarket['trend-holo'],
    });

    if (normal) {
      variants.push(normal);
    }

    if (holo) {
      variants.push(holo);
    }
  }

  if (tcgplayer) {
    const rate = rates[tcgplayer.unit];
    for (const [variantName, priceData] of Object.entries(tcgplayer)) {
      if (!priceData || typeof priceData !== 'object' || variantName === 'unit') {
        continue;
      }

      const variant = createConvertedVariant(
        `TCGplayer ${variantName.replaceAll('-', ' ')}`,
        tcgplayer.unit,
        rate,
        {
          minimum: priceData.lowPrice,
          average: priceData.marketPrice ?? priceData.midPrice,
          maximum: priceData.highPrice,
        },
      );

      if (variant) {
        variants.push(variant);
      }
    }
  }

  return variants;
}

async function fetchTcgdexQuote(card, now) {
  const apiUrl = buildTcgdexApiUrl(card);
  if (!apiUrl) {
    throw new HttpsError('invalid-argument', 'ID TCGdex da carta ausente.');
  }

  const [tcgdexCard, rates] = await Promise.all([
    fetchJson(apiUrl),
    fetchExchangeRates(),
  ]);
  const variants = extractTcgdexPriceVariants(tcgdexCard?.pricing, rates);

  if (!variants.length) {
    throw new HttpsError(
      'not-found',
      'A TCGdex não retornou cotação para esta carta.',
      { url: apiUrl },
    );
  }

  const primaryPrice = pickPrimaryPrice(variants);

  return {
    cardId: ensureString(card?.id),
    cardName: ensureString(card?.name),
    collectionId: ensureString(card?.collectionId),
    currency: 'BRL',
    source: 'TCGdex',
    url: buildTcgdexPageUrl(card),
    cacheVersion: PRICE_CACHE_VERSION,
    unavailableReason:
      'Preço alternativo de Cardmarket/TCGplayer convertido para BRL.',
    fetchedAt: admin.firestore.Timestamp.fromMillis(now),
    expiresAt: admin.firestore.Timestamp.fromMillis(now + CACHE_TTL_MS),
    variants,
    ...primaryPrice,
  };
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

      try {
        quote = await fetchTcgdexQuote(card, now);
      } catch (fallbackError) {
        quote = createUnavailableQuote(
          card,
          url,
          now,
          fallbackError instanceof Error
            ? fallbackError.message
            : priceError instanceof Error
              ? priceError.message
              : 'Cotação indisponível na Liga Pokémon.',
        );
      }
    }

    await cacheRef.set(removeUndefinedFields(quote), { merge: true });

    return serializeQuote(quote, false);
  },
);
