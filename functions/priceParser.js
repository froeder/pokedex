const PRICE_EXTRA_LABELS = {
  0: 'Normal',
};

function ensureString(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function parseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readJavascriptAssignment(html, variableName) {
  const token = `var ${variableName} =`;
  const tokenIndex = html.indexOf(token);

  if (tokenIndex < 0) {
    return undefined;
  }

  let cursor = tokenIndex + token.length;
  while (/\s/.test(html[cursor])) {
    cursor += 1;
  }

  const opener = html[cursor];
  const closer = opener === '[' ? ']' : opener === '{' ? '}' : undefined;

  if (!closer) {
    return undefined;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = cursor; index < html.length; index += 1) {
    const char = html[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }

      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === opener) {
      depth += 1;
    } else if (char === closer) {
      depth -= 1;

      if (depth === 0) {
        return JSON.parse(html.slice(cursor, index + 1));
      }
    }
  }

  return undefined;
}

function getExtraLabels(html) {
  const labels = { ...PRICE_EXTRA_LABELS };
  const extras = readJavascriptAssignment(html, 'dataExtras');

  if (Array.isArray(extras)) {
    for (const extra of extras) {
      if (typeof extra?.id === 'number' && typeof extra?.label === 'string') {
        labels[extra.id] = extra.label;
      }
    }
  }

  return labels;
}

function findMatchingEdition(editions, card) {
  const number = ensureString(card?.number);
  const ligaSetCode = ensureString(card?.ligaSetCode).toUpperCase();

  return editions.find((edition) => {
    const matchesNumber = !number || ensureString(edition?.num) === number;
    const matchesCode =
      !ligaSetCode || ensureString(edition?.code).toUpperCase() === ligaSetCode;

    return matchesNumber && matchesCode;
  });
}

function extractStructuredPriceVariants(html, card) {
  const editions = readJavascriptAssignment(html, 'cards_editions');

  if (!Array.isArray(editions) || !editions.length) {
    return [];
  }

  const edition = findMatchingEdition(editions, card) ?? editions[0];
  const priceByExtra = edition?.price;

  if (!priceByExtra || typeof priceByExtra !== 'object') {
    return [];
  }

  const extraLabels = getExtraLabels(html);

  return Object.entries(priceByExtra)
    .map(([extraId, prices]) => ({
      label: extraLabels[extraId] ?? `Extra ${extraId}`,
      minimum: parseNumber(prices?.p),
      average: parseNumber(prices?.m),
      maximum: parseNumber(prices?.g),
    }))
    .filter(
      (variant) =>
        typeof variant.minimum === 'number' ||
        typeof variant.average === 'number' ||
        typeof variant.maximum === 'number',
    );
}

module.exports = {
  extractStructuredPriceVariants,
  readJavascriptAssignment,
};
