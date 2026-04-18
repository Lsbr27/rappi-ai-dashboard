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
  kpiChange: document.querySelector("#kpiChange"),
  chartSubtitle: document.querySelector("#chartSubtitle"),
  lineChart: document.querySelector("#lineChart"),
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
  `;
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
  elements.kpiAvg.textContent = number(stats.avg);
  elements.kpiMin.textContent = number(stats.min.value);
  elements.kpiMinDate.textContent = date(stats.min.t);
  elements.kpiMax.textContent = number(stats.max.value);
  elements.kpiMaxDate.textContent = date(stats.max.t);
  elements.kpiChange.textContent = `${stats.change >= 0 ? "+" : ""}${number(stats.change)} (${stats.changePct.toFixed(1)}%)`;
  elements.kpiChange.style.color = stats.change >= 0 ? "var(--green-dark)" : "var(--red)";
}

function renderDrops() {
  const start = new Date(`${state.start}T00:00:00.000Z`).getTime();
  const end = new Date(`${state.end}T23:59:59.999Z`).getTime();
  const hourly = data.hourly
    .filter((point) => {
      const time = new Date(point.t).getTime();
      return time >= start && time <= end;
    })
    .map((entry, index, arr) => ({
      ...entry,
      delta: index === 0 ? 0 : entry.avg - arr[index - 1].avg,
    }))
    .filter((entry) => entry.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, 6);

  elements.dropsList.innerHTML = hourly.length
    ? hourly
        .map(
          (entry) => `
          <div class="rank-item">
            <div>
              <strong>${number(entry.delta)}</strong>
              <small>vs hora anterior</small>
            </div>
            <small>${date(entry.t)}</small>
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
  const labels = {
    raw: "Muestra compacta cada pocos puntos",
    hourly: "Promedio horario",
    daily: "Promedio diario",
  };

  elements.chartSubtitle.textContent = labels[state.granularity];
  renderKpis(stats);
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

  const hourly = data.hourly
    .filter((point) => {
      const time = new Date(point.t).getTime();
      const start = new Date(`${state.start}T00:00:00.000Z`).getTime();
      const end = new Date(`${state.end}T23:59:59.999Z`).getTime();
      return time >= start && time <= end;
    })
    .map((entry, index, arr) => ({
      ...entry,
      delta: index === 0 ? 0 : entry.avg - arr[index - 1].avg,
    }));

  const biggestDrop = hourly.filter((entry) => entry.delta < 0).sort((a, b) => a.delta - b.delta)[0];
  const biggestRecovery = hourly.filter((entry) => entry.delta > 0).sort((a, b) => b.delta - a.delta)[0];

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

  if (q.includes("recuper") || q.includes("sub")) {
    if (!biggestRecovery) return "No veo una recuperación horaria positiva en el rango visible.";
    return `La mayor recuperación ocurrió cerca de ${date(biggestRecovery.t)} con un aumento de +${number(biggestRecovery.delta)} tiendas visibles frente a la hora anterior.`;
  }

  if (q.includes("archivo") || q.includes("csv") || q.includes("fuente")) {
    return `La app procesó ${number(data.source.files)} archivos CSV y ${number(data.source.points)} puntos de datos entre ${date(data.source.start)} y ${date(data.source.end)}.`;
  }

  if (q.includes("resumen") || q.includes("comport") || q.includes("insight")) {
    const direction = stats.change >= 0 ? "mejoró" : "se deterioró";
    const dropText = biggestDrop
      ? ` La caída horaria más fuerte fue de ${number(biggestDrop.delta)} cerca de ${date(biggestDrop.t)}.`
      : "";
    return `Resumen ejecutivo: en el rango visible, la disponibilidad promedio fue ${number(stats.avg)} tiendas visibles. El indicador ${direction} ${number(Math.abs(stats.change))} puntos entre el primer y último registro (${stats.changePct.toFixed(1)}%). El mínimo fue ${number(stats.min.value)} y el máximo ${number(stats.max.value)}.${dropText}`;
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
