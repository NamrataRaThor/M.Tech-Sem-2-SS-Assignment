import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { logger } from '../logging';

export const initTracing = (serviceName: string) => {
  // Use OTLP for centralized tracing (Loki/Tempo)
  const traceExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://loki:4318/v1/traces',
  });

  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
    }) as any,
    traceExporter,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();

  logger.info(`Tracing & OTEL initialized for ${serviceName}`);

  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => logger.info('Tracing terminated'))
      .catch((error) => logger.error({ error }, 'Error terminating tracing'))
      .finally(() => process.exit(0));
  });
};
