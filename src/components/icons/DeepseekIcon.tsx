import React from 'react';

/**
 * Komponen SVG untuk ikon paus biru yang bergaya.
 * Dibuat menggunakan satu path SVG yang kompleks untuk mendefinisikan
 * bentuk luar dan detail ruang negatif (mata, perut) secara presisi.
 *
 * @param props Properti SVG standar seperti className, width, height, dll.
 */
export const DeepSeekIcon = (props: React.SVGProps<SVGSVGElement>) => {
  // Path data yang sangat detail untuk mereplikasi bentuk paus
  // Perintah M (Move), C (Cubic Bezier), dan Z (Close) digunakan untuk menggambar kurva
  const pathData =
    "M 152.8,74.2 C 151.7,55.4 142.9,39.2 129.4,26.6 " +
    "C 114.3,12.4 94.9,4 73.7,4 " +
    "C 42.6,4 16.5,25.6 10.1,55.5 " +
    "C 7.8,66.9 8.8,78.8 12.8,89.5 " +
    "C 10.3,89.6 4,92.2 4,99.2 " +
    "C 4,107.5 13,111.4 16.5,111.4 " +
    "C 22.1,121.3 31.7,128.9 43.1,132.5 " +
    "C 54.8,136.2 67.5,135.9 78.5,131.7 " +
    "L 78.5,131.7 C 76.2,148.4 82.5,163.6 94.6,174.1 " +
    "C 99.4,178.1 105.1,180.7 111.2,181.4 " +
    "C 126.8,183.4 141.2,175.2 148.1,162.2 " +
    "C 152.1,155.1 153.8,146.9 153,138.8 " +
    "C 168.1,126.5 174.5,108.1 169.5,89.8 " +
    "C 166.4,78.8 160.5,74.7 152.8,74.2 Z " +
    "M 79,66.5 C 74.4,66.5 70.7,70.2 70.7,74.8 " +
    "C 70.7,79.4 74.4,83.1 79,83.1 " +
    "C 83.6,83.1 87.3,79.4 87.3,74.8 " +
    "C 87.3,70.2 83.6,66.5 79,66.5 Z";

  return (
    <svg
      viewBox="0 0 185 185" // ViewBox disesuaikan agar pas dengan koordinat path
      xmlns="http://www.w3.org/2000/svg"
      {...props} // Memungkinkan penambahan properti standar SVG
    >
      <title>Whale Icon</title>
      <path
        d={pathData}
        fill="#4A90E2" // Warna biru yang solid dan cerah
        fillRule="evenodd" // Memastikan "lubang" pada path dirender dengan benar
      />
    </svg>
  );
};

export default DeepSeekIcon;