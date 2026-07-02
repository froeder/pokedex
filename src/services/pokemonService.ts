import type { CatalogCard, PokemonProfile, PokemonStat } from '../types';

type NamedApiResource = {
  name: string;
  url: string;
};

type PokeApiPokemon = {
  id: number;
  name: string;
  height?: number;
  weight?: number;
  sprites?: {
    other?: {
      'official-artwork'?: {
        front_default?: string;
      };
    };
    front_default?: string;
  };
  species: NamedApiResource;
  abilities?: Array<{
    ability: NamedApiResource;
  }>;
  types?: Array<{
    type: NamedApiResource;
  }>;
  stats?: Array<{
    base_stat: number;
    stat: NamedApiResource;
  }>;
};

type PokeApiAbility = {
  names?: Array<{
    name: string;
    language: NamedApiResource;
  }>;
};

type PokeApiSpecies = {
  id: number;
  name: string;
  genera?: Array<{
    genus: string;
    language: NamedApiResource;
  }>;
  flavor_text_entries?: Array<{
    flavor_text: string;
    language: NamedApiResource;
  }>;
  habitat?: NamedApiResource | null;
  color?: NamedApiResource;
  shape?: NamedApiResource;
  capture_rate?: number;
  base_happiness?: number;
  is_baby: boolean;
  is_legendary: boolean;
  is_mythical: boolean;
  evolution_chain?: {
    url: string;
  };
};

type EvolutionChainNode = {
  species: NamedApiResource;
  evolves_to: EvolutionChainNode[];
};

type PokeApiEvolutionChain = {
  chain: EvolutionChainNode;
};

const profileCache = new Map<string, PokemonProfile | null>();

const specialNameMap: Record<string, string> = {
  "farfetchd": 'farfetchd',
  "sirfetchd": 'sirfetchd',
  'ho-oh': 'ho-oh',
  'mime-jr': 'mime-jr',
  'mr-mime': 'mr-mime',
  'mr-rime': 'mr-rime',
  'nidoran-f': 'nidoran-f',
  'nidoran-m': 'nidoran-m',
  'porygon-z': 'porygon-z',
  'type-null': 'type-null',
};

const statLabels: Record<string, string> = {
  hp: 'HP',
  attack: 'Ataque',
  defense: 'Defesa',
  'special-attack': 'Atq. esp.',
  'special-defense': 'Def. esp.',
  speed: 'Velocidade',
};

const pokemonTypeLabels: Record<string, string> = {
  bug: 'Inseto',
  dark: 'Noturno',
  dragon: 'Dragão',
  electric: 'Elétrico',
  fairy: 'Fada',
  fighting: 'Lutador',
  fire: 'Fogo',
  flying: 'Voador',
  ghost: 'Fantasma',
  grass: 'Grama',
  ground: 'Terra',
  ice: 'Gelo',
  normal: 'Normal',
  poison: 'Veneno',
  psychic: 'Psíquico',
  rock: 'Pedra',
  steel: 'Metal',
  water: 'Água',
};

const abilityLabels: Record<string, string> = {
  adaptability: 'Adaptabilidade',
  blaze: 'Chama',
  chlorophyll: 'Clorofila',
  'compound-eyes': 'Olhos Compostos',
  'cute-charm': 'Charme',
  damp: 'Umidade',
  'early-bird': 'Madrugador',
  guts: 'Coragem',
  'keen-eye': 'Olhar Aguçado',
  levitate: 'Levitação',
  'lightning-rod': 'Para-raios',
  'magic-guard': 'Guarda Mágica',
  'natural-cure': 'Cura Natural',
  overgrow: 'Supercrescimento',
  'poison-point': 'Ponto Venenoso',
  'run-away': 'Fuga',
  'sand-veil': 'Véu de Areia',
  'shed-skin': 'Troca de Pele',
  'shield-dust': 'Pó Escudo',
  static: 'Estática',
  stench: 'Fedor',
  sturdy: 'Robustez',
  swarm: 'Enxame',
  'swift-swim': 'Nado Rápido',
  torrent: 'Torrente',
  'water-absorb': 'Absorção de Água',
};

const genusLabels: Record<string, string> = {
  seed: 'Pokémon Semente',
  lizard: 'Pokémon Lagarto',
  flame: 'Pokémon Chama',
  turtle: 'Pokémon Tartaruga',
  tiny: 'Pokémon Pequeno',
  worm: 'Pokémon Minhoca',
  cocoon: 'Pokémon Casulo',
  butterfly: 'Pokémon Borboleta',
  hairy: 'Pokémon Peludo',
  bird: 'Pokémon Pássaro',
  mouse: 'Pokémon Rato',
  snake: 'Pokémon Serpente',
  poison: 'Pokémon Veneno',
  fairy: 'Pokémon Fada',
  fox: 'Pokémon Raposa',
  'hairy bug': 'Pokémon Inseto Peludo',
  bat: 'Pokémon Morcego',
  weed: 'Pokémon Erva',
  flower: 'Pokémon Flor',
  mushroom: 'Pokémon Cogumelo',
  insect: 'Pokémon Inseto',
  duck: 'Pokémon Pato',
  pig: 'Pokémon Porco',
  cat: 'Pokémon Gato',
  psi: 'Pokémon Psi',
  superpower: 'Pokémon Superpoder',
  rock: 'Pokémon Rocha',
  transport: 'Pokémon Transporte',
  dragon: 'Pokémon Dragão',
};

const genusTermLabels: Record<string, string> = {
  armor: 'Armadura',
  ball: 'Bola',
  bat: 'Morcego',
  bird: 'Pássaro',
  bone: 'Osso',
  bug: 'Inseto',
  butterfly: 'Borboleta',
  cat: 'Gato',
  cocoon: 'Casulo',
  crab: 'Caranguejo',
  dragon: 'Dragão',
  duck: 'Pato',
  fairy: 'Fada',
  fire: 'Fogo',
  fish: 'Peixe',
  flame: 'Chama',
  flower: 'Flor',
  fox: 'Raposa',
  gas: 'Gás',
  hairy: 'Peludo',
  horn: 'Chifre',
  insect: 'Inseto',
  lizard: 'Lagarto',
  magnet: 'Ímã',
  mouse: 'Rato',
  mushroom: 'Cogumelo',
  poison: 'Veneno',
  psi: 'Psi',
  rock: 'Rocha',
  seed: 'Semente',
  shellfish: 'Marisco',
  snake: 'Serpente',
  superpower: 'Superpoder',
  tiny: 'Pequeno',
  transport: 'Transporte',
  turtle: 'Tartaruga',
  weed: 'Erva',
  worm: 'Minhoca',
};

function titleCase(value: string) {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function toApiSlug(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/♀/g, '-f')
    .replace(/♂/g, '-m')
    .replace(/['’]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(lv\.?\s*x|ex|gx|vmax|vstar|v-union|break|prime)\b/g, ' ')
    .replace(/\b(radiant|shining|dark|light|m)\b/g, ' ')
    .replace(/&.*$/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getPokemonNameCandidates(card: CatalogCard) {
  const rawName = card.searchName || card.name;
  const withoutOwner = rawName.replace(/^.+['’]s\s+/i, '');
  const beforeDash = withoutOwner.split(/\s+-\s+/)[0];
  const candidates = [
    rawName,
    withoutOwner,
    beforeDash,
    beforeDash.split(/\s+/).slice(0, 2).join(' '),
    beforeDash.split(/\s+/)[0],
  ]
    .map(toApiSlug)
    .map((slug) => specialNameMap[slug] ?? slug)
    .filter(Boolean);

  return [...new Set(candidates)];
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`PokeAPI retornou HTTP ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

async function tryFetchJson<T>(url: string): Promise<T | null> {
  const response = await fetch(url);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`PokeAPI retornou HTTP ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

function pickLanguageValue<T extends { language: NamedApiResource }>(
  values: T[] | undefined,
  getValue: (value: T) => string,
  fallbackLanguages = ['pt-br', 'pt', 'en'],
) {
  if (!values?.length) {
    return undefined;
  }

  const entry =
    fallbackLanguages
      .map((language) =>
        values.find((value) => value.language.name === language),
      )
      .find(Boolean);

  if (!entry) {
    return undefined;
  }

  return getValue(entry).replace(/\s+/g, ' ').trim();
}

function pickPortugueseValue<T extends { language: NamedApiResource }>(
  values: T[] | undefined,
  getValue: (value: T) => string,
) {
  return pickLanguageValue(values, getValue, ['pt-br', 'pt']);
}

function translateGenus(value: string | undefined) {
  if (!value) {
    return undefined;
  }

  const normalized = value
    .replace(/^the\s+/i, '')
    .replace(/\s*pok[eé]mon$/i, '')
    .replace(/^pok[eé]mon\s+/i, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (genusLabels[normalized]) {
    return genusLabels[normalized];
  }

  const translatedTerms = normalized
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => genusTermLabels[term]);

  if (translatedTerms.length && translatedTerms.every(Boolean)) {
    return `Pokémon ${translatedTerms.join(' ')}`;
  }

  return undefined;
}

function collectEvolutionNames(node: EvolutionChainNode, names: string[] = []) {
  names.push(titleCase(node.species.name));

  for (const child of node.evolves_to) {
    collectEvolutionNames(child, names);
  }

  return names;
}

function getStats(pokemon: PokeApiPokemon): PokemonStat[] {
  return (
    pokemon.stats?.map((stat) => ({
      label: statLabels[stat.stat.name] ?? titleCase(stat.stat.name),
      value: stat.base_stat,
    })) ?? []
  );
}

async function getAbilityLabel(ability: NamedApiResource) {
  if (abilityLabels[ability.name]) {
    return abilityLabels[ability.name];
  }

  try {
    const detail = await fetchJson<PokeApiAbility>(ability.url);
    return (
      pickPortugueseValue(detail.names, (entry) => entry.name) ??
      titleCase(ability.name)
    );
  } catch {
    return titleCase(ability.name);
  }
}

async function buildPokemonProfile(
  pokemon: PokeApiPokemon,
): Promise<PokemonProfile> {
  const species = await fetchJson<PokeApiSpecies>(pokemon.species.url);
  const evolutionChain = species.evolution_chain?.url
    ? await fetchJson<PokeApiEvolutionChain>(species.evolution_chain.url)
    : null;
  const flavorText = pickPortugueseValue(
    species.flavor_text_entries,
    (entry) => entry.flavor_text,
  );
  const abilities = await Promise.all(
    pokemon.abilities?.map((ability) => getAbilityLabel(ability.ability)) ?? [],
  );

  return {
    id: pokemon.id,
    name: pokemon.name,
    displayName: titleCase(pokemon.name),
    sourceUrl: `https://pokeapi.co/api/v2/pokemon/${pokemon.name}/`,
    spriteUrl:
      pokemon.sprites?.other?.['official-artwork']?.front_default ??
      pokemon.sprites?.front_default,
    genus: translateGenus(
      pickLanguageValue(species.genera, (entry) => entry.genus),
    ),
    flavorText,
    habitat: species.habitat ? titleCase(species.habitat.name) : undefined,
    color: species.color ? titleCase(species.color.name) : undefined,
    shape: species.shape ? titleCase(species.shape.name) : undefined,
    captureRate: species.capture_rate,
    baseHappiness: species.base_happiness,
    isBaby: species.is_baby,
    isLegendary: species.is_legendary,
    isMythical: species.is_mythical,
    heightMeters:
      typeof pokemon.height === 'number' ? pokemon.height / 10 : undefined,
    weightKg:
      typeof pokemon.weight === 'number' ? pokemon.weight / 10 : undefined,
    abilities,
    types:
      pokemon.types?.map(
        (type) => pokemonTypeLabels[type.type.name] ?? titleCase(type.type.name),
      ) ?? [],
    stats: getStats(pokemon),
    evolutionChain: evolutionChain ? collectEvolutionNames(evolutionChain.chain) : [],
  };
}

export async function getPokemonProfile(
  card: CatalogCard,
): Promise<PokemonProfile | null> {
  const candidates = getPokemonNameCandidates(card);
  const cacheKey = candidates[0] ?? card.id;

  if (profileCache.has(cacheKey)) {
    return profileCache.get(cacheKey)!;
  }

  for (const candidate of candidates) {
    const pokemon = await tryFetchJson<PokeApiPokemon>(
      `https://pokeapi.co/api/v2/pokemon/${candidate}/`,
    );

    if (pokemon) {
      const profile = await buildPokemonProfile(pokemon);
      profileCache.set(cacheKey, profile);
      return profile;
    }
  }

  profileCache.set(cacheKey, null);
  return null;
}
