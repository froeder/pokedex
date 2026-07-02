import { mkdir, rm, writeFile } from 'node:fs/promises';

const API_BASE = 'https://api.tcgdex.net/v2';
const OUTPUT_DIR = new URL('../public/catalog/', import.meta.url);
const POCKET_SET_ID = /^(?:P-A|[AB]\d)/;

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }

  return response.json();
}

function isPhysicalTcgSet(set) {
  return !POCKET_SET_ID.test(set.id);
}

function inferPrintedTotal(localId, cards, officialCount) {
  const prefix = localId.match(/^[A-Z]+/)?.[0];
  if (prefix) {
    const prefixCards = cards.filter((card) => card.localId.startsWith(prefix));
    if (prefixCards.length > 0) {
      return `${prefix}${String(prefixCards.length).padStart(2, '0')}`;
    }
  }

  return String(officialCount || cards.length);
}

function normalizeSetDetail(detail, fallback, language) {
  const officialCount = detail.cardCount?.official ?? fallback.cardCount?.official;
  const totalCount = detail.cardCount?.total ?? fallback.cardCount?.total;
  const abbreviation = detail.abbreviation?.official ?? fallback.id.toUpperCase();
  const cards = detail.cards ?? [];

  return {
    id: detail.id,
    name: detail.name,
    shortName: detail.name,
    serie: detail.serie?.name ?? 'Pokémon TCG',
    releaseYear: detail.releaseDate
      ? Number(detail.releaseDate.slice(0, 4))
      : undefined,
    releaseDate: detail.releaseDate,
    cardCount: totalCount ?? cards.length,
    officialCount: officialCount ?? cards.length,
    ligaSetCode: abbreviation,
    tcgdexSetId: detail.id,
    logoUrl: detail.logo,
    symbolUrl: detail.symbol,
    language,
    hasPortugueseData: language === 'pt',
    cards: cards.map((card) => ({
      id: card.id,
      name: card.name,
      searchName: card.name,
      collectionId: detail.id,
      collectionName: detail.name,
      ligaSetCode: abbreviation,
      tcgdexSetId: detail.id,
      number: card.localId,
      printedTotal: inferPrintedTotal(card.localId, cards, officialCount),
      imageUrl: card.image,
      types: [],
      rarity: '',
    })),
  };
}

async function getSetDetail(set, ptIds) {
  if (ptIds.has(set.id)) {
    try {
      return normalizeSetDetail(
        await fetchJson(`${API_BASE}/pt/sets/${set.id}`),
        set,
        'pt',
      );
    } catch (error) {
      console.warn(`PT indisponível para ${set.id}: ${error.message}`);
    }
  }

  return normalizeSetDetail(
    await fetchJson(`${API_BASE}/en/sets/${set.id}`),
    set,
    'en',
  );
}

function sortSets(first, second) {
  const firstDate = first.releaseDate ?? '';
  const secondDate = second.releaseDate ?? '';
  return secondDate.localeCompare(firstDate) || second.id.localeCompare(first.id);
}

async function main() {
  const [enSets, ptSets] = await Promise.all([
    fetchJson(`${API_BASE}/en/sets`),
    fetchJson(`${API_BASE}/pt/sets`),
  ]);
  const ptIds = new Set(ptSets.map((set) => set.id));
  const sourceSets = enSets.filter(isPhysicalTcgSet);

  await rm(OUTPUT_DIR, { recursive: true, force: true });
  await mkdir(new URL('sets/', OUTPUT_DIR), { recursive: true });

  const details = [];
  for (const [index, set] of sourceSets.entries()) {
    const detail = await getSetDetail(set, ptIds);
    details.push(detail);
    await writeFile(
      new URL(`sets/${detail.id}.json`, OUTPUT_DIR),
      `${JSON.stringify(detail, null, 2)}\n`,
    );
    console.log(`${index + 1}/${sourceSets.length} ${detail.id} ${detail.name}`);
  }

  const summary = details.sort(sortSets).map(({ cards, ...set }) => set);
  await writeFile(
    new URL('sets.json', OUTPUT_DIR),
    `${JSON.stringify(summary, null, 2)}\n`,
  );

  console.log(`Catálogo sincronizado: ${summary.length} coleções.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
