import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.API_BASE || "http://localhost:8000/api/v1";
const TOKEN = __ENV.JWT_TOKEN || "";
const TRIP_ID = __ENV.TRIP_ID || "trip_golden";

export const options = {
  stages: [
    { duration: "10s", target: 25 },
    { duration: "20s", target: 50 },
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{endpoint:read}": ["p(95)<300"],
    "http_req_duration{endpoint:pulse}": ["p(95)<2000"],
  },
};

export default function () {
  const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

  const hRes = http.get(`${BASE}/health`, { tags: { endpoint: "read" } });
  check(hRes, { "health 200": (r) => r.status === 200 });

  if (TOKEN) {
    const tRes = http.get(`${BASE}/trips/${TRIP_ID}`, { headers, tags: { endpoint: "read" } });
    check(tRes, { "trip detail ok": (r) => r.status === 200 || r.status === 404 });

    const sRes = http.get(`${BASE}/trips/${TRIP_ID}/slack`, { headers, tags: { endpoint: "read" } });
    check(sRes, { "slack ok": (r) => r.status === 200 || r.status === 404 });
  }

  sleep(0.5);
}
