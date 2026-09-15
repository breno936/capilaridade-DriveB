const BRAND_DEFINITIONS = [
  { slug: 'bosch', label: 'Bosch', pattern: /\bBOSCH\b/ },
  { slug: 'volkswagen', label: 'Volkswagen', pattern: /\bVOLKSWAGEN\b|\bVW\b/ },
  { slug: 'fiat', label: 'Fiat', pattern: /\bFIAT\b/ },
  { slug: 'chevrolet', label: 'Chevrolet', pattern: /\bCHEVROLET\b|\bGM\b/ },
  { slug: 'nissan', label: 'Nissan', pattern: /\bNISSAN\b/ },
  { slug: 'jeep', label: 'Jeep', pattern: /\bJEEP\b/ },
  { slug: 'toyota', label: 'Toyota', pattern: /\bTOYOTA\b/ },
  { slug: 'hyundai', label: 'Hyundai', pattern: /\bHYUNDAI\b/ },
  { slug: 'renault', label: 'Renault', pattern: /\bRENAULT\b/ },
  { slug: 'ford', label: 'Ford', pattern: /\bFORD\b/ },
  { slug: 'citroen', label: 'Citroen', pattern: /\bCITRO[EÉ]N\b/ },
  { slug: 'peugeot', label: 'Peugeot', pattern: /\bPEUGEOT\b/ },
  { slug: 'byd', label: 'BYD', pattern: /\bBYD\b/ },
  { slug: 'mercedes', label: 'Mercedes-Benz', pattern: /\bMERCEDES(-|\s)?BENZ\b/ },
  { slug: 'bmw', label: 'BMW', pattern: /\bBMW\b/ },
  { slug: 'caoa', label: 'CAOA', pattern: /\bCAOA\b/ },
  { slug: 'honda', label: 'Honda', pattern: /\bHONDA\b/ },
  { slug: 'audi', label: 'Audi', pattern: /\bAUDI\b/ },
  { slug: 'gwm', label: 'GWM', pattern: /\bGWM\b/ },
  { slug: 'volvo', label: 'Volvo', pattern: /\bVOLVO\b/ },
  { slug: 'kia', label: 'Kia', pattern: /\bKIA\b/ },
  { slug: 'mini', label: 'Mini', pattern: /\bMINI\b/ },
  { slug: 'landrover', label: 'Land Rover', pattern: /\bLAND\s?ROVER\b/ },
  { slug: 'chery', label: 'Chery', pattern: /\bCHERY\b/ },
  { slug: 'mitsubishi', label: 'Mitsubishi', pattern: /\bMITSUBISHI\b/ },
  { slug: 'chrysler', label: 'Chrysler', pattern: /\bCHRYSLER\b/ },
  { slug: 'porsche', label: 'Porsche', pattern: /\bPORSCHE\b/ },
];

function workshopHaystack(item) {
  return [item.displayName, item.tradingName, item.corporateName].filter(Boolean).join(' ').toUpperCase();
}

export function detectWorkshopBrand(item) {
  const haystack = workshopHaystack(item);
  return BRAND_DEFINITIONS.find((brand) => brand.pattern.test(haystack)) || null;
}

export function brandIconUrl(slug) {
  return `/icons/brands/${slug}.png`;
}

export const workshopBrands = BRAND_DEFINITIONS;
