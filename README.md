# Rappi Availability Intelligence

Aplicación web local para visualizar y conversar con datos históricos de disponibilidad de tiendas.

## Qué incluye

- Dashboard con KPIs de disponibilidad visible.
- Filtros por rango de fecha y granularidad.
- Gráfico de serie temporal, promedio diario y mayores caídas horarias.
- Tabla de archivos CSV procesados.
- Chatbot semántico local que responde sobre el rango visible del dashboard.

## Cómo correr

```bash
node scripts/preprocess.js
python3 -m http.server 4173 --directory app
```

Luego abre:

```txt
http://127.0.0.1:4173
```

## Datos

La carpeta `Archivo (1)` contiene 201 archivos CSV. Cada archivo viene en formato ancho:

```txt
Plot name, metric, Value Prefix, Value Suffix, timestamp_1, timestamp_2, ...
NOW, synthetic_monitoring_visible_stores, ..., value_1, value_2, ...
```

El script `scripts/preprocess.js` transforma esos CSV en `app/data.js`, con:

- serie compacta para visualización,
- agregados horarios,
- agregados diarios,
- mayores caídas y recuperaciones,
- resumen por archivo.

## Decisiones

- Se construyó sin dependencias externas para poder demostrarlo localmente y rápido.
- El chatbot no inventa datos: responde usando los mismos agregados visibles en el dashboard.
- La visualización usa SVG nativo para evitar problemas de instalación durante la prueba.
- La app separa preprocesamiento, datos y UI para que luego pueda migrarse a Next.js, Vercel AI SDK o una base real.

## Cómo explicar el uso de AI

Para la presentación:

- AI se usó como agente de ingeniería para inspeccionar el dataset, detectar que venía en formato ancho y diseñar una solución local.
- El agente ayudó a crear el preprocesador, la interfaz, los cálculos semánticos y las respuestas del chatbot.
- La decisión clave fue no usar un LLM en runtime, porque la prueba puede demostrarse sin API keys y con respuestas auditables.
- En producción, el chatbot podría evolucionar a Vercel AI SDK/OpenAI/Claude con tools controladas para consultar warehouse, capa semántica y dashboards.

## Limitaciones conocidas

- El dataset disponible contiene una métrica agregada (`synthetic_monitoring_visible_stores`), no eventos por tienda individual.
- Por eso el dashboard analiza disponibilidad agregada, no disponibilidad por `store_id`, ciudad o vertical.
- Si se recibe un dataset granular, la misma estructura puede ampliarse con filtros por tienda, ciudad, marca, motivo y estado.
