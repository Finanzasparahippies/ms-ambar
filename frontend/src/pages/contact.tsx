import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function ContactRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/contacto');
  }, [router]);
  return null;
}
