/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/tour', destination: '/comprar-boletos', permanent: true },
      { source: '/gallery', destination: '/galeria', permanent: true },
      { source: '/music', destination: '/musica', permanent: true },
      { source: '/merch', destination: '/tienda', permanent: true },
      { source: '/blog', destination: '/ambar-te-escribe', permanent: true },
      { source: '/contact', destination: '/contacto', permanent: true },
    ];
  },
};

export default nextConfig;
