import {
  Badge,
  Box,
  Card,
  CardBody,
  Grid,
  HStack,
  Text,
} from '@chakra-ui/react';
import { Clock3, Repeat2 } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DailyImpactBucket, DiagnosticAnalysis, PatternBucket, formatValue } from '../utils/availabilityData';

interface DiagnosticInsightsProps {
  analysis: DiagnosticAnalysis;
}

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function Panel({
  children,
  gridColumn,
}: {
  children: React.ReactNode;
  gridColumn?: Record<string, string> | string;
}) {
  return (
    <Card
      gridColumn={gridColumn}
      bg="#ffffff"
      border="1px solid #e9edf3"
      borderRadius="8px"
      boxShadow="0 1px 2px rgba(16, 24, 40, 0.04)"
      overflow="hidden"
      transition="box-shadow 160ms ease, transform 160ms ease"
      _hover={{ boxShadow: '0 8px 24px rgba(16, 24, 40, 0.10)', transform: 'translateY(-2px)' }}
    >
      <CardBody p={{ base: 4, md: 5 }}>{children}</CardBody>
    </Card>
  );
}

function SectionTitle({
  icon,
  title,
  caption,
}: {
  icon: React.ReactNode;
  title: string;
  caption: string;
}) {
  return (
    <HStack spacing={2.5} align="start" mb={4}>
      <Box color="#ff441f" pt="1px" flex="0 0 auto">
        {icon}
      </Box>
      <Box minW={0}>
        <Text fontSize="15px" fontWeight="750" color="#30323a" lineHeight="1.2">
          {title}
        </Text>
        <Text fontSize="13px" color="#8a909b" mt={1} lineHeight="1.35">
          {caption}
        </Text>
      </Box>
    </HStack>
  );
}

function InsightBlock({
  tone,
  label,
  title,
  body,
}: {
  tone: 'orange' | 'purple' | 'blue';
  label: string;
  title: string;
  body: string;
}) {
  const palette = {
    orange: { bg: '#fff0dc', color: '#9a5b00', border: '#f59e0b' },
    purple: { bg: '#f0e9ff', color: '#5b3c9c', border: '#7c3aed' },
    blue:   { bg: '#e8f1ff', color: '#35618f', border: '#3b82f6' },
  }[tone];

  return (
    <Box borderLeft={`3px solid ${palette.border}`} pl={3} py={0.5}>
      <Badge
        bg={palette.bg}
        color={palette.color}
        borderRadius="7px"
        px={2}
        py={0.5}
        fontSize="11px"
        letterSpacing="0"
        textTransform="uppercase"
      >
        {label}
      </Badge>
      <Text mt={2} fontSize="17px" fontWeight="800" color="#30323a" lineHeight="1.25">
        {title}
      </Text>
      <Text mt={1.5} fontSize="13px" color="#8a909b" lineHeight="1.45">
        {body}
      </Text>
    </Box>
  );
}

function PatternRow({ label, pct, value }: { label: string; pct: number; value: number }) {
  const color = pct >= 80 ? '#ff441f' : pct >= 40 ? '#f59e0b' : '#2ed477';

  return (
    <Box>
      <HStack justify="space-between" align="baseline" mb={1.5}>
        <Text fontSize="14px" fontWeight="750" color="#4a4d55">
          {label}
        </Text>
        <Text fontSize="13px" color="#8a909b">
          {pct}% bajo lo esperado
        </Text>
      </HStack>
      <Box h="7px" bg="#edf0f4" borderRadius="999px" overflow="hidden">
        <Box h="100%" w={`${pct}%`} borderRadius="999px" style={{ background: `linear-gradient(90deg, ${color} 0%, ${color}66 100%)` }} />
      </Box>
      <Text fontSize="12px" color="#8a909b" mt={1.5}>
        Promedio: {formatValue(value)} tiendas visibles
      </Text>
    </Box>
  );
}

function EvolutionTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ payload?: { value: number; expected: number } }>; label?: string }) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;

  const point = payload[0].payload;
  const difference = Math.abs(point.value - point.expected);
  const isBelowExpected = point.value < point.expected;

  return (
    <Box
      bg="white"
      border="1px solid #e9edf3"
      borderRadius="8px"
      boxShadow="0 10px 24px rgba(15, 23, 42, 0.12)"
      p={3}
      minW="220px"
    >
      <Text fontSize="12px" color="#8a909b" mb={2}>
        Momento: {label}
      </Text>
      <Box display="grid" gap={1}>
        <HStack justify="space-between" gap={4}>
          <Text fontSize="12px" color="#5d6470">Tiendas visibles</Text>
          <Text fontSize="12px" fontWeight="750" color="#30323a">{formatValue(point.value)}</Text>
        </HStack>
        <HStack justify="space-between" gap={4}>
          <Text fontSize="12px" color="#5d6470">Promedio esperado</Text>
          <Text fontSize="12px" fontWeight="750" color="#30323a">{formatValue(point.expected)}</Text>
        </HStack>
        <HStack justify="space-between" gap={4}>
          <Text fontSize="12px" color="#5d6470">Diferencia absoluta</Text>
          <Text fontSize="12px" fontWeight="750" color="#30323a">{formatValue(difference)}</Text>
        </HStack>
      </Box>
      <Badge
        mt={2.5}
        bg={isBelowExpected ? '#fff1ed' : '#ecfdf3'}
        color={isBelowExpected ? '#ff441f' : '#067647'}
        borderRadius="full"
        px={2}
      >
        {isBelowExpected ? 'Por debajo de lo esperado' : 'Dentro de lo esperado'}
      </Badge>
    </Box>
  );
}

function sortHours(rows: PatternBucket[]) {
  return [...rows].sort((a, b) => Number.parseInt(a.label, 10) - Number.parseInt(b.label, 10));
}

function sortDays(rows: PatternBucket[]) {
  return [...rows].sort((a, b) => {
    const aMatch = a.label.match(/(\d{2})\/(\d{2})/);
    const bMatch = b.label.match(/(\d{2})\/(\d{2})/);
    const aKey = aMatch ? `${aMatch[2]}${aMatch[1]}` : a.label;
    const bKey = bMatch ? `${bMatch[2]}${bMatch[1]}` : b.label;
    return aKey.localeCompare(bKey);
  });
}

function DistributionChart({
  title,
  caption,
  data,
  kind,
  referenceAverage,
  tickFormatter,
  tickInterval = 0,
  tickAngle = 0,
}: {
  title: string;
  caption: string;
  data: PatternBucket[];
  kind: 'hour' | 'day';
  referenceAverage?: number;
  tickFormatter?: (value: string) => string;
  tickInterval?: number;
  tickAngle?: number;
}) {
  const usesAverageMetric = kind === 'hour';
  const topLabels = new Set(
    [...data]
      .sort((a, b) => b.belowPct - a.belowPct || a.avgValue - b.avgValue)
      .slice(0, 3)
      .map((row) => row.label),
  );
  const chartData = data.map((row) => ({
    ...row,
    metric: usesAverageMetric ? row.avgValue : row.belowPct,
    isTop: topLabels.has(row.label),
  }));
  const topRows = [...data]
    .sort((a, b) => {
      if (usesAverageMetric) return a.avgValue - b.avgValue || b.belowPct - a.belowPct;
      return b.belowPct - a.belowPct || a.avgValue - b.avgValue;
    })
    .slice(0, 3);
  const worst = topRows[0];
  const topSummary = topRows.map((row) => row.label).join(', ');
  const interpretation = usesAverageMetric
    ? buildHourlyAverageInsight(topSummary, worst?.avgValue || 0, referenceAverage || 0)
    : buildDistributionInsight(kind, topSummary, worst?.belowPct || 0);

  return (
    <Panel>
      <Box mb={4}>
        <Text fontSize="15px" fontWeight="750" color="#30323a" lineHeight="1.2">
          {title}
        </Text>
        <Text fontSize="13px" color="#8a909b" mt={1} lineHeight="1.35">
          {caption}
        </Text>
      </Box>
      <Box h={{ base: '260px', md: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 10, bottom: tickAngle ? 10 : 0, left: usesAverageMetric ? 10 : -18 }}
          >
            <CartesianGrid strokeDasharray="2 3" stroke="#edf1f5" vertical={false} />
            <XAxis
              dataKey="label"
              interval={tickInterval}
              minTickGap={8}
              tickFormatter={tickFormatter}
              angle={tickAngle}
              textAnchor={tickAngle ? 'end' : 'middle'}
              height={tickAngle ? 48 : 30}
              tick={{ fontSize: 11, fill: '#778293' }}
              tickLine={false}
              axisLine={{ stroke: '#dfe4eb' }}
              width={usesAverageMetric ? 72 : undefined}
            />
            <YAxis
              domain={usesAverageMetric ? ['auto', 'auto'] : [0, 100]}
              tickFormatter={(value) => usesAverageMetric ? formatValue(Number(value)) : `${value}%`}
              tick={{ fontSize: 11, fill: '#778293' }}
              tickLine={false}
              axisLine={{ stroke: '#dfe4eb' }}
            />
            <Tooltip
              formatter={(value, name, props) => {
                if (usesAverageMetric) {
                  return [
                    formatValue(Number(value)),
                    props.payload.avgValue < (referenceAverage || 0)
                      ? 'Promedio bajo la referencia'
                      : 'Promedio sobre la referencia',
                  ];
                }
                if (name === 'metric') return [`${value}%`, 'Tiempo bajo lo esperado'];
                return [
                  props.payload.isTop ? 'Top 3 crítico' : 'Referencia',
                  'Foco visual',
                ];
              }}
              labelFormatter={(label) => `${label}`}
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e9edf3',
                borderRadius: '8px',
                boxShadow: '0 10px 24px rgba(15, 23, 42, 0.12)',
                fontSize: '12px',
              }}
            />
            <Bar dataKey="metric" name="metric" radius={[5, 5, 0, 0]} barSize={18}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.label}
                  fill={
                    usesAverageMetric
                      ? averageColor(entry.avgValue, referenceAverage || 0)
                      : entry.isTop ? severityColor(entry.metric) : '#e4e8ef'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
      <Text fontSize="13px" color="#5d6470" lineHeight="1.4" mt={3}>
        {interpretation}
      </Text>
    </Panel>
  );
}

const IMPACT_COLORS = ['#ff441f', '#ff441f', '#f59e0b', '#f59e0b', '#a0a8b8'];

function ImpactChart({ data }: { data: DailyImpactBucket[] }) {
  if (!data.length) return null;

  const top = data[0];
  const second = data[1];
  const secondText = second ? `, seguido por el ${second.label}` : '';
  const insight = `El ${top.label} concentró la mayor pérdida con ~${formatValue(top.totalLoss)} tiendas afectadas${secondText}. ${data.length >= 2 ? 'Estos días requieren revisión prioritaria.' : 'Este día requiere revisión prioritaria.'}`;

  return (
    <Panel>
      <Box mb={4}>
        <Text fontSize="15px" fontWeight="750" color="#30323a" lineHeight="1.2">
          Impacto de caídas por día
        </Text>
        <Text fontSize="13px" color="#8a909b" mt={1} lineHeight="1.35">
          ¿Qué días generaron mayor pérdida de tiendas visibles?
        </Text>
      </Box>
      <Box h={{ base: '260px', md: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: 10 }}>
            <CartesianGrid strokeDasharray="2 3" stroke="#edf1f5" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#778293' }}
              tickLine={false}
              axisLine={{ stroke: '#dfe4eb' }}
            />
            <YAxis
              tickFormatter={(value) => formatValue(Number(value))}
              tick={{ fontSize: 11, fill: '#778293' }}
              tickLine={false}
              axisLine={{ stroke: '#dfe4eb' }}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as DailyImpactBucket;
                return (
                  <Box
                    bg="white"
                    border="1px solid #e9edf3"
                    borderRadius="8px"
                    boxShadow="0 10px 24px rgba(15, 23, 42, 0.12)"
                    p={3}
                    minW="210px"
                  >
                    <Text fontSize="12px" fontWeight="750" color="#30323a" mb={2}>{label}</Text>
                    <Box display="grid" gap={1}>
                      <HStack justify="space-between" gap={4}>
                        <Text fontSize="12px" color="#5d6470">Tiendas perdidas</Text>
                        <Text fontSize="12px" fontWeight="750" color="#30323a">{formatValue(point.totalLoss)}</Text>
                      </HStack>
                      <HStack justify="space-between" gap={4}>
                        <Text fontSize="12px" color="#5d6470">Nº de caídas</Text>
                        <Text fontSize="12px" fontWeight="750" color="#30323a">{point.dropCount}</Text>
                      </HStack>
                      <HStack justify="space-between" gap={4}>
                        <Text fontSize="12px" color="#5d6470">Caída más fuerte</Text>
                        <Text fontSize="12px" fontWeight="750" color="#30323a">{formatValue(point.biggestDrop)}</Text>
                      </HStack>
                    </Box>
                  </Box>
                );
              }}
            />
            <Bar dataKey="totalLoss" radius={[5, 5, 0, 0]} barSize={40}>
              {data.map((entry, index) => (
                <Cell key={entry.label} fill={IMPACT_COLORS[index] ?? '#a0a8b8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
      <Text fontSize="13px" color="#5d6470" lineHeight="1.4" mt={3}>
        {insight}
      </Text>
    </Panel>
  );
}

function severityColor(value: number) {
  if (value >= 70) return '#ff441f';
  if (value >= 35) return '#f59e0b';
  return '#2ed477';
}

function averageColor(value: number, referenceAverage: number) {
  return value < referenceAverage ? '#ff441f' : '#2ed477';
}

function buildHourlyAverageInsight(labels: string, worstValue: number, referenceAverage: number) {
  if (!labels) {
    return 'No hay horas con promedio bajo claro; la disponibilidad se mantiene equilibrada durante el día.';
  }

  const gap = Math.max(referenceAverage - worstValue, 0);
  return `Las horas ${labels} tienen el menor promedio de tiendas visibles; la peor queda ${formatValue(gap)} tiendas bajo el promedio general.`;
}

function buildDistributionInsight(kind: 'hour' | 'day', labels: string, worstPct: number) {
  const scope = kind === 'hour' ? 'horas' : 'días';
  const target = kind === 'hour' ? 'esas horas' : 'esos días';

  if (!labels) {
    return `No hay ${scope} con deterioro claro; implica una señal estable en el rango visible.`;
  }

  if (worstPct >= 70) {
    return `Destacan ${labels}; implica concentración crítica del deterioro en ${target}.`;
  }

  if (worstPct >= 35) {
    return `Destacan ${labels}; implica concentración moderada que conviene monitorear.`;
  }

  return `Destacan ${labels}, pero con baja severidad; implica variaciones puntuales más que un patrón crítico.`;
}

export function DiagnosticInsights({ analysis }: DiagnosticInsightsProps) {
  const stateMarkers = analysis.chartData.filter((point, index, rows) => {
    const previous = rows[index - 1];
    const isBelow = point.value < point.expected;
    const wasBelow = previous ? previous.value < previous.expected : !isBelow;
    return point.isImportantDrop || point.isWorst || isBelow !== wasBelow;
  });
  const belowExpectedPoints = stateMarkers.filter((point) => point.value < point.expected);
  const withinExpectedPoints = stateMarkers.filter((point) => point.value >= point.expected);
  const biggestDrop = analysis.biggestDrop;
  const dropSeverity = analysis.reviewShare >= 25 ? 'grave' : analysis.reviewShare >= 10 ? 'relevante' : 'baja';
  const dropContinuity =
    analysis.importantDrops >= 3 ? 'recurrentes' : analysis.importantDrops > 0 ? 'puntuales' : 'sin recurrencia';
  const topHours = analysis.problematicHours.slice(0, 6);
  const topDays = analysis.problematicDays.slice(0, 6);
  const hourlyDistribution = sortHours(analysis.problematicHours);
  const dailyDistribution = sortDays(analysis.problematicDays);

  return (
    <Box>
      <Grid templateColumns={{ base: '1fr', xl: '2.05fr 1.15fr' }} gap={4} alignItems="stretch">
        <Panel>
          <Box mb={4}>
            <Text fontSize="15px" fontWeight="750" color="#30323a" lineHeight="1.2">
              Evolución de tiendas visibles vs nivel esperado
            </Text>
            <Text fontSize="13px" color="#8a909b" mt={1} lineHeight="1.35">
              Línea roja: tiendas visibles reales. Línea punteada: promedio esperado del periodo.
            </Text>
          </Box>
          <Box h={{ base: '300px', md: '360px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={analysis.chartData} margin={{ top: 8, right: 14, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="2 3" stroke="#edf1f5" />
                <XAxis
                  dataKey="time"
                  minTickGap={36}
                  tick={{ fontSize: 12, fill: '#778293' }}
                  tickLine={false}
                  axisLine={{ stroke: '#dfe4eb' }}
                />
                <YAxis
                  tickFormatter={(value) => formatValue(Number(value))}
                  tick={{ fontSize: 12, fill: '#778293' }}
                  tickLine={false}
                  axisLine={{ stroke: '#dfe4eb' }}
                  width={78}
                />
                <Tooltip
                  content={<EvolutionTooltip />}
                />
                <ReferenceLine y={analysis.expectedAverage} stroke="#f59e0b" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#ff441f"
                  strokeWidth={2.2}
                  dot={false}
                  activeDot={{ r: 4, stroke: '#ff441f', strokeWidth: 2, fill: '#fff' }}
                  name="Tiendas visibles"
                />
                <Scatter data={belowExpectedPoints} dataKey="value" fill="#ff441f" name="Por debajo de lo esperado" />
                <Scatter data={withinExpectedPoints} dataKey="value" fill="#2ed477" name="Dentro de lo esperado" />
              </ComposedChart>
            </ResponsiveContainer>
          </Box>
        </Panel>

        <Panel>
          <Box display="grid" gap={5} h="100%" alignContent="start">
            <InsightBlock
              tone="orange"
              label="Mayor caída"
              title={
                biggestDrop
                  ? `Bajó ${formatValue(biggestDrop.drop)} tiendas`
                  : 'No hubo caídas visibles'
              }
              body={
                biggestDrop
                  ? `De ${formatValue(biggestDrop.from)} a ${formatValue(biggestDrop.to)} el ${biggestDrop.time}.`
                  : 'La serie no muestra una variación negativa relevante en el periodo.'
              }
            />

            <InsightBlock
              tone="purple"
              label="Caídas importantes"
              title={`${analysis.importantDrops} caídas importantes`}
              body={`Se cuentan cuando la pérdida supera ${formatValue(analysis.importantDropThreshold)} tiendas.`}
            />

            <InsightBlock
              tone="blue"
              label="Recuperación"
              title={`${formatMinutes(analysis.avgRecoveryMinutes)} en promedio`}
              body="Tiempo típico para volver al rango esperado después de una caída."
            />
          </Box>
        </Panel>
      </Grid>

      <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={4} mt={4}>
        <Panel>
          <SectionTitle
            icon={<Clock3 size={18} />}
            title="Horas donde más baja"
            caption="Muestra si las caídas se concentran en una franja del día."
          />
          <Box display="grid" gap={4}>
            {topHours.map((hour) => (
              <PatternRow key={hour.label} label={hour.label} pct={hour.belowPct} value={hour.avgValue} />
            ))}
          </Box>
        </Panel>

        <Panel>
          <SectionTitle
            icon={<Repeat2 size={18} />}
            title="Patrón observado"
            caption={`Severidad ${dropSeverity}; caídas ${dropContinuity}.`}
          />
          <Box display="grid" gap={4}>
            {topDays.map((day) => (
              <PatternRow key={day.label} label={day.label} pct={day.belowPct} value={day.avgValue} />
            ))}
          </Box>
        </Panel>
      </Grid>

      <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={4} mt={4}>
        <DistributionChart
          title="Promedio por hora"
          caption="Pregunta: ¿qué horas tienen menor disponibilidad visible?"
          data={hourlyDistribution}
          kind="hour"
          referenceAverage={analysis.expectedAverage}
          tickFormatter={(label) => label.replace(':00', 'h')}
          tickInterval={1}
        />
        <DistributionChart
          title="Distribución por día"
          caption="Pregunta: ¿qué días fueron más problemáticos?"
          data={dailyDistribution}
          kind="day"
          tickFormatter={(label) => label.match(/(\d{2}\/\d{2})/)?.[1] || label}
          tickAngle={-35}
        />
      </Grid>

      <Box mt={4}>
        <ImpactChart data={analysis.dailyImpact} />
      </Box>
    </Box>
  );
}
