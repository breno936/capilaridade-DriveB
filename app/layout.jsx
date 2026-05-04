import './globals.css';

export const metadata = {
  title: 'Capilaridade das Oficinas',
  description: 'Dashboard Next.js para mapa de calor e filtros da base de oficinas.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
