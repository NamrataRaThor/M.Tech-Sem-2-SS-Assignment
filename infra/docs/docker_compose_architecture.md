# EventSphere: Docker Compose Architecture Design

This document outlines the local orchestration strategy for the EventSphere platform using Docker Compose. It ensures that all 8 microservices and the observability stack (LGTM stack) start in the correct order with shared networking and persistent data.

---

## 1. Service Orchestration Architecture

The system is divided into three tiers:
1.  **Infra Tier**: Core data and messaging (Postgres, Redis, Kafka).
2.  **App Tier**: The 8 microservices.
3.  **Observability Tier**: Metrics and logs (Prometheus, Grafana, Loki, Promtail).

### **Infrastructure Overview**
| Service | Image | Role |
| :--- | :--- | :--- |
| `postgres` | `postgres:15-alpine` | Shared DB server (Service isolation via logical DBs). |
| `redis` | `redis:7-alpine` | Distributed locks and seat hold TTL storage. |
| `kafka` | `confluentinc/cp-kafka:latest` | Event backbone. |
| `zookeeper` | `confluentinc/cp-zookeeper:latest` | Kafka coordination. |

---

## 2. Networking Strategy

A single, custom bridge network is used for all containers:
- **Network Name**: `eventsphere-network`
- **Internal DNS**: Services resolve each other by container name (e.g., `http://identity-service:8081`).
- **External Access**: Only the `api-gateway` and `grafana` are exposed to the host machine.

---

## 3. Volume Strategy

Named volumes are used to ensure data persistence across container restarts:
- `postgres_data`: For all microservice databases.
- `redis_data`: For seat hold persistence.
- `kafka_data`: For event log retention.
- `grafana_data`: For dashboards and alerts.

---

## 4. Service Dependency Diagram

```mermaid
graph TD
    subgraph Infrastructure
        ZK[Zookeeper] --> K[Kafka]
        PG[PostgreSQL]
        RD[Redis]
    end

    subgraph Observability
        L[Loki]
        PT[Promtail] --> L
        P[Prometheus]
        G[Grafana] --> P
        G --> L
    end

    subgraph Microservices
        IS[Identity] --> PG
        CS[Catalog] --> PG
        SS[Seating] --> PG
        SS --> RD
        OS[Order] --> PG
        OS --> K
        PS[Payment] --> PG
        PS --> K
        TS[Ticket] --> PG
        TS --> K
        NS[Notification] --> PG
        NS --> K
    end

    GW[API Gateway] --> IS
    GW --> CS
    GW --> SS
    GW --> OS
    GW --> PS
    GW --> TS
    GW --> NS
```

---

## 5. Environment Strategy

A centralized `.env` file at the root manages all secrets and configurations:
- **Database URLs**: `DATABASE_URL=postgresql://user:pass@postgres:5432/dbname`
- **Kafka**: `KAFKA_BROKERS=kafka:9092`
- **Secrets**: `JWT_SECRET`, `IDEMPOTENCY_EXPIRY`.
- **Tracing**: `OTEL_EXPORTER_OTLP_ENDPOINT=http://loki:4317`

---

## 6. Startup Sequencing

Docker Compose `depends_on` with `condition: service_healthy` is used to ensure apps don't start until infrastructure is ready:

1.  **Tier 1**: Zookeeper & Postgres.
2.  **Tier 2**: Kafka (Depends on Zookeeper) & Redis.
3.  **Tier 3**: Loki & Prometheus.
4.  **Tier 4**: Identity, Catalog, Seating (Depends on PG/Redis).
5.  **Tier 5**: Order, Payment, Ticket, Notification (Depends on Kafka).
6.  **Tier 6**: API Gateway & Grafana.

---

## 7. Health Check Standards

Every container implements a health check to inform the orchestrator:
- **App**: `curl -f http://localhost:PORT/health || exit 1`
- **Postgres**: `pg_isready -U user`
- **Kafka**: `kafka-topics --bootstrap-server localhost:9092 --list`
