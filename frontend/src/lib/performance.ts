import axios from 'axios';
import { getApiUrl } from './utils';

export const reportWebVitalsToBackend = (metric: any) => {
  const apiUrl = getApiUrl();
  const body = {
    name: metric.name,
    value: metric.value,
    path: typeof window !== 'undefined' ? window.location.pathname : '',
  };

  // Use sendBeacon if available for better reliability on page hide
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
    navigator.sendBeacon(`${apiUrl}/performance/vitals/`, blob);
  } else {
    axios.post(`${apiUrl}/performance/vitals/`, body).catch(() => {
      // Ignore errors in performance reporting
    });
  }
};
