type AvailabilityPoint = {
  t: string;
  value: number;
};

type AvailabilityFile = {
  file: string;
  start: string;
  end: string;
  avg: number;
  min: number;
  max: number;
};

type RappiAvailabilityData = {
  generatedAt: string;
  metric: string;
  source: {
    files: number;
    points: number;
    start: string;
    end: string;
  };
  summary: {
    avg: number;
    min: AvailabilityPoint & { file: string };
    max: AvailabilityPoint & { file: string };
    p90: number;
    latest: AvailabilityPoint & { file: string };
    latestAvg: number;
  };
  series: AvailabilityPoint[];
  hourly: Array<AvailabilityPoint & { avg: number }>;
  daily: Array<AvailabilityPoint & { avg: number }>;
  files: AvailabilityFile[];
};

export type StoreStatus = 'online' | 'offline';

export type Store = {
  id: string;
  currentStatus: StoreStatus;
};

export type StatusRecord = {
  id: string;
  storeId: string;
  timestamp: Date;
  status: StoreStatus;
  duration: number;
  value: number;
};

export type TimelineData = {
  time: string;
  visible: number;
  baseline: number;
};

export type DashboardMetrics = {
  totalStores: number;
  // % of hourly readings at or above healthyThreshold (baseline × 0.85).
  // Measures signal health, NOT classic infrastructure uptime.
  uptime: number;
  totalChanges: number;
  totalReadings: number;
  readingsToReview: number;
  /** @legacy — prefer averageDropMagnitude */
  avgDowntime: number;
  /** Mean absolute delta across all negative steps in the period */
  averageDropMagnitude: number;
  expectedAverage: number;
  latestVisible: number;
  latestDeltaPercent: number;
  latestDirection: 'above' | 'below' | 'flat';
};

export type DiagnosticPoint = {
  time: string;
  value: number;
  expected: number;
  drop?: number;
  isImportantDrop?: boolean;
  isWorst?: boolean;
};

export type DiagnosticIncident = {
  id: string;
  start: string;
  end: string;
  recovery: string;
  minutesToRecover: number;
  minValue: number;
};

export type PatternBucket = {
  label: string;
  belowPct: number;
  avgValue: number;
  count: number;
};

export type DailyImpactBucket = {
  label: string;
  /** @legacy — prefer cumulativeDropMagnitude */
  totalLoss: number;
  /** Sum of all negative-step magnitudes for the day (volatility proxy, not monetary loss) */
  cumulativeDropMagnitude: number;
  dropCount: number;
  biggestDrop: number;
};

export type RecoveryStats = {
  min: number;
  median: number;
  max: number;
  avg: number;
};

export type DiagnosticAnalysis = {
  expectedAverage: number;
  expectedThreshold: number;
  importantDropThreshold: number;
  totalDrops: number;
  importantDrops: number;
  reviewShare: number;
  /** @legacy — prefer recoveryStats.avg */
  avgRecoveryMinutes: number;
  recoveryStats: RecoveryStats;
  patternSummary: string;
  worstPoint: {
    time: string;
    value: number;
  };
  biggestDrop: {
    time: string;
    from: number;
    to: number;
    drop: number;
    pct: number;
  } | null;
  chartData: DiagnosticPoint[];
  incidents: DiagnosticIncident[];
  problematicHours: PatternBucket[];
  problematicDays: PatternBucket[];
  dailyImpact: DailyImpactBucket[];
  baselineContext: BaselineContext;
};

declare global {
  interface Window {
    RAPPI_AVAILABILITY_DATA?: RappiAvailabilityData;
  }
}

export type BaselineContext = {
  baselineValue: number;
  healthyThreshold: number;
  extremeDays: string[];
  worstDay: { day: string; minValue: number } | null;
  cleanPoints: Array<{ t: Date; value: number }>;
};

function percentileOf(nums: number[], p: number): number {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function buildBaselineContext(
  allSeriesPoints: Array<{ t: Date; value: number }>,
  options: { thresholdFactor?: number } = {}
): BaselineContext {
  const thresholdFactor = options.thresholdFactor ?? 0.05;
  const allValues = allSeriesPoints.map((p) => p.value);
  const globalMedian = percentileOf(allValues, 50);
  const extremeThreshold = globalMedian * thresholdFactor;

  const byDay = new Map<string, Array<{ t: Date; value: number }>>();
  for (const point of allSeriesPoints) {
    const day = point.t.toISOString().slice(0, 10);
    const existing = byDay.get(day) ?? [];
    existing.push(point);
    byDay.set(day, existing);
  }

  // worstDay = day with the absolute minimum value across the entire series.
  // Tracked independently of extreme classification so the UI can always show it.
  let worstDay: { day: string; minValue: number } | null = null;
  for (const [day, dayPoints] of byDay) {
    const minValue = Math.min(...dayPoints.map((p) => p.value));
    if (!worstDay || minValue < worstDay.minValue) {
      worstDay = { day, minValue };
    }
  }

  // Extreme day detection: use the day's MEDIAN, not its minimum.
  // This prevents cumulative metrics (which start near zero at the beginning of each
  // collection window) from being classified as extreme on every single day.
  // A day is only extreme if its typical (median) value is anomalously low.
  const extremeDays: string[] = [];
  for (const [day, dayPoints] of byDay) {
    const dayMedian = percentileOf(dayPoints.map((p) => p.value), 50);
    if (dayMedian <= extremeThreshold) {
      extremeDays.push(day);
    }
  }

  const extremeDaySet = new Set(extremeDays);
  const cleanPoints = allSeriesPoints.filter(
    (point) => !extremeDaySet.has(point.t.toISOString().slice(0, 10))
  );

  // Fallback: if all days are extreme (e.g. very sparse data), use the full series.
  const referencePoints = cleanPoints.length > 0 ? cleanPoints : allSeriesPoints;
  const baselineValue = percentileOf(referencePoints.map((p) => p.value), 50);
  const healthyThreshold = baselineValue * 0.85;

  return { baselineValue, healthyThreshold, extremeDays, worstDay, cleanPoints };
}

const formatCompact = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 0,
});

function getRawData(): RappiAvailabilityData {
  const data = window.RAPPI_AVAILABILITY_DATA;
  if (!data) {
    throw new Error('No se encontro window.RAPPI_AVAILABILITY_DATA. Revisa public/data.js.');
  }
  return data;
}

function inRange(value: string, start: Date, end: Date) {
  const time = new Date(value).getTime();
  return time >= start.getTime() && time <= end.getTime();
}

function minutesBetween(start: string, end: string) {
  const diff = Math.abs(new Date(end).getTime() - new Date(start).getTime());
  return Math.max(1, Math.round(diff / 60000));
}

function statusForValue(value: number, baseline: number): StoreStatus {
  return value >= baseline ? 'online' : 'offline';
}

function formatDateTime(value: Date) {
  return value.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatHour(value: Date) {
  return value.toLocaleString('es-CO', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    hour12: false,
  });
}

function formatDay(value: Date) {
  return value.toLocaleDateString('es-CO', {
    timeZone: 'America/Bogota',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
}

export function getInitialDateRange() {
  const data = getRawData();
  return {
    start: new Date(data.source.start),
    end: new Date(data.source.end),
  };
}

export function formatValue(value: number) {
  return formatCompact.format(Math.round(value || 0));
}

export function buildDashboardData(startDate: Date, endDate: Date) {
  const data = getRawData();
  const allSeriesPoints = data.series
    .map((point) => ({ t: new Date(point.t), value: point.value }))
    .filter((point) => Number.isFinite(point.value));
  const baselineCtx = buildBaselineContext(allSeriesPoints);
  const baseline = baselineCtx.baselineValue;
  const healthyThreshold = baselineCtx.healthyThreshold;
  const hourly = data.hourly.filter((point) => inRange(point.t, startDate, endDate));
  const files = data.files.filter((file) => inRange(file.start, startDate, endDate));
  const latestByFile = new Map<string, AvailabilityFile>();

  files.forEach((file) => {
    const existing = latestByFile.get(file.file);
    if (!existing || new Date(file.end).getTime() > new Date(existing.end).getTime()) {
      latestByFile.set(file.file, file);
    }
  });

  const stores = Array.from(latestByFile.values())
    .slice(0, 80)
    .map((file, index) => ({
      id: `Reporte ${String(index + 1).padStart(3, '0')}`,
      currentStatus: statusForValue(file.avg, healthyThreshold),
    }));

  const statusHistory = files.slice(0, 220).map((file, index) => ({
    id: `${file.file}-${index}`,
    storeId: `Reporte ${String((index % Math.max(stores.length, 1)) + 1).padStart(3, '0')}`,
    timestamp: new Date(file.end),
    status: statusForValue(file.avg, healthyThreshold),
    duration: minutesBetween(file.start, file.end),
    value: file.avg,
  }));

  const timelineData = hourly.map((point) => ({
    time: new Date(point.t).toLocaleDateString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
    }),
    visible: Math.round(point.avg),
    baseline: Math.round(baseline),
  }));

  const totalRecords = hourly.length;
  const onlineRecords = hourly.filter((point) => point.avg >= healthyThreshold).length;
  const offlineRecords = Math.max(totalRecords - onlineRecords, 0);
  const uptime = totalRecords > 0 ? (onlineRecords / totalRecords) * 100 : 0;
  const latestVisible = data.summary.latest.value;
  const latestDeltaPercent = baseline
    ? ((latestVisible - baseline) / baseline) * 100
    : 0;

  const drops = hourly
    .map((point, index) => ({
      point,
      delta: index === 0 ? 0 : point.avg - hourly[index - 1].avg,
    }))
    .filter((entry) => entry.delta < 0);

  const averageDropMagnitude = drops.length
    ? Math.round(drops.reduce((sum, entry) => sum + Math.abs(entry.delta), 0) / drops.length)
    : 0;
  // avgDowntime kept for UI compatibility; mirrors averageDropMagnitude (fallback differs for legacy reasons)
  const avgDowntime = averageDropMagnitude || offlineRecords;

  return {
    stores,
    statusHistory,
    timelineData,
    source: data.source,
    summary: data.summary,
    baselineContext: baselineCtx,
    metrics: {
      totalStores: data.source.files,
      uptime: Number(uptime.toFixed(1)),
      totalChanges: data.source.points,
      totalReadings: totalRecords,
      readingsToReview: offlineRecords,
      avgDowntime,
      averageDropMagnitude,
      expectedAverage: baseline,
      latestVisible,
      latestDeltaPercent: Number(latestDeltaPercent.toFixed(1)),
      latestDirection: latestDeltaPercent > 1 ? 'above' : latestDeltaPercent < -1 ? 'below' : 'flat',
    },
  };
}

export function buildDiagnosticAnalysis(startDate: Date, endDate: Date): DiagnosticAnalysis {
  const data = getRawData();
  const allSeriesPoints = data.series
    .map((point) => ({ t: new Date(point.t), value: point.value }))
    .filter((point) => Number.isFinite(point.value));
  const baselineCtx = buildBaselineContext(allSeriesPoints);
  const baselineValue = baselineCtx.baselineValue;
  const expectedThreshold = baselineCtx.healthyThreshold;
  const importantDropThreshold = baselineValue * 0.15;
  const points = allSeriesPoints
    .filter((point) => point.t >= startDate && point.t <= endDate)
    .sort((a, b) => a.t.getTime() - b.t.getTime());

  const enriched = points.map((point, index) => {
    const previous = points[index - 1];
    const delta = previous ? point.value - previous.value : 0;
    const pct = previous?.value ? (delta / previous.value) * 100 : 0;

    return {
      ...point,
      delta,
      pct,
      index,
    };
  });

  const drops = enriched.filter((point) => point.delta < 0);
  const importantDrops = enriched.filter((point) => point.delta <= -importantDropThreshold);
  const worstPoint = enriched.reduce(
    (worst, point) => point.value < worst.value ? point : worst,
    enriched[0] || { t: startDate, value: 0, delta: 0, pct: 0, index: 0 },
  );
  const biggestDrop = drops.reduce(
    (worst, point) => point.delta < worst.delta ? point : worst,
    drops[0],
  );

  const incidents: Array<{
    start: typeof enriched[number];
    end: typeof enriched[number];
    min: typeof enriched[number];
    recovery?: typeof enriched[number];
    count: number;
  }> = [];
  let currentIncident: typeof incidents[number] | null = null;

  enriched.forEach((point) => {
    if (point.value < expectedThreshold) {
      if (!currentIncident) {
        currentIncident = {
          start: point,
          end: point,
          min: point,
          count: 0,
        };
      }
      currentIncident.end = point;
      currentIncident.count += 1;
      if (point.value < currentIncident.min.value) {
        currentIncident.min = point;
      }
      return;
    }

    if (currentIncident) {
      currentIncident.recovery = point;
      incidents.push(currentIncident);
      currentIncident = null;
    }
  });

  if (currentIncident) {
    incidents.push(currentIncident);
  }

  const recoveredIncidents = incidents.filter((incident) => incident.recovery);
  const recoveryMinutes = recoveredIncidents.map((incident) =>
    Math.round((incident.recovery!.t.getTime() - incident.start.t.getTime()) / 60000),
  );
  const avgRecoveryMinutes = recoveryMinutes.length
    ? Math.round(recoveryMinutes.reduce((a, b) => a + b, 0) / recoveryMinutes.length)
    : 0;
  const recoveryStats: RecoveryStats = recoveryMinutes.length
    ? {
        min: Math.min(...recoveryMinutes),
        median: Math.round(percentileOf(recoveryMinutes, 50)),
        max: Math.max(...recoveryMinutes),
        avg: avgRecoveryMinutes,
      }
    : { min: 0, median: 0, max: 0, avg: 0 };

  const hourBuckets = new Map<string, { label: string; count: number; below: number; sum: number }>();
  const dayBuckets = new Map<string, { label: string; count: number; below: number; sum: number }>();

  enriched.forEach((point) => {
    const hour = formatHour(point.t);
    const hourBucket = hourBuckets.get(hour) || { label: `${hour}:00`, count: 0, below: 0, sum: 0 };
    hourBucket.count += 1;
    hourBucket.sum += point.value;
    // Compare against baselineValue (median), not healthyThreshold (0.85× baseline).
    // healthyThreshold is for incident detection; baselineValue gives meaningful "below expected" counts.
    if (point.value < baselineValue) hourBucket.below += 1;
    hourBuckets.set(hour, hourBucket);

    const day = formatDay(point.t);
    const dayBucket = dayBuckets.get(day) || { label: day, count: 0, below: 0, sum: 0 };
    dayBucket.count += 1;
    dayBucket.sum += point.value;
    if (point.value < baselineValue) dayBucket.below += 1;
    dayBuckets.set(day, dayBucket);
  });

  const toPatternRows = (rows: Array<{ label: string; count: number; below: number; sum: number }>) =>
    rows
      .map((row) => ({
        label: row.label,
        belowPct: row.count ? Math.round((row.below / row.count) * 100) : 0,
        avgValue: row.count ? Math.round(row.sum / row.count) : 0,
        count: row.count,
      }))
      .sort((a, b) => b.belowPct - a.belowPct || a.avgValue - b.avgValue);

  const problematicHours = toPatternRows([...hourBuckets.values()]);
  const problematicDays = toPatternRows([...dayBuckets.values()]);

  const dayImpactMap = new Map<string, DailyImpactBucket>();
  for (const point of enriched) {
    if (point.delta >= 0) continue;
    const label = point.t.toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit',
      month: '2-digit',
    });
    const existing = dayImpactMap.get(label) ?? { label, totalLoss: 0, cumulativeDropMagnitude: 0, dropCount: 0, biggestDrop: 0 };
    existing.totalLoss += Math.abs(point.delta);
    existing.cumulativeDropMagnitude += Math.abs(point.delta);
    existing.dropCount += 1;
    if (Math.abs(point.delta) > existing.biggestDrop) existing.biggestDrop = Math.abs(point.delta);
    dayImpactMap.set(label, existing);
  }
  const dailyImpact = [...dayImpactMap.values()]
    .sort((a, b) => b.totalLoss - a.totalLoss)
    .slice(0, 5);
  const recurringHours = problematicHours.filter((hour) => hour.belowPct >= 80).slice(0, 4);
  const patternSummary = recurringHours.length
    ? `La caída no parece puntual: las horas ${recurringHours.map((hour) => hour.label).join(', ')} concentran deterioro recurrente.`
    : 'No se ve una franja dominante; el deterioro parece disperso y más puntual que constante.';

  return {
    expectedAverage: baselineValue,
    expectedThreshold,
    baselineContext: baselineCtx,
    importantDropThreshold,
    totalDrops: drops.length,
    importantDrops: importantDrops.length,
    reviewShare: enriched.length
      ? Math.round((enriched.filter((point) => point.value < expectedThreshold).length / enriched.length) * 100)
      : 0,
    avgRecoveryMinutes,
    recoveryStats,
    patternSummary,
    worstPoint: {
      time: formatDateTime(worstPoint.t),
      value: worstPoint.value,
    },
    biggestDrop: biggestDrop
      ? {
          time: formatDateTime(biggestDrop.t),
          from: enriched[biggestDrop.index - 1]?.value || 0,
          to: biggestDrop.value,
          drop: Math.abs(biggestDrop.delta),
          pct: Math.abs(Number(biggestDrop.pct.toFixed(1))),
        }
      : null,
    chartData: (() => {
      // Downsample to ≤300 points for legibility; always keep worstPoint and important drops.
      const step = Math.max(1, Math.ceil(enriched.length / 300));
      return enriched
        .filter((point, i) =>
          i % step === 0 ||
          point.t.getTime() === worstPoint.t.getTime() ||
          point.delta <= -importantDropThreshold,
        )
        .map((point) => ({
          time: formatDateTime(point.t),
          value: point.value,
          expected: Math.round(baselineValue),
          drop: point.delta < 0 ? Math.abs(point.delta) : undefined,
          isImportantDrop: point.delta <= -importantDropThreshold,
          isWorst: point.t.getTime() === worstPoint.t.getTime(),
        }));
    })(),
    incidents: incidents
      .filter((incident) => incident.recovery)
      .map((incident, index) => ({
        id: `incident-${index}`,
        start: formatDateTime(incident.start.t),
        end: formatDateTime(incident.end.t),
        recovery: formatDateTime(incident.recovery!.t),
        minutesToRecover: Math.round((incident.recovery!.t.getTime() - incident.start.t.getTime()) / 60000),
        minValue: incident.min.value,
      })),
    problematicHours,
    dailyImpact,
  };
}

export function getChatResponse(question: string, dashboardData: { metrics: DashboardMetrics; analysis: DiagnosticAnalysis }): string {
  const { metrics, analysis } = dashboardData;
  const normalized = question.toLowerCase().trim();

  // Normalize question
  const cleanQuestion = normalized
    .replace(/[¿?¡!.,;:]/g, '')
    .replace(/\s+/g, ' ');

  // Detect intention
  let intention: string;

  if (cleanQuestion.includes('resumen') || cleanQuestion.includes('summary') || cleanQuestion.includes('estado') || cleanQuestion.includes('general')) {
    intention = 'summary';
  } else if (cleanQuestion.includes('evento critico') || cleanQuestion.includes('critical') || cleanQuestion.includes('incidente') || cleanQuestion.includes('peor dia') || cleanQuestion.includes('worst day')) {
    intention = 'critical_event';
  } else if (cleanQuestion.includes('hora') || cleanQuestion.includes('horas') || cleanQuestion.includes('problematic hours') || cleanQuestion.includes('franja')) {
    intention = 'problem_hours';
  } else if (cleanQuestion.includes('dia') || cleanQuestion.includes('dias') || cleanQuestion.includes('problematic days') || cleanQuestion.includes('deterioro')) {
    intention = 'problem_days';
  } else if (cleanQuestion.includes('recuperacion') || cleanQuestion.includes('recovery') || cleanQuestion.includes('tiempo') || cleanQuestion.includes('restaurar')) {
    intention = 'recovery';
  } else if (cleanQuestion.includes('metrica') || cleanQuestion.includes('uptime') || cleanQuestion.includes('disponibilidad') || cleanQuestion.includes('explicar') || cleanQuestion.includes('que significa')) {
    intention = 'metric_explainer';
  } else {
    intention = 'fallback';
  }

  // Generate response based on intention
  switch (intention) {
    case 'summary':
      const state = metrics.uptime >= 95 ? 'estable' : metrics.uptime >= 85 ? 'con algunas alertas' : 'crítico';
      const drops = analysis.importantDrops;
      const reviewPct = analysis.reviewShare;
      return `El estado general es ${state} con ${formatValue(metrics.uptime)}% de uptime. Se registraron ${drops} caídas importantes y el ${reviewPct}% de las lecturas requieren revisión. El promedio esperado es ${formatValue(metrics.expectedAverage)} tiendas visibles.`;

    case 'critical_event':
      const worstDay = analysis.baselineContext.worstDay;
      if (worstDay) {
        const [, month, day] = worstDay.day.split('-');
        return `El evento crítico ocurrió el ${day}/${month} con un mínimo de ${formatValue(worstDay.minValue)} tiendas visibles. Esta fecha concentra la mayor caída observada en el período.`;
      }
      return 'No se detectó un evento crítico claro en el período analizado.';

    case 'problem_hours':
      const topHours = analysis.problematicHours.slice(0, 3);
      if (topHours.length) {
        const hoursText = topHours.map(h => `${h.label} (${h.belowPct}% bajo lo esperado)`).join(', ');
        return `Las horas más problemáticas son: ${hoursText}. Estas franjas concentran la mayor proporción de lecturas por debajo del promedio esperado.`;
      }
      return 'No se identificaron horas con deterioro significativo en el período.';

    case 'problem_days':
      const topDays = analysis.problematicDays.slice(0, 3);
      if (topDays.length) {
        const daysText = topDays.map(d => `${d.label} (${d.belowPct}% bajo lo esperado)`).join(', ');
        return `Los días más problemáticos son: ${daysText}. Estos días muestran mayor variabilidad y lecturas por debajo del promedio.`;
      }
      return 'No se identificaron días con deterioro significativo en el período.';

    case 'recovery':
      const { recoveryStats } = analysis;
      if (recoveryStats.avg > 0) {
        return `La mediana de tiempo de recuperación es ${formatMinutes(recoveryStats.median)}. El rango observado va de ${formatMinutes(recoveryStats.min)} a ${formatMinutes(recoveryStats.max)} minutos basado en ${analysis.incidents.length} incidentes cerrados.`;
      }
      return 'No hay suficientes datos de incidentes cerrados para calcular estadísticas de recuperación.';

    case 'metric_explainer':
      return `El uptime mide el porcentaje de lecturas por hora que están al menos en el 85% del promedio esperado (${formatValue(metrics.expectedAverage)} tiendas). No es uptime tradicional de infraestructura, sino salud de la señal de disponibilidad. La magnitud promedio de caídas es ${formatValue(metrics.averageDropMagnitude)} tiendas.`;

    default:
      return 'No entiendo tu pregunta. Puedes preguntarme sobre el resumen general, eventos críticos, horas o días problemáticos, recuperación, o explicación de métricas.';
  }
}
