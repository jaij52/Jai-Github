#!/usr/bin/env python3
"""
Grafana Log POC — Log Generator
Emits structured JSON log lines to ./logs/app.log
"""

import json
import os
import random
import time
import uuid
from datetime import datetime, timezone

LOG_DIR = "./logs"
LOG_FILE = os.path.join(LOG_DIR, "app.log")

SERVICES = ["auth-service", "payment-service", "api-gateway"]

MESSAGES = {
    "INFO": [
        "GET /api/v1/users 200 OK",
        "POST /api/v1/login 200 OK",
        "GET /api/v1/products 200 OK",
        "Payment processed successfully",
        "User session created",
        "Token validated",
        "Health check passed",
        "Cache hit for key user:profile",
        "Database query executed in 12ms",
        "Request completed successfully",
    ],
    "WARN": [
        "Slow database query detected (>500ms)",
        "Retry attempt 2/3 for external API",
        "Cache miss — falling back to database",
        "High memory usage detected: 78%",
        "Rate limit approaching for client 192.168.1.10",
        "Deprecated API endpoint called: /api/v0/users",
        "JWT token expiring soon",
    ],
    "ERROR": [
        "Database connection timeout",
        "Payment gateway returned 503",
        "Authentication failed: invalid credentials",
        "Unhandled exception in request handler",
        "Failed to connect to upstream service",
        "Disk write error: no space left",
    ],
}

# Weighted log level distribution: ~70% INFO, ~20% WARN, ~10% ERROR
LEVEL_WEIGHTS = [("INFO", 70), ("WARN", 20), ("ERROR", 10)]
LEVELS = [level for level, weight in LEVEL_WEIGHTS for _ in range(weight)]


def make_log_entry() -> dict:
    level = random.choice(LEVELS)
    service = random.choice(SERVICES)
    message = random.choice(MESSAGES[level])
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "service": service,
        "message": message,
        "request_id": uuid.uuid4().hex[:8],
    }


def main(rate: float = 1.0):
    os.makedirs(LOG_DIR, exist_ok=True)
    print(f"Writing logs to {LOG_FILE} at {rate} log(s)/second. Ctrl+C to stop.")

    with open(LOG_FILE, "a", buffering=1) as f:
        try:
            while True:
                entry = make_log_entry()
                line = json.dumps(entry)
                f.write(line + "\n")
                print(line)
                time.sleep(1.0 / rate)
        except KeyboardInterrupt:
            print("\nStopped.")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate structured JSON logs for Grafana POC")
    parser.add_argument(
        "--rate",
        type=float,
        default=1.0,
        help="Log emit rate in logs/second (default: 1.0)",
    )
    args = parser.parse_args()
    main(rate=args.rate)
