import type { CatalogCard } from '../types';

interface CardArtworkProps {
  card: Pick<CatalogCard, 'imageUrl' | 'name' | 'number' | 'printedTotal'>;
  quality?: 'low' | 'high';
  alt?: string;
}

export function CardArtwork({
  alt,
  card,
  quality = 'low',
}: CardArtworkProps) {
  if (!card.imageUrl) {
    return (
      <div className="card-art-placeholder" aria-label={card.name}>
        <span>{card.name}</span>
      </div>
    );
  }

  return (
    <img
      src={`${card.imageUrl}/${quality}.webp`}
      alt={alt ?? `${card.name} (${card.number}/${card.printedTotal})`}
      loading={quality === 'low' ? 'lazy' : undefined}
    />
  );
}
