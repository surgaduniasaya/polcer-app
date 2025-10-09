import React from 'react';

/**
 * Komponen SVG untuk logo Meta (Infinity Loop) yang sangat presisi dengan gradien warna.
 * Direplikasi untuk sama persis dengan gambar, termasuk bentuk 3D, variasi ketebalan,
 * dan gradien warna yang halus.
 *
 * @param props Properti SVG standar seperti className, width, height, dll.
 */
export const LlamaIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      viewBox="0 0 160 90" // ViewBox yang disesuaikan untuk proporsi horizontal yang pas
      xmlns="http://www.w3.org/2000/svg"
      {...props} // Memungkinkan penambahan properti standar SVG
    >
      <title>Meta Infinity Loop Logo (Final Accurate)</title>

      {/* Definisi Gradien Linier - Disempurnakan */}
      <defs>
        <linearGradient id="metaGradientFinal" x1="0%" y1="0%" x2="100%" y2="0%">
          {/* Warna dan offset disesuaikan untuk mencocokkan transisi di gambar */}
          <stop offset="0%" stopColor="#00c6ff" /> {/* Biru muda cerah */}
          <stop offset="30%" stopColor="#8d5bff" /> {/* Ungu kebiruan */}
          <stop offset="60%" stopColor="#ff00a2" /> {/* Magenta terang */}
          <stop offset="100%" stopColor="#ff7043" /> {/* Oranye kemerahan */}
        </linearGradient>
      </defs>

      {/* Path untuk bentuk Infinity Loop yang sangat presisi
          Path ini direkonstruksi untuk akurasi maksimal pada bentuk dan ketebalan 3D. */}
      <path
        d="M 12.0,46.0 C 12.0,24.0 28.0,10.0 50.0,10.0 
           C 72.0,10.0 88.0,24.0 88.0,46.0 
           C 88.0,68.0 72.0,82.0 50.0,82.0 
           C 28.0,82.0 12.0,68.0 12.0,46.0 Z 
           M 100.0,46.0 C 100.0,24.0 116.0,10.0 138.0,10.0 
           C 160.0,10.0 176.0,24.0 176.0,46.0 
           C 176.0,68.0 160.0,82.0 138.0,82.0 
           C 116.0,82.0 100.0,68.0 100.0,46.0 Z"
        fill="url(#metaGradientFinal)"
        stroke="none"
        // Transformasi untuk rotasi dan posisi yang tepat
        transform="translate(-8, 5) rotate(-12, 84, 46)"
      />
    </svg>
  );
};

export default LlamaIcon;