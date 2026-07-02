import { collections as fallbackCollections } from '../data/catalog';
import type { Attack, CatalogCard, TcgCollection } from '../types';

type TcgDexAttack = {
  name: string;
  cost?: string[];
  damage?: string | number;
  effect?: string;
};

type TcgDexCardDetail = {
  image?: string;
  hp?: number | string;
  types?: string[];
  rarity?: string;
  stage?: string;
  illustrator?: string;
  attacks?: TcgDexAttack[];
  set?: {
    name?: string;
  };
};

const catalogCache = new Map<string, TcgCollection>();
const detailCache = new Map<string, CatalogCard>();

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Não foi possível carregar ${url}`);
  }

  return response.json() as Promise<T>;
}

function withSortedCollections(collections: TcgCollection[]) {
  return [...collections].sort((first, second) => {
    const firstDate = first.releaseDate ?? String(first.releaseYear ?? '');
    const secondDate = second.releaseDate ?? String(second.releaseYear ?? '');
    return (
      secondDate.localeCompare(firstDate) ||
      second.id.localeCompare(first.id)
    );
  });
}

export async function loadCatalogCollections() {
  try {
    const collections = await fetchJson<TcgCollection[]>('/catalog/sets.json');
    return withSortedCollections(collections);
  } catch {
    return fallbackCollections;
  }
}

export async function loadCollectionCards(collectionId: string) {
  if (catalogCache.has(collectionId)) {
    return catalogCache.get(collectionId)!;
  }

  try {
    const collection = await fetchJson<TcgCollection>(
      `/catalog/sets/${collectionId}.json`,
    );
    catalogCache.set(collectionId, collection);
    return collection;
  } catch {
    const fallback = fallbackCollections.find(
      (collection) => collection.id === collectionId,
    );

    if (!fallback) {
      throw new Error('Coleção não encontrada no catálogo local.');
    }

    return fallback;
  }
}

function normalizeAttacks(attacks?: TcgDexAttack[]): Attack[] | undefined {
  if (!attacks?.length) {
    return undefined;
  }

  return attacks.map((attack) => ({
    name: attack.name,
    cost: attack.cost,
    damage:
      typeof attack.damage === 'number' ? String(attack.damage) : attack.damage,
    effect: attack.effect,
  }));
}

export async function hydrateCatalogCard(card: CatalogCard) {
  if (detailCache.has(card.id)) {
    return detailCache.get(card.id)!;
  }

  const tcgdexSetId = card.tcgdexSetId ?? card.collectionId;
  const languagePath = card.imageUrl.includes('/pt/') ? 'pt' : 'en';

  try {
    const detail = await fetchJson<TcgDexCardDetail>(
      `https://api.tcgdex.net/v2/${languagePath}/sets/${tcgdexSetId}/${card.number}`,
    );
    const hydratedCard: CatalogCard = {
      ...card,
      imageUrl: detail.image ?? card.imageUrl,
      hp:
        typeof detail.hp === 'string'
          ? Number.parseInt(detail.hp, 10)
          : detail.hp ?? card.hp,
      types: detail.types ?? card.types,
      rarity: detail.rarity ?? card.rarity,
      stage: detail.stage ?? card.stage,
      illustrator: detail.illustrator ?? card.illustrator,
      attacks: normalizeAttacks(detail.attacks) ?? card.attacks,
      collectionName: detail.set?.name ?? card.collectionName,
    };

    detailCache.set(card.id, hydratedCard);
    return hydratedCard;
  } catch {
    return card;
  }
}
