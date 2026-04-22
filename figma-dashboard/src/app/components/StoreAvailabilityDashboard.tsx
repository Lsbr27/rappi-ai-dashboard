import { useMemo } from 'react';
import { Box, HStack, Heading, Text, VStack } from '@chakra-ui/react';
import { DiagnosticInsights } from './DiagnosticInsights';
import { InsightsAssistant } from './InsightsAssistant';
import { MetricsCards } from './MetricsCards';
import { buildDashboardData, buildDiagnosticAnalysis, formatValue, getInitialDateRange } from '../utils/availabilityData';

export function StoreAvailabilityDashboard() {
  const dateRange = useMemo(() => getInitialDateRange(), []);
  const diagnosticAnalysis = useMemo(
    () => buildDiagnosticAnalysis(dateRange.start, dateRange.end),
    [dateRange],
  );
  const { metrics } = useMemo(
    () => buildDashboardData(dateRange.start, dateRange.end),
    [dateRange],
  );
  const generalStatus = useMemo(() => {
    const { reviewShare, biggestDrop, problematicHours, importantDrops } = diagnosticAnalysis;
    const stateLabel = reviewShare >= 25 ? 'crítico' : reviewShare >= 10 ? 'con alertas' : 'estable';
    const parts: string[] = [
      `Estado ${stateLabel}: el ${reviewShare}% de las lecturas cayeron bajo el umbral saludable.`,
    ];
    if (importantDrops > 0 && biggestDrop) {
      parts.push(`Evento más grave el ${biggestDrop.time}: bajó ${formatValue(biggestDrop.drop)} tiendas.`);
    }
    const mostVulnerable = problematicHours[0];
    if (mostVulnerable && mostVulnerable.belowPct >= 30) {
      parts.push(`Franja más vulnerable: ${mostVulnerable.label}.`);
    }
    const worstDay = diagnosticAnalysis.baselineContext.worstDay;
    if (worstDay) {
      const [, month, day] = worstDay.day.split('-');
      parts.push(`Se detectó un evento crítico el ${day}/${month} que concentra la mayor caída observada en el período.`);
    }
    return parts.join(' ');
  }, [diagnosticAnalysis]);

  return (
    <Box minH="100vh" bg="#ffffff" color="#2f3137" borderTop="4px solid #FF441F">
      <Box maxW="1184px" mx="auto" px={{ base: 4, md: 6 }} py={{ base: 5, md: 8 }}>
        <VStack
          as="header"
          align="center"
          spacing={{ base: 4, md: 5 }}
          mb={{ base: 5, md: 6 }}
          bg="#FF441F"
          color="white"
          borderRadius="8px"
          px={{ base: 5, md: 10 }}
          py={{ base: 8, md: 12 }}
          textAlign="center"
        >
          <HStack spacing={2} color="white">
            <Box w="10px" h="10px" bg="white" borderRadius="2px" transform="rotate(45deg)" />
            <Text fontSize="12px" fontWeight="800" letterSpacing="0.08em" textTransform="uppercase">
              Rappi Availability
            </Text>
          </HStack>
          <Heading
            as="h1"
            maxW="900px"
            fontSize={{ base: '36px', md: '64px' }}
            fontWeight="300"
            lineHeight="1.05"
            color="white"
            letterSpacing="0"
          >
            Disponibilidad de tiendas en{' '}
            <Box as="span" fontWeight="800">
              Rappi
            </Box>
          </Heading>
          <Text maxW="720px" fontSize={{ base: '15px', md: '18px' }} color="whiteAlpha.900" lineHeight="1.45">
            Seguimiento de la disponibilidad de tiendas visibles para los usuarios en Rappi
          </Text>
          <Box
            w="min(100%, 720px)"
            bg="white"
            color="#2f3137"
            borderRadius="7px"
            boxShadow="0 18px 38px rgba(143, 35, 16, 0.18)"
            px={{ base: 4, md: 6 }}
            py={{ base: 4, md: 5 }}
            textAlign="left"
          >
            <Text fontSize={{ base: '14px', md: '15px' }} color="#2f3137" fontWeight="750" lineHeight="1.35">
              {generalStatus}
            </Text>
            <Text fontSize="13px" color="#727986" lineHeight="1.35" mt={1.5}>
              Identifica momentos críticos y prioriza acciones de monitoreo.
            </Text>
          </Box>
        </VStack>
        <Box mb={4}>
          <MetricsCards metrics={metrics} analysis={diagnosticAnalysis} />
        </Box>
        <DiagnosticInsights analysis={diagnosticAnalysis} />
        <Box mt={6}>
          <InsightsAssistant metrics={metrics} analysis={diagnosticAnalysis} />
        </Box>
      </Box>
    </Box>
  );
}
