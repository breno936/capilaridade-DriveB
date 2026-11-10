// Citroen e Peugeot no Brasil costumam ser vendidas pela mesma concessionaria (grupo
// Stellantis) - nossa base registra isso como uma unica marca "citroen" quando a origem
// e a planilha de concessionarias. Sem isso, apareceria falso "oportunidade" de Peugeot
// em todo lugar onde ja temos a loja combinada cadastrada so como Citroen.
const BRAND_EQUIVALENTS = {
  citroen: ['citroen', 'peugeot'],
  peugeot: ['peugeot', 'citroen'],
};

export function buildDealerCoverageMap(driveBWorkshops) {
  const coverage = new Map();
  driveBWorkshops.forEach((item) => {
    if (item.serviceType !== 'concessionaria' || !item.brandSlug || !item.cityKey) return;
    const set = coverage.get(item.cityKey) || new Set();
    set.add(item.brandSlug);
    coverage.set(item.cityKey, set);
  });
  return coverage;
}

export function hasDealerCoverage(coverageMap, cityKey, brandSlug) {
  const set = coverageMap.get(cityKey);
  if (!set) return false;
  const equivalents = BRAND_EQUIVALENTS[brandSlug] || [brandSlug];
  return equivalents.some((slug) => set.has(slug));
}

export function annotateDealers(dealers, coverageMap) {
  return dealers.map((dealer) => {
    const covered = dealer.cityKey ? hasDealerCoverage(coverageMap, dealer.cityKey, dealer.brandSlug) : false;
    return {
      ...dealer,
      status: covered ? 'covered' : 'opportunity',
    };
  });
}

export function googleMapsSearchUrl(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function downloadDealersCsv(dealers) {
  const header = ['marca', 'concessionaria', 'cidade', 'uf', 'endereco', 'status'];

  const rows = dealers.map((item) => [
    item.brandLabel,
    item.dealerName,
    item.cityName,
    item.stateCode,
    item.address,
    item.status === 'opportunity' ? 'Oportunidade' : 'Ja temos',
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
  link.download = 'concessionarias_oportunidades_prospeccao.csv';
  link.click();
  URL.revokeObjectURL(url);
}
