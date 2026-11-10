'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  defaultFilters,
  enrichWorkshops,
  filterWorkshops,
  formatNumber,
  formatStateLabel,
} from '../lib/workshop-utils';
import {
  annotateDealers,
  buildDealerCoverageMap,
  downloadDealersCsv,
  googleMapsSearchUrl,
} from '../lib/manufacturer-dealers';
import { brandIconUrl } from '../lib/workshop-brands';
import initialCityCache from '../data/city-cache.json';
import initialWorkshopCategories from '../data/workshop-categories.json';
import initialHeavyFleet from '../data/workshop-heavy-fleet.json';
import initialConcessionariaBrands from '../data/workshop-concessionaria-brands.json';
import initialNetworkConsultants from '../data/workshop-network-consultants.json';

const MapView = dynamic(() => import('./map-view'), {
  ssr: false,
  loading: () => <div className="map-loading">Carregando mapa...</div>,
});

const PAGE_SIZE = 15;

const prospeccaoDefaultFilters = {
  search: '',
  brand: 'all',
  state: 'all',
  status: 'opportunity',
};

const statusOptions = [
  { value: 'opportunity', label: 'Oportunidade' },
  { value: 'covered', label: 'Ja temos' },
  { value: 'all', label: 'Todas' },
];

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
          <option key={`${label}-${option.value}`} value={option.value}>{option.label}</option>
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

function KpiCard({ label, value, meta, tone = 'cyan' }) {
  return (
    <article className={`kpi-card tone-${tone}`}>
      <span className="kpi-accent" aria-hidden="true" />
      <div className="kpi-topline"><span>{label}</span></div>
      <strong className="kpi-value">{value}</strong>
      <div className="kpi-meta"><span>{meta}</span></div>
    </article>
  );
}

function renderDealerPopup(item) {
  const isOpportunity = item.status === 'opportunity';
  const statusLabel = isOpportunity ? 'Oportunidade de prospeccao' : 'Ja e nossa concessionaria nessa cidade';
  const mapsUrl = googleMapsSearchUrl(`${item.dealerName}, ${item.address || ''}, ${item.cityName} ${item.stateCode}`);
  return [
    '<div>',
    `<strong>${item.dealerName}</strong><br/>`,
    `<span>Marca: ${item.brandLabel}</span><br/>`,
    `<span>Cidade: ${item.cityName} - ${item.stateCode}</span><br/>`,
    item.address ? `<span>Endereco: ${item.address}</span><br/>` : '',
    `<span class="status-chip ${isOpportunity ? 'attention' : 'ideal'}">${statusLabel}</span><br/>`,
    `<a class="link-button" target="_blank" rel="noreferrer" href="${mapsUrl}">Abrir no Google Maps</a>`,
    '</div>',
  ].join('');
}

export default function ProspeccaoClient() {
  const [workshops, setWorkshops] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState(prospeccaoDefaultFilters);
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
        const [workshopsResponse, dealersResponse] = await Promise.all([
          fetch('/data/workshops.json', { cache: 'no-store' }),
          fetch('/data/manufacturer-dealers.json', { cache: 'no-store' }),
        ]);
        if (!workshopsResponse.ok) throw new Error(`Falha ao carregar oficinas (${workshopsResponse.status})`);
        if (!dealersResponse.ok) throw new Error(`Falha ao carregar concessionarias do mercado (${dealersResponse.status})`);

        const workshopsPayload = await workshopsResponse.json();
        const dealersPayload = await dealersResponse.json();

        if (!cancelled) {
          setWorkshops(enrichWorkshops(workshopsPayload, initialCityCache, initialWorkshopCategories, initialHeavyFleet, initialConcessionariaBrands, initialNetworkConsultants));
          setDealers(dealersPayload);
          setError('');
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || 'Nao foi possivel carregar a base de dados.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  // So concessionarias ativas da rede DriveB contam como "ja temos" - mesma regra usada
  // no Estudo de Capilaridade e no restante do app.
  const driveBWorkshops = useMemo(
    () => filterWorkshops(workshops, { ...defaultFilters, franchiseId: '1', isActive: 'true', isBlocked: 'false' }),
    [workshops],
  );

  const coverageMap = useMemo(() => buildDealerCoverageMap(driveBWorkshops), [driveBWorkshops]);
  const dealersWithStatus = useMemo(() => annotateDealers(dealers, coverageMap), [dealers, coverageMap]);

  const brandOptions = useMemo(() => {
    const labels = new Map();
    dealersWithStatus.forEach((item) => { labels.set(item.brandSlug, item.brandLabel); });
    return [
      { value: 'all', label: 'Todas as marcas' },
      ...[...labels.entries()].sort((left, right) => left[1].localeCompare(right[1], 'pt-BR')).map(([value, label]) => ({ value, label })),
    ];
  }, [dealersWithStatus]);

  const stateOptions = useMemo(() => {
    const values = new Set(dealersWithStatus.map((item) => item.stateCode).filter(Boolean));
    return [
      { value: 'all', label: 'Todos os estados' },
      ...[...values].sort().map((value) => ({ value, label: formatStateLabel(value) })),
    ];
  }, [dealersWithStatus]);

  // Filtrado por marca/UF/busca mas NAO por status, para os KPIs mostrarem sempre o total
  // de oportunidade x ja temos, independente da aba de status selecionada na tabela/mapa.
  const scopedDealers = useMemo(() => {
    const term = filters.search.trim().toLocaleLowerCase('pt-BR');
    return dealersWithStatus.filter((item) => {
      if (filters.brand !== 'all' && item.brandSlug !== filters.brand) return false;
      if (filters.state !== 'all' && item.stateCode !== filters.state) return false;
      if (!term) return true;
      const haystack = `${item.dealerName} ${item.cityName} ${item.address}`.toLocaleLowerCase('pt-BR');
      return haystack.includes(term);
    });
  }, [dealersWithStatus, filters.brand, filters.state, filters.search]);

  const filteredDealers = useMemo(() => {
    if (filters.status === 'all') return scopedDealers;
    return scopedDealers.filter((item) => item.status === filters.status);
  }, [scopedDealers, filters.status]);

  useEffect(() => {
    if (selectedId && !filteredDealers.some((item) => item.id === selectedId)) setSelectedId(null);
  }, [filteredDealers, selectedId]);

  const opportunityCount = scopedDealers.filter((item) => item.status === 'opportunity').length;
  const coveredCount = scopedDealers.filter((item) => item.status === 'covered').length;
  const statesWithOpportunity = new Set(
    scopedDealers.filter((item) => item.status === 'opportunity').map((item) => item.stateCode),
  ).size;

  const totalPages = Math.max(1, Math.ceil(filteredDealers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filteredDealers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const mapItems = useMemo(
    () => filteredDealers
      .filter((item) => item.hasCoords)
      .map((item) => ({ ...item, displayName: item.dealerName })),
    [filteredDealers],
  );

  function updateFilter(key, value) {
    setFilters((previous) => ({ ...previous, [key]: value }));
    setPage(1);
    setFitRequestToken((previous) => previous + 1);
  }

  function resetFilters() {
    setFilters(prospeccaoDefaultFilters);
    setPage(1);
    setSelectedId(null);
    setFitRequestToken((previous) => previous + 1);
  }

  if (loading) {
    return <StatusCard title="Carregando oportunidades de prospeccao" description="Cruzando a lista de concessionarias do mercado com a nossa rede." />;
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
              <h1>Oportunidades de Prospeccao</h1>
              <span className="scope-pill">Concessionarias</span>
            </div>
            <p>
              Concessionarias oficiais das montadoras que ainda nao fazem parte da rede DriveB, cruzadas
              por cidade e marca. Fonte: listagem publica das montadoras (
              {new Date().toLocaleDateString('pt-BR')}), comparada com a nossa base ativa.
            </p>
          </div>
          <div className="topbar-status">
            <Link className="app-switch-link" href="/">
              <span aria-hidden="true">←</span> Voltar ao dashboard
            </Link>
          </div>
        </header>

        <section className="kpi-grid">
          <KpiCard label="Oportunidades de prospeccao" value={formatNumber(opportunityCount)} meta="Cidades/marca sem concessionaria nossa" tone="amber" />
          <KpiCard label="Ja temos" value={formatNumber(coveredCount)} meta="Cidades/marca onde ja somos parceiros" tone="green" />
          <KpiCard label="Estados com oportunidade" value={formatNumber(statesWithOpportunity)} meta="No recorte de marca/UF atual" tone="cyan" />
          <KpiCard label="Marcas mapeadas" value={formatNumber(brandOptions.length - 1)} meta="Fontes: montadoras parceiras e concorrentes" tone="rose" />
        </section>

        <section className="panel commercial-filter-panel">
          <div className="panel-heading compact">
            <span>Filtros</span>
            <button className="text-button" onClick={resetFilters} type="button">Limpar</button>
          </div>

          <div className="filter-control">
            <span>Status</span>
            <SegmentedControl value={filters.status} onChange={(value) => updateFilter('status', value)} options={statusOptions} ariaLabel="Status" />
          </div>

          <div className="commercial-filter-grid">
            <FilterSelect label="Marca" value={filters.brand} onChange={(value) => updateFilter('brand', value)} options={brandOptions} />
            <FilterSelect label="Estado (UF)" value={filters.state} onChange={(value) => updateFilter('state', value)} options={stateOptions} />
          </div>

          <div className="commercial-actions">
            <label className="search-control">
              <span>Buscar concessionaria, cidade ou endereco</span>
              <input
                type="search"
                placeholder="Nome, cidade ou endereco"
                value={filters.search}
                onChange={(event) => updateFilter('search', event.target.value)}
              />
            </label>
            <button className="primary-button" onClick={() => downloadDealersCsv(filteredDealers)} type="button">
              Exportar lista (CSV)
            </button>
          </div>
        </section>

        <section className={`panel map-panel commercial-map-panel ${isMapFullscreen ? 'is-fullscreen' : ''}`}>
          <div className="panel-heading">
            <div>
              <h2>Mapa de oportunidades</h2>
              <p>
                Posicao aproximada pelo centro da cidade (nao e o endereco exato) - use o endereco no popup ou na
                tabela para visitar. {filteredDealers.length - mapItems.length > 0
                  ? `${filteredDealers.length - mapItems.length} sem coordenada nao aparecem no mapa.`
                  : ''}
              </p>
            </div>
            <div className="map-panel-controls">
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
            workshops={mapItems}
            selectedId={selectedId}
            onSelect={setSelectedId}
            layerMode="points"
            mapTheme="light"
            fitRequestToken={fitRequestToken}
            isFullscreen={isMapFullscreen}
            renderPopup={renderDealerPopup}
          />
        </section>

        <section className="panel table-panel">
          <div className="panel-heading table-heading">
            <div>
              <h2>Lista de concessionarias</h2>
              <p>Mostrando {formatNumber(pageItems.length)} de {formatNumber(filteredDealers.length)} no recorte atual.</p>
            </div>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Marca</th>
                  <th>Concessionaria</th>
                  <th>Cidade / UF</th>
                  <th>Endereco</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => (
                  <tr
                    key={item.id}
                    className={selectedId === item.id ? 'is-selected' : ''}
                    onClick={() => item.hasCoords && setSelectedId(item.id)}
                  >
                    <td>
                      <div className="workshop-title">
                        <img
                          src={brandIconUrl(item.brandSlug)}
                          alt={item.brandLabel}
                          loading="lazy"
                          style={{ width: 20, height: 20, objectFit: 'contain' }}
                          onError={(event) => { event.currentTarget.style.display = 'none'; }}
                        />
                        <strong>{item.brandLabel}</strong>
                      </div>
                    </td>
                    <td>{item.dealerName}</td>
                    <td>{item.cityName} - {item.stateCode}</td>
                    <td className="muted-small">{item.address || '-'}</td>
                    <td>
                      <span className={`status-chip ${item.status === 'opportunity' ? 'attention' : 'ideal'}`}>
                        {item.status === 'opportunity' ? 'Oportunidade' : 'Ja temos'}
                      </span>
                    </td>
                    <td>
                      <a
                        className="action-link"
                        href={googleMapsSearchUrl(`${item.dealerName}, ${item.address || ''}, ${item.cityName} ${item.stateCode}`)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Mapa
                      </a>
                    </td>
                  </tr>
                ))}
                {!pageItems.length ? (
                  <tr><td colSpan={6} className="muted">Nenhuma concessionaria encontrada nesse recorte.</td></tr>
                ) : null}
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
