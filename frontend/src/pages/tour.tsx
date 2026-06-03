import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function TourRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/comprar-boletos');
  }, [router]);
  return null;
}
