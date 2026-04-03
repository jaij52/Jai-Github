# Jai-Github — Grafana Log POC

A proof-of-concept for centralized log collection and visualization using the **Grafana + Loki + Promtail** stack, with a Python log generator.

---

## Architecture

```
Python Log Generator
        │
        ▼  (writes JSON logs to ./logs/)
    Promtail
        │
        ▼  (ships logs to)
      Loki
        │
        ▼  (queried by)
    Grafana  ──► Pre-built Dashboard
```

---

## Components

| Component | Purpose |
|---|---|
| `log_generator.py` | Python script that emits structured JSON log lines at random intervals |
| `docker-compose.yml` | Spins up Grafana, Loki, and Promtail together |
| `loki/loki-config.yml` | Loki configuration (local filesystem storage) |
| `promtail/promtail-config.yml` | Promtail scrape config (watches `./logs/*.log`) |
| `grafana/dashboards/logs-dashboard.json` | Pre-built Grafana dashboard for log exploration |
| `grafana/provisioning/` | Auto-provisions the datasource and dashboard on startup |

---

## Spec

### Log Generator (`log_generator.py`)
- Emits structured JSON log lines to `./logs/app.log`
- Fields: `timestamp`, `level` (INFO/WARN/ERROR), `service`, `message`, `request_id`
- Simulates 3 services: `auth-service`, `payment-service`, `api-gateway`
- Random log level distribution: ~70% INFO, ~20% WARN, ~10% ERROR
- Configurable emit rate (default: 1 log/second)

### Loki
- Runs on port `3100`
- Local filesystem storage under `./loki-data/`
- Single-binary mode (monolithic)

### Promtail
- Watches `./logs/*.log` for new lines
- Labels: `job=app-logs`, `service` (parsed from log JSON)
- Ships to Loki at `http://loki:3100`

### Grafana
- Runs on port `3000` (default credentials: `admin` / `admin`)
- Auto-provisioned Loki datasource
- Pre-built dashboard with:
  - Log volume over time (bar chart)
  - Log level breakdown (pie chart)
  - Live log stream panel with label filters

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Python 3.8+

### Run

```bash
# 1. Start the stack
docker compose up -d

# 2. Start generating logs
python log_generator.py

# 3. Open Grafana
open http://localhost:3000
# Login: admin / admin
# Navigate to Dashboards → App Logs Dashboard
```

---

## Log Format

Each line in `./logs/app.log` is a JSON object:

```json
{
  "timestamp": "2026-03-28T14:00:00.123456Z",
  "level": "INFO",
  "service": "api-gateway",
  "message": "GET /api/v1/users 200 OK",
  "request_id": "a1b2c3d4"
}
```
