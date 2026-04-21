# Rappi Availability Dashboard

Dashboard para analizar la disponibilidad histórica de tiendas visibles en Rappi, construido sobre datos de monitoreo sintético (`synthetic_monitoring_visible_stores`).

## Stack

- **React 18** + **Vite**
- **Chakra UI** — componentes y layout
- **Recharts** — gráficos interactivos
- **Lucide React** — íconos

## Correr localmente

```bash
cd figma-dashboard
npm install
npm run dev
```

Abre `http://localhost:5173`

## Regenerar los datos

Los datos viven en `figma-dashboard/public/data.js`, generados a partir de los CSVs de exportación:

```bash
node scripts/preprocess.js
cp app/data.js figma-dashboard/public/data.js
```

> Los CSV originales (`Archivo (1)/`) no se incluyen en el repositorio.

## Estructura

```
├── figma-dashboard/        # Dashboard React (fuente principal)
│   ├── public/data.js      # Dataset preprocesado
│   └── src/
│       ├── app/
│       │   ├── components/ # DiagnosticInsights, MetricsCards, StoreAvailabilityDashboard
│       │   └── utils/      # availabilityData.ts — toda la lógica de análisis
│       └── main.tsx
└── scripts/
    └── preprocess.js       # Transforma CSVs → data.js
```

## Qué muestra

- **KPIs** — disponibilidad actual, estabilidad, caídas detectadas, impacto, tiempo de recuperación
- **Evolución temporal** — serie real vs. promedio esperado, puntos críticos marcados
- **Horas y días más problemáticos** — ranking con porcentaje bajo lo esperado
- **Distribución por hora y día** — gráficos de barras con escala de severidad
- **Impacto de caídas por día** — top 5 días por pérdida acumulada de tiendas visibles

## Limitaciones

El dataset contiene una métrica agregada, no eventos por tienda individual. El análisis refleja disponibilidad total, no segmentada por tienda, ciudad o vertical. Con un dataset granular la misma estructura puede extenderse con esos filtros.
