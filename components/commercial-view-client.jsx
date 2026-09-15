'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  coverageTypeOptions,
  countBy,
  defaultFilters,
  downloadCommercialCsv,
  enrichWorkshops,
  filterWorkshops,
  formatNumber,
  formatStateLabel,
  googleMapsUrl,
  layerOptions,
  mapThemeOptions,
  percent,
  solutionLabel,
  solutionOptions,
  uniqueValues,
} from '../lib/workshop-utils';
import { brandIconUrl } from '../lib/workshop-brands';
import initialCityCache from '../data/city-cache.json';
import initialWorkshopCategories from '../data/workshop-categories.json';

const MapView = dynamic(() => import('./map-view'), {
  ssr: false,
  loading: () => <div className="map-loading">Carregando mapa...</div>,
});

const PAGE_SIZE = 10;
const chartColors = ['#6c5dd3', '#2f6fed', '#f97316', '#667085', '#12b76a', '#e5484d'];

const commercialDefaultFilters = {
  search: '',
  franchiseId: 'all',
  state: 'all',
  city: 'all',
  coverageType: 'all',
  brand: 'all',
  mapTheme: 'light',
  layerMode: 'both',
};

const safetyFilters = {
  isActive: 'true',
  isBlocked: 'false',
  locationScope: 'in_brazil',
  cityResolution: 'resolved',
};

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

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="filter-control filter-card">
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

function SegmentedControl({ value, onChange, options, ariaLabel }) {
  return (
    <div className="segmented-control" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          className={value === option.value ? 'is-active' : ''}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function KpiCard({ label, value, meta, tone = 'cyan', icon, badge }) {
  return (
    <article className={`kpi-card tone-${tone}`}>
      <span className="kpi-accent" aria-hidden="true" />
      <div className="kpi-topline">
        <span>{label}</span>
        <span className="metric-icon" aria-hidden="true">{icon}</span>
      </div>
      <strong className="kpi-value">{value}</strong>
      <div className="kpi-meta">
        {badge ? <span className={`state-badge ${tone}`}>{badge}</span> : null}
        <span>{meta}</span>
      </div>
    </article>
  );
}

function Breakdown({ data, formatter }) {
  const entries = Object.entries(data).sort((left, right) => right[1] - left[1]).slice(0, 8);
  const peak = entries.length ? entries[0][1] : 0;

  if (!entries.length) return <p className="muted">Sem dados para o recorte atual.</p>;

  return (
    <div className="breakdown-list">
      {entries.map(([label, value], index) => {
        const width = peak ? Math.max((value / peak) * 100, 7) : 0;
        return (
          <div className="breakdown-row" key={label}>
            <div className="breakdown-label">
              <span className="legend-dot" style={{ background: chartColors[index % chartColors.length] }} />
              <strong>{formatter(label)}</strong>
            </div>
            <div className="breakdown-track">
              <div
                className="breakdown-fill"
                style={{ width: `${width.toFixed(1)}%`, background: chartColors[index % chartColors.length] }}
              />
            </div>
            <span>{formatNumber(value)}</span>
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({ data, formatter }) {
  const entries = Object.entries(data).sort((left, right) => right[1] - left[1]).slice(0, 5);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  let cursor = 0;
  const gradient = entries.length
    ? entries.map(([, value], index) => {
      const start = cursor;
      const end = cursor + (value / total) * 360;
      cursor = end;
      return `${chartColors[index % chartColors.length]} ${start}deg ${end}deg`;
    }).join(', ')
    : '#e4e7ec 0deg 360deg';

  return (
    <div className="donut-layout">
      <div className="donut-chart" style={{ background: `conic-gradient(${gradient})` }}>
        <div>
          <strong>{formatNumber(total)}</strong>
          <span>oficinas</span>
        </div>
      </div>
      <div className="donut-legend">
        {entries.map(([label, value], index) => (
          <div key={label}>
            <span className="legend-dot" style={{ background: chartColors[index % chartColors.length] }} />
            <span>{formatter(label)}</span>
            <strong>{percent(value, total)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CommercialViewClient() {
  const [workshops, setWorkshops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(commercialDefaultFilters);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);
  const [fitRequestToken, setFitRequestToken] = useState(0);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  useEffect(() => {
    if (!isMapFullscreen) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') setIsMapFullscreen(false);
    }

    document.body.classList.add('map-fullscreen-active');
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('map-fullscreen-active');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMapFullscreen]);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      try {
        setLoading(true);
        const response = await fetch('/data/workshops.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Falha ao carregar dataset (${response.status})`);
        const payload = await response.json();
        if (!cancelled) {
          setWorkshops(enrichWorkshops(payload, initialCityCache, initialWorkshopCategories));
          setError('');
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Nao foi possivel carregar o dataset.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const operationalWorkshops = useMemo(
    () => filterWorkshops(workshops, { ...defaultFilters, ...safetyFilters }),
    [workshops],
  );

  const filteredWorkshops = useMemo(() => {
    const base = filterWorkshops(workshops, {
      ...defaultFilters,
      ...safetyFilters,
      search: filters.search,
      franchiseId: filters.franchiseId,
      state: filters.state,
      city: filters.city,
      brand: filters.brand,
    });
    return filters.coverageType === 'all' ? base : base.filter((item) => item.serviceType === filters.coverageType);
  }, [workshops, filters]);

  useEffect(() => {
    if (selectedId && !filteredWorkshops.some((item) => item.id === selectedId)) setSelectedId(null);
  }, [filteredWorkshops, selectedId]);

  const stateOptions = useMemo(
    () => [{ value: 'all', label: 'Todos os estados' }, ...uniqueValues(operationalWorkshops, 'stateCode').map((value) => ({ value, label: formatStateLabel(value) }))],
    [operationalWorkshops],
  );
  const cityOptions = useMemo(() => {
    const scoped = filters.state === 'all' ? operationalWorkshops : operationalWorkshops.filter((item) => item.stateCode === filters.state);
    const uniqueCities = [...new Map(
      scoped.filter((item) => item.cityKey && item.cityDisplayName).map((item) => [item.cityKey, item.cityDisplayName]),
    ).entries()].sort((left, right) => left[1].localeCompare(right[1], 'pt-BR'));

    return [{ value: 'all', label: 'Todas as cidades' }, ...uniqueCities.map(([value, label]) => ({ value, label }))];
  }, [filters.state, operationalWorkshops]);

  const brandOptions = useMemo(() => {
    const labels = new Map();
    operationalWorkshops.forEach((item) => { if (item.brandSlug) labels.set(item.brandSlug, item.brandLabel); });
    return [
      { value: 'all', label: 'Todas' },
      ...[...labels.entries()].sort((left, right) => left[1].localeCompare(right[1], 'pt-BR')).map(([value, label]) => ({ value, label })),
    ];
  }, [operationalWorkshops]);

  const brandSummary = useMemo(() => {
    const counts = new Map();
    filteredWorkshops.forEach((item) => {
      if (!item.brandSlug) return;
      const current = counts.get(item.brandSlug);
      counts.set(item.brandSlug, { slug: item.brandSlug, label: item.brandLabel, hasIcon: item.brandHasIcon, count: (current?.count || 0) + 1 });
    });
    return [...counts.values()].sort((left, right) => right.count - left.count);
  }, [filteredWorkshops]);

  const totalPages = Math.max(1, Math.ceil(filteredWorkshops.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredWorkshops.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const stateCount = new Set(filteredWorkshops.map((item) => item.stateCode).filter(Boolean)).size;
  const cityCount = new Set(filteredWorkshops.map((item) => item.cityKey).filter(Boolean)).size;
  const stateDistribution = countBy(filteredWorkshops.filter((item) => item.stateCode), 'stateCode');
  const coverageDistribution = countBy(filteredWorkshops, 'coverageLabel');
  const currentScopeLabel = filters.state !== 'all' ? formatStateLabel(filters.state) : 'Brasil';

  function updateFilter(key, value) {
    setFilters((previous) => {
      if (key === 'state') return { ...previous, state: value, city: 'all' };
      return { ...previous, [key]: value };
    });
    setPage(1);
    setFitRequestToken((previous) => previous + 1);
  }

  function resetFilters() {
    setFilters(commercialDefaultFilters);
    setPage(1);
    setSelectedId(null);
    setFitRequestToken((previous) => previous + 1);
  }

  if (loading) {
    return <StatusCard title="Carregando visao comercial" description="Preparando a apresentacao da rede credenciada." />;
  }

  if (error) {
    return <StatusCard title="Falha ao carregar os dados" description={error} />;
  }

  return (
    <div className="study-shell">
      <main className="study-main">
        <header className="topbar">
          <div>
            <div className="title-row">
              <h1>Nossa Rede Credenciada</h1>
              <span className="scope-pill">{currentScopeLabel}</span>
            </div>
            <p>Apresente ao cliente a capilaridade da rede DriveB: oficinas ativas, cobertura por estado e cidade e marcas parceiras. Feito para uso em reunioes comerciais.</p>
          </div>
          <div className="topbar-status">
            <Link className="app-switch-link" href="/">
              <span aria-hidden="true">←</span> Painel interno
            </Link>
            <button className="icon-button" onClick={() => setFitRequestToken((previous) => previous + 1)} title="Atualizar enquadramento" type="button">↻</button>
          </div>
        </header>

        <section className="kpi-grid">
          <KpiCard
            label="Oficinas ativas na rede"
            value={formatNumber(filteredWorkshops.length)}
            meta="Somente pontos ativos e em operacao"
            badge="Rede"
            icon="◦"
          />
          <KpiCard
            label="Estados atendidos"
            value={formatNumber(stateCount)}
            meta="Cobertura no recorte atual"
            tone="green"
            badge="Cobertura"
            icon="▦"
          />
          <KpiCard
            label="Cidades atendidas"
            value={formatNumber(cityCount)}
            meta="Cidades com oficina mapeada"
            badge="Presenca"
            icon="◈"
          />
          <KpiCard
            label="Marcas parceiras"
            value={formatNumber(brandSummary.length)}
            meta="Marcas reconhecidas no recorte atual"
            tone="green"
            badge="Parceria"
            icon="✚"
          />
        </section>

        <section className="panel commercial-filter-panel">
          <div className="panel-heading compact">
            <span>Filtros de apresentacao</span>
            <button className="text-button" onClick={resetFilters} type="button">Limpar</button>
          </div>

          <div className="filter-control">
            <span>Solucao</span>
            <SegmentedControl
              value={filters.franchiseId}
              onChange={(value) => updateFilter('franchiseId', value)}
              options={solutionOptions}
              ariaLabel="Solucao"
            />
          </div>

          <div className="commercial-filter-grid">
            <FilterSelect label="Estado (UF)" value={filters.state} onChange={(value) => updateFilter('state', value)} options={stateOptions} />
            <FilterSelect label="Cidade" value={filters.city} onChange={(value) => updateFilter('city', value)} options={cityOptions} />
            <FilterSelect label="Cobertura" value={filters.coverageType} onChange={(value) => updateFilter('coverageType', value)} options={coverageTypeOptions} />
            <FilterSelect label="Marca" value={filters.brand} onChange={(value) => updateFilter('brand', value)} options={brandOptions} />
            <FilterSelect label="Mapa base" value={filters.mapTheme} onChange={(value) => updateFilter('mapTheme', value)} options={mapThemeOptions} />
          </div>

          <div className="commercial-actions">
            <label className="search-control">
              <span>Buscar cidade do cliente</span>
              <input
                type="search"
                placeholder="Oficina, cidade ou UF"
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
              />
            </label>
            <button className="primary-button" onClick={() => setFitRequestToken((previous) => previous + 1)} type="button">Reenquadrar mapa</button>
          </div>
        </section>

        <section className={`panel map-panel commercial-map-panel ${isMapFullscreen ? 'is-fullscreen' : ''}`}>
          <div className="panel-heading">
            <div>
              <h2>Mapa da rede</h2>
              <p>Pontos e mapa de calor da rede ativa no recorte selecionado. Use a tela cheia para apresentar ao cliente.</p>
            </div>
            <div className="map-panel-controls">
              <SegmentedControl value={filters.layerMode} onChange={(value) => updateFilter('layerMode', value)} options={layerOptions} ariaLabel="Camada do mapa" />
              <button
                className="icon-button"
                onClick={() => setIsMapFullscreen((previous) => !previous)}
                title={isMapFullscreen ? 'Sair da tela cheia' : 'Ver mapa em tela cheia'}
                type="button"
              >
                {isMapFullscreen ? '⤡' : '⤢'}
              </button>
            </div>
          </div>
          <MapView
            workshops={filteredWorkshops}
            selectedId={selectedId}
            onSelect={setSelectedId}
            layerMode={filters.layerMode}
            mapTheme={filters.mapTheme}
            fitRequestToken={fitRequestToken}
            isFullscreen={isMapFullscreen}
          />
        </section>

        <section className="analytics-grid compact-analytics">
          <article className="panel">
            <div className="panel-heading">
              <h2>Presenca por Estado</h2>
            </div>
            <Breakdown data={stateDistribution} formatter={(label) => formatStateLabel(label)} />
          </article>

          <article className="panel">
            <div className="panel-heading">
              <h2>Distribuicao por Cobertura</h2>
            </div>
            <DonutChart data={coverageDistribution} formatter={(label) => label} />
          </article>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Marcas parceiras</h2>
              <p>Marcas e categorias identificadas na base de oficinas no recorte atual.</p>
            </div>
          </div>
          {brandSummary.length ? (
            <div className="brand-grid">
              {brandSummary.map((brand) => (
                <div className="brand-chip" key={brand.slug}>
                  {brand.hasIcon ? (
                    <img
                      src={brandIconUrl(brand.slug)}
                      alt={brand.label}
                      loading="lazy"
                      onError={(event) => { event.currentTarget.style.display = 'none'; }}
                    />
                  ) : null}
                  <strong>{brand.label}</strong>
                  <span>{formatNumber(brand.count)} oficinas</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ padding: '20px' }}>Nenhuma marca reconhecida automaticamente no recorte atual.</p>
          )}
        </section>

        <section className="panel table-panel">
          <div className="panel-heading table-heading">
            <div>
              <h2>Oficinas da rede</h2>
              <p>Mostrando {formatNumber(pageItems.length)} de {formatNumber(filteredWorkshops.length)} oficinas no recorte atual.</p>
            </div>
            <div className="table-actions">
              <button className="icon-button" onClick={() => downloadCommercialCsv(filteredWorkshops)} title="Exportar lista (CSV)" type="button">⇩</button>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Nome da oficina</th>
                  <th>Cidade / UF</th>
                  <th>Cobertura</th>
                  <th>Marca</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => {
                  return (
                    <tr
                      key={item.id}
                      className={selectedId === item.id ? 'is-selected' : ''}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <td>
                        <div className="workshop-title">
                          <span className="row-icon" aria-hidden="true">⌁</span>
                          <div>
                            <strong>{item.displayName}</strong>
                            <span>{item.corporateName || solutionLabel(item.franchiseId)}</span>
                          </div>
                        </div>
                      </td>
                      <td>{item.cityDisplayName}</td>
                      <td><span className="badge info">{item.serviceTypeLabel || item.coverageLabel}</span></td>
                      <td>{item.brandLabel || <span className="muted-small">Independente</span>}</td>
                      <td>
                        <a className="action-link" href={googleMapsUrl(item)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>
                          Mapa
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <span>Mostrando pagina {currentPage} de {totalPages}</span>
            <div>
              <button className="icon-button" disabled={currentPage === 1} onClick={() => setPage((previous) => Math.max(1, previous - 1))} type="button">‹</button>
              <button className="page-button is-active" type="button">{currentPage}</button>
              <button className="icon-button" disabled={currentPage === totalPages} onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))} type="button">›</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
