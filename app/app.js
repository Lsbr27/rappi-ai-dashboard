const data = window.RAPPI_AVAILABILITY_DATA;

const formatNumber = new Intl.NumberFormat("es-CO");
const formatDate = new Intl.DateTimeFormat("es-CO", {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
const formatDay = new Intl.DateTimeFormat("es-CO", {
  month: "short",
  day: "2-digit",
});

const state = {
  granularity: "hourly",
  start: data.source.start.slice(0, 10),
  end: data.source.end.slice(0, 10),
  fileQuery: "",
};

const elements = {
  dataWindow: document.querySelector("#data-window"),
  granularity: document.querySelector("#granularity"),
  startDate: document.querySelector("#startDate"),
  endDate: document.querySelector("#endDate"),
  resetFilters: document.querySelector("#resetFilters"),
  kpiAvg: document.querySelector("#kpiAvg"),
  kpiMin: document.querySelector("#kpiMin"),
  kpiMinDate: document.querySelector("#kpiMinDate"),
  kpiMax: document.querySelector("#kpiMax"),
  kpiMaxDate: document.querySelector("#kpiMaxDate"),
  kpiDrop: document.querySelector("#kpiDrop"),
  kpiDropDate: document.querySelector("#kpiDropDate"),
  statusCard: document.querySelector("#statusCard"),
  periodStatus: document.querySelector("#periodStatus"),
  periodStatusReason: document.querySelector("#periodStatusReason"),
  statusBadge: document.querySelector("#statusBadge"),
  executiveInsight: document.querySelector("#executiveInsight"),
  operationalRecommendation: document.querySelector("#operationalRecommendation"),
  chartSubtitle: document.querySelector("#chartSubtitle"),
  lineChart: document.querySelector("#lineChart"),
  chartTooltip: document.querySelector("#chartTooltip"),
  barChart: document.querySelector("#barChart"),
  dropsList: document.querySelector("#dropsList"),
  fileSearch: document.querySelector("#fileSearch"),
  filesTable: document.querySelector("#filesTable"),
  chatMessages: document.querySelector("#chatMessages"),
  chatForm: document.querySelector("#chatForm"),
  chatInput: document.querySelector("#chatInput"),
};

function number(value) {
  return formatNumber.format(Math.round(value || 0));
}

function date(value) {
  return formatDate.format(new Date(value));
}

function day(value) {
  return formatDay.format(new Date(value));
}

function activeSeries() {
  const source =
    state.granularity === "daily"
      ? data.daily.map((d) => ({ t: d.t, value: d.avg }))
      : state.granularity === "raw"
        ? data.series
        : data.hourly.map((d) => ({ t: d.t, value: d.avg }));

  const start = new Date(`${state.start}T00:00:00.000Z`).getTime();
  const end = new Date(`${state.end}T23:59:59.999Z`).getTime();
  return source.filter((point) => {
    const time = new Date(point.t).getTime();
    return time >= start && time <= end;
  });
}

function getStats(points) {
  if (!points.length) return null;
  const values = points.map((point) => point.value);
  const min = points.reduce((best, point) => (point.value < best.value ? point : best), points[0]);
  const max = points.reduce((best, point) => (point.value > best.value ? point : best), points[0]);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const first = points[0];
  const last = points[points.length - 1];
  return {
    avg,
    min,
    max,
    first,
    last,
    change: last.value - first.value,
    changePct: ((last.value - first.value) / Math.max(first.value, 1)) * 100,
  };
}

function activeHourly() {
  const start = new Date(`${state.start}T00:00:00.000Z`).getTime();
  const end = new Date(`${state.end}T23:59:59.999Z`).getTime();
  return data.hourly
    .filter((point) => {
      const time = new Date(point.t).getTime();
      return time >= start && time <= end;
    })
    .map((entry, index, arr) => ({
      ...entry,
      value: entry.avg,
      delta: index === 0 ? 0 : entry.avg - arr[index - 1].avg,
    }));
}

function getDiagnostics(points) {
  const stats = getStats(points);
  const hourly = activeHourly();
  const drops = hourly
    .filter((entry) => entry.delta < 0)
    .sort((a, b) => a.delta - b.delta);
  const recoveries = hourly
    .filter((entry) => entry.delta > 0)
    .sort((a, b) => b.delta - a.delta);
  const biggestDrop = drops[0] || null;
  const biggestRecovery = recoveries[0] || null;
  const absoluteDrops = hourly
    .map((entry) => Math.abs(Math.min(entry.delta, 0)))
    .filter((value) => value > 0);
  const avgDrop =
    absoluteDrops.reduce((sum, value) => sum + value, 0) / Math.max(absoluteDrops.length, 1);
  const severeThreshold = Math.max(avgDrop * 2.5, stats ? stats.avg * 0.12 : 0);
  const anomalies = drops.filter((entry) => Math.abs(entry.delta) >= severeThreshold);
  const minSeverity = stats ? (stats.avg - stats.min.value) / Math.max(stats.avg, 1) : 0;
  const dropSeverity =
    biggestDrop && stats ? Math.abs(biggestDrop.delta) / Math.max(stats.avg, 1) : 0;

  let level = "normal";
  if (minSeverity > 0.55 || dropSeverity > 0.35 || anomalies.length >= 3) {
    level = "critical";
  } else if (minSeverity > 0.3 || dropSeverity > 0.18 || anomalies.length > 0) {
    level = "warning";
  }

  return {
    stats,
    hourly,
    drops,
    recoveries,
    biggestDrop,
    biggestRecovery,
    anomalies,
    avgDrop,
    severeThreshold,
    minSeverity,
    dropSeverity,
    level,
  };
}

function statusCopy(diagnostics) {
  if (!diagnostics.stats) {
    return {
      title: "Sin datos",
      badge: "Sin datos",
      reason: "No hay puntos disponibles para el rango seleccionado.",
      insight: "Ajusta los filtros para recuperar datos del periodo.",
      recommendation: "Restablece el rango completo o selecciona fechas con datos.",
    };
  }

  const { stats, biggestDrop, anomalies, level } = diagnostics;
  const direction = stats.change >= 0 ? "cerró por encima" : "cerró por debajo";
  const changeText = `${number(Math.abs(stats.change))} tiendas (${Math.abs(stats.changePct).toFixed(1)}%)`;
  const dropText = biggestDrop
    ? ` La caída más fuerte fue de ${number(biggestDrop.delta)} el ${date(biggestDrop.t)}`
    : "";

  if (level === "critical") {
    return {
      title: "Crítico",
      badge: "Acción",
      reason: `Se detectó una desviación fuerte frente al promedio y ${anomalies.length} anomalía(s) horaria(s).`,
      insight: `El periodo ${direction} del inicio por ${changeText}. El mínimo cayó a ${number(stats.min.value)} tiendas visibles.${dropText}`,
      recommendation: biggestDrop
        ? `Prioriza la ventana de ${date(biggestDrop.t)} y cruza contra incidentes, monitoreo sintético y cambios operativos.`
        : "Revisa las horas con menor disponibilidad y valida si hubo incidentes operativos.",
    };
  }

  if (level === "warning") {
    return {
      title: "En observación",
      badge: "Atención",
      reason: `Hay variaciones relevantes y ${anomalies.length} punto(s) atípico(s) dentro del rango.`,
      insight: `La disponibilidad promedio fue ${number(stats.avg)} y el periodo ${direction} del inicio por ${changeText}.${dropText}`,
      recommendation: biggestDrop
        ? `Revisa si la caída de ${date(biggestDrop.t)} corresponde a comportamiento esperado, horario o incidente.`
        : "Monitorea el rango con granularidad horaria para detectar posibles degradaciones.",
    };
  }

  return {
    title: "Estable",
    badge: "Normal",
    reason: "No se detectan caídas atípicas severas en el rango visible.",
    insight: `La disponibilidad promedio fue ${number(stats.avg)} y el periodo ${direction} del inicio por ${changeText}.`,
    recommendation: "Mantén el monitoreo y usa el ranking de caídas para investigar cambios puntuales.",
  };
}

function scale(points, width, height, pad) {
  const xs = points.map((point) => new Date(point.t).getTime());
  const ys = points.map((point) => point.value);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const xSpan = Math.max(maxX - minX, 1);
  const ySpan = Math.max(maxY - minY, 1);

  return {
    x: (t) => pad.left + ((new Date(t).getTime() - minX) / xSpan) * (width - pad.left - pad.right),
    y: (v) => height - pad.bottom - ((v - minY) / ySpan) * (height - pad.top - pad.bottom),
    minY,
    maxY,
  };
}

function drawLineChart(points) {
  const svg = elements.lineChart;
  const width = svg.clientWidth || 900;
  const height = svg.clientHeight || 360;
  const pad = { top: 20, right: 24, bottom: 42, left: 76 };
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  if (points.length < 2) {
    svg.innerHTML = `<text x="24" y="50">No hay datos para este rango.</text>`;
    return;
  }

  const s = scale(points, width, height, pad);
  const line = points.map((point) => `${s.x(point.t).toFixed(1)},${s.y(point.value).toFixed(1)}`).join(" ");
  const area = `${pad.left},${height - pad.bottom} ${line} ${width - pad.right},${height - pad.bottom}`;
  const ticks = [s.minY, s.minY + (s.maxY - s.minY) / 2, s.maxY];
  const xTicks = [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]];
  const stats = getStats(points);
  const diagnostics = getDiagnostics(points);
  const markerCandidates = [
    { ...stats.min, type: "min", label: "Min" },
    { ...stats.max, type: "max", label: "Max" },
  ];
  if (diagnostics.biggestDrop) {
    markerCandidates.push({
      t: diagnostics.biggestDrop.t,
      value: diagnostics.biggestDrop.avg,
      type: "drop",
      label: "Drop",
    });
  }

  const markers = markerCandidates
    .filter((marker, index, arr) => arr.findIndex((item) => item.t === marker.t && item.type === marker.type) === index)
    .map((marker) => ({
      ...marker,
      x: s.x(marker.t),
      y: s.y(marker.value),
    }));

  svg.innerHTML = `
    ${ticks
      .map((tick) => {
        const y = s.y(tick);
        return `<line class="axis" x1="${pad.left}" x2="${width - pad.right}" y1="${y}" y2="${y}"></line>
          <text x="10" y="${y + 4}">${number(tick)}</text>`;
      })
      .join("")}
    ${xTicks
      .map((tick) => `<text x="${s.x(tick.t) - 34}" y="${height - 14}">${day(tick.t)}</text>`)
      .join("")}
    <polyline class="chart-area" points="${area}"></polyline>
    <polyline class="chart-line" points="${line}"></polyline>
    ${markers
      .map(
        (marker) => `
        <circle class="chart-point ${marker.type}" cx="${marker.x}" cy="${marker.y}" r="6"></circle>
        <text class="chart-marker-label" x="${Math.min(marker.x + 9, width - 46)}" y="${Math.max(marker.y - 9, 16)}">${marker.label}</text>
      `
      )
      .join("")}
    <line id="hoverLine" class="hover-line" x1="-10" x2="-10" y1="${pad.top}" y2="${height - pad.bottom}"></line>
    <rect id="hoverZone" class="hover-zone" x="${pad.left}" y="${pad.top}" width="${width - pad.left - pad.right}" height="${height - pad.top - pad.bottom}"></rect>
  `;

  const hoverZone = svg.querySelector("#hoverZone");
  const hoverLine = svg.querySelector("#hoverLine");
  hoverZone.addEventListener("mousemove", (event) => {
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const nearest = points.reduce((best, point) => {
      const distance = Math.abs(s.x(point.t) - x);
      return distance < best.distance ? { point, distance } : best;
    }, { point: points[0], distance: Infinity }).point;
    const index = points.indexOf(nearest);
    const previous = points[Math.max(0, index - 1)];
    const delta = nearest.value - previous.value;
    const status =
      nearest.value === stats.min.value
        ? "Punto mínimo"
        : nearest.value === stats.max.value
          ? "Punto máximo"
          : delta < 0
            ? "Caída"
            : delta > 0
              ? "Recuperación"
              : "Sin cambio";

    hoverLine.setAttribute("x1", s.x(nearest.t));
    hoverLine.setAttribute("x2", s.x(nearest.t));
    elements.chartTooltip.style.display = "block";
    elements.chartTooltip.style.left = `${Math.min(event.offsetX + 18, rect.width - 240)}px`;
    elements.chartTooltip.style.top = `${Math.max(event.offsetY - 40, 12)}px`;
    elements.chartTooltip.innerHTML = `
      <strong>${date(nearest.t)}</strong>
      <span>Tiendas visibles: ${number(nearest.value)}</span>
      <span>Variación previa: ${delta >= 0 ? "+" : ""}${number(delta)}</span>
      <span>Estado: ${status}</span>
    `;
  });
  hoverZone.addEventListener("mouseleave", () => {
    hoverLine.setAttribute("x1", -10);
    hoverLine.setAttribute("x2", -10);
    elements.chartTooltip.style.display = "none";
  });
}

function drawBarChart() {
  const svg = elements.barChart;
  const width = svg.clientWidth || 500;
  const height = svg.clientHeight || 360;
  const pad = { top: 20, right: 18, bottom: 42, left: 70 };
  const start = new Date(`${state.start}T00:00:00.000Z`).getTime();
  const end = new Date(`${state.end}T23:59:59.999Z`).getTime();
  const points = data.daily.filter((point) => {
    const time = new Date(point.t).getTime();
    return time >= start && time <= end;
  });

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  if (!points.length) {
    svg.innerHTML = `<text x="24" y="50">No hay datos diarios.</text>`;
    return;
  }

  const max = Math.max(...points.map((point) => point.avg));
  const min = Math.min(...points.map((point) => point.avg));
  const innerWidth = width - pad.left - pad.right;
  const barWidth = Math.max(12, innerWidth / points.length - 8);
  const y = (value) =>
    height - pad.bottom - ((value - min) / Math.max(max - min, 1)) * (height - pad.top - pad.bottom);

  svg.innerHTML = `
    <line class="axis" x1="${pad.left}" x2="${width - pad.right}" y1="${height - pad.bottom}" y2="${height - pad.bottom}"></line>
    <text x="10" y="${y(max) + 4}">${number(max)}</text>
    <text x="10" y="${height - pad.bottom}">${number(min)}</text>
    ${points
      .map((point, index) => {
        const x = pad.left + index * (innerWidth / points.length) + 4;
        const barHeight = height - pad.bottom - y(point.avg);
        return `<rect class="bar" x="${x}" y="${y(point.avg)}" width="${barWidth}" height="${barHeight}" rx="4"></rect>
          <text x="${x}" y="${height - 14}">${day(point.t)}</text>`;
      })
      .join("")}
  `;
}

function renderKpis(stats) {
  if (!stats) return;
  const diagnostics = getDiagnostics(activeSeries());
  elements.kpiAvg.textContent = number(stats.avg);
  elements.kpiMin.textContent = number(stats.min.value);
  elements.kpiMinDate.textContent = date(stats.min.t);
  elements.kpiMax.textContent = number(stats.max.value);
  elements.kpiMaxDate.textContent = date(stats.max.t);
  elements.kpiDrop.textContent = diagnostics.biggestDrop ? number(diagnostics.biggestDrop.delta) : "0";
  elements.kpiDrop.style.color = diagnostics.biggestDrop ? "var(--red)" : "var(--green-dark)";
  elements.kpiDropDate.textContent = diagnostics.biggestDrop
    ? `${date(diagnostics.biggestDrop.t)} · vs hora anterior`
    : "Sin caída horaria";
}

function renderDiagnosis(diagnostics) {
  const copy = statusCopy(diagnostics);
  elements.periodStatus.textContent = copy.title;
  elements.periodStatusReason.textContent = copy.reason;
  elements.statusBadge.textContent = copy.badge;
  elements.executiveInsight.textContent = copy.insight;
  elements.operationalRecommendation.textContent = copy.recommendation;
  elements.statusCard.className = `status-card ${diagnostics.level || ""}`.trim();
  elements.statusBadge.className = `badge ${diagnostics.level || ""}`.trim();
}

function renderDrops() {
  const diagnostics = getDiagnostics(activeSeries());
  const hourly = diagnostics.drops.slice(0, 6);
  const maxDrop = Math.max(...hourly.map((entry) => Math.abs(entry.delta)), 1);

  elements.dropsList.innerHTML = hourly.length
    ? hourly
        .map(
          (entry) => `
          <div class="drop-item">
            <div class="drop-meta">
              <span>${date(entry.t)}</span>
              <strong>${number(entry.delta)}</strong>
            </div>
            <div class="drop-track">
              <div class="drop-fill" style="width: ${(Math.abs(entry.delta) / maxDrop) * 100}%"></div>
            </div>
          </div>
        `
        )
        .join("")
    : `<p class="lead">No se detectaron caídas en este rango.</p>`;
}

function renderTable() {
  const query = state.fileQuery.trim().toLowerCase();
  elements.filesTable.innerHTML = data.files
    .filter((file) => !query || file.file.toLowerCase().includes(query))
    .slice(0, 80)
    .map(
      (file) => `
      <tr>
        <td>${file.file}</td>
        <td>${date(file.start)}</td>
        <td>${date(file.end)}</td>
        <td>${number(file.avg)}</td>
        <td>${number(file.min)}</td>
        <td>${number(file.max)}</td>
      </tr>
    `
    )
    .join("");
}

function render() {
  const points = activeSeries();
  const stats = getStats(points);
  const diagnostics = getDiagnostics(points);
  const labels = {
    raw: "Muestra compacta cada pocos puntos",
    hourly: "Promedio horario",
    daily: "Promedio diario",
  };

  elements.chartSubtitle.textContent = labels[state.granularity];
  renderKpis(stats);
  renderDiagnosis(diagnostics);
  drawLineChart(points);
  drawBarChart();
  renderDrops();
  renderTable();
}

function answerQuestion(question) {
  const q = question.toLowerCase();
  const points = activeSeries();
  const stats = getStats(points);
  if (!stats) return "No encontré datos en el rango activo. Ajusta los filtros y vuelvo a intentarlo.";

  const diagnostics = getDiagnostics(points);
  const { biggestDrop, biggestRecovery } = diagnostics;

  if (q.includes("mín") || q.includes("min") || q.includes("peor")) {
    return `El punto mínimo del rango visible fue ${number(stats.min.value)} tiendas visibles el ${date(stats.min.t)}. Es el momento más crítico observado en el dashboard filtrado.`;
  }

  if (q.includes("máx") || q.includes("max") || q.includes("mejor")) {
    return `El punto máximo fue ${number(stats.max.value)} tiendas visibles el ${date(stats.max.t)}. Ese es el pico de disponibilidad observado en el rango actual.`;
  }

  if (q.includes("caída") || q.includes("cayo") || q.includes("baj")) {
    if (!biggestDrop) return "En el rango visible no veo una caída horaria negativa relevante.";
    return `La mayor caída ocurrió cerca de ${date(biggestDrop.t)} con una variación de ${number(biggestDrop.delta)} tiendas visibles frente a la hora anterior. Conviene revisar operación, monitoreo o incidentes alrededor de ese bloque horario.`;
  }

  if (q.includes("sever") || q.includes("grave") || q.includes("crítica") || q.includes("critica")) {
    if (!biggestDrop) return "No encontré una caída horaria relevante en el rango visible.";
    return `La peor caída fue ${diagnostics.level === "critical" ? "crítica" : diagnostics.level === "warning" ? "relevante" : "moderada"}: ${number(biggestDrop.delta)} tiendas visibles frente a la hora anterior, equivalente a ${Math.round(diagnostics.dropSeverity * 100)}% del promedio del rango.`;
  }

  if (q.includes("recuper") || q.includes("sub")) {
    if (!biggestRecovery) return "No veo una recuperación horaria positiva en el rango visible.";
    return `La mayor recuperación ocurrió cerca de ${date(biggestRecovery.t)} con un aumento de +${number(biggestRecovery.delta)} tiendas visibles frente a la hora anterior.`;
  }

  if (q.includes("archivo") || q.includes("csv") || q.includes("fuente")) {
    return `La app procesó ${number(data.source.files)} archivos CSV y ${number(data.source.points)} puntos de datos entre ${date(data.source.start)} y ${date(data.source.end)}.`;
  }

  if (q.includes("investig") || q.includes("recomend")) {
    const copy = statusCopy(diagnostics);
    return `Recomendación: ${copy.recommendation} También revisaría el mínimo del periodo (${number(stats.min.value)} tiendas visibles el ${date(stats.min.t)}) y compararía esa ventana contra incidentes o cambios operativos.`;
  }

  if (q.includes("resumen") || q.includes("comport") || q.includes("insight")) {
    const direction = stats.change >= 0 ? "mejoró" : "se deterioró";
    const dropText = biggestDrop
      ? ` La caída horaria más fuerte fue de ${number(biggestDrop.delta)} cerca de ${date(biggestDrop.t)}.`
      : "";
    return `Resumen ejecutivo: en el rango visible, la disponibilidad promedio fue ${number(stats.avg)} tiendas visibles. Estado del periodo: ${statusCopy(diagnostics).title}. El indicador ${direction} ${number(Math.abs(stats.change))} puntos entre el primer y último registro (${stats.changePct.toFixed(1)}%). El mínimo fue ${number(stats.min.value)} y el máximo ${number(stats.max.value)}.${dropText}`;
  }

  return `Puedo responder sobre mínimos, máximos, caídas, recuperaciones, fuentes CSV y resumen ejecutivo. Con los filtros actuales veo un promedio de ${number(stats.avg)} tiendas visibles entre ${date(stats.first.t)} y ${date(stats.last.t)}.`;
}

function addMessage(text, role = "bot") {
  const message = document.createElement("div");
  message.className = `message ${role}`;
  message.textContent = text;
  elements.chatMessages.appendChild(message);
  elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

function setup() {
  elements.dataWindow.textContent = `${number(data.source.files)} CSV · ${date(data.source.start)} - ${date(data.source.end)}`;
  elements.startDate.value = state.start;
  elements.endDate.value = state.end;

  elements.granularity.addEventListener("change", (event) => {
    state.granularity = event.target.value;
    render();
  });
  elements.startDate.addEventListener("change", (event) => {
    state.start = event.target.value;
    render();
  });
  elements.endDate.addEventListener("change", (event) => {
    state.end = event.target.value;
    render();
  });
  elements.resetFilters.addEventListener("click", () => {
    state.granularity = "hourly";
    state.start = data.source.start.slice(0, 10);
    state.end = data.source.end.slice(0, 10);
    elements.granularity.value = state.granularity;
    elements.startDate.value = state.start;
    elements.endDate.value = state.end;
    render();
  });
  elements.fileSearch.addEventListener("input", (event) => {
    state.fileQuery = event.target.value;
    renderTable();
  });
  elements.chatForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = elements.chatInput.value.trim();
    if (!question) return;
    addMessage(question, "user");
    addMessage(answerQuestion(question), "bot");
    elements.chatInput.value = "";
  });
  document.querySelectorAll("[data-question]").forEach((button) => {
    button.addEventListener("click", () => {
      const question = button.dataset.question;
      addMessage(question, "user");
      addMessage(answerQuestion(question), "bot");
    });
  });
  window.addEventListener("resize", render);

  addMessage(
    "Hola. Ya leí los CSV de disponibilidad. Puedes preguntarme por mínimos, máximos, caídas, recuperaciones o pedir un resumen ejecutivo del rango filtrado."
  );
  render();
}

setup();
