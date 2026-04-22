import { Activity, AlertTriangle, ArrowDown, ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react';
import {
  Badge,
  Box,
  Card,
  CardBody,
  HStack,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Text,
} from '@chakra-ui/react';
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { DiagnosticAnalysis } from '../utils/availabilityData';

const RAPPI_RED = '#FF441F';
const GREEN = '#12b76a';
const NEUTRAL = '#667085';

interface MetricsCardsProps {
  metrics: {
    uptime: number;
    /** @legacy */
    avgDowntime: number;
    averageDropMagnitude: number;
    latestVisible: number;
  };
  analysis: DiagnosticAnalysis;
}

type SparkPoint = {
  label: string;
  value: number;
};

const compactNumber = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 0,
});

function formatNumber(value: number) {
  return compactNumber.format(Math.round(value || 0));
}

function formatMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function latestPoints(points: SparkPoint[], count = 18) {
  return points.slice(Math.max(points.length - count, 0));
}

function chunkSeries<T>(items: T[], chunks = 12, getValue: (chunk: T[]) => number): SparkPoint[] {
  if (!items.length) return [];
  const size = Math.ceil(items.length / chunks);

  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => {
    const chunk = items.slice(index * size, index * size + size);
    return {
      label: `${index + 1}`,
      value: getValue(chunk),
    };
  });
}

function Sparkline({ data, color }: { data: SparkPoint[]; color: string }) {
  const sparkData = data.length ? data : [{ label: 'Sin datos', value: 0 }];

  return (
    <Box h="52px" mt={4}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={sparkData} margin={{ top: 6, right: 2, bottom: 6, left: 2 }}>
          <YAxis hide domain={['dataMin', 'dataMax']} />
          <Tooltip
            formatter={(value) => [formatNumber(Number(value)), 'Valor']}
            labelFormatter={() => ''}
            cursor={false}
            contentStyle={{
              border: '1px solid #e9edf3',
              borderRadius: '8px',
              boxShadow: '0 10px 24px rgba(15, 23, 42, 0.12)',
              fontSize: '12px',
            }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.4}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}

function statusMeta(status: 'stable' | 'attention' | 'unstable') {
  if (status === 'unstable') {
    return {
      label: 'INESTABLE',
      color: RAPPI_RED,
      bg: 'red.50',
      icon: AlertTriangle,
    };
  }

  if (status === 'attention') {
    return {
      label: 'REQUIERE ATENCIÓN',
      color: RAPPI_RED,
      bg: 'orange.50',
      icon: AlertTriangle,
    };
  }

  return {
    label: 'ESTABLE',
    color: GREEN,
    bg: 'green.50',
    icon: CheckCircle2,
  };
}

export function MetricsCards({ metrics, analysis }: MetricsCardsProps) {
  const availabilitySeries = latestPoints(
    analysis.chartData.map((point) => ({
      label: point.time,
      value: point.value,
    })),
  );
  const stabilitySeries = chunkSeries(analysis.chartData, 12, (chunk) => {
    const healthy = chunk.filter((point) => point.value >= analysis.expectedThreshold).length;
    return Math.round((healthy / chunk.length) * 100);
  });
  const dropFrequencySeries = chunkSeries(analysis.chartData, 12, (chunk) => {
    return chunk.filter((point) => point.isImportantDrop).length;
  });
  const dropImpactSeries = chunkSeries(analysis.chartData, 12, (chunk) => {
    const drops = chunk.map((point) => point.drop || 0);
    return Math.round(drops.reduce((sum, value) => sum + value, 0) / Math.max(drops.length, 1));
  });
  const recoverySeries = analysis.incidents.map((incident) => ({
    label: incident.start,
    value: incident.minutesToRecover,
  }));
  const latestIsBelowRange = metrics.latestVisible < analysis.expectedThreshold;
  const hasRecurrentDrops = analysis.importantDrops >= 3;
  const avgRecoveryIsHigh = analysis.recoveryStats.avg >= 8 * 60;
  const avgDropIsRelevant = metrics.averageDropMagnitude >= analysis.expectedAverage * 0.08;

  const cards = [
    {
      title: 'Disponibilidad actual',
      value: formatNumber(metrics.latestVisible),
      suffix: 'tiendas visibles',
      description: 'Última lectura observada en la serie.',
      icon: Activity,
      sparkline: availabilitySeries,
      status: hasRecurrentDrops ? 'unstable' : latestIsBelowRange ? 'attention' : 'stable',
      primary: true,
    },
    {
      title: 'Estabilidad del sistema',
      value: `${metrics.uptime}%`,
      suffix: 'lecturas sobre umbral saludable',
      description: '% de horas con señal ≥ baseline × 0.85. No mide infraestructura, sino calidad de señal.',
      icon: ArrowRight,
      sparkline: stabilitySeries,
      status: metrics.uptime >= 90 ? 'stable' : metrics.uptime >= 75 ? 'attention' : 'unstable',
    },
    {
      title: 'Caídas detectadas',
      value: formatNumber(analysis.importantDrops),
      suffix: 'eventos importantes',
      description: 'Frecuencia de caídas relevantes en el tiempo.',
      icon: AlertTriangle,
      sparkline: dropFrequencySeries,
      status: hasRecurrentDrops ? 'unstable' : analysis.importantDrops > 0 ? 'attention' : 'stable',
    },
    {
      title: 'Magnitud promedio de caída',
      value: formatNumber(metrics.averageDropMagnitude),
      suffix: 'unidades por evento de caída',
      description: 'Media del delta absoluto en lecturas con variación negativa.',
      icon: ArrowDown,
      sparkline: dropImpactSeries,
      status: avgDropIsRelevant ? 'attention' : 'stable',
    },
    {
      title: 'Tiempo de recuperación',
      value: formatMinutes(analysis.recoveryStats.median),
      suffix: analysis.incidents.length
        ? `mediana · rango ${formatMinutes(analysis.recoveryStats.min)}–${formatMinutes(analysis.recoveryStats.max)}`
        : 'sin historial suficiente',
      description: 'Mediana del tiempo hasta volver al rango esperado en incidentes cerrados.',
      icon: RotateCcw,
      sparkline: recoverySeries,
      status: avgRecoveryIsHigh ? 'attention' : 'stable',
    },
  ];

  return (
    <SimpleGrid columns={{ base: 1, md: 2, xl: 5 }} spacing={4}>
      {cards.map((card) => {
        const status = statusMeta(card.status as 'stable' | 'attention' | 'unstable');
        const Icon = card.icon;
        const StatusIcon = status.icon;

        return (
          <Card
            key={card.title}
            bg={card.primary ? 'white' : status.bg}
            borderWidth={card.primary ? '2px' : '1px'}
            borderColor={card.primary ? RAPPI_RED : 'rgba(16, 24, 40, 0.08)'}
            boxShadow={card.primary ? '0 14px 34px rgba(255, 68, 31, 0.12)' : 'sm'}
            transition="box-shadow 160ms ease, transform 160ms ease"
            _hover={{ boxShadow: 'md', transform: 'translateY(-1px)' }}
          >
            <CardBody p={card.primary ? 6 : 5}>
              <HStack justify="space-between" align="center" mb={3}>
                <Box
                  bg={status.color}
                  color="white"
                  w={card.primary ? 12 : 10}
                  h={card.primary ? 12 : 10}
                  borderRadius="8px"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  boxShadow="sm"
                >
                  <Icon size={20} />
                </Box>
                <Badge
                  bg="whiteAlpha.800"
                  color={status.color}
                  borderRadius="full"
                  px={2}
                  display="inline-flex"
                  alignItems="center"
                  gap={1}
                >
                  <StatusIcon size={12} />
                  {status.label}
                </Badge>
              </HStack>

              <Stat>
                <StatLabel color="gray.600" fontSize="sm" mb={1}>
                  {card.title}
                </StatLabel>
                <StatNumber
                  color="gray.800"
                  fontSize={card.primary ? '3xl' : '2xl'}
                  fontWeight="800"
                  lineHeight="1.1"
                >
                  {card.value}
                </StatNumber>
                <Text color="gray.600" fontSize="sm" lineHeight="1.35" mt={1}>
                  {card.suffix}
                </Text>
              </Stat>

              <Sparkline data={card.sparkline} color={status.color} />

              <Text color="gray.500" fontSize="xs" lineHeight="1.35" mt={3}>
                {card.description}
              </Text>
            </CardBody>
          </Card>
        );
      })}
    </SimpleGrid>
  );
}
