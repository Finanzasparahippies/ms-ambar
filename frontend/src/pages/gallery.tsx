import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function GalleryRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/galeria');
  }, [router]);
  return null;
}
