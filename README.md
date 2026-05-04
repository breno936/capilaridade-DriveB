# Dashboard de Capilaridade das Oficinas

Aplicação `Next.js` para explorar a base `car_workshop` com foco em capilaridade, mapa de calor no Brasil e filtros operacionais.

## O que a aplicação entrega

- mapa de calor com base na latitude/longitude da planilha
- modo alternativo com pontos clicáveis
- filtros por conceito, rede, categoria, checkout, regiões internas e flags operacionais
- KPIs de cobertura, ativação, bloqueio e qualidade geográfica
- tabela paginada sincronizada com o mapa
- exportação da seleção atual para CSV

## Arquivos principais

- `app/page.jsx`: entrada da aplicação
- `components/dashboard-client.jsx`: dashboard React com filtros, KPIs e tabela
- `components/map-view.jsx`: mapa Leaflet com heatmap e pontos
- `lib/workshop-utils.js`: utilitários de filtro, formatação e exportação
- `public/data/workshops.json`: dataset consumido pelo app
- `scripts/export-workshops.ps1`: script para regenerar os dados a partir do Excel

## Como rodar

1. Instale as dependências:

```powershell
npm install
```

2. Suba o ambiente de desenvolvimento:

```powershell
npm run dev
```

3. Abra `http://localhost:3000`

## Build de produção

```powershell
npm run build
npm start
```

## Regenerar o dataset

Sempre que `export_carworkshop.xlsx` mudar, rode:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/export-workshops.ps1
```

O script gera:

- `public/data/workshops.json` para o app `Next.js`
- `data/workshops.js` como saída legada

## Observações de dados

- a base atual possui registros com coordenadas fora do bounding box do Brasil
- por isso, o dashboard inicia em `Somente Brasil` para evitar distorção no heatmap
- a planilha não expõe cidade/UF diretamente na tabela principal, então a app trabalha com coordenadas e dimensões operacionais da própria base
- os arquivos `index.html`, `app.js` e `styles.css` ficaram como versão estática legada
