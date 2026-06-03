import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function MerchRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/tienda');
  }, [router]);
  return null;
}
