import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { CardGrid } from '../components/CardGrid';
import { useAuth } from '../hooks/useAuth';
import {
  createCustomCollection,
  deleteCustomCollection,
  subscribeToCustomCollections,
  subscribeToUserCards,
} from '../services/collectionService';
import { loadCatalogCollections, loadCollectionCards } from '../services/catalogService';
import type { CustomCollection, UserCard } from '../types';

export function CustomCollectionsPage() {
  const { user } = useAuth();
  const [collections, setCollections] = useState<CustomCollection[]>([]);
  const [userCards, setUserCards] = useState<UserCard[]>([]);
  const [catalogCollections, setCatalogCollections] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'aleatorio' | 'por-colecao'>('aleatorio');
  const [randomCount, setRandomCount] = useState(6);
  const [selectedCatalogId, setSelectedCatalogId] = useState('');
  const [error, setError] = useState('');
  const [completions, setCompletions] = useState<Record<string, number | null>>({});

  useEffect(() => {
    if (!user) return undefined;

    const unsubCards = subscribeToUserCards(user.uid, (cards) => {
      setUserCards(cards);
    }, (err) => console.error(err));

    const unsubCollections = subscribeToCustomCollections(user.uid, (next) => {
      setCollections(next);
    }, (err) => console.error(err));

    loadCatalogCollections().then(setCatalogCollections).catch(() => setCatalogCollections([]));

    return () => {
      unsubCards?.();
      unsubCollections?.();
    };
  }, [user]);

  const userCardsById = useMemo(() => {
    const map = new Map<string, UserCard>();
    userCards.forEach((c) => map.set(c.id, c));
    return map;
  }, [userCards]);

  async function handleCreate(e?: Event) {
    e?.preventDefault?.();
    if (!user) return;
    setError('');
    setCreating(true);

    try {
      if (!name.trim()) {
        setError('Informe um nome para a coleção');
        return;
      }

      if (mode === 'aleatorio') {
        const pool = [...userCards];
        const pick = [] as UserCard[];
        for (let i = 0; i < Math.min(randomCount, pool.length); i++) {
          const idx = Math.floor(Math.random() * pool.length);
          pick.push(pool.splice(idx, 1)[0]);
        }

        const cardIds = pick.map((c) => c.id);
        await createCustomCollection(user.uid, { name: name.trim(), cardIds, sourceCollectionId: null });
      } else {
        if (!selectedCatalogId) {
          setError('Selecione uma coleção de origem');
          return;
        }

        // load catalog set and pick user's cards that belong to it
        try {
          const catalog = await loadCollectionCards(selectedCatalogId);
          const catalogIds = new Set(catalog.cards.map((c: any) => c.id));
          const ownedIds = userCards.filter((c) => catalogIds.has(c.id)).map((c) => c.id);
          await createCustomCollection(user.uid, { name: name.trim(), cardIds: ownedIds, sourceCollectionId: selectedCatalogId });
        } catch (err) {
          setError('Não foi possível carregar a coleção selecionada');
        }
      }

      setName('');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!user) return;
    await deleteCustomCollection(user.uid, id);
  }

  useEffect(() => {
    let mounted = true;

    async function computeAll() {
      const next: Record<string, number | null> = {};

      await Promise.all(
        collections.map(async (col) => {
          const ownedCount = col.cardIds.filter((id) => userCardsById.has(id)).length;

          if (!col.sourceCollectionId) {
            next[col.id] = col.cardIds.length ? Math.round((ownedCount / col.cardIds.length) * 100) : null;
            return;
          }

          try {
            const catalog = await loadCollectionCards(col.sourceCollectionId!);
            const total = catalog.cardCount ?? (catalog.cards?.length ?? null);
            next[col.id] = total ? Math.round((ownedCount / total) * 100) : null;
          } catch {
            next[col.id] = null;
          }
        }),
      );

      if (mounted) setCompletions(next);
    }

    computeAll();

    return () => {
      mounted = false;
    };
  }, [collections, userCardsById]);

  return (
    <div className="page-stack">
      <section className="page-header">
        <div>
          <span className="eyebrow">Coleções</span>
          <h1>Coleções Personalizadas</h1>
        </div>
      </section>

      <section className="panel">
        <form onSubmit={(e) => { e.preventDefault(); void handleCreate(); }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input placeholder="Nome da coleção" value={name} onChange={(ev) => setName(ev.target.value)} />
            <div>
              <label style={{ marginRight: 8 }}>
                <input type="radio" checked={mode === 'aleatorio'} onChange={() => setMode('aleatorio')} /> Aleatório
              </label>
              <label>
                <input type="radio" checked={mode === 'por-colecao'} onChange={() => setMode('por-colecao')} /> Por coleção
              </label>
            </div>
            {mode === 'aleatorio' ? (
              <input type="number" min={1} max={1000} value={randomCount} onChange={(ev) => setRandomCount(Number(ev.target.value))} style={{ width: 90 }} />
            ) : (
              <select value={selectedCatalogId} onChange={(ev) => setSelectedCatalogId(ev.target.value)}>
                <option value="">Selecione...</option>
                {catalogCollections.map((col: any) => (
                  <option key={col.id} value={col.id}>{col.name}</option>
                ))}
              </select>
            )}
            <button className="primary-action" type="button" disabled={creating} onClick={() => void handleCreate()}>
              <Plus size={16} />
              Criar
            </button>
          </div>
          {error ? <div className="form-error">{error}</div> : null}
        </form>
      </section>

      <section className="panel">
        {collections.length === 0 ? <p>Nenhuma coleção personalizada criada.</p> : (
          <div style={{ display: 'grid', gap: 12 }}>
            {collections.map((col) => {
              const ownedCards = col.cardIds.map((id) => userCardsById.get(id)).filter(Boolean) as UserCard[];
              const isSource = Boolean(col.sourceCollectionId);
              const completion = completions[col.id];

              return (
                <article key={col.id} className="panel" style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{col.name}</strong>
                      <div style={{ fontSize: 12 }}>{ownedCards.length} cartas{isSource ? ' · origem: coleção' : ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div style={{ fontWeight: 800 }}>{completion != null ? `${completion}%` : '—'}</div>
                      <button className="icon-button" type="button" onClick={() => void handleDelete(col.id)} title="Excluir coleção">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {ownedCards.length > 0 ? (
                    <CardGrid cards={ownedCards} onRemove={() => {}} onSelect={() => {}} />
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
