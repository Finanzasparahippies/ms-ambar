import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function GalleryRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/galleria');
  }, [router]);
  return null;
}
