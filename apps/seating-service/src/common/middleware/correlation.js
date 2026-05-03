"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.correlationIdMiddleware = void 0;
const uuid_1 = require("uuid");
const correlationIdMiddleware = (req, res, next) => {
    const correlationId = req.headers['x-correlation-id'] || (0, uuid_1.v4)();
    // Inject into request headers so downstream services can receive it
    req.headers['x-correlation-id'] = correlationId;
    // Inject into response headers for visibility
    res.setHeader('x-correlation-id', correlationId);
    next();
};
exports.correlationIdMiddleware = correlationIdMiddleware;
//# sourceMappingURL=correlation.js.map