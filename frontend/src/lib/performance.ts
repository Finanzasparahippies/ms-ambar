import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

export const reportWebVitalsToBackend = (metric: any) => {
  const body = {
    name: metric.name,
    value: metric.value,
    path: window.location.pathname,
  };

  // Use sendBeacon if available for better reliability on page hide
  if (navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
    navigator.sendBeacon(`${API_URL}/performance/vitals/`, blob);
  } else {
    axios.post(`${API_URL}/performance/vitals/`, body).catch(() => {
      // Ignore errors in performance reporting
    });
  }
};
