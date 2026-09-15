import CapillarityStudyClient from '../../../components/capillarity-study-client';

export const metadata = {
  title: 'Estudo de Capilaridade | Capilaridade das Oficinas',
  description: 'Gere e acompanhe o historico do estudo de capilaridade de um cliente.',
};

export default function ClientCapillarityStudyPage({ params }) {
  return <CapillarityStudyClient clientId={Number(params.clientId)} />;
}
