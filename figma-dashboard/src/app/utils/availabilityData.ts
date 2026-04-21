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
  uptime: number;
  totalChanges: number;
  totalReadings: number;
  readingsToReview: number;
  avgDowntime: number;
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
  totalLoss: number;
  dropCount: number;
  biggestDrop: number;
};

export type DiagnosticAnalysis = {
  expectedAverage: number;
  expectedThreshold: number;
  importantDropThreshold: number;
  totalDrops: number;
  importantDrops: number;
  reviewShare: number;
  avgRecoveryMinutes: number;
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
};

declare global {
  interface Window {
    RAPPI_AVAILABILITY_DATA?: RappiAvailabilityData;
  }
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
  const baseline = data.summary.avg;
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
      currentStatus: statusForValue(file.avg, baseline * 0.85),
    }));

  const statusHistory = files.slice(0, 220).map((file, index) => ({
    id: `${file.file}-${index}`,
    storeId: `Reporte ${String((index % Math.max(stores.length, 1)) + 1).padStart(3, '0')}`,
    timestamp: new Date(file.end),
    status: statusForValue(file.avg, baseline * 0.85),
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
  const onlineRecords = hourly.filter((point) => point.avg >= baseline * 0.85).length;
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

  const avgDowntime = drops.length
    ? Math.round(drops.reduce((sum, entry) => sum + Math.abs(entry.delta), 0) / drops.length)
    : offlineRecords;

  return {
    stores,
    statusHistory,
    timelineData,
    source: data.source,
    summary: data.summary,
    metrics: {
      totalStores: data.source.files,
      uptime: Number(uptime.toFixed(1)),
      totalChanges: data.source.points,
      totalReadings: totalRecords,
      readingsToReview: offlineRecords,
      avgDowntime,
      expectedAverage: baseline,
      latestVisible,
      latestDeltaPercent: Number(latestDeltaPercent.toFixed(1)),
      latestDirection: latestDeltaPercent > 1 ? 'above' : latestDeltaPercent < -1 ? 'below' : 'flat',
    },
  };
}

export function buildDiagnosticAnalysis(startDate: Date, endDate: Date): DiagnosticAnalysis {
  const data = getRawData();
  const expectedAverage = data.summary.avg;
  const expectedThreshold = expectedAverage * 0.85;
  const importantDropThreshold = expectedAverage * 0.15;
  const points = data.series
    .map((point) => ({
      t: new Date(point.t),
      value: point.value,
    }))
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
  const avgRecoveryMinutes = recoveredIncidents.length
    ? Math.round(
        recoveredIncidents.reduce((sum, incident) => {
          return sum + Math.round((incident.recovery!.t.getTime() - incident.start.t.getTime()) / 60000);
        }, 0) / recoveredIncidents.length,
      )
    : 0;

  const hourBuckets = new Map<string, { label: string; count: number; below: number; sum: number }>();
  const dayBuckets = new Map<string, { label: string; count: number; below: number; sum: number }>();

  enriched.forEach((point) => {
    const hour = formatHour(point.t);
    const hourBucket = hourBuckets.get(hour) || { label: `${hour}:00`, count: 0, below: 0, sum: 0 };
    hourBucket.count += 1;
    hourBucket.sum += point.value;
    if (point.value < expectedThreshold) hourBucket.below += 1;
    hourBuckets.set(hour, hourBucket);

    const day = formatDay(point.t);
    const dayBucket = dayBuckets.get(day) || { label: day, count: 0, below: 0, sum: 0 };
    dayBucket.count += 1;
    dayBucket.sum += point.value;
    if (point.value < expectedThreshold) dayBucket.below += 1;
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
    const existing = dayImpactMap.get(label) ?? { label, totalLoss: 0, dropCount: 0, biggestDrop: 0 };
    existing.totalLoss += Math.abs(point.delta);
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
    expectedAverage,
    expectedThreshold,
    importantDropThreshold,
    totalDrops: drops.length,
    importantDrops: importantDrops.length,
    reviewShare: enriched.length
      ? Math.round((enriched.filter((point) => point.value < expectedThreshold).length / enriched.length) * 100)
      : 0,
    avgRecoveryMinutes,
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
    chartData: enriched.map((point) => ({
      time: formatDateTime(point.t),
      value: point.value,
      expected: Math.round(expectedAverage),
      drop: point.delta < 0 ? Math.abs(point.delta) : undefined,
      isImportantDrop: point.delta <= -importantDropThreshold,
      isWorst: point.t.getTime() === worstPoint.t.getTime(),
    })),
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
    problematicDays,
    dailyImpact,
  };
}
