import ClientListClient from '../../components/client-list-client';

export const metadata = {
  title: 'Estudo de Capilaridade | Capilaridade das Oficinas',
  description: 'Selecione um cliente para ver o historico de estudos de capilaridade ou crie um novo.',
};

export default function EstudoCapilaridadePage() {
  return <ClientListClient />;
}
