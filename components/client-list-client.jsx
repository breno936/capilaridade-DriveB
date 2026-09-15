'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { formatNumber } from '../lib/workshop-utils';

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

export default function ClientListClient() {
  const router = useRouter();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadClients() {
      try {
        setLoading(true);
        const response = await fetch('/api/clients', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Falha ao carregar clientes (${response.status})`);
        const data = await response.json();
        if (!cancelled) {
          setClients(data.clients || []);
          setError('');
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Nao foi possivel carregar os clientes.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadClients();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredClients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) => client.name.toLowerCase().includes(term));
  }, [clients, search]);

  async function createClient(event) {
    event.preventDefault();
    const name = newClientName.trim();
    if (!name) return;

    setIsCreating(true);
    setCreateError('');
    try {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error(`Falha ao criar cliente (${response.status})`);
      const data = await response.json();
      router.push(`/estudo-capilaridade/${data.client.id}`);
    } catch (createErr) {
      setCreateError(createErr.message || 'Nao foi possivel criar o cliente.');
      setIsCreating(false);
    }
  }

  return (
    <div className="study-shell">
      <main className="study-main">
        <header className="topbar">
          <div>
            <div className="title-row">
              <h1>Estudo de Capilaridade</h1>
              <span className="scope-pill">Por cliente</span>
            </div>
            <p>Selecione um cliente para ver o historico de estudos ou crie um novo cliente para comecar.</p>
          </div>
          <div className="topbar-status">
            <Link className="app-switch-link" href="/">
              <span aria-hidden="true">←</span> Voltar ao dashboard
            </Link>
          </div>
        </header>

        <section className="panel upload-panel">
          <div className="panel-heading">
            <div>
              <h2>Novo cliente</h2>
              <p>Cria o registro do cliente e leva direto para o upload da planilha de cidades.</p>
            </div>
          </div>
          <form className="mapping-grid" onSubmit={createClient}>
            <label className="filter-control filter-card mapping-field">
              <span>Nome do cliente</span>
              <input
                type="text"
                placeholder="Ex: Transportadora XYZ"
                value={newClientName}
                onChange={(event) => setNewClientName(event.target.value)}
              />
            </label>
            <button className="primary-button" type="submit" disabled={!newClientName.trim() || isCreating}>
              {isCreating ? 'Criando...' : 'Criar e iniciar estudo'}
            </button>
          </form>
          {createError ? <p className="upload-error">{createError}</p> : null}
        </section>

        <section className="panel table-panel">
          <div className="panel-heading table-heading">
            <div>
              <h2>Clientes com estudo</h2>
              <p>{formatNumber(filteredClients.length)} de {formatNumber(clients.length)} clientes.</p>
            </div>
            <div className="table-actions">
              <input
                type="search"
                placeholder="Buscar cliente..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          {loading ? <p className="muted" style={{ padding: '20px' }}>Carregando clientes...</p> : null}
          {error ? <p className="upload-error" style={{ padding: '0 20px 20px' }}>{error}</p> : null}

          {!loading && !error ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Ultimo estudo</th>
                    <th>Cobertura</th>
                    <th>Cidades</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => (
                    <tr key={client.id} onClick={() => router.push(`/estudo-capilaridade/${client.id}`)} style={{ cursor: 'pointer' }}>
                      <td><strong>{client.name}</strong></td>
                      <td>{client.last_study_at ? formatDate(client.last_study_at) : <span className="muted-small">Nenhum estudo ainda</span>}</td>
                      <td>
                        {client.last_summary
                          ? `${Number(client.last_summary.coveragePercent || 0).toFixed(1).replace('.', ',')}%`
                          : '-'}
                      </td>
                      <td>{client.last_summary ? formatNumber(client.last_summary.total || 0) : '-'}</td>
                    </tr>
                  ))}
                  {!filteredClients.length ? (
                    <tr><td colSpan={4} className="muted">Nenhum cliente encontrado.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
