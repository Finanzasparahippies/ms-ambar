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

