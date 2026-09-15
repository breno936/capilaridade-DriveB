import PriceRadarClient from '../../components/price-radar-client';

export const metadata = {
  title: 'Radar de Precos | Capilaridade das Oficinas',
  description: 'Compare os precos propostos de pecas com uma referencia de mercado e classifique cada item.',
};

export default function RadarDePrecosPage() {
  return <PriceRadarClient />;
}
