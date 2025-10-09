import { Suspense } from 'react';

/**
 * Komponen SceneLayout sekarang menjadi komponen layout murni.
 * Tidak lagi mengimpor RobotScene atau memiliki 'use client'.
 * Ia hanya menyediakan kerangka untuk menempatkan scene 3D dan konten.
 */
export default function SceneLayout({
  children,
  scene,
}: {
  children: React.ReactNode;
  scene: React.ReactNode;
}) {
  return (
    <main className="relative w-screen h-screen overflow-hidden bg-white">
      <div className="absolute inset-0 z-0 pointer-events-none lg:w-3/g5">
        {/*
         * Suspense dipindahkan ke sini.
         * Ia akan menangani fallback saat 'scene' (RobotScene dinamis) sedang dimuat.
        */}
        <Suspense fallback={<div className="h-full w-full bg-gray-100/80 animate-pulse rounded-md" />}>
          {scene}
        </Suspense>
      </div>
      <div className="relative z-10 h-full w-full">
        {children}
      </div>
    </main>
  );
}

