import React from 'react';

/**
 * Komponen SVG untuk logo berlian/bintang Gemini yang dioptimalkan.
 * Mereplikasi bentuk "kilauan" dengan empat path terpisah yang bertemu
 * di dekat pusat, namun tidak sepenuhnya bersatu, menciptakan efek visual
 * yang lebih akurat sesuai gambar.
 * @param props Properti SVG standar seperti className, width, height, dll.
 */
export const GeminiIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      viewBox="0 0 24 24" // ViewBox standar untuk ikon, tetap konsisten
      xmlns="http://www.w3.org/2000/svg"
      fill="none" // Kita akan mengisi setiap path secara individual
      {...props} // Memungkinkan penambahan properti standar SVG
    >
      <title>Gemini Logo (Optimized)</title>

      {/* Setiap path merepresentasikan satu "kilauan" atau "sayap" bintang */}
      {/* Warna yang digunakan adalah perkiraan paling akurat dari gambar */}

      {/* Kilauan Merah (atas) */}
      <path d="M12 2L14 8L12 10L10 8L12 2Z" fill="#EA4335" />

      {/* Kilauan Biru (kanan) */}
      <path d="M22 12L16 14L14 12L16 10L22 12Z" fill="#4285F4" />

      {/* Kilauan Hijau (bawah) */}
      <path d="M12 22L10 16L12 14L14 16L12 22Z" fill="#34A853" />

      {/* Kilauan Kuning (kiri) */}
      <path d="M2 12L8 10L10 12L8 14L2 12Z" fill="#FBBC04" />

    </svg>
  );
};

export default GeminiIcon;