import type { PriceQuote, UserCard } from '../types';

export function getQuoteUnitPrice(quote?: PriceQuote | null) {
  if (!quote) {
    return undefined;
  }

  const firstMinimum = quote.variants.find(
    (variant) => typeof variant.minimum === 'number',
  )?.minimum;

  return firstMinimum ?? quote.price;
}

export function getCardUnitPrice(card: Pick<UserCard, 'priceQuote'>) {
  return getQuoteUnitPrice(card.priceQuote);
}

export function getCardTotalPrice(
  card: Pick<UserCard, 'priceQuote' | 'quantity'>,
) {
  const unitPrice = getCardUnitPrice(card);

  if (typeof unitPrice !== 'number') {
    return undefined;
  }

  return unitPrice * Math.max(1, Math.floor(card.quantity ?? 1));
}

export function getCollectionPriceSummary(
  cards: Pick<UserCard, 'id' | 'priceQuote' | 'quantity'>[],
) {
  const uniqueCards = new Map<string, Pick<UserCard, 'priceQuote' | 'quantity'>>();
  let totalWithCopies = 0;
  let quotedCardCount = 0;

  cards.forEach((card) => {
    uniqueCards.set(card.id, card);

    const cardTotalPrice = getCardTotalPrice(card);
    if (typeof cardTotalPrice === 'number') {
      totalWithCopies += cardTotalPrice;
      quotedCardCount += 1;
    }
  });

  const totalUnique = Array.from(uniqueCards.values()).reduce((total, card) => {
    const unitPrice = getCardUnitPrice(card);
    return typeof unitPrice === 'number' ? total + unitPrice : total;
  }, 0);

  return {
    totalUnique,
    totalWithCopies,
    quotedCardCount,
    unquotedCardCount: cards.length - quotedCardCount,
  };
}
