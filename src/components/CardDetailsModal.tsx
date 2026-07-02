import { ExternalLink, RefreshCcw, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getTypeClass, getTypeLabel } from '../data/catalog';
import { hydrateCatalogCard } from '../services/catalogService';
import { getPokemonProfile } from '../services/pokemonService';
import { getCardPrice } from '../services/priceService';
import type { CatalogCard, PokemonProfile, PriceQuote } from '../types';
import { getFriendlyFirebaseError } from '../utils/firebaseErrors';
import { formatBRL, formatDateTime } from '../utils/formatters';
import { CardArtwork } from './CardArtwork';

interface CardDetailsModalProps {
  card: CatalogCard;
  onClose: () => void;
}

function getQuoteSourceLabel(source: PriceQuote['source']) {
  if (source === 'LigaPokemon') {
    return 'Liga Pokémon';
  }

  if (source === 'Demo') {
    return 'Estimativa local';
  }

  if (source === 'Unavailable') {
    return 'Liga Pokémon indisponível';
  }

  return source;
}

function formatMeasurement(value: number | undefined, unit: string) {
  if (typeof value !== 'number') {
    return '-';
  }

  return `${value.toLocaleString('pt-BR', {
    maximumFractionDigits: 1,
  })} ${unit}`;
}

function formatTrait(profile: PokemonProfile) {
  if (profile.isMythical) {
    return 'Mítico';
  }

  if (profile.isLegendary) {
    return 'Lendário';
  }

  if (profile.isBaby) {
    return 'Bebê';
  }

  return 'Pokémon';
}

export function CardDetailsModal({ card, onClose }: CardDetailsModalProps) {
  const [detailedCard, setDetailedCard] = useState<CatalogCard>(card);
  const [pokemonProfile, setPokemonProfile] =
    useState<PokemonProfile | null>(null);
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

    hydrateCatalogCard(card)
      .then((hydratedCard) => {
        if (!ignore) {
          setDetailedCard({
            ...card,
            ...hydratedCard,
          });
        }
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, [card]);

  useEffect(() => {
    let ignore = false;

    getPokemonProfile(detailedCard)
      .then((profile) => {
        if (!ignore) {
          setPokemonProfile(profile);
        }
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, [detailedCard]);

  useEffect(() => {
    let ignore = false;

    getCardPrice(detailedCard)
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
  }, [detailedCard, refreshToken]);

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
            card={detailedCard}
            quality="high"
            alt={`${detailedCard.name} ampliada`}
          />
        </div>

        <div className="modal-content">
          <div className="modal-title-block">
            <span>
              {detailedCard.collectionName} #{detailedCard.number}
            </span>
            <h2 id="card-modal-title">{detailedCard.name}</h2>
          </div>

          <div className="detail-kpis">
            <div>
              <span>HP</span>
              <strong>{detailedCard.hp ?? '-'}</strong>
            </div>
            <div>
              <span>Raridade</span>
              <strong>{detailedCard.rarity || '-'}</strong>
            </div>
            <div>
              <span>Estágio</span>
              <strong>{detailedCard.stage ?? '-'}</strong>
            </div>
          </div>

          <div className="type-list modal-types">
            {detailedCard.types.map((type) => (
              <span
                className={`type-pill type-${getTypeClass(type)}`}
                key={type}
              >
                {getTypeLabel(type)}
              </span>
            ))}
          </div>

          <section className="card-info-panel" aria-label="Detalhes da carta">
            <div>
              <span>Coleção</span>
              <strong>{detailedCard.collectionName}</strong>
            </div>
            <div>
              <span>Número</span>
              <strong>
                {detailedCard.number}/{detailedCard.printedTotal}
              </strong>
            </div>
            <div>
              <span>Código Liga</span>
              <strong>{detailedCard.ligaSetCode}</strong>
            </div>
            <div>
              <span>Ilustrador</span>
              <strong>{detailedCard.illustrator ?? '-'}</strong>
            </div>
          </section>

          {detailedCard.attacks?.length ? (
            <div className="attack-list">
              {detailedCard.attacks.map((attack) => (
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

          {pokemonProfile ? (
            <section className="pokemon-panel" aria-label="Dados do Pokémon">
              <div className="pokemon-panel-heading">
                {pokemonProfile.spriteUrl ? (
                  <img
                    src={pokemonProfile.spriteUrl}
                    alt=""
                    loading="lazy"
                  />
                ) : null}
                <div>
                  <span>Pokémon #{pokemonProfile.id}</span>
                  <h3>{pokemonProfile.displayName}</h3>
                  <p>{pokemonProfile.genus ?? formatTrait(pokemonProfile)}</p>
                </div>
              </div>

              {pokemonProfile.flavorText ? (
                <p className="pokemon-flavor">{pokemonProfile.flavorText}</p>
              ) : null}

              <div className="type-list">
                {pokemonProfile.types.map((type) => (
                  <span className="type-pill type-Colorless" key={type}>
                    {type}
                  </span>
                ))}
              </div>

              <div className="pokemon-facts">
                <div>
                  <span>Altura</span>
                  <strong>
                    {formatMeasurement(pokemonProfile.heightMeters, 'm')}
                  </strong>
                </div>
                <div>
                  <span>Peso</span>
                  <strong>{formatMeasurement(pokemonProfile.weightKg, 'kg')}</strong>
                </div>
                <div>
                  <span>Captura</span>
                  <strong>{pokemonProfile.captureRate ?? '-'}</strong>
                </div>
                <div>
                  <span>Categoria</span>
                  <strong>{formatTrait(pokemonProfile)}</strong>
                </div>
              </div>

              {pokemonProfile.abilities.length ? (
                <div className="pokemon-detail-row">
                  <span>Habilidades</span>
                  <strong>{pokemonProfile.abilities.join(', ')}</strong>
                </div>
              ) : null}

              {pokemonProfile.evolutionChain.length ? (
                <div className="pokemon-detail-row">
                  <span>Evolução</span>
                  <strong>{pokemonProfile.evolutionChain.join(' > ')}</strong>
                </div>
              ) : null}

              {pokemonProfile.stats.length ? (
                <div className="pokemon-stats">
                  {pokemonProfile.stats.map((stat) => (
                    <div key={stat.label}>
                      <span>{stat.label}</span>
                      <meter min={0} max={255} value={stat.value} />
                      <strong>{stat.value}</strong>
                    </div>
                  ))}
                </div>
              ) : null}

              <a
                className="external-link"
                href={pokemonProfile.sourceUrl}
                target="_blank"
                rel="noreferrer"
              >
                Ver na PokéAPI
                <ExternalLink size={16} aria-hidden="true" />
              </a>
            </section>
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
                      : getQuoteSourceLabel(quote.source)}
                  </span>
                  <span>{formatDateTime(quote.fetchedAt)}</span>
                </div>

                {quote.variants.length ? (
                  <div className="price-variant-list">
                    {quote.variants.map((variant) => (
                      <article className="price-variant-card" key={variant.label}>
                        <h3>{variant.label}</h3>
                        <dl>
                          <div>
                            <dt>Menor preço</dt>
                            <dd>{formatBRL(variant.minimum)}</dd>
                          </div>
                          <div>
                            <dt>Preço médio</dt>
                            <dd>{formatBRL(variant.average)}</dd>
                          </div>
                          <div>
                            <dt>Maior preço</dt>
                            <dd>{formatBRL(variant.maximum)}</dd>
                          </div>
                        </dl>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="quote-empty">
                    {quote.unavailableReason ??
                      'A Liga Pokémon não retornou cotação para esta carta.'}
                  </div>
                )}

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
