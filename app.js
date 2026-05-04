(function () {
  const workshops = Array.isArray(window.WORKSHOPS) ? window.WORKSHOPS : [];
  const defaults = {
    search: '', concept: 'all', checkoutType: 'all', networkId: 'all', categoryId: 'all',
    regionServiceId: 'all', regionPartId: 'all', isActive: 'all', isBlocked: 'all',
    isOffline: 'all', isFee: 'all', isMargin: 'all', isWhiteLabel: 'all', isDahruj: 'all',
    isNoIntermediation: 'all', locationScope: 'in_brazil', layerMode: 'heat', page: 1,
    pageSize: 25, selectedId: null
  };
  const state = { ...defaults };
  const dom = {
    searchInput: document.getElementById('searchInput'), conceptFilter: document.getElementById('conceptFilter'),
    checkoutFilter: document.getElementById('checkoutFilter'), networkFilter: document.getElementById('networkFilter'),
    categoryFilter: document.getElementById('categoryFilter'), regionServiceFilter: document.getElementById('regionServiceFilter'),
    regionPartFilter: document.getElementById('regionPartFilter'), activeFilter: document.getElementById('activeFilter'),
    blockedFilter: document.getElementById('blockedFilter'), offlineFilter: document.getElementById('offlineFilter'),
    feeFilter: document.getElementById('feeFilter'), marginFilter: document.getElementById('marginFilter'),
    whiteLabelFilter: document.getElementById('whiteLabelFilter'), dahrujFilter: document.getElementById('dahrujFilter'),
    noIntermediationFilter: document.getElementById('noIntermediationFilter'), locationScopeFilter: document.getElementById('locationScopeFilter'),
    layerModeFilter: document.getElementById('layerModeFilter'), resetFilters: document.getElementById('resetFilters'),
    exportCsv: document.getElementById('exportCsv'), fitMapButton: document.getElementById('fitMapButton'),
    heroDescription: document.getElementById('heroDescription'), quickSummary: document.getElementById('quickSummary'),
    kpiGrid: document.getElementById('kpiGrid'), qualityBanner: document.getElementById('qualityBanner'),
    conceptBreakdown: document.getElementById('conceptBreakdown'), networkBreakdown: document.getElementById('networkBreakdown'),
    tableDescription: document.getElementById('tableDescription'), resultsTableBody: document.getElementById('resultsTableBody'),
    prevPage: document.getElementById('prevPage'), nextPage: document.getElementById('nextPage'), pageInfo: document.getElementById('pageInfo')
  };

  const boolOptions = [{ value: 'all', label: 'Todos' }, { value: 'true', label: 'Sim' }, { value: 'false', label: 'Não' }];
  const locationOptions = [{ value: 'in_brazil', label: 'Somente Brasil' }, { value: 'all', label: 'Todos os pontos' }, { value: 'outside_brazil', label: 'Somente fora do Brasil' }];
  const layerOptions = [{ value: 'heat', label: 'Heatmap' }, { value: 'points', label: 'Pontos' }, { value: 'both', label: 'Heatmap + pontos' }];

  const map = L.map('map', { zoomControl: false, preferCanvas: true }).setView([-14.235, -51.9253], 4);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
  const heatLayer = L.heatLayer([], { radius: 28, blur: 20, maxZoom: 7, minOpacity: 0.35, gradient: { 0.15: '#1d4ed8', 0.45: '#06b6d4', 0.7: '#facc15', 1: '#ef4444' } });
  const markersLayer = L.layerGroup();
  const markerById = new Map();

  function escapeHtml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  function formatNumber(value) { return new Intl.NumberFormat('pt-BR').format(value || 0); }
  function percent(value, total) { return total ? ((value / total) * 100).toFixed(1).replace('.', ',') + '%' : '0%'; }
  function googleMapsUrl(item) { return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(item.lat + ',' + item.lng); }
  function csvEscape(value) { const text = String(value ?? ''); return /[;"\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text; }
  function uniqueValues(key) {
    return [...new Set(workshops.map((item) => item[key]).filter((value) => value !== null && value !== undefined && value !== ''))]
      .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true }));
  }
  function populateSelect(select, options) {
    select.innerHTML = options.map((option) => '<option value="' + escapeHtml(String(option.value)) + '">' + escapeHtml(option.label) + '</option>').join('');
  }
  function parseBooleanFilter(value, current) { return current === 'all' ? true : String(value) === current; }
  function countBy(data, key) {
    return data.reduce((acc, item) => { const bucket = item[key] || 'Não informado'; acc[bucket] = (acc[bucket] || 0) + 1; return acc; }, {});
  }
  function conceptColor(concept) { return concept === 'NETWORK' ? '#38bdf8' : concept === 'INDEPENDENT' ? '#f97316' : '#a78bfa'; }

  function setupFilters() {
    populateSelect(dom.conceptFilter, [{ value: 'all', label: 'Todos' }].concat(uniqueValues('concept').map((value) => ({ value, label: value }))));
    populateSelect(dom.checkoutFilter, [{ value: 'all', label: 'Todos' }].concat(uniqueValues('checkoutType').map((value) => ({ value, label: value }))));
    populateSelect(dom.networkFilter, [{ value: 'all', label: 'Todas' }].concat(uniqueValues('networkId').map((value) => ({ value, label: 'Rede ' + value }))));
    populateSelect(dom.categoryFilter, [{ value: 'all', label: 'Todas' }].concat(uniqueValues('categoryId').map((value) => ({ value, label: 'Categoria ' + value }))));
    populateSelect(dom.regionServiceFilter, [{ value: 'all', label: 'Todas' }].concat(uniqueValues('regionServiceId').map((value) => ({ value, label: 'Serviço ' + value }))));
    populateSelect(dom.regionPartFilter, [{ value: 'all', label: 'Todas' }].concat(uniqueValues('regionPartId').map((value) => ({ value, label: 'Peças ' + value }))));
    [dom.activeFilter, dom.blockedFilter, dom.offlineFilter, dom.feeFilter, dom.marginFilter, dom.whiteLabelFilter, dom.dahrujFilter, dom.noIntermediationFilter].forEach((element) => populateSelect(element, boolOptions));
    populateSelect(dom.locationScopeFilter, locationOptions);
    populateSelect(dom.layerModeFilter, layerOptions);
  }

  function matchesSearch(item, search) {
    if (!search) return true;
    const haystack = [item.displayName, item.corporateName, item.sapId, item.taxIdentifier, item.ownerName, item.email, item.ownerEmail, item.phone]
      .filter(Boolean).join(' ').toLocaleLowerCase('pt-BR');
    return haystack.includes(search);
  }

  function filterData() {
    const search = state.search.trim().toLocaleLowerCase('pt-BR');
    return workshops.filter((item) => {
      if (!item.hasValidCoordinates) return false;
      if (!matchesSearch(item, search)) return false;
      if (state.concept !== 'all' && item.concept !== state.concept) return false;
      if (state.checkoutType !== 'all' && item.checkoutType !== state.checkoutType) return false;
      if (state.networkId !== 'all' && String(item.networkId) !== state.networkId) return false;
      if (state.categoryId !== 'all' && String(item.categoryId) !== state.categoryId) return false;
      if (state.regionServiceId !== 'all' && String(item.regionServiceId) !== state.regionServiceId) return false;
      if (state.regionPartId !== 'all' && String(item.regionPartId) !== state.regionPartId) return false;
      if (!parseBooleanFilter(item.isActive, state.isActive)) return false;
      if (!parseBooleanFilter(item.isBlocked, state.isBlocked)) return false;
      if (!parseBooleanFilter(item.isOffline, state.isOffline)) return false;
      if (!parseBooleanFilter(item.isFee, state.isFee)) return false;
      if (!parseBooleanFilter(item.isMargin, state.isMargin)) return false;
      if (!parseBooleanFilter(item.isWhiteLabel, state.isWhiteLabel)) return false;
      if (!parseBooleanFilter(item.isDahruj, state.isDahruj)) return false;
      if (!parseBooleanFilter(item.isNoIntermediation, state.isNoIntermediation)) return false;
      if (state.locationScope === 'in_brazil' && !item.isInBrazil) return false;
      if (state.locationScope === 'outside_brazil' && item.isInBrazil) return false;
      return true;
    });
  }

  function buildBadges(item) {
    const badges = [];
    badges.push('<span class="badge info">' + escapeHtml(item.concept || 'Sem conceito') + '</span>');
    badges.push('<span class="badge">Rede ' + escapeHtml(String(item.networkId || '-')) + '</span>');
    badges.push('<span class="badge">Categoria ' + escapeHtml(String(item.categoryId || '-')) + '</span>');
    badges.push('<span class="badge ' + (item.isActive ? 'success' : 'danger') + '">' + (item.isActive ? 'Ativa' : 'Inativa') + '</span>');
    if (item.isBlocked) badges.push('<span class="badge danger">Bloqueada</span>');
    if (item.isOffline) badges.push('<span class="badge warning">Offline</span>');
    if (item.isFee) badges.push('<span class="badge">Fee</span>');
    if (item.isWhiteLabel) badges.push('<span class="badge">White label</span>');
    if (!item.isInBrazil) badges.push('<span class="badge danger">Fora do Brasil</span>');
    return badges.join('');
  }

  function buildPopup(item) {
    return [
      '<div><strong>' + escapeHtml(item.displayName) + '</strong><br/>',
      '<span>' + escapeHtml(item.corporateName || '') + '</span><br/>',
      '<span>Conceito: ' + escapeHtml(item.concept || 'N/D') + '</span><br/>',
      '<span>Rede: ' + escapeHtml(String(item.networkId || 'N/D')) + ' · Categoria: ' + escapeHtml(String(item.categoryId || 'N/D')) + '</span><br/>',
      '<span>Contato: ' + escapeHtml(item.phone || item.ownerMobilePhone || 'N/D') + '</span><br/>',
      '<a class="link-button" target="_blank" rel="noreferrer" href="' + googleMapsUrl(item) + '">Abrir no Google Maps</a></div>'
    ].join('');
  }
  function renderMap(filtered) {
    heatLayer.setLatLngs(filtered.map((item) => [item.lat, item.lng, item.isBlocked ? 0.45 : 1]));
    markersLayer.clearLayers();
    markerById.clear();
    filtered.forEach((item) => {
      const marker = L.circleMarker([item.lat, item.lng], {
        radius: state.selectedId === item.id ? 8 : 5,
        weight: state.selectedId === item.id ? 2 : 1,
        color: state.selectedId === item.id ? '#ffffff' : conceptColor(item.concept),
        fillColor: conceptColor(item.concept),
        fillOpacity: state.selectedId === item.id ? 0.95 : 0.72
      }).bindPopup(buildPopup(item));
      marker.on('click', function () { state.selectedId = item.id; render(false); });
      markerById.set(item.id, marker);
      markersLayer.addLayer(marker);
    });
    if (state.layerMode === 'heat' || state.layerMode === 'both') { if (!map.hasLayer(heatLayer)) map.addLayer(heatLayer); } else if (map.hasLayer(heatLayer)) map.removeLayer(heatLayer);
    if (state.layerMode === 'points' || state.layerMode === 'both') { if (!map.hasLayer(markersLayer)) map.addLayer(markersLayer); } else if (map.hasLayer(markersLayer)) map.removeLayer(markersLayer);
    if (state.selectedId && markerById.has(state.selectedId)) markerById.get(state.selectedId).openPopup();
  }

  function fitMap(filtered) {
    if (!filtered.length) { map.setView([-14.235, -51.9253], 4); return; }
    const bounds = L.latLngBounds(filtered.map((item) => [item.lat, item.lng]));
    map.fitBounds(bounds.pad(0.12), { maxZoom: 8 });
  }

  function renderKpis(filtered) {
    const activeCount = filtered.filter((item) => item.isActive).length;
    const blockedCount = filtered.filter((item) => item.isBlocked).length;
    const outsideCount = filtered.filter((item) => !item.isInBrazil).length;
    const networkCount = new Set(filtered.map((item) => item.networkId).filter(Boolean)).size;
    const cards = [
      { label: 'Oficinas filtradas', value: formatNumber(filtered.length), meta: formatNumber(workshops.length) + ' registros na base' },
      { label: 'Ativas', value: formatNumber(activeCount), meta: percent(activeCount, filtered.length) + ' da seleção atual' },
      { label: 'Bloqueadas', value: formatNumber(blockedCount), meta: percent(blockedCount, filtered.length) + ' da seleção atual' },
      { label: 'Redes no recorte', value: formatNumber(networkCount), meta: formatNumber(outsideCount) + ' pontos fora do Brasil' }
    ];
    dom.kpiGrid.innerHTML = cards.map((card) => '<article class="kpi-card"><div class="kpi-label">' + escapeHtml(card.label) + '</div><div class="kpi-value">' + escapeHtml(card.value) + '</div><div class="kpi-meta">' + escapeHtml(card.meta) + '</div></article>').join('');
  }

  function renderSummary(filtered) {
    const insideBrazil = filtered.filter((item) => item.isInBrazil).length;
    const summary = [
      ['Cobertura no Brasil', percent(insideBrazil, filtered.length)],
      ['Checkout opcional/obrigatório', formatNumber(filtered.filter((item) => item.checkoutType !== 'NO').length)],
      ['Com margem', formatNumber(filtered.filter((item) => item.isMargin).length)],
      ['White label', formatNumber(filtered.filter((item) => item.isWhiteLabel).length)],
      ['Sem intermediação', formatNumber(filtered.filter((item) => item.isNoIntermediation).length)]
    ];
    dom.quickSummary.innerHTML = summary.map((entry) => '<div class="summary-item"><span>' + escapeHtml(entry[0]) + '</span><strong>' + escapeHtml(entry[1]) + '</strong></div>').join('');
  }

  function renderBreakdown(container, buckets, formatter) {
    const entries = Object.entries(buckets).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const peak = entries.length ? entries[0][1] : 0;
    if (!entries.length) { container.innerHTML = '<p class="muted">Sem dados para o recorte atual.</p>'; return; }
    container.innerHTML = entries.map(([label, value]) => {
      const width = peak ? Math.max((value / peak) * 100, 8) : 0;
      return '<div class="breakdown-row"><div><strong>' + escapeHtml(formatter(label)) + '</strong><div class="breakdown-track"><div class="breakdown-fill" style="width:' + width.toFixed(1) + '%"></div></div></div><strong>' + escapeHtml(formatNumber(value)) + '</strong></div>';
    }).join('');
  }

  function renderStatusCell(item) {
    const lines = [item.isActive ? 'Ativa' : 'Inativa'];
    if (item.isBlocked) lines.push('Bloqueada');
    if (item.isOffline) lines.push('Offline');
    if (item.checkoutType && item.checkoutType !== 'NO') lines.push('Checkout ' + item.checkoutType.toLowerCase());
    return lines.map((line) => escapeHtml(line)).join('<br/>');
  }

  function renderTable(filtered) {
    const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * state.pageSize;
    const pageItems = filtered.slice(start, start + state.pageSize);
    dom.tableDescription.textContent = filtered.length ? formatNumber(filtered.length) + ' oficinas no recorte atual. Exibindo ' + formatNumber(pageItems.length) + ' por página.' : 'Nenhuma oficina encontrada para o filtro atual.';
    dom.pageInfo.textContent = 'Página ' + state.page + ' de ' + totalPages;
    dom.prevPage.disabled = state.page === 1;
    dom.nextPage.disabled = state.page === totalPages;
    dom.resultsTableBody.innerHTML = pageItems.map((item) => '<tr data-id="' + escapeHtml(item.id) + '" class="' + (state.selectedId === item.id ? 'is-selected' : '') + '"><td><div class="result-name">' + escapeHtml(item.displayName) + '</div><div class="result-subtitle">SAP ' + escapeHtml(item.sapId || '-') + ' · CNPJ ' + escapeHtml(item.taxIdentifier || '-') + '</div><div class="badges">' + buildBadges(item) + '</div></td><td>' + escapeHtml(item.concept || 'N/D') + '</td><td>Rede ' + escapeHtml(String(item.networkId || '-')) + '<br/><span class="result-subtitle">Categoria ' + escapeHtml(String(item.categoryId || '-')) + '</span></td><td>' + renderStatusCell(item) + '</td><td>' + escapeHtml(item.lat.toFixed(5) + ', ' + item.lng.toFixed(5)) + '<br/><a class="link-button" target="_blank" rel="noreferrer" href="' + googleMapsUrl(item) + '">abrir mapa</a></td><td>' + escapeHtml(item.phone || item.ownerMobilePhone || 'N/D') + '<br/><span class="result-subtitle">' + escapeHtml(item.email || item.ownerEmail || 'Sem e-mail') + '</span></td></tr>').join('');
  }

  function renderQualityBanner(filtered) {
    const totalOutside = workshops.filter((item) => !item.isInBrazil).length;
    const selectedOutside = filtered.filter((item) => !item.isInBrazil).length;
    if (!totalOutside) { dom.qualityBanner.classList.add('hidden'); return; }
    dom.qualityBanner.classList.remove('hidden');
    dom.qualityBanner.innerHTML = 'A base possui <strong>' + formatNumber(totalOutside) + '</strong> registros fora do bounding box do Brasil. No filtro atual, <strong>' + formatNumber(selectedOutside) + '</strong> aparecem fora do país. O dashboard inicia priorizando apenas coordenadas brasileiras para evitar distorção do mapa de calor.';
  }

  function updateHero(filtered) {
    const activeCount = filtered.filter((item) => item.isActive).length;
    const concepts = Object.keys(countBy(filtered, 'concept')).length;
    dom.heroDescription.textContent = formatNumber(filtered.length) + ' oficinas no recorte, ' + formatNumber(activeCount) + ' ativas e ' + formatNumber(concepts) + ' conceitos visíveis no mapa.';
  }

  function exportCsv(filtered) {
    const header = ['id','sap_id','display_name','corporate_name','concept','network_id','category_id','is_active','is_blocked','is_offline','checkout_type','is_fee','is_margin','is_white_label','is_dahruj','is_no_intermediation','lat','lng','is_in_brazil','phone','email'];
    const rows = filtered.map((item) => [item.id,item.sapId,item.displayName,item.corporateName,item.concept,item.networkId,item.categoryId,item.isActive,item.isBlocked,item.isOffline,item.checkoutType,item.isFee,item.isMargin,item.isWhiteLabel,item.isDahruj,item.isNoIntermediation,item.lat,item.lng,item.isInBrazil,item.phone || item.ownerMobilePhone || '',item.email || item.ownerEmail || '']);
    const csv = [header].concat(rows).map((row) => row.map(csvEscape).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'capilaridade_oficinas_filtrada.csv'; link.click();
    URL.revokeObjectURL(url);
  }

  function attachEvents() {
    [[dom.searchInput,'input','search'],[dom.conceptFilter,'change','concept'],[dom.checkoutFilter,'change','checkoutType'],[dom.networkFilter,'change','networkId'],[dom.categoryFilter,'change','categoryId'],[dom.regionServiceFilter,'change','regionServiceId'],[dom.regionPartFilter,'change','regionPartId'],[dom.activeFilter,'change','isActive'],[dom.blockedFilter,'change','isBlocked'],[dom.offlineFilter,'change','isOffline'],[dom.feeFilter,'change','isFee'],[dom.marginFilter,'change','isMargin'],[dom.whiteLabelFilter,'change','isWhiteLabel'],[dom.dahrujFilter,'change','isDahruj'],[dom.noIntermediationFilter,'change','isNoIntermediation'],[dom.locationScopeFilter,'change','locationScope'],[dom.layerModeFilter,'change','layerMode']]
      .forEach(([element, eventName, key]) => element.addEventListener(eventName, function (event) { state[key] = event.target.value; state.page = 1; render(true); }));
    dom.resetFilters.addEventListener('click', function () {
      Object.assign(state, defaults);
      dom.searchInput.value = defaults.search; dom.conceptFilter.value = defaults.concept; dom.checkoutFilter.value = defaults.checkoutType; dom.networkFilter.value = defaults.networkId; dom.categoryFilter.value = defaults.categoryId; dom.regionServiceFilter.value = defaults.regionServiceId; dom.regionPartFilter.value = defaults.regionPartId; dom.activeFilter.value = defaults.isActive; dom.blockedFilter.value = defaults.isBlocked; dom.offlineFilter.value = defaults.isOffline; dom.feeFilter.value = defaults.isFee; dom.marginFilter.value = defaults.isMargin; dom.whiteLabelFilter.value = defaults.isWhiteLabel; dom.dahrujFilter.value = defaults.isDahruj; dom.noIntermediationFilter.value = defaults.isNoIntermediation; dom.locationScopeFilter.value = defaults.locationScope; dom.layerModeFilter.value = defaults.layerMode;
      render(true);
    });
    dom.fitMapButton.addEventListener('click', function () { fitMap(filterData()); });
    dom.exportCsv.addEventListener('click', function () { exportCsv(filterData()); });
    dom.prevPage.addEventListener('click', function () { if (state.page > 1) { state.page -= 1; render(false); } });
    dom.nextPage.addEventListener('click', function () { const filtered = filterData(); const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize)); if (state.page < totalPages) { state.page += 1; render(false); } });
    dom.resultsTableBody.addEventListener('click', function (event) {
      const row = event.target.closest('tr[data-id]'); if (!row) return;
      state.selectedId = Number(row.dataset.id);
      const item = filterData().find((entry) => entry.id === state.selectedId);
      if (item) map.flyTo([item.lat, item.lng], Math.max(map.getZoom(), 8), { duration: .6 });
      render(false);
    });
  }

  function render(shouldFitMap) {
    const filtered = filterData();
    updateHero(filtered); renderKpis(filtered); renderSummary(filtered); renderQualityBanner(filtered);
    renderBreakdown(dom.conceptBreakdown, countBy(filtered, 'concept'), (label) => label);
    renderBreakdown(dom.networkBreakdown, countBy(filtered, 'networkId'), (label) => 'Rede ' + label);
    renderTable(filtered); renderMap(filtered);
    if (shouldFitMap) fitMap(filtered);
  }

  setupFilters();
  attachEvents();
  render(true);
})();
