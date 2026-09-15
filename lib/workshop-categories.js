const ICON_BACKED_BRANDS = {
  'bosch car service': { slug: 'bosch', label: 'Bosch' },
  'bosch diesel service': { slug: 'bosch', label: 'Bosch' },
  'bosch diesel center': { slug: 'bosch', label: 'Bosch' },
  hyundai: { slug: 'hyundai', label: 'Hyundai' },
  chevrolet: { slug: 'chevrolet', label: 'Chevrolet' },
  volkswagen: { slug: 'volkswagen', label: 'Volkswagen' },
  'volkswagen caminhoes': { slug: 'volkswagen', label: 'Volkswagen' },
  jeep: { slug: 'jeep', label: 'Jeep' },
  fiat: { slug: 'fiat', label: 'Fiat' },
  toyota: { slug: 'toyota', label: 'Toyota' },
  'concessionaria toyota': { slug: 'toyota', label: 'Toyota' },
  'concesionaria toyota': { slug: 'toyota', label: 'Toyota' },
  nissan: { slug: 'nissan', label: 'Nissan' },
  honda: { slug: 'honda', label: 'Honda' },
  renault: { slug: 'renault', label: 'Renault' },
  byd: { slug: 'byd', label: 'BYD' },
  ford: { slug: 'ford', label: 'Ford' },
  gwm: { slug: 'gwm', label: 'GWM' },
  bmw: { slug: 'bmw', label: 'BMW' },
  citroen: { slug: 'citroen', label: 'Citroen' },
  'citroen | peugeot': { slug: 'citroen', label: 'Citroen / Peugeot' },
  kia: { slug: 'kia', label: 'Kia' },
};

const SERVICE_TYPE_BY_CATEGORIA = {
  pneus: 'pneus',
  campneus: 'pneus',
  bridgestone: 'pneus',
  'della via': 'pneus',
  'hc pneus': 'pneus',
  pirelli: 'pneus',
  continental: 'pneus',
  cacique: 'pneus',
  'pneus santa helena': 'pneus',
  michelin: 'pneus',
  'aguia pneus': 'pneus',
  vidros: 'vidros',
  vidrama: 'vidros',
  vidrovan: 'vidros',
  'funilaria e pintura': 'funilaria',
  concessionaria: 'concessionaria',
  'concessionaria toyota': 'concessionaria',
  'concesionaria toyota': 'concessionaria',
};

function normalizeKey(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function slugify(value) {
  return normalizeKey(value).replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
}

export function resolveCategoria(rawCategoria) {
  if (!rawCategoria) return null;
  const key = normalizeKey(rawCategoria);
  const iconBrand = ICON_BACKED_BRANDS[key];
  const brandSlug = iconBrand ? iconBrand.slug : slugify(rawCategoria);
  const brandLabel = iconBrand ? iconBrand.label : rawCategoria.trim();
  const serviceType = SERVICE_TYPE_BY_CATEGORIA[key] || 'oficina';

  return { brandSlug, brandLabel, serviceType, hasIcon: Boolean(iconBrand) };
}
