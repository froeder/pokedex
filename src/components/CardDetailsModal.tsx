import { ExternalLink, RefreshCcw, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getTypeClass, getTypeLabel } from '../data/catalog';
import { getCardPrice } from '../services/priceService';
import type { PriceQuote, UserCard } from '../types';
import { getFriendlyFirebaseError } from '../utils/firebaseErrors';
import { formatBRL, formatDateTime } from '../utils/formatters';
import { CardArtwork } from './CardArtwork';

interface CardDetailsModalProps {
  card: UserCard;
  onClose: () => void;
}

export function CardDetailsModal({ card, onClose }: CardDetailsModalProps) {
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    let ignore = false;

    getCardPrice(card)
      .then((nextQuote) => {
        if (!ignore) {
          setQuote(nextQuote);
        }
      })
      .catch((priceError: unknown) => {
        if (!ignore) {
          setError(getFriendlyFirebaseError(priceError));
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [card, refreshToken]);

  const primaryPriceLabel = useMemo(() => {
    if (!quote?.price) {
      return 'Cotação indisponível';
    }

    return quote.priceType === 'minimum'
      ? `${formatBRL(quote.price)} menor preço`
      : `${formatBRL(quote.price)} preço médio`;
  }, [quote]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="card-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="icon-button modal-close"
          type="button"
          onClick={onClose}
          title="Fechar"
          aria-label="Fechar"
        >
          <X size={20} aria-hidden="true" />
        </button>

        <div className="modal-media">
          <CardArtwork
            card={card}
            quality="high"
            alt={`${card.name} ampliada`}
          />
        </div>

        <div className="modal-content">
          <div className="modal-title-block">
            <span>
              {card.collectionName} #{card.number}
            </span>
            <h2 id="card-modal-title">{card.name}</h2>
          </div>

          <div className="detail-kpis">
            <div>
              <span>HP</span>
              <strong>{card.hp ?? '-'}</strong>
            </div>
            <div>
              <span>Raridade</span>
              <strong>{card.rarity}</strong>
            </div>
            <div>
              <span>Estágio</span>
              <strong>{card.stage ?? '-'}</strong>
            </div>
          </div>

          <div className="type-list modal-types">
            {card.types.map((type) => (
              <span
                className={`type-pill type-${getTypeClass(type)}`}
                key={type}
              >
                {getTypeLabel(type)}
              </span>
            ))}
          </div>

          {card.attacks?.length ? (
            <div className="attack-list">
              {card.attacks.map((attack) => (
                <div className="attack-row" key={attack.name}>
                  <div>
                    <strong>{attack.name}</strong>
                    {attack.effect ? <p>{attack.effect}</p> : null}
                  </div>
                  <span>{attack.damage ?? ''}</span>
                </div>
              ))}
            </div>
          ) : null}

          <section className="price-panel" aria-label="Valor de mercado">
            <div className="price-heading">
              <div>
                <span>Valor de mercado</span>
                <strong>{loading ? 'Consultando...' : primaryPriceLabel}</strong>
              </div>
              <button
                className="icon-button"
                type="button"
                disabled={loading}
                onClick={() => {
                  setLoading(true);
                  setError('');
                  setRefreshToken((current) => current + 1);
                }}
                title="Atualizar cotação"
                aria-label="Atualizar cotação"
              >
                <RefreshCcw size={18} aria-hidden="true" />
              </button>
            </div>

            {error ? <div className="inline-error">{error}</div> : null}

            {quote ? (
              <>
                <div className="quote-meta">
                  <span>
                    {quote.cached
                      ? 'Cache Firestore'
                      : quote.source === 'LigaPokemon'
                        ? 'Liga Pokémon'
                        : quote.source}
                  </span>
                  <span>{formatDateTime(quote.fetchedAt)}</span>
                </div>

                <div className="variant-table" role="table">
                  <div className="variant-row variant-head" role="row">
                    <span>Extra</span>
                    <span>Menor</span>
                    <span>Médio</span>
                    <span>Maior</span>
                  </div>
                  {quote.variants.map((variant) => (
                    <div className="variant-row" role="row" key={variant.label}>
                      <span>{variant.label}</span>
                      <span>{formatBRL(variant.minimum)}</span>
                      <span>{formatBRL(variant.average)}</span>
                      <span>{formatBRL(variant.maximum)}</span>
                    </div>
                  ))}
                </div>

                {quote.url ? (
                  <a
                    className="external-link"
                    href={quote.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir na Liga Pokémon
                    <ExternalLink size={16} aria-hidden="true" />
                  </a>
                ) : null}
              </>
            ) : null}
          </section>
        </div>
      </section>
    </div>
  );
}
