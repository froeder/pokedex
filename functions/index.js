const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2/options');
const admin = require('firebase-admin');
const cheerio = require('cheerio');

admin.initializeApp();
setGlobalOptions({ region: 'southamerica-east1', maxInstances: 5 });

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const BRL_REGEX = /R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/g;

function ensureString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function normalizeForSearch(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function parseBRL(value) {
  const normalized = value
    .replace('R$', '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
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
      'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.6,en;q=0.4',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      'user-agent':
        'Mozilla/5.0 (compatible; PokedexTCGBR/0.1; +https://example.local)',
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

function extractRelevantText($) {
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const normalized = normalizeForSearch(bodyText);
  const anchors = [
    'preco medio de venda no marketplace',
    'menor preco',
    'lista de compras',
  ];
  const anchorIndex = anchors
    .map((anchor) => normalized.indexOf(anchor))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (typeof anchorIndex === 'number') {
    return bodyText.slice(Math.max(0, anchorIndex - 160), anchorIndex + 2600);
  }

  return bodyText.slice(0, 3200);
}

function extractVariantLabels(text) {
  const labels = [];
  const seen = new Set();
  const labelRegex =
    /\b(?:[NFR]\s+)?(Normal|Foil|Reverse|Holografica|Holográfica|Holo)\b/gi;

  for (const match of text.matchAll(labelRegex)) {
    const label = match[1].replace('Holografica', 'Holográfica');
    const key = normalizeForSearch(label);
    if (!seen.has(key)) {
      seen.add(key);
      labels.push(label);
    }
  }

  return labels;
}

function extractPriceVariants(html) {
  const $ = cheerio.load(html);
  const relevantText = extractRelevantText($);
  const amounts = [...relevantText.matchAll(BRL_REGEX)]
    .map((match) => parseBRL(match[0]))
    .filter((amount) => typeof amount === 'number');

  if (!amounts.length) {
    return [];
  }

  const labels = extractVariantLabels(relevantText);
  const variants = [];

  for (let index = 0; index < amounts.length && variants.length < 5; index += 3) {
    variants.push({
      label:
        labels[variants.length] ??
        (variants.length === 0 ? 'Marketplace' : `Extra ${variants.length + 1}`),
      minimum: amounts[index],
      average: amounts[index + 1],
      maximum: amounts[index + 2],
    });
  }

  return variants.filter(
    (variant) =>
      typeof variant.minimum === 'number' ||
      typeof variant.average === 'number' ||
      typeof variant.maximum === 'number',
  );
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

      if (expiresAt > now) {
        return serializeQuote(cachedQuote, true);
      }
    }

    const url = buildLigaUrl(card);
    const html = await fetchLigaPage(url);
    const variants = extractPriceVariants(html);

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
    const quote = {
      cardId,
      cardName,
      collectionId,
      currency: 'BRL',
      source: 'LigaPokemon',
      url,
      fetchedAt,
      expiresAt,
      variants,
      ...primaryPrice,
    };

    await cacheRef.set(quote, { merge: true });

    return serializeQuote(quote, false);
  },
);
