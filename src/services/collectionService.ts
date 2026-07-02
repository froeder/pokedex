import {
  collection,
  deleteDoc,
  doc,
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

  return {
    ...(data as CatalogCard),
    addedAt,
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

export async function addUserCard(uid: string, card: CatalogCard) {
  if (db) {
    await setDoc(
      doc(db, 'users', uid, 'cards', card.id),
      {
        ...removeUndefinedFields(card),
        addedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return;
  }

  const cards = readLocalCards(uid).filter((item) => item.id !== card.id);
  writeLocalCards(uid, [
    {
      ...card,
      addedAt: new Date().toISOString(),
    },
    ...cards,
  ]);
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
