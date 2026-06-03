import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function MusicRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/musica');
  }, [router]);
  return null;
}
