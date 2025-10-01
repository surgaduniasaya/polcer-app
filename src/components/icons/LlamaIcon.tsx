// File baru untuk ikon Llama
import React from 'react';

const LlamaIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Z" />
    <path d="m15.23 12.03-2.5-2.5a.5.5 0 0 0-.71 0l-2.5 2.5" />
    <path d="m15.23 15.23-2.5-2.5a.5.5 0 0 0-.71 0l-2.5 2.5" />
    <path d="M8.77 12.03 6.27 9.53a.5.5 0 0 1 .71 0l2.5 2.5" />
    <path d="m8.77 15.23-2.5-2.5a.5.5 0 0 1 .71 0l2.5 2.5" />
  </svg>
);

export default LlamaIcon;
