'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import {
  boolOptions,
  buildStrategicSummary,
  countBy,
  defaultFilters,
  downloadCsv,
  enrichWorkshops,
  filterWorkshops,
  formatNumber,
  formatStateLabel,
  googleMapsUrl,
  layerOptions,
  locationOptions,
  percent,
  uniqueValues,
} from '../lib/workshop-utils';

const MapView = dynamic(() => import('./map-view'), {
  ssr: false,
  loading: () => <div className="map-loading">Carregando mapa...</div>,
});

const PAGE_SIZE = 25;

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Breakdown({ data, formatter }) {
  const entries = Object.entries(data).sort((left, right) => right[1] - left[1]).slice(0, 6);
  const peak = entries.length ? entries[0][1] : 0;

  if (!entries.length) {
    return <p className="muted">Sem dados para o recorte atual.</p>;
  }

  return entries.map(([label, value]) => {
    const width = peak ? Math.max((value / peak) * 100, 8) : 0;
    return (
      <div className="breakdown-row" key={label}>
        <div>
          <strong>{formatter(label)}</strong>
          <div className="breakdown-track">
            <div className="breakdown-fill" style={{ width: `${width.toFixed(1)}%` }} />
          </div>
        </div>
        <strong>{formatNumber(value)}</strong>
      </div>
    );
  });
}

function WorkshopBadges({ item }) {
  return (
    <div className="badges">
      <span className="badge info">{item.concept || 'Sem conceito'}</span>
      <span className="badge">{item.coverageLabel}</span>
      <span className="badge">{formatStateLabel(item.stateCode)}</span>
      <span className="badge">Rede {item.networkId || '-'}</span>
      <span className="badge">Categoria {item.categoryId || '-'}</span>
      <span className={`badge ${item.isActive ? 'success' : 'danger'}`}>{item.isActive ? 'Ativa' : 'Inativa'}</span>
      {item.isBlocked ? <span className="badge danger">Bloqueada</span> : null}
      {item.isOffline ? <span className="badge warning">Offline</span> : null}
      {!item.isOperational ? <span className="badge danger">Fora da cobertura operacional</span> : null}
      {!item.isInBrazil ? <span className="badge danger">Fora do Brasil</span> : null}
    </div>
  );
}

function StatusCard({ title, description }) {
  return (
    <main className="status-shell">
      <section className="status-card">
        <p className="eyebrow">Capilaridade</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </section>
    </main>
  );
}

function RecommendationItem({ item }) {
  return (
    <div className={`recommendation-item ${item.tone}`}>
      <strong>{item.title}</strong>
      <p>{item.body}</p>
    </div>
  );
}

function PriorityStateRow({ report }) {
  const statusLabel = report.status === 'critical' ? 'Crítico' : report.status === 'attention' ? 'Atenção' : 'Ideal';

  return (
    <div className="priority-row">
      <div className="priority-copy">
        <div className="priority-title">
          <strong>{report.groupName}</strong>
          <span className={`status-chip ${report.status}`}>{statusLabel}</span>
        </div>
        <p>
          Operacionais: {formatNumber(report.operationalCounts.oficina)} oficinas, {formatNumber(report.operationalCounts.vidros)} vidros e {formatNumber(report.operationalCounts.pneus)} pneus.
        </p>
        <p className="muted">
          Gap mínimo: {report.minimumDeficitText || 'atendido'} · Gap ideal: {report.idealDeficitText || 'atendido'}
        </p>
      </div>
      <div className="priority-metric">
        <strong>{formatNumber(report.total)}</strong>
        <span>registros</span>
      </div>
    </div>
  );
}

export default function DashboardClient() {
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(defaultFilters);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [fitRequestToken, setFitRequestToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        const response = await fetch('/data/workshops.json', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Falha ao carregar dataset (${response.status})`);
        }
        const payload = await response.json();
        if (!cancelled) {
          setWorkshops(enrichWorkshops(payload));
          setError('');
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || 'Não foi possível carregar o dataset.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredWorkshops = useMemo(() => filterWorkshops(workshops, filters), [filters, workshops]);

  useEffect(() => {
    if (selectedId && !filteredWorkshops.some((item) => item.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filteredWorkshops, selectedId]);

  const conceptOptions = useMemo(
    () => [{ value: 'all', label: 'Todos' }, ...uniqueValues(workshops, 'concept').map((value) => ({ value, label: value }))],
    [workshops],
  );
  const checkoutOptions = useMemo(
    () => [{ value: 'all', label: 'Todos' }, ...uniqueValues(workshops, 'checkoutType').map((value) => ({ value, label: value }))],
    [workshops],
  );
  const networkOptions = useMemo(
    () => [{ value: 'all', label: 'Todas' }, ...uniqueValues(workshops, 'networkId').map((value) => ({ value, label: `Rede ${value}` }))],
    [workshops],
  );
  const categoryOptions = useMemo(
    () => [{ value: 'all', label: 'Todas' }, ...uniqueValues(workshops, 'categoryId').map((value) => ({ value, label: `Categoria ${value}` }))],
    [workshops],
  );
  const stateOptions = useMemo(
    () => [{ value: 'all', label: 'Todos' }, ...uniqueValues(workshops, 'stateCode').map((value) => ({ value, label: formatStateLabel(value) }))],
    [workshops],
  );
  const cityOptions = useMemo(() => {
    const scoped = filters.state === 'all'
      ? workshops
      : workshops.filter((item) => item.stateCode === filters.state);
    const uniqueCities = [...new Map(
      scoped
        .filter((item) => item.cityKey && item.cityDisplayName)
        .map((item) => [item.cityKey, item.cityDisplayName]),
    ).entries()].sort((left, right) => left[1].localeCompare(right[1], 'pt-BR'));

    return [{ value: 'all', label: 'Todas' }, ...uniqueCities.map(([value, label]) => ({ value, label }))];
  }, [filters.state, workshops]);
  const regionServiceOptions = useMemo(
    () => [{ value: 'all', label: 'Todas' }, ...uniqueValues(workshops, 'regionServiceId').map((value) => ({ value, label: `Serviço ${value}` }))],
    [workshops],
  );
  const regionPartOptions = useMemo(
    () => [{ value: 'all', label: 'Todas' }, ...uniqueValues(workshops, 'regionPartId').map((value) => ({ value, label: `Peças ${value}` }))],
    [workshops],
  );

  const totalPages = Math.max(1, Math.ceil(filteredWorkshops.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredWorkshops.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const activeCount = filteredWorkshops.filter((item) => item.isActive).length;
  const operationalCount = filteredWorkshops.filter((item) => item.isOperational).length;
  const blockedCount = filteredWorkshops.filter((item) => item.isBlocked).length;
  const outsideCount = filteredWorkshops.filter((item) => !item.isInBrazil).length;
  const insideCount = filteredWorkshops.filter((item) => item.isInBrazil).length;
  const cityResolvedCount = filteredWorkshops.filter((item) => item.cityName).length;
  const networkCount = new Set(filteredWorkshops.map((item) => item.networkId).filter(Boolean)).size;

  const conceptDistribution = countBy(filteredWorkshops, 'concept');
  const stateDistribution = countBy(filteredWorkshops.filter((item) => item.stateCode), 'stateCode');
  const cityDistribution = countBy(filteredWorkshops.filter((item) => item.cityDisplayName), 'cityDisplayName');
  const totalOutside = workshops.filter((item) => !item.isInBrazil).length;
  const strategicDimension = filters.state !== 'all' && cityResolvedCount > 0 ? 'city' : 'state';
  const strategicSummary = useMemo(() => buildStrategicSummary(filteredWorkshops, strategicDimension), [filteredWorkshops, strategicDimension]);
  const currentScopeLabel = filters.state !== 'all' ? formatStateLabel(filters.state) : 'Brasil';

  function updateFilter(key, value) {
    setFilters((previous) => {
      if (key === 'state') {
        return { ...previous, state: value, city: 'all' };
      }
      return { ...previous, [key]: value };
    });
    setPage(1);
    setFitRequestToken((previous) => previous + 1);
  }

  function resetFilters() {
    setFilters(defaultFilters);
    setPage(1);
    setSelectedId(null);
    setFitRequestToken((previous) => previous + 1);
  }

  if (loading) {
    return <StatusCard title="Carregando dashboard" description="Lendo o dataset exportado e preparando o mapa com a inteligência de cobertura." />;
  }

  if (error) {
    return <StatusCard title="Falha ao carregar os dados" description={error} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-card">
          <p className="eyebrow">Dashboard</p>
          <h1>Capilaridade das oficinas</h1>
          <p className="muted">Agora com leitura estratégica por estado, classificação de cobertura e recomendações acionáveis em tempo real.</p>
        </div>

        <section className="panel">
          <div className="panel-header">
            <h2>Filtros</h2>
            <button className="ghost-button" onClick={resetFilters}>Limpar</button>
          </div>

          <label className="field">
            <span>Busca</span>
            <input
              type="search"
              placeholder="Nome, SAP, CNPJ, UF ou cobertura"
              value={filters.search}
              onChange={(event) => updateFilter('search', event.target.value)}
            />
          </label>

          <div className="field-grid">
            <FilterSelect label="Conceito" value={filters.concept} onChange={(value) => updateFilter('concept', value)} options={conceptOptions} />
            <FilterSelect label="Checkout" value={filters.checkoutType} onChange={(value) => updateFilter('checkoutType', value)} options={checkoutOptions} />
            <FilterSelect label="Rede" value={filters.networkId} onChange={(value) => updateFilter('networkId', value)} options={networkOptions} />
            <FilterSelect label="Categoria" value={filters.categoryId} onChange={(value) => updateFilter('categoryId', value)} options={categoryOptions} />
            <FilterSelect label="Estado" value={filters.state} onChange={(value) => updateFilter('state', value)} options={stateOptions} />
            <FilterSelect label="Cidade" value={filters.city} onChange={(value) => updateFilter('city', value)} options={cityOptions} />
            <FilterSelect label="Região serviço" value={filters.regionServiceId} onChange={(value) => updateFilter('regionServiceId', value)} options={regionServiceOptions} />
            <FilterSelect label="Região peças" value={filters.regionPartId} onChange={(value) => updateFilter('regionPartId', value)} options={regionPartOptions} />
            <FilterSelect label="Ativa" value={filters.isActive} onChange={(value) => updateFilter('isActive', value)} options={boolOptions} />
            <FilterSelect label="Bloqueada" value={filters.isBlocked} onChange={(value) => updateFilter('isBlocked', value)} options={boolOptions} />
            <FilterSelect label="Offline" value={filters.isOffline} onChange={(value) => updateFilter('isOffline', value)} options={boolOptions} />
            <FilterSelect label="Fee" value={filters.isFee} onChange={(value) => updateFilter('isFee', value)} options={boolOptions} />
            <FilterSelect label="Margem" value={filters.isMargin} onChange={(value) => updateFilter('isMargin', value)} options={boolOptions} />
            <FilterSelect label="White label" value={filters.isWhiteLabel} onChange={(value) => updateFilter('isWhiteLabel', value)} options={boolOptions} />
            <FilterSelect label="Dahruj" value={filters.isDahruj} onChange={(value) => updateFilter('isDahruj', value)} options={boolOptions} />
            <FilterSelect label="Sem intermediação" value={filters.isNoIntermediation} onChange={(value) => updateFilter('isNoIntermediation', value)} options={boolOptions} />
            <FilterSelect label="Recorte geográfico" value={filters.locationScope} onChange={(value) => updateFilter('locationScope', value)} options={locationOptions} />
            <FilterSelect label="Camada do mapa" value={filters.layerMode} onChange={(value) => updateFilter('layerMode', value)} options={layerOptions} />
          </div>
        </section>

        <section className="panel compact-panel">
          <div className="panel-header">
            <h2>Resumo filtrado</h2>
            <button className="primary-button" onClick={() => downloadCsv(filteredWorkshops)}>Exportar CSV</button>
          </div>
          <div className="summary-list">
            <div className="summary-item"><span>Recorte atual</span><strong>{currentScopeLabel}</strong></div>
            <div className="summary-item"><span>Cobertura no Brasil</span><strong>{percent(insideCount, filteredWorkshops.length)}</strong></div>
            <div className="summary-item"><span>Cidades resolvidas</span><strong>{formatNumber(cityResolvedCount)}</strong></div>
            <div className="summary-item"><span>Operacionais</span><strong>{formatNumber(operationalCount)}</strong></div>
            <div className="summary-item"><span>{strategicSummary.dimension === 'city' ? 'Cidades críticas' : 'Estados críticos'}</span><strong>{formatNumber(strategicSummary.criticalStates.length)}</strong></div>
            <div className="summary-item"><span>{strategicSummary.dimension === 'city' ? 'Cidades ideais' : 'Estados ideais'}</span><strong>{formatNumber(strategicSummary.idealStates.length)}</strong></div>
          </div>
        </section>
      </aside>

      <main className="main-content">
        <section className="hero">
          <div>
            <p className="eyebrow">Cobertura nacional</p>
            <h2>Mapa de calor do Brasil</h2>
            <p className="muted">
              {formatNumber(filteredWorkshops.length)} oficinas no recorte, {formatNumber(activeCount)} ativas, {formatNumber(operationalCount)} operacionais e foco atual em {currentScopeLabel}.
            </p>
          </div>
          <div className="legend-box">
            <span>Baixa densidade</span>
            <div className="legend-gradient" />
            <span>Alta densidade</span>
          </div>
        </section>

        <section className="kpi-grid">
          <article className="kpi-card">
            <div className="kpi-label">Oficinas filtradas</div>
            <div className="kpi-value">{formatNumber(filteredWorkshops.length)}</div>
            <div className="kpi-meta">{formatNumber(workshops.length)} registros na base</div>
          </article>
          <article className="kpi-card">
            <div className="kpi-label">Operacionais</div>
            <div className="kpi-value">{formatNumber(operationalCount)}</div>
            <div className="kpi-meta">{percent(operationalCount, filteredWorkshops.length)} da seleção atual</div>
          </article>
          <article className="kpi-card">
            <div className="kpi-label">{strategicSummary.dimension === 'city' ? 'Cidades críticas' : 'Estados críticos'}</div>
            <div className="kpi-value">{formatNumber(strategicSummary.criticalStates.length)}</div>
            <div className="kpi-meta">Sem 1 oficina + 1 vidros + 1 pneus</div>
          </article>
          <article className="kpi-card">
            <div className="kpi-label">Redes no recorte</div>
            <div className="kpi-value">{formatNumber(networkCount)}</div>
            <div className="kpi-meta">{formatNumber(outsideCount)} pontos fora do Brasil</div>
          </article>
        </section>

        <section className={`quality-banner ${totalOutside ? '' : 'hidden'}`}>
          A base possui <strong>{formatNumber(totalOutside)}</strong> registros fora do bounding box do Brasil. No filtro atual, <strong>{formatNumber(outsideCount)}</strong> aparecem fora do país. O dashboard inicia priorizando apenas coordenadas brasileiras para evitar distorção no mapa de calor.
        </section>

        <section className="map-panel panel wide-panel">
          <div className="panel-header stacked-mobile">
            <div>
              <h2>Distribuição geográfica</h2>
              <p className="muted">Heatmap, pontos clicáveis, leitura por estado e navegação sincronizada com a lista.</p>
            </div>
            <button className="ghost-button" onClick={() => setFitRequestToken((previous) => previous + 1)}>Reenquadrar mapa</button>
          </div>
          <MapView
            workshops={filteredWorkshops}
            selectedId={selectedId}
            onSelect={setSelectedId}
            layerMode={filters.layerMode}
            fitRequestToken={fitRequestToken}
          />
        </section>

        <section className="analytics-grid">
          <div className="panel wide-panel">
            <div className="panel-header">
              <h2>Distribuição por conceito</h2>
              <span className="muted">Peso relativo da seleção atual</span>
            </div>
            <div className="breakdown-list">
              <Breakdown data={conceptDistribution} formatter={(label) => label} />
            </div>
          </div>
          <div className="panel wide-panel">
            <div className="panel-header">
              <h2>{filters.state === 'all' ? 'Distribuição por estado' : 'Distribuição por cidade'}</h2>
              <span className="muted">{filters.state === 'all' ? 'Maiores concentrações do filtro' : 'Cidades mais fortes dentro do estado selecionado'}</span>
            </div>
            <div className="breakdown-list">
              <Breakdown
                data={filters.state === 'all' ? stateDistribution : cityDistribution}
                formatter={(label) => (filters.state === 'all' ? formatStateLabel(label) : label)}
              />
            </div>
          </div>
        </section>

        <section className="strategy-grid">
          <div className="panel wide-panel">
            <div className="panel-header">
              <h2>Radar estratégico</h2>
              <span className="muted">Recalcula em tempo real em nível de {strategicSummary.dimension === 'city' ? 'cidade' : 'estado'}</span>
            </div>
            <div className="strategy-copy">
              <strong>{strategicSummary.headline}</strong>
              <p className="muted">{strategicSummary.narrative}</p>
            </div>
            <div className="summary-list strategy-mini-kpis">
              <div className="summary-item"><span>{strategicSummary.dimension === 'city' ? 'Cidades analisadas' : 'Estados analisados'}</span><strong>{formatNumber(strategicSummary.reports.length)}</strong></div>
              <div className="summary-item"><span>Em atenção</span><strong>{formatNumber(strategicSummary.attentionStates.length)}</strong></div>
              <div className="summary-item"><span>Meta ideal atendida</span><strong>{formatNumber(strategicSummary.idealStates.length)}</strong></div>
            </div>
            <div className="recommendation-list">
              {strategicSummary.recommendations.map((item) => (
                <RecommendationItem key={item.title} item={item} />
              ))}
            </div>
          </div>

          <div className="panel wide-panel">
            <div className="panel-header">
              <h2>Onde atacar primeiro</h2>
              <span className="muted">Prioridade para preencher pilares mínimos e depois adensar em {strategicSummary.dimension === 'city' ? 'cidades' : 'estados'}</span>
            </div>
            <div className="priority-list">
              {strategicSummary.topPriorityStates.length ? (
                strategicSummary.topPriorityStates.map((report) => (
                  <PriorityStateRow key={report.groupKey} report={report} />
                ))
              ) : (
                <p className="muted">Nenhuma localidade com gap no recorte atual.</p>
              )}
            </div>
          </div>
        </section>

        <section className="panel wide-panel">
          <div className="panel-header stacked-mobile">
            <div>
              <h2>Oficinas filtradas</h2>
              <p className="muted">
                {filteredWorkshops.length
                  ? `${formatNumber(filteredWorkshops.length)} oficinas no recorte atual. Exibindo ${formatNumber(pageItems.length)} por página.`
                  : 'Nenhuma oficina encontrada para o filtro atual.'}
              </p>
            </div>
            <div className="pagination-controls">
              <button className="ghost-button" disabled={currentPage === 1} onClick={() => setPage((previous) => Math.max(1, previous - 1))}>Anterior</button>
              <span className="muted">Página {currentPage} de {totalPages}</span>
              <button className="ghost-button" disabled={currentPage === totalPages} onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}>Próxima</button>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Oficina</th>
                  <th>Conceito</th>
                  <th>Rede</th>
                  <th>Status</th>
                  <th>Coordenadas</th>
                  <th>Contato</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => (
                  <tr key={item.id} className={selectedId === item.id ? 'is-selected' : ''} onClick={() => setSelectedId(item.id)}>
                    <td>
                      <div className="result-name">{item.displayName}</div>
                      <div className="result-subtitle">SAP {item.sapId || '-'} · {item.cityDisplayName || formatStateLabel(item.stateCode)} · {item.coverageLabel}</div>
                      <WorkshopBadges item={item} />
                    </td>
                    <td>{item.concept || 'N/D'}</td>
                    <td>Rede {item.networkId || '-'}<br /><span className="result-subtitle">Categoria {item.categoryId || '-'}</span></td>
                    <td>
                      {item.isActive ? 'Ativa' : 'Inativa'}<br />
                      {item.isBlocked ? 'Bloqueada' : 'Disponível'}<br />
                      {item.isOffline ? 'Offline' : 'Online'}
                      {item.checkoutType && item.checkoutType !== 'NO' ? <><br />Checkout {item.checkoutType.toLowerCase()}</> : null}
                    </td>
                    <td>
                      {item.lat.toFixed(5)}, {item.lng.toFixed(5)}<br />
                      <a className="link-button" href={googleMapsUrl(item)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                        abrir mapa
                      </a>
                    </td>
                    <td>
                      {item.phone || item.ownerMobilePhone || 'N/D'}<br />
                      <span className="result-subtitle">{item.email || item.ownerEmail || 'Sem e-mail'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
