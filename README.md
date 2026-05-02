# EventSphere: Event-Driven Microservices Architecture

EventSphere is a production-ready demonstration of a modern microservices platform designed for high-scale event ticket booking. It balances technical correctness with an understandable architecture, making it ideal for demonstrating distributed systems principles.

---

## 🏗️ Architecture Overview

The system consists of **8 specialized microservices** communicating via REST (synchronous) and Kafka (asynchronous).

### **Core Services**
- **Identity Service**: Handles user authentication and JWT issuance.
- **Catalog Service**: Manages event venues and ticket pricing.
- **Seating Service**: Orchestrates real-time seat holds and concurrency.
- **Order Service**: The **Saga Orchestrator** for the checkout workflow.
- **Payment Service**: Handles transaction processing with idempotency.
- **Ticket Service**: Generates unique tickets and mock QR codes.
- **Notification Service**: Sends event-driven Emails/SMS (mocked).
- **API Gateway**: The single entry point for all client traffic.

---

## 🛰️ The "Simple Saga" Workflow

EventSphere uses an **Orchestrator-based Saga** in the Order Service to ensure data consistency across services:

1.  **Reserve**: Order Service calls Seating Service to hold seats.
2.  **Pay**: Order Service calls Payment Service to charge the user.
3.  **Confirm**: On success, `order.confirmed.v1` is published to Kafka.
4.  **Fulfill**: Ticket Service consumes the event and generates assets.
5.  **Notify**: Notification Service alerts the user.
6.  **Rollback**: If payment fails, the Order Service automatically releases the seats.

---

## 📊 Observability (The LGTM Stack)

The platform is fully observable using the **Loki, Grafana, Tempo, Prometheus** stack:
- **Metrics**: Track request rates and latencies via Prometheus.
- **Logs**: Centralized JSON logging with **Correlation IDs**.
- **Traces**: Distributed tracing via OpenTelemetry to visualize the entire request lifecycle.

---

## 🚀 Getting Started

### **Prerequisites**
- Docker & Docker Compose
- Node.js 18+ (for local development)
- Minikube (optional, for K8s deployment)

### **Local Launch (Docker Compose)**
```bash
# 1. Start the entire ecosystem
docker-compose up -d --build

# 2. Access the APIs
# Gateway: http://localhost:8080
# Grafana: http://localhost:3000 (admin/admin)
```

### **Kubernetes Deployment (Minikube)**
```bash
# 1. Enable Ingress
minikube addons enable ingress

# 2. Apply manifests
kubectl apply -f infra/k8s/base.yaml
kubectl apply -f infra/k8s/postgres.yaml
kubectl apply -f infra/k8s/messaging.yaml
kubectl apply -f infra/k8s/apps-part1.yaml
kubectl apply -f infra/k8s/apps-part2.yaml
kubectl apply -f infra/k8s/ingress.yaml
```

---

## 📝 Engineering Standards
- **Clean Architecture**: Services separated into Repository, Service, and Controller layers.
- **Idempotency**: Critical operations (Orders/Payments) use unique IDs to prevent duplicates.
- **Resiliency**: Readiness/Liveness probes and graceful shutdown handlers.
- **Structured Telemetry**: Every log entry is correlated with a Trace ID.
