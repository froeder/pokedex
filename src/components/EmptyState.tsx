import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';

export function EmptyState() {
  return (
    <section className="empty-state">
      <div className="empty-icon">
        <Plus size={28} aria-hidden="true" />
      </div>
      <h2>Sua Pokédex ainda está vazia</h2>
      <p>Adicione cartas do catálogo para acompanhar sua coleção.</p>
      <Link className="primary-action" to="/adicionar">
        <Plus size={18} aria-hidden="true" />
        Adicionar carta
      </Link>
    </section>
  );
}
