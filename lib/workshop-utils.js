export const defaultFilters = {
  search: '',
  concept: 'all',
  checkoutType: 'all',
  networkId: 'all',
  categoryId: 'all',
  state: 'all',
  city: 'all',
  regionServiceId: 'all',
  regionPartId: 'all',
  isActive: 'all',
  isBlocked: 'all',
  isOffline: 'all',
  isFee: 'all',
  isMargin: 'all',
  isWhiteLabel: 'all',
  isDahruj: 'all',
  isNoIntermediation: 'all',
  locationScope: 'in_brazil',
  layerMode: 'both',
};

export const boolOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'true', label: 'Sim' },
  { value: 'false', label: 'Não' },
];

export const locationOptions = [
  { value: 'in_brazil', label: 'Somente Brasil' },
  { value: 'all', label: 'Todos os pontos' },
  { value: 'outside_brazil', label: 'Somente fora do Brasil' },
];

export const layerOptions = [
  { value: 'both', label: 'Heatmap + pontos' },
  { value: 'points', label: 'Pontos' },
  { value: 'heat', label: 'Heatmap' },
];

export const coverageLabels = {
  oficina: 'Oficina',
  vidros: 'Vidros',
  pneus: 'Pneus',
};

export const stateNameByCode = {
  AC: 'Acre',
  AL: 'Alagoas',
  AP: 'Amapá',
  AM: 'Amazonas',
  BA: 'Bahia',
  CE: 'Ceará',
  DF: 'Distrito Federal',
  ES: 'Espírito Santo',
  GO: 'Goiás',
  MA: 'Maranhão',
  MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais',
  PA: 'Pará',
  PB: 'Paraíba',
  PR: 'Paraná',
  PE: 'Pernambuco',
  PI: 'Piauí',
  RJ: 'Rio de Janeiro',
  RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul',
  RO: 'Rondônia',
  RR: 'Roraima',
  SC: 'Santa Catarina',
  SP: 'São Paulo',
  SE: 'Sergipe',
  TO: 'Tocantins',
};

const dddToStateCode = {
  11: 'SP', 12: 'SP', 13: 'SP', 14: 'SP', 15: 'SP', 16: 'SP', 17: 'SP', 18: 'SP', 19: 'SP',
  21: 'RJ', 22: 'RJ', 24: 'RJ',
  27: 'ES', 28: 'ES',
  31: 'MG', 32: 'MG', 33: 'MG', 34: 'MG', 35: 'MG', 37: 'MG', 38: 'MG',
  41: 'PR', 42: 'PR', 43: 'PR', 44: 'PR', 45: 'PR', 46: 'PR',
  47: 'SC', 48: 'SC', 49: 'SC',
  51: 'RS', 53: 'RS', 54: 'RS', 55: 'RS',
  61: 'DF',
  62: 'GO', 64: 'GO',
  63: 'TO',
  65: 'MT', 66: 'MT',
  67: 'MS',
  68: 'AC',
  69: 'RO',
  71: 'BA', 73: 'BA', 74: 'BA', 75: 'BA', 77: 'BA',
  79: 'SE',
  81: 'PE', 87: 'PE',
  82: 'AL',
  83: 'PB',
  84: 'RN',
  85: 'CE', 88: 'CE',
  86: 'PI', 89: 'PI',
  91: 'PA', 93: 'PA', 94: 'PA',
  92: 'AM', 97: 'AM',
  95: 'RR',
  96: 'AP',
  98: 'MA', 99: 'MA',
};

const stateBounds = [
  { code: 'DF', latMin: -16.1, latMax: -15.4, lngMin: -48.4, lngMax: -47.3 },
  { code: 'RJ', latMin: -23.4, latMax: -20.7, lngMin: -44.9, lngMax: -40.9 },
  { code: 'ES', latMin: -21.4, latMax: -17.8, lngMin: -41.9, lngMax: -39.6 },
  { code: 'SE', latMin: -11.6, latMax: -9.5, lngMin: -38.3, lngMax: -36.2 },
  { code: 'AL', latMin: -10.6, latMax: -8.8, lngMin: -38.5, lngMax: -35.1 },
  { code: 'PB', latMin: -8.4, latMax: -6.0, lngMin: -38.9, lngMax: -34.7 },
  { code: 'RN', latMin: -6.6, latMax: -4.8, lngMin: -38.9, lngMax: -35.0 },
  { code: 'PE', latMin: -9.6, latMax: -7.1, lngMin: -41.5, lngMax: -34.8 },
  { code: 'CE', latMin: -8.1, latMax: -2.8, lngMin: -41.7, lngMax: -37.1 },
  { code: 'PI', latMin: -10.9, latMax: -2.7, lngMin: -46.0, lngMax: -40.3 },
  { code: 'MA', latMin: -10.6, latMax: 0.3, lngMin: -49.0, lngMax: -41.6 },
  { code: 'AP', latMin: -1.1, latMax: 4.8, lngMin: -54.3, lngMax: -50.7 },
  { code: 'RR', latMin: 0.8, latMax: 5.6, lngMin: -61.9, lngMax: -58.8 },
  { code: 'AC', latMin: -11.3, latMax: -7.0, lngMin: -74.1, lngMax: -66.4 },
  { code: 'RO', latMin: -13.8, latMax: -7.8, lngMin: -66.9, lngMax: -59.8 },
  { code: 'AM', latMin: -9.9, latMax: 2.5, lngMin: -73.9, lngMax: -56.0 },
  { code: 'PA', latMin: -9.9, latMax: 2.1, lngMin: -59.0, lngMax: -46.0 },
  { code: 'TO', latMin: -13.6, latMax: -5.0, lngMin: -50.9, lngMax: -45.5 },
  { code: 'GO', latMin: -19.6, latMax: -12.0, lngMin: -53.4, lngMax: -46.0 },
  { code: 'MT', latMin: -19.0, latMax: -7.0, lngMin: -61.8, lngMax: -50.8 },
  { code: 'MS', latMin: -24.2, latMax: -17.7, lngMin: -58.4, lngMax: -50.8 },
  { code: 'SP', latMin: -25.4, latMax: -19.7, lngMin: -53.3, lngMax: -44.0 },
  { code: 'MG', latMin: -23.1, latMax: -14.0, lngMin: -51.4, lngMax: -39.7 },
  { code: 'PR', latMin: -26.9, latMax: -22.4, lngMin: -54.9, lngMax: -48.0 },
  { code: 'SC', latMin: -29.5, latMax: -25.8, lngMin: -53.9, lngMax: -48.1 },
  { code: 'RS', latMin: -33.9, latMax: -27.0, lngMin: -57.9, lngMax: -49.7 },
  { code: 'BA', latMin: -18.5, latMax: -8.3, lngMin: -47.0, lngMax: -37.2 },
];

const tireCategoryIds = new Set(['38', '40']);
const glassCategoryIds = new Set(['23', '56', '65', '67']);
const tireNetworkIds = new Set(['55']);
const glassNetworkIds = new Set(['58', '2']);

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
}

function extractDdd(item) {
  const phone = String(item.phone || item.ownerMobilePhone || '').replace(/\D/g, '');
  if (phone.length < 10) return '';
  return phone.slice(0, 2);
}

function deriveStateFromCoordinates(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '';
  const match = stateBounds.find((state) => lat >= state.latMin && lat <= state.latMax && lng >= state.lngMin && lng <= state.lngMax);
  return match?.code || '';
}

function deriveStateFromPhone(item) {
  const ddd = extractDdd(item);
  if (!ddd) return '';
  if (ddd === '61') {
    if (Number.isFinite(item.lat) && Number.isFinite(item.lng) && item.lat >= -16.1 && item.lat <= -15.4 && item.lng >= -48.4 && item.lng <= -47.3) {
      return 'DF';
    }
    return 'GO';
  }
  return dddToStateCode[Number(ddd)] || '';
}

export function coverageTypeLabel(type) {
  return coverageLabels[type] || 'Oficina';
}

export function formatStateLabel(code) {
  if (!code) return 'Não identificado';
  return `${code} · ${stateNameByCode[code] || code}`;
}

export function deriveCoverageType(item) {
  const categoryId = String(item.categoryId || '');
  const networkId = String(item.networkId || '');
  const haystack = normalizeText([item.displayName, item.tradingName, item.corporateName].filter(Boolean).join(' '));

  if (
    tireCategoryIds.has(categoryId)
    || tireNetworkIds.has(networkId)
    || /(pneu|pneus|borrachar|campneus|recap|tyre|pneustil|pneumac)/.test(haystack)
  ) {
    return 'pneus';
  }

  if (
    glassCategoryIds.has(categoryId)
    || glassNetworkIds.has(networkId)
    || /(vidro|vidros|parabrisa|parabrisas|autoglass|glass|vigia|poliglass)/.test(haystack)
  ) {
    return 'vidros';
  }

  return 'oficina';
}

export function enrichWorkshop(item) {
  const stateCode = deriveStateFromPhone(item) || deriveStateFromCoordinates(item.lat, item.lng);
  const coverageType = deriveCoverageType(item);
  const cityName = item.cityName || '';
  const cityStateCode = item.cityStateCode || stateCode;
  const cityKey = item.cityKey || (cityName && cityStateCode ? `${normalizeText(cityName)}::${cityStateCode}` : '');

  return {
    ...item,
    addressId: item.addressId || '',
    stateCode,
    stateName: stateNameByCode[stateCode] || '',
    cityName,
    cityStateCode,
    cityKey,
    cityDisplayName: cityName ? `${cityName}${cityStateCode ? ` · ${cityStateCode}` : ''}` : '',
    citySource: item.citySource || '',
    coverageType,
    coverageLabel: coverageTypeLabel(coverageType),
    isOperational: Boolean(item.isActive && !item.isBlocked),
  };
}

export function enrichWorkshops(items) {
  return items.map(enrichWorkshop);
}

export function formatNumber(value) {
  return new Intl.NumberFormat('pt-BR').format(value || 0);
}

export function percent(value, total) {
  if (!total) return '0%';
  return `${((value / total) * 100).toFixed(1).replace('.', ',')}%`;
}

export function uniqueValues(items, key) {
  return [...new Set(items.map((item) => item[key]).filter((value) => value !== null && value !== undefined && value !== ''))]
    .sort((left, right) => String(left).localeCompare(String(right), 'pt-BR', { numeric: true }));
}

export function countBy(items, key) {
  return items.reduce((accumulator, item) => {
    const bucket = item[key] || 'Não informado';
    accumulator[bucket] = (accumulator[bucket] || 0) + 1;
    return accumulator;
  }, {});
}

function parseBooleanFilter(value, current) {
  if (current === 'all') return true;
  return String(value) === current;
}

function matchesSearch(item, search) {
  if (!search) return true;
  const haystack = [
    item.displayName,
    item.corporateName,
    item.sapId,
    item.taxIdentifier,
    item.ownerName,
    item.email,
    item.ownerEmail,
    item.phone,
    item.stateCode,
    item.stateName,
    item.cityName,
    item.cityDisplayName,
    item.coverageLabel,
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('pt-BR');
  return haystack.includes(search);
}

export function filterWorkshops(items, filters) {
  const search = filters.search.trim().toLocaleLowerCase('pt-BR');
  return items.filter((item) => {
    if (!item.hasValidCoordinates) return false;
    if (!matchesSearch(item, search)) return false;
    if (filters.concept !== 'all' && item.concept !== filters.concept) return false;
    if (filters.checkoutType !== 'all' && item.checkoutType !== filters.checkoutType) return false;
    if (filters.networkId !== 'all' && String(item.networkId) !== filters.networkId) return false;
    if (filters.categoryId !== 'all' && String(item.categoryId) !== filters.categoryId) return false;
    if (filters.state !== 'all' && item.stateCode !== filters.state) return false;
    if (filters.city !== 'all' && item.cityKey !== filters.city) return false;
    if (filters.regionServiceId !== 'all' && String(item.regionServiceId) !== filters.regionServiceId) return false;
    if (filters.regionPartId !== 'all' && String(item.regionPartId) !== filters.regionPartId) return false;
    if (!parseBooleanFilter(item.isActive, filters.isActive)) return false;
    if (!parseBooleanFilter(item.isBlocked, filters.isBlocked)) return false;
    if (!parseBooleanFilter(item.isOffline, filters.isOffline)) return false;
    if (!parseBooleanFilter(item.isFee, filters.isFee)) return false;
    if (!parseBooleanFilter(item.isMargin, filters.isMargin)) return false;
    if (!parseBooleanFilter(item.isWhiteLabel, filters.isWhiteLabel)) return false;
    if (!parseBooleanFilter(item.isDahruj, filters.isDahruj)) return false;
    if (!parseBooleanFilter(item.isNoIntermediation, filters.isNoIntermediation)) return false;
    if (filters.locationScope === 'in_brazil' && !item.isInBrazil) return false;
    if (filters.locationScope === 'outside_brazil' && item.isInBrazil) return false;
    return true;
  });
}

function buildCoverageDeficit(operationalCounts, target) {
  return {
    oficina: Math.max(0, target - operationalCounts.oficina),
    vidros: Math.max(0, target - operationalCounts.vidros),
    pneus: Math.max(0, target - operationalCounts.pneus),
  };
}

function deficitText(deficit) {
  return Object.entries(deficit)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => `${count} ${coverageTypeLabel(type).toLocaleLowerCase('pt-BR')}`)
    .join(', ');
}

function getGroupingDescriptor(item, dimension) {
  if (dimension === 'city') {
    if (!item.cityKey || !item.cityName) return null;
    return {
      key: item.cityKey,
      name: item.cityDisplayName || item.cityName,
    };
  }

  if (!item.stateCode) return null;
  return {
    key: item.stateCode,
    name: item.stateName || stateNameByCode[item.stateCode] || item.stateCode,
  };
}

export function buildCoverageReports(items, dimension = 'state') {
  const groups = items
    .filter((item) => item.isInBrazil)
    .reduce((accumulator, item) => {
      const descriptor = getGroupingDescriptor(item, dimension);
      if (!descriptor) return accumulator;

      const current = accumulator[descriptor.key] || {
        groupKey: descriptor.key,
        groupName: descriptor.name,
        items: [],
      };
      current.items.push(item);
      accumulator[descriptor.key] = current;
      return accumulator;
    }, {});

  return Object.values(groups).map((group) => {
    const operationalItems = group.items.filter((item) => item.isOperational);
    const operationalCounts = {
      oficina: operationalItems.filter((item) => item.coverageType === 'oficina').length,
      vidros: operationalItems.filter((item) => item.coverageType === 'vidros').length,
      pneus: operationalItems.filter((item) => item.coverageType === 'pneus').length,
    };
    const rawCounts = {
      oficina: group.items.filter((item) => item.coverageType === 'oficina').length,
      vidros: group.items.filter((item) => item.coverageType === 'vidros').length,
      pneus: group.items.filter((item) => item.coverageType === 'pneus').length,
    };
    const minimumDeficit = buildCoverageDeficit(operationalCounts, 1);
    const idealDeficit = buildCoverageDeficit(operationalCounts, 2);
    const missingTypes = Object.entries(minimumDeficit).filter(([, count]) => count > 0).map(([type]) => type);
    const minimumGap = Object.values(minimumDeficit).reduce((sum, count) => sum + count, 0);
    const idealGap = Object.values(idealDeficit).reduce((sum, count) => sum + count, 0);
    const status = missingTypes.length ? 'critical' : idealGap > 0 ? 'attention' : 'ideal';
    const priorityScore = (missingTypes.length * 120) + (idealGap * 20) + Math.max(0, 4 - operationalItems.length) * 5;

    return {
      groupKey: group.groupKey,
      groupName: group.groupName,
      total: group.items.length,
      operationalTotal: operationalItems.length,
      operationalCounts,
      rawCounts,
      missingTypes,
      minimumDeficit,
      idealDeficit,
      minimumGap,
      idealGap,
      status,
      priorityScore,
      minimumDeficitText: deficitText(minimumDeficit),
      idealDeficitText: deficitText(idealDeficit),
    };
  }).sort((left, right) => right.priorityScore - left.priorityScore || right.total - left.total);
}

export function buildStrategicSummary(items, dimension = 'state') {
  const reports = buildCoverageReports(items, dimension);
  const criticalStates = reports.filter((report) => report.status === 'critical');
  const attentionStates = reports.filter((report) => report.status === 'attention');
  const idealStates = reports.filter((report) => report.status === 'ideal');
  const topPriorityStates = reports.filter((report) => report.status !== 'ideal').slice(0, 6);

  const recommendations = [];

  criticalStates.slice(0, 3).forEach((report) => {
    const missing = report.missingTypes.map((type) => coverageTypeLabel(type).toLocaleLowerCase('pt-BR')).join(', ');
    recommendations.push({
      tone: 'critical',
      title: `${report.groupName} pede ataque imediato`,
      body: `Hoje faltam pilares mínimos de cobertura em ${missing}. Para sair do crítico, ${dimension === 'city' ? 'a cidade' : 'o estado'} precisa de ${report.minimumDeficitText}.`,
    });
  });

  attentionStates
    .filter((report) => report.operationalCounts.oficina >= 1)
    .slice(0, 2)
    .forEach((report) => {
      recommendations.push({
        tone: 'attention',
        title: `${report.groupName} é oportunidade de adensamento`,
        body: `A base já existe, mas ainda faltam ${report.idealDeficitText} para atingir a meta ideal de 2 oficinas, 2 pontos de vidros e 2 de pneus.`,
      });
    });

  if (!recommendations.length) {
    recommendations.push({
      tone: 'ideal',
      title: 'Cobertura equilibrada no recorte atual',
      body: 'Os estados visíveis já cumprem a meta mínima. O próximo passo é reforçar os estados com maior volume para ganhar redundância operacional.',
    });
  }

  const headline = criticalStates.length
    ? `${formatNumber(criticalStates.length)} ${dimension === 'city' ? 'cidades' : 'estados'} estão críticos no recorte atual`
    : attentionStates.length
      ? `${formatNumber(attentionStates.length)} ${dimension === 'city' ? 'cidades' : 'estados'} ainda precisam de reforço`
      : 'Cobertura mínima atendida no recorte atual';

  const narrative = criticalStates.length
    ? `A leitura estratégica considera apenas operações ativas e não bloqueadas. ${dimension === 'city' ? 'Cidades críticas' : 'Estados críticos'} são os que ainda não possuem pelo menos 1 oficina, 1 ponto de vidros e 1 de pneus.`
    : `A meta mínima está coberta, então o foco passa a ser adensar para o padrão ideal de 2 operações por pilar em nível de ${dimension === 'city' ? 'cidade' : 'estado'}.`;

  return {
    reports,
    criticalStates,
    attentionStates,
    idealStates,
    topPriorityStates,
    recommendations,
    headline,
    narrative,
    dimension,
  };
}

export function googleMapsUrl(item) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.lat},${item.lng}`)}`;
}

export function downloadCsv(items) {
  const header = [
    'id', 'sap_id', 'display_name', 'corporate_name', 'concept', 'network_id', 'category_id',
    'state_code', 'state_name', 'city_name', 'city_state_code', 'coverage_type', 'is_active', 'is_blocked', 'is_offline', 'checkout_type',
    'is_fee', 'is_margin', 'is_white_label', 'is_dahruj', 'is_no_intermediation', 'lat', 'lng',
    'is_in_brazil', 'phone', 'email',
  ];

  const rows = items.map((item) => [
    item.id,
    item.sapId,
    item.displayName,
    item.corporateName,
    item.concept,
    item.networkId,
    item.categoryId,
    item.stateCode,
    item.stateName,
    item.cityName,
    item.cityStateCode,
    item.coverageType,
    item.isActive,
    item.isBlocked,
    item.isOffline,
    item.checkoutType,
    item.isFee,
    item.isMargin,
    item.isWhiteLabel,
    item.isDahruj,
    item.isNoIntermediation,
    item.lat,
    item.lng,
    item.isInBrazil,
    item.phone || item.ownerMobilePhone || '',
    item.email || item.ownerEmail || '',
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map((value) => {
      const text = String(value ?? '');
      return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }).join(';'))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'capilaridade_oficinas_filtrada.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export function conceptColor(concept) {
  if (concept === 'NETWORK') return '#38bdf8';
  if (concept === 'INDEPENDENT') return '#f97316';
  return '#a78bfa';
}
