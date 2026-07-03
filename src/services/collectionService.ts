import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { CatalogCard, PokemonProfile, PriceQuote, UserCard } from '../types';

const LOCAL_COLLECTION_EVENT = 'pokedex:collection-change';

function storageKey(uid: string) {
  return `pokedex:user-cards:${uid}`;
}

function toUserCard(data: DocumentData): UserCard {
  const addedAt =
    typeof data.addedAt === 'string'
      ? data.addedAt
      : data.addedAt?.toDate?.().toISOString() ?? new Date().toISOString();

  const quantity = Number(data.quantity);

  return {
    ...(data as CatalogCard),
    addedAt,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    collectionCardCount:
      data.collectionCardCount != null
        ? Number(data.collectionCardCount)
        : undefined,
    pokemonProfile:
      data.pokemonProfile != null ? (data.pokemonProfile as PokemonProfile) : undefined,
    priceQuote: data.priceQuote != null ? (data.priceQuote as PriceQuote) : undefined,
  };
}

function readLocalCards(uid: string): UserCard[] {
  const rawValue = window.localStorage.getItem(storageKey(uid));
  if (!rawValue) {
    return [];
  }

  return JSON.parse(rawValue) as UserCard[];
}

function writeLocalCards(uid: string, cards: UserCard[]) {
  window.localStorage.setItem(storageKey(uid), JSON.stringify(cards));
  window.dispatchEvent(new CustomEvent(LOCAL_COLLECTION_EVENT, { detail: uid }));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function removeUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => removeUndefinedFields(item)) as T;
  }

  if (isPlainRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, removeUndefinedFields(item)]),
    ) as T;
  }

  return value;
}

export function subscribeToUserCards(
  uid: string,
  onCards: (cards: UserCard[]) => void,
  onError?: (error: Error) => void,
) {
  if (db) {
    const cardsQuery = query(
      collection(db, 'users', uid, 'cards'),
      orderBy('addedAt', 'desc'),
    );

    return onSnapshot(
      cardsQuery,
      (snapshot) => {
        onCards(snapshot.docs.map((cardDoc) => toUserCard(cardDoc.data())));
      },
      (error) => onError?.(error),
    );
  }

  const emitLocalCards = () => onCards(readLocalCards(uid));
  const localListener = (event: Event) => {
    const customEvent = event as CustomEvent<string>;
    if (customEvent.detail === uid) {
      emitLocalCards();
    }
  };
  const storageListener = (event: StorageEvent) => {
    if (event.key === storageKey(uid)) {
      emitLocalCards();
    }
  };

  emitLocalCards();
  window.addEventListener(LOCAL_COLLECTION_EVENT, localListener);
  window.addEventListener('storage', storageListener);

  return () => {
    window.removeEventListener(LOCAL_COLLECTION_EVENT, localListener);
    window.removeEventListener('storage', storageListener);
  };
}

export async function addUserCard(
  uid: string,
  card: CatalogCard,
  quantity = 1,
) {
  const normalizedQuantity = Math.max(1, Math.floor(quantity));

  let collectionCardCount: number | undefined;
  let pokemonProfile: PokemonProfile | null | undefined;
  let priceQuote: PriceQuote | null | undefined;
  let currentQuantity = 0;
  let existingPokemonProfile: PokemonProfile | null | undefined;
  let existingPriceQuote: PriceQuote | null | undefined;
  let existingCard: UserCard | undefined;
  const cardRef = db ? doc(db, 'users', uid, 'cards', card.id) : null;

  if (db && cardRef) {
    const currentCard = await getDoc(cardRef);
    const currentData = currentCard.data();
    currentQuantity = currentCard.exists()
      ? Number(currentData?.quantity ?? 1)
      : 0;
    existingPokemonProfile = currentCard.exists()
      ? (currentData?.pokemonProfile as PokemonProfile | null | undefined)
      : undefined;
    existingPriceQuote = currentCard.exists()
      ? (currentData?.priceQuote as PriceQuote | null | undefined)
      : undefined;
  } else {
    existingCard = readLocalCards(uid).find((item) => item.id === card.id);
    currentQuantity = existingCard?.quantity ?? 0;
    existingPokemonProfile = existingCard?.pokemonProfile;
    existingPriceQuote = existingCard?.priceQuote;
  }

  try {
    const mod = await import('./catalogService');
    const collection = await mod.loadCollectionCards(card.collectionId);
    collectionCardCount = collection?.cardCount;
  } catch {
    collectionCardCount = undefined;
  }

  try {
    const mod = await import('./pokemonService');
    pokemonProfile = await mod.getPokemonProfile(card);
  } catch {
    pokemonProfile = null;
  }

  try {
    const mod = await import('./priceService');
    priceQuote =
      existingPriceQuote && mod.canReusePriceQuote(existingPriceQuote)
        ? existingPriceQuote
        : await mod.getCardPrice(card);
  } catch {
    priceQuote = undefined;
  }

  if (db && cardRef) {
    const cardData = removeUndefinedFields({
      ...card,
      quantity: currentQuantity + normalizedQuantity,
      addedAt: serverTimestamp(),
      collectionCardCount,
      pokemonProfile:
        pokemonProfile !== undefined ? pokemonProfile : existingPokemonProfile,
      priceQuote: priceQuote !== undefined ? priceQuote : existingPriceQuote,
    });

    await setDoc(
      cardRef,
      cardData,
      { merge: true },
    );
    return;
  }

  const existingCards = readLocalCards(uid);

  writeLocalCards(uid, [
    {
      ...card,
      quantity: currentQuantity + normalizedQuantity,
      addedAt: new Date().toISOString(),
      collectionCardCount,
      pokemonProfile:
        pokemonProfile !== undefined
          ? pokemonProfile
          : existingCard?.pokemonProfile,
      priceQuote:
        priceQuote !== undefined ? priceQuote : existingCard?.priceQuote,
    },
    ...existingCards.filter((item) => item.id !== card.id),
  ]);
}

export async function updateUserCardQuantity(
  uid: string,
  cardId: string,
  quantity: number,
) {
  const normalizedQuantity = Math.max(1, Math.floor(quantity));

  if (db) {
    await setDoc(
      doc(db, 'users', uid, 'cards', cardId),
      { quantity: normalizedQuantity },
      { merge: true },
    );
    return;
  }

  const cards = readLocalCards(uid).map((card) =>
    card.id === cardId ? { ...card, quantity: normalizedQuantity } : card,
  );
  writeLocalCards(uid, cards);
}

export async function updateUserCardPriceQuote(
  uid: string,
  cardId: string,
  priceQuote: PriceQuote,
) {
  const sanitizedQuote = removeUndefinedFields(priceQuote);

  if (db) {
    await updateDoc(doc(db, 'users', uid, 'cards', cardId), {
      priceQuote: sanitizedQuote,
    });
    return;
  }

  const cards = readLocalCards(uid);
  const hasCard = cards.some((card) => card.id === cardId);

  if (!hasCard) {
    return;
  }

  writeLocalCards(
    uid,
    cards.map((card) =>
      card.id === cardId ? { ...card, priceQuote: sanitizedQuote } : card,
    ),
  );
}

export async function removeUserCard(uid: string, cardId: string) {
  if (db) {
    await deleteDoc(doc(db, 'users', uid, 'cards', cardId));
    return;
  }

  writeLocalCards(
    uid,
    readLocalCards(uid).filter((card) => card.id !== cardId),
  );
}
