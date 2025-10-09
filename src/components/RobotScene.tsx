import Spline from '@splinetool/react-spline/next';

/**
 * Komponen ini sekarang hanya bertanggung jawab untuk me-render Spline.
 * Tidak perlu lagi `next/dynamic` di sini karena pemanggilan komponen ini
 * sudah dibungkus dengan <Suspense> di level yang lebih tinggi (di SceneLayout).
 * Cukup pastikan komponen ini adalah Client Component.
 */
export default function RobotScene() {
  return (
    <Spline
      scene="https://prod.spline.design/z-N6HevBt9TorsBn/scene.splinecode"
    />
  );
}

