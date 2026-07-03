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
  type DocumentData,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type { CatalogCard, UserCard } from '../types';

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

function removeUndefinedFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => removeUndefinedFields(item)) as T;
  }

  if (value && typeof value === 'object') {
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

  if (db) {
    const cardRef = doc(db, 'users', uid, 'cards', card.id);
    const currentCard = await getDoc(cardRef);
    const currentQuantity = currentCard.exists()
      ? Number(currentCard.data().quantity ?? 1)
      : 0;
    let collectionCardCount: number | undefined;
    try {
      const mod = await import('./catalogService');
      const collection = await mod.loadCollectionCards(card.collectionId);
      collectionCardCount = collection?.cardCount;
    } catch {
      collectionCardCount = undefined;
    }

    await setDoc(
      cardRef,
      {
        ...removeUndefinedFields(card),
        quantity: currentQuantity + normalizedQuantity,
        addedAt: serverTimestamp(),
        collectionCardCount,
      },
      { merge: true },
    );
    return;
  }

  const existingCards = readLocalCards(uid);
  const existingCard = existingCards.find((item) => item.id === card.id);
  const currentQuantity = existingCard?.quantity ?? 0;
  let collectionCardCountLocal: number | undefined;
  try {
    const mod = await import('./catalogService');
    const collection = await mod.loadCollectionCards(card.collectionId);
    collectionCardCountLocal = collection?.cardCount;
  } catch {
    collectionCardCountLocal = undefined;
  }

  writeLocalCards(uid, [
    {
      ...card,
      quantity: currentQuantity + normalizedQuantity,
      addedAt: new Date().toISOString(),
      collectionCardCount: collectionCardCountLocal,
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
