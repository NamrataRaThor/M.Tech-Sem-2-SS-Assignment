# EventSphere: Kubernetes Architecture Design (Minikube)

This document outlines the production-grade Kubernetes deployment strategy for the EventSphere platform on a Minikube cluster.

---

## 1. Namespace & Resource Organization

A dedicated namespace `eventsphere` is used to isolate the platform.

### **Service Tiers**
- **Infra (Stateful)**: PostgreSQL, Redis, Kafka/Zookeeper. Managed via `StatefulSets` or `Deployments` with `PVCs`.
- **App (Stateless)**: 8 microservices. Managed via `Deployments` with `HPA`.
- **Observability**: Prometheus, Grafana, Loki. Managed via `Deployments` and `DaemonSets` (Promtail).

---

## 2. Ingress & Traffic Strategy

The **API Gateway** is the only service exposed externally.
- **Ingress Controller**: NGINX Ingress Controller (enabled via `minikube addons enable ingress`).
- **Domain**: `eventsphere.local` (mapped in `/etc/hosts`).
- **TLS**: Terminated at the Ingress level (Self-signed for demo).

---

## 3. Storage Strategy

Minikube uses the standard `hostPath` storage class.
- **Postgres**: 5Gi PVC.
- **Redis**: 2Gi PVC.
- **Kafka**: 5Gi PVC.
- **Observability (Loki)**: 5Gi PVC.

---

## 4. Deployment Strategy

- **Rolling Updates**: `maxSurge: 1`, `maxUnavailable: 0` to ensure zero downtime.
- **Probes**:
    - **Readiness**: `/ready` endpoint (ensures DB/Kafka are connected).
    - **Liveness**: `/health` endpoint (restarts container on deadlock).
- **Auto-Scaling (HPA)**:
    - Target CPU: 70%.
    - Min Replicas: 1.
    - Max Replicas: 5.

---

## 5. Security & Configuration

- **ConfigMaps**: Store non-sensitive URLs (e.g., `KAFKA_BROKERS`, `SERVICE_URLS`).
- **Secrets**: Store sensitive credentials (e.g., `DATABASE_URL`, `JWT_SECRET`).
- **Resource Limits**: 
    - Apps: `128Mi` Memory / `100m` CPU.
    - Infra: `512Mi` Memory / `500m` CPU.

---

## 6. Observability Stack

- **Prometheus**: Scrapes pods using `prometheus.io/scrape: "true"` annotations.
- **Loki**: Centralized log aggregator.
- **Promtail**: DaemonSet to ship logs from container stdout to Loki.
- **Grafana**: Pre-configured with Prometheus and Loki data sources.
