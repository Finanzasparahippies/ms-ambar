import { getApiUrl } from './utils';

let vitalsQueue: any[] = [];
let vitalsTimer: ReturnType<typeof setTimeout> | null = null;

const flushVitals = () => {
  if (vitalsQueue.length === 0 || typeof window === 'undefined') return;
  const apiUrl = getApiUrl();
  const payload = [...vitalsQueue];
  vitalsQueue = [];

  const bodyStr = JSON.stringify(payload.length === 1 ? payload[0] : payload);

  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([bodyStr], { type: 'application/json' });
    navigator.sendBeacon(`${apiUrl}/performance/vitals/`, blob);
  } else {
    fetch(`${apiUrl}/performance/vitals/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr,
      keepalive: true,
    }).catch(() => {});
  }
};

export const reportWebVitalsToBackend = (metric: any) => {
  if (typeof window === 'undefined') return;

  vitalsQueue.push({
    name: metric.name,
    value: metric.value,
    path: window.location.pathname,
  });

  if (vitalsTimer) clearTimeout(vitalsTimer);
  vitalsTimer = setTimeout(flushVitals, 1500);
};

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushVitals);
}

