import { Trash2 } from 'lucide-react';
import { getTypeClass, getTypeLabel } from '../data/catalog';
import type { UserCard } from '../types';
import { CardArtwork } from './CardArtwork';

interface CardGridProps {
  cards: UserCard[];
  removingId?: string;
  onSelect: (card: UserCard) => void;
  onRemove: (cardId: string) => void;
}

export function CardGrid({
  cards,
  onRemove,
  onSelect,
  removingId,
}: CardGridProps) {
  return (
    <div className="card-grid">
      {cards.map((card) => (
        <article className="owned-card" key={card.id}>
          <button
            className="card-open-button"
            type="button"
            onClick={() => onSelect(card)}
          >
            <CardArtwork card={card} />
            <span className="card-number">
              {card.number}/{card.printedTotal}
            </span>
          </button>

          <div className="owned-card-body">
            <div>
              <h3>{card.name}</h3>
              <p>{card.collectionName}</p>
            </div>

            <div className="card-footer-row">
              <div className="type-list" aria-label="Tipo">
                {card.types.map((type) => (
                  <span
                    className={`type-pill type-${getTypeClass(type)}`}
                    key={type}
                  >
                    {getTypeLabel(type)}
                  </span>
                ))}
              </div>

              <button
                className="icon-button subtle-danger"
                type="button"
                disabled={removingId === card.id}
                onClick={() => onRemove(card.id)}
                title="Remover"
                aria-label={`Remover ${card.name}`}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
