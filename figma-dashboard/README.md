# Rappi Availability Dashboard

Dashboard React para visualizar y analizar disponibilidad histórica de tiendas visibles en Rappi.

## Requisitos

- Node.js 18+
- npm 9+

## Instalación y uso

```bash
npm install
npm run dev
```

Abre `http://localhost:5173`

## Datos

Los datos se cargan desde `public/data.js`, generado por `scripts/preprocess.js` a partir de los CSV de exportación. El archivo ya está incluido en el repositorio.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción en `dist/` |
| `npm run preview` | Previsualizar el build |
