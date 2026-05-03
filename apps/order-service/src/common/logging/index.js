"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.correlationIdMiddleware = exports.httpLogger = exports.logger = void 0;
const pino_1 = __importDefault(require("pino"));
const api_1 = require("@opentelemetry/api");
exports.logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || 'info',
    formatters: {
        level: (label) => {
            return { level: label.toUpperCase() };
        },
    },
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
    mixin() {
        // Automatically inject TraceID and SpanID from OpenTelemetry context
        const activeSpan = api_1.trace.getSpan(api_1.context.active());
        if (activeSpan) {
            const { traceId, spanId } = activeSpan.spanContext();
            return {
                traceId,
                spanId,
                service: process.env.SERVICE_NAME || 'unknown-service',
            };
        }
        return {
            service: process.env.SERVICE_NAME || 'unknown-service',
        };
    },
});
const httpLogger = (req, res, next) => {
    const start = Date.now();
    const correlationId = (req.headers['x-correlation-id'] || 'no-id');
    const requestId = (req.headers['x-request-id'] || 'no-id');
    res.on('finish', () => {
        const duration = Date.now() - start;
        exports.logger.info({
            correlationId,
            requestId,
            eventType: 'HTTP_REQUEST',
            latency: `${duration}ms`,
            statusCode: res.statusCode,
            method: req.method,
            path: req.path,
            userId: req.headers['x-user-id'] || 'anonymous',
        }, `${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
    });
    next();
};
exports.httpLogger = httpLogger;
const correlationIdMiddleware = (req, res, next) => {
    const correlationId = req.headers['x-correlation-id'] || `corr-${Date.now()}`;
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
    next();
};
exports.correlationIdMiddleware = correlationIdMiddleware;
//# sourceMappingURL=index.js.map