"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initTracing = void 0;
const sdk_node_1 = require("@opentelemetry/sdk-node");
const auto_instrumentations_node_1 = require("@opentelemetry/auto-instrumentations-node");
const exporter_trace_otlp_http_1 = require("@opentelemetry/exporter-trace-otlp-http");
const resources_1 = require("@opentelemetry/resources");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const logging_1 = require("../logging");
const initTracing = (serviceName) => {
    // Use OTLP for centralized tracing (Loki/Tempo)
    const traceExporter = new exporter_trace_otlp_http_1.OTLPTraceExporter({
        url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://loki:4318/v1/traces',
    });
    const sdk = new sdk_node_1.NodeSDK({
        resource: new resources_1.Resource({
            [semantic_conventions_1.SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        }),
        traceExporter,
        instrumentations: [(0, auto_instrumentations_node_1.getNodeAutoInstrumentations)()],
    });
    sdk.start();
    logging_1.logger.info(`Tracing & OTEL initialized for ${serviceName}`);
    process.on('SIGTERM', () => {
        sdk.shutdown()
            .then(() => logging_1.logger.info('Tracing terminated'))
            .catch((error) => logging_1.logger.error({ error }, 'Error terminating tracing'))
            .finally(() => process.exit(0));
    });
};
exports.initTracing = initTracing;
//# sourceMappingURL=index.js.map