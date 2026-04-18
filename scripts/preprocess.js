const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "Archivo (1)");
const outputFile = path.join(root, "app", "data.js");

const CSV_PREFIX_COLUMNS = 4;
const SAMPLE_LIMIT = 900;

function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }

  cells.push(cell);
  return cells;
}

function bucketHour(date) {
  const bucket = new Date(date);
  bucket.setUTCMinutes(0, 0, 0);
  return bucket.toISOString();
}

function bucketDay(date) {
  const bucket = new Date(date);
  bucket.setUTCHours(0, 0, 0, 0);
  return bucket.toISOString();
}

function formatFileLabel(fileName) {
  return fileName
    .replace("AVAILABILITY-data", "Export")
    .replace(".csv", "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSeries(points, limit) {
  if (points.length <= limit) return points;
  const stride = Math.ceil(points.length / limit);
  const compacted = [];

  for (let i = 0; i < points.length; i += stride) {
    const chunk = points.slice(i, i + stride);
    const avg =
      chunk.reduce((sum, point) => sum + point.value, 0) / Math.max(chunk.length, 1);
    compacted.push({
      t: chunk[Math.floor(chunk.length / 2)].t,
      value: Math.round(avg),
    });
  }

  return compacted;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[index];
}

function summarizeBucket(entries) {
  const values = entries.map((entry) => entry.value);
  return {
    t: entries[0].bucket,
    avg: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
    min: Math.min(...values),
    max: Math.max(...values),
    points: values.length,
  };
}

function main() {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(`No existe la carpeta de datos: ${sourceDir}`);
  }

  const files = fs
    .readdirSync(sourceDir)
    .filter((file) => file.toLowerCase().endsWith(".csv"))
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

  const rawPoints = [];
  const fileSummaries = [];
  const metrics = new Set();

  for (const file of files) {
    const filePath = path.join(sourceDir, file);
    const lines = fs.readFileSync(filePath, "utf8").trim().split(/\r?\n/);
    if (lines.length < 2) continue;

    const headers = parseCsvLine(lines[0]);
    const row = parseCsvLine(lines[1]);
    const metric = row[1] || "unknown_metric";
    metrics.add(metric);

    const points = [];
    for (let i = CSV_PREFIX_COLUMNS; i < headers.length; i += 1) {
      const timestamp = Date.parse(headers[i]);
      const value = Number(row[i]);
      if (Number.isFinite(timestamp) && Number.isFinite(value)) {
        points.push({
          t: new Date(timestamp).toISOString(),
          value,
          file,
          metric,
        });
      }
    }

    if (points.length) {
      const values = points.map((point) => point.value);
      fileSummaries.push({
        file,
        label: formatFileLabel(file),
        start: points[0].t,
        end: points[points.length - 1].t,
        avg: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
        min: Math.min(...values),
        max: Math.max(...values),
        points: points.length,
      });
      rawPoints.push(...points);
    }
  }

  rawPoints.sort((a, b) => Date.parse(a.t) - Date.parse(b.t));

  const values = rawPoints.map((point) => point.value);
  const first = rawPoints[0];
  const last = rawPoints[rawPoints.length - 1];
  const minPoint = rawPoints.reduce((best, point) => (point.value < best.value ? point : best), first);
  const maxPoint = rawPoints.reduce((best, point) => (point.value > best.value ? point : best), first);

  const hourlyMap = new Map();
  const dailyMap = new Map();

  for (const point of rawPoints) {
    const date = new Date(point.t);
    const hour = bucketHour(date);
    const day = bucketDay(date);

    if (!hourlyMap.has(hour)) hourlyMap.set(hour, []);
    hourlyMap.get(hour).push({ ...point, bucket: hour });

    if (!dailyMap.has(day)) dailyMap.set(day, []);
    dailyMap.get(day).push({ ...point, bucket: day });
  }

  const hourly = [...hourlyMap.values()].map(summarizeBucket);
  const daily = [...dailyMap.values()].map(summarizeBucket);
  const hourlyDelta = hourly.map((entry, index) => ({
    ...entry,
    delta: index === 0 ? 0 : entry.avg - hourly[index - 1].avg,
  }));

  const biggestDrops = hourlyDelta
    .filter((entry) => entry.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 10);

  const biggestRecoveries = hourlyDelta
    .filter((entry) => entry.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 10);

  const latestWindow = rawPoints.slice(Math.max(0, rawPoints.length - 180));
  const latestAvg =
    latestWindow.reduce((sum, point) => sum + point.value, 0) /
    Math.max(latestWindow.length, 1);

  const dataset = {
    generatedAt: new Date().toISOString(),
    metric: [...metrics][0] || "synthetic_monitoring_visible_stores",
    source: {
      files: files.length,
      points: rawPoints.length,
      start: first?.t || null,
      end: last?.t || null,
    },
    summary: {
      avg: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
      min: minPoint,
      max: maxPoint,
      p10: Math.round(percentile(values, 0.1)),
      p50: Math.round(percentile(values, 0.5)),
      p90: Math.round(percentile(values, 0.9)),
      latest: last,
      latestAvg: Math.round(latestAvg),
      first,
      changeAbs: last.value - first.value,
      changePct: Number((((last.value - first.value) / first.value) * 100).toFixed(2)),
    },
    series: compactSeries(rawPoints.map(({ t, value }) => ({ t, value })), SAMPLE_LIMIT),
    hourly,
    daily,
    biggestDrops,
    biggestRecoveries,
    files: fileSummaries,
  };

  fs.writeFileSync(
    outputFile,
    `window.RAPPI_AVAILABILITY_DATA = ${JSON.stringify(dataset, null, 2)};\n`
  );

  console.log(`Generated ${path.relative(root, outputFile)}`);
  console.log(`${files.length} CSV files, ${rawPoints.length} data points`);
}

main();
