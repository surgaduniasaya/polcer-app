'use client';

import { useSearchParams } from 'next/navigation';
import Landing from './Landing';

// Komponen ini bertindak sebagai "jembatan" antara Server dan Client.
// Tujuannya adalah untuk membaca searchParams di sisi client dengan aman.
export default function LandingWrapper() {
  // Hook useSearchParams hanya bisa digunakan di Client Component.
  const searchParams = useSearchParams();
  const error = searchParams.get('error');

  // Kita teruskan pesan error (jika ada) ke komponen Landing.
  return <Landing errorMessage={error || undefined} />;
}
