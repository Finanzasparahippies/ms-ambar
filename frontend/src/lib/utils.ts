import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getApiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  if (typeof window !== 'undefined') {
    const { origin, hostname, protocol, port } = window.location;

    // GitHub Codespaces support
    if (origin.includes('github.dev')) {
      return origin.replace(port, '8000') + '/api';
    }

    // Localhost development on desktop
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:8000/api';
    }

    // Direct access via IP address (e.g. mobile device on local network http://192.168.x.x:3000)
    if (port === '3000') {
      return `${protocol}//${hostname}:8000/api`;
    }

    // Staging / Production / Reverse Proxy behind Nginx
    return `${origin}/api`;
  }

  return 'http://localhost:8000/api';
}

/**
 * Calculates relative luminance of a hex color and returns an accessible text color (dark or light)
 * ensuring a minimum contrast ratio of 4.5:1 (WCAG AA).
 */
export function getAccessibleTextColor(hexColor?: string, preferredTextColor?: string): string {
  if (!hexColor || typeof hexColor !== 'string') {
    return preferredTextColor || '#F4F6F0';
  }

  let cleanHex = hexColor.replace('#', '').trim();
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  if (cleanHex.length !== 6) {
    return preferredTextColor || '#F4F6F0';
  }

  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const rL = toLinear(r);
  const gL = toLinear(g);
  const bL = toLinear(b);

  const luminance = 0.2126 * rL + 0.7152 * gL + 0.0722 * bL;
  const isBackgroundLight = luminance > 0.35;

  if (isBackgroundLight) {
    if (preferredTextColor) {
      let prefClean = preferredTextColor.replace('#', '').trim();
      if (prefClean.length === 3) prefClean = prefClean.split('').map(c => c + c).join('');
      if (prefClean.length === 6) {
        const pr = parseInt(prefClean.substring(0, 2), 16) / 255;
        const pg = parseInt(prefClean.substring(2, 4), 16) / 255;
        const pb = parseInt(prefClean.substring(4, 6), 16) / 255;
        const prefLum = 0.2126 * toLinear(pr) + 0.7152 * toLinear(pg) + 0.0722 * toLinear(pb);
        if (prefLum < 0.2) return preferredTextColor;
      }
    }
    return '#080c0a';
  } else {
    if (preferredTextColor) {
      let prefClean = preferredTextColor.replace('#', '').trim();
      if (prefClean.length === 3) prefClean = prefClean.split('').map(c => c + c).join('');
      if (prefClean.length === 6) {
        const pr = parseInt(prefClean.substring(0, 2), 16) / 255;
        const pg = parseInt(prefClean.substring(2, 4), 16) / 255;
        const pb = parseInt(prefClean.substring(4, 6), 16) / 255;
        const prefLum = 0.2126 * toLinear(pr) + 0.7152 * toLinear(pg) + 0.0722 * toLinear(pb);
        if (prefLum > 0.4) return preferredTextColor;
      }
    }
    return '#F4F6F0';
  }
}
