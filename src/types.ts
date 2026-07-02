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
  source: 'LigaPokemon' | 'Demo';
  url?: string;
  price?: number;
  priceType?: 'average' | 'minimum';
  cached: boolean;
  fetchedAt: string;
  expiresAt?: string;
  variants: PriceVariant[];
}
