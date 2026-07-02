import type { CatalogCard, PokemonType, TcgCollection } from '../types';

const typeLabels: Record<PokemonType, string> = {
  Grass: 'Grama',
  Fire: 'Fogo',
  Water: 'Água',
  Lightning: 'Elétrico',
  Psychic: 'Psíquico',
  Fighting: 'Lutador',
  Darkness: 'Noturno',
  Metal: 'Metal',
  Dragon: 'Dragão',
  Colorless: 'Incolor',
  Trainer: 'Treinador',
  Grama: 'Grama',
  Fogo: 'Fogo',
  Água: 'Água',
  Elétrico: 'Elétrico',
  Psíquico: 'Psíquico',
  Lutador: 'Lutador',
  Sombrio: 'Sombrio',
  Noturno: 'Noturno',
  Dragão: 'Dragão',
  Incolor: 'Incolor',
  Treinador: 'Treinador',
};

const typeClassNames: Record<string, string> = {
  grass: 'Grass',
  grama: 'Grass',
  fire: 'Fire',
  fogo: 'Fire',
  water: 'Water',
  agua: 'Water',
  lightning: 'Lightning',
  eletrico: 'Lightning',
  psychic: 'Psychic',
  psiquico: 'Psychic',
  fighting: 'Fighting',
  lutador: 'Fighting',
  darkness: 'Darkness',
  sombrio: 'Darkness',
  noturno: 'Darkness',
  metal: 'Metal',
  dragon: 'Dragon',
  dragao: 'Dragon',
  colorless: 'Colorless',
  incolor: 'Colorless',
  trainer: 'Trainer',
  treinador: 'Trainer',
};

function normalizeType(type: string) {
  return type
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function card(
  collection: Pick<TcgCollection, 'id' | 'name' | 'ligaSetCode'>,
  data: Omit<CatalogCard, 'collectionId' | 'collectionName' | 'ligaSetCode'> & {
    ligaSetCode?: string;
  },
): CatalogCard {
  return {
    ...data,
    collectionId: collection.id,
    collectionName: collection.name,
    ligaSetCode: data.ligaSetCode ?? collection.ligaSetCode,
  };
}

const sv151 = {
  id: 'sv03-5-151',
  name: 'Escarlate e Violeta - 151',
  shortName: '151',
  serie: 'Escarlate e Violeta',
  releaseYear: 2023,
  cardCount: 207,
  ligaSetCode: 'MEW',
  tcgdexSetId: 'sv03.5',
  logoUrl: 'https://assets.tcgdex.net/en/sv/sv03.5/logo',
  symbolUrl: 'https://assets.tcgdex.net/univ/sv/sv03.5/symbol',
} satisfies Omit<TcgCollection, 'cards'>;

const paradoxRift = {
  id: 'sv04-fenda-paradoxal',
  name: 'Escarlate e Violeta - Fenda Paradoxal',
  shortName: 'Fenda Paradoxal',
  serie: 'Escarlate e Violeta',
  releaseYear: 2023,
  cardCount: 266,
  ligaSetCode: 'PAR',
  tcgdexSetId: 'sv04',
  logoUrl: 'https://assets.tcgdex.net/en/sv/sv04/logo',
  symbolUrl: 'https://assets.tcgdex.net/univ/sv/sv04/symbol',
} satisfies Omit<TcgCollection, 'cards'>;

const lostOrigin = {
  id: 'swsh11-origem-perdida',
  name: 'Espada e Escudo - Origem Perdida',
  shortName: 'Origem Perdida',
  serie: 'Espada e Escudo',
  releaseYear: 2022,
  cardCount: 247,
  ligaSetCode: 'LOR',
  tcgdexSetId: 'swsh11',
  logoUrl: 'https://assets.tcgdex.net/en/swsh/swsh11/logo',
  symbolUrl: 'https://assets.tcgdex.net/univ/swsh/swsh11/symbol',
} satisfies Omit<TcgCollection, 'cards'>;

export const collections: TcgCollection[] = [
  {
    ...sv151,
    cards: [
      card(sv151, {
        id: 'sv03.5-001',
        name: 'Bulbasaur',
        number: '001',
        printedTotal: '165',
        imageUrl: 'https://assets.tcgdex.net/en/sv/sv03.5/001',
        hp: 70,
        types: ['Grass'],
        rarity: 'Comum',
        stage: 'Básico',
        illustrator: 'Mitsuhiro Arita',
        attacks: [
          {
            name: 'Chicote Cipó',
            cost: ['Grass', 'Colorless'],
            damage: '20',
          },
        ],
      }),
      card(sv151, {
        id: 'sv03.5-003',
        name: 'Venusaur ex',
        number: '003',
        printedTotal: '165',
        imageUrl: 'https://assets.tcgdex.net/en/sv/sv03.5/003',
        hp: 340,
        types: ['Grass'],
        rarity: 'Rara Dupla',
        stage: 'Estágio 2',
        illustrator: 'PLANETA Mochizuki',
        attacks: [
          {
            name: 'Florescimento Tranquilo',
            cost: ['Grass'],
            effect: 'Cura dano de 1 dos seus Pokémon.',
          },
          {
            name: 'Chicote Perigoso',
            cost: ['Grass', 'Grass', 'Colorless'],
            damage: '150',
          },
        ],
      }),
      card(sv151, {
        id: 'sv03.5-004',
        name: 'Charmander',
        number: '004',
        printedTotal: '165',
        imageUrl: 'https://assets.tcgdex.net/en/sv/sv03.5/004',
        hp: 70,
        types: ['Fire'],
        rarity: 'Comum',
        stage: 'Básico',
        illustrator: 'Mitsuhiro Arita',
        attacks: [
          {
            name: 'Brasa',
            cost: ['Fire'],
            damage: '30',
          },
        ],
      }),
      card(sv151, {
        id: 'sv03.5-006',
        name: 'Charizard ex',
        number: '006',
        printedTotal: '165',
        imageUrl: 'https://assets.tcgdex.net/en/sv/sv03.5/006',
        hp: 330,
        types: ['Fire'],
        rarity: 'Rara Dupla',
        stage: 'Estágio 2',
        illustrator: 'PLANETA Mochizuki',
        attacks: [
          {
            name: 'Asa Valente',
            cost: ['Fire'],
            damage: '60+',
            effect: 'Causa mais dano se este Pokémon tiver contadores de dano.',
          },
          {
            name: 'Vórtice Explosivo',
            cost: ['Fire', 'Fire', 'Fire', 'Fire'],
            damage: '330',
          },
        ],
      }),
      card(sv151, {
        id: 'sv03.5-007',
        name: 'Squirtle',
        number: '007',
        printedTotal: '165',
        imageUrl: 'https://assets.tcgdex.net/en/sv/sv03.5/007',
        hp: 60,
        types: ['Water'],
        rarity: 'Comum',
        stage: 'Básico',
        illustrator: 'Mitsuhiro Arita',
        attacks: [
          {
            name: 'Jato de Água',
            cost: ['Water'],
            damage: '20',
          },
        ],
      }),
      card(sv151, {
        id: 'sv03.5-009',
        name: 'Blastoise ex',
        number: '009',
        printedTotal: '165',
        imageUrl: 'https://assets.tcgdex.net/en/sv/sv03.5/009',
        hp: 330,
        types: ['Water'],
        rarity: 'Rara Dupla',
        stage: 'Estágio 2',
        illustrator: 'PLANETA Mochizuki',
      }),
      card(sv151, {
        id: 'sv03.5-025',
        name: 'Pikachu',
        number: '025',
        printedTotal: '165',
        imageUrl: 'https://assets.tcgdex.net/en/sv/sv03.5/025',
        hp: 60,
        types: ['Lightning'],
        rarity: 'Comum',
        stage: 'Básico',
        illustrator: 'Naoyo Kimura',
      }),
      card(sv151, {
        id: 'sv03.5-151',
        name: 'Mew ex',
        number: '151',
        printedTotal: '165',
        imageUrl: 'https://assets.tcgdex.net/en/sv/sv03.5/151',
        hp: 180,
        types: ['Psychic'],
        rarity: 'Rara Dupla',
        stage: 'Básico',
      }),
    ],
  },
  {
    ...paradoxRift,
    cards: [
      card(paradoxRift, {
        id: 'sv04-038',
        name: 'Garchomp ex',
        number: '038',
        printedTotal: '182',
        imageUrl: 'https://assets.tcgdex.net/en/sv/sv04/038',
        hp: 320,
        types: ['Water'],
        rarity: 'Rara Dupla',
        stage: 'Estágio 2',
      }),
      card(paradoxRift, {
        id: 'sv04-089',
        name: 'Valentia Férrea ex',
        searchName: 'Iron Valiant ex',
        number: '089',
        printedTotal: '182',
        imageUrl: 'https://assets.tcgdex.net/en/sv/sv04/089',
        hp: 220,
        types: ['Psychic'],
        rarity: 'Rara Dupla',
        stage: 'Básico',
        illustrator: 'aky CG Works',
        attacks: [
          {
            name: 'Lâmina Laser',
            cost: ['Psychic', 'Psychic', 'Colorless'],
            damage: '200',
          },
        ],
      }),
      card(paradoxRift, {
        id: 'sv04-124',
        name: 'Lua Estrondo ex',
        searchName: 'Roaring Moon ex',
        number: '124',
        printedTotal: '182',
        imageUrl: 'https://assets.tcgdex.net/en/sv/sv04/124',
        hp: 230,
        types: ['Darkness'],
        rarity: 'Rara Dupla',
        stage: 'Básico',
        illustrator: 'takuyoa',
        attacks: [
          {
            name: 'Estripação Frenética',
            cost: ['Darkness', 'Darkness', 'Colorless'],
            effect: 'Nocauteia o Pokémon Ativo do oponente e causa dano a si mesmo.',
          },
          {
            name: 'Tempestade Calamitosa',
            cost: ['Darkness', 'Darkness', 'Colorless'],
            damage: '100+',
          },
        ],
      }),
      card(paradoxRift, {
        id: 'sv04-225',
        name: 'Valentia Férrea ex',
        searchName: 'Iron Valiant ex',
        number: '225',
        printedTotal: '182',
        imageUrl: 'https://assets.tcgdex.net/en/sv/sv04/225',
        hp: 220,
        types: ['Psychic'],
        rarity: 'Rara Ultra',
        stage: 'Básico',
      }),
      card(paradoxRift, {
        id: 'sv04-252',
        name: 'Gholdengo ex',
        number: '252',
        printedTotal: '182',
        imageUrl: 'https://assets.tcgdex.net/en/sv/sv04/252',
        hp: 260,
        types: ['Metal'],
        rarity: 'Rara Ilustração Especial',
        stage: 'Estágio 1',
      }),
    ],
  },
  {
    ...lostOrigin,
    cards: [
      card(lostOrigin, {
        id: 'swsh11-130',
        name: 'Giratina V',
        number: '130',
        printedTotal: '196',
        imageUrl: 'https://assets.tcgdex.net/en/swsh/swsh11/130',
        hp: 220,
        types: ['Dragon'],
        rarity: 'Rara Holográfica V',
        stage: 'Básico',
      }),
      card(lostOrigin, {
        id: 'swsh11-186',
        name: 'Giratina V',
        number: '186',
        printedTotal: '196',
        imageUrl: 'https://assets.tcgdex.net/en/swsh/swsh11/186',
        hp: 220,
        types: ['Dragon'],
        rarity: 'Rara Ultra',
        stage: 'Básico',
      }),
      card(lostOrigin, {
        id: 'swsh11-TG03',
        name: 'Charizard',
        number: 'TG03',
        printedTotal: 'TG30',
        imageUrl: 'https://assets.tcgdex.net/en/swsh/swsh11/TG03',
        hp: 170,
        types: ['Fire'],
        rarity: 'Galeria de Treinadores',
        stage: 'Estágio 2',
      }),
      card(lostOrigin, {
        id: 'swsh11-TG05',
        name: 'Pikachu',
        number: 'TG05',
        printedTotal: 'TG30',
        imageUrl: 'https://assets.tcgdex.net/en/swsh/swsh11/TG05',
        hp: 60,
        types: ['Lightning'],
        rarity: 'Galeria de Treinadores',
        stage: 'Básico',
      }),
    ],
  },
];

export const allCards = collections.flatMap((collection) => collection.cards);

export function getCardById(cardId: string) {
  return allCards.find((cardItem) => cardItem.id === cardId);
}

export function getCollectionById(collectionId: string) {
  return collections.find((collection) => collection.id === collectionId);
}

export function getTypeLabel(type: PokemonType) {
  return typeLabels[type] ?? type;
}

export function getTypeClass(type: PokemonType) {
  return typeClassNames[normalizeType(type)] ?? 'Trainer';
}
