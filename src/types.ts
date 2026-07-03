export type PokemonType = string;

export interface Attack {
  name: string;
  cost?: PokemonType[];
  damage?: string;
  effect?: string;
}

export interface CatalogCard {
  id: string;
  name: string;
  searchName?: string;
  collectionId: string;
  collectionName: string;
  ligaSetCode: string;
  tcgdexSetId?: string;
  number: string;
  printedTotal: string;
  imageUrl: string;
  hp?: number;
  types: PokemonType[];
  rarity: string;
  stage?: string;
  illustrator?: string;
  attacks?: Attack[];
}

export interface TcgCollection {
  id: string;
  name: string;
  shortName: string;
  serie: string;
  releaseYear: number;
  cardCount: number;
  ligaSetCode: string;
  tcgdexSetId: string;
  hasPortugueseData?: boolean;
  releaseDate?: string;
  officialCount?: number;
  logoUrl?: string;
  symbolUrl?: string;
  cards: CatalogCard[];
}

export interface UserCard extends CatalogCard {
  addedAt: string;
  quantity: number;
  collectionCardCount?: number;
}

export interface PriceVariant {
  label: string;
  minimum?: number;
  average?: number;
  maximum?: number;
}

export interface PriceQuote {
  cardId: string;
  cardName: string;
  collectionId: string;
  currency: 'BRL';
  source: 'LigaPokemon' | 'TCGdex' | 'Demo' | 'Unavailable';
  url?: string;
  price?: number;
  priceType?: 'average' | 'minimum';
  cached: boolean;
  cacheVersion?: number;
  unavailableReason?: string;
  fetchedAt: string;
  expiresAt?: string;
  variants: PriceVariant[];
}

export interface PokemonStat {
  label: string;
  value: number;
}

export interface PokemonProfile {
  id: number;
  name: string;
  displayName: string;
  sourceUrl: string;
  spriteUrl?: string;
  genus?: string;
  flavorText?: string;
  habitat?: string;
  color?: string;
  shape?: string;
  captureRate?: number;
  baseHappiness?: number;
  isBaby: boolean;
  isLegendary: boolean;
  isMythical: boolean;
  heightMeters?: number;
  weightKg?: number;
  abilities: string[];
  types: string[];
  stats: PokemonStat[];
  evolutionChain: string[];
}
