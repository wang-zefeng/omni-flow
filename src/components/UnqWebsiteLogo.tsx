import React from "react";

interface UnqLogoProps {
  className?: string;
  showText?: boolean;
}

export default function UnqWebsiteLogo({ className = "h-8 w-auto", showText = true }: UnqLogoProps) {
  // Balanced strokes, premium vibrant corporate brand colors
  // Light Sky Cyan: #00a2e8
  // Deep Rich Royal Indigo: #122cb4
  // Soft Neutral Grey: #cccccc
  if (!showText) {
    return (
      <svg 
        viewBox="20 35 170 115" 
        preserveAspectRatio="xMidYMid meet"
        fill="none" 
        xmlns="http://www.w3.org/2000/svg" 
        className={className}
      >
        {/* Light Blue Hook Emblem */}
        <path 
          d="M 45 65 C 45 130, 133 130, 133 92" 
          stroke="#00a2e8" 
          strokeWidth="24" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        {/* Dark Blue Hook Emblem */}
        <path 
          d="M 87 98 C 87 50, 172 50, 172 88" 
          stroke="#122cb4" 
          strokeWidth="24" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        {/* Grey Pearl Dot */}
        <circle cx="172" cy="132" r="13" fill="#cccccc" />
      </svg>
    );
  }

  return (
    <svg 
      viewBox="20 35 455 115" 
      preserveAspectRatio="xMidYMid meet"
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
    >
      {/* Light Blue Hook Emblem */}
      <path 
        d="M 45 65 C 45 130, 133 130, 133 92" 
        stroke="#00a2e8" 
        strokeWidth="24" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      {/* Dark Blue Hook Emblem */}
      <path 
        d="M 87 98 C 87 50, 172 50, 172 88" 
        stroke="#122cb4" 
        strokeWidth="24" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      {/* Grey Pearl Dot */}
      <circle cx="172" cy="132" r="13" fill="#cccccc" />

      {/* Elegant Letter U */}
      <path 
        d="M 235 55 L 235 95 C 235 115, 275 115, 275 95 L 275 55" 
        stroke="#122cb4" 
        strokeWidth="14" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />

      {/* Elegant Letter N */}
      <path 
        d="M 315 115 L 315 55 L 365 115 L 365 55" 
        stroke="#122cb4" 
        strokeWidth="14" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />

      {/* Elegant Letter Q */}
      <circle 
        cx="418" 
        cy="85" 
        r="30" 
        stroke="#122cb4" 
        strokeWidth="14" 
        fill="none" 
      />
      <path 
        d="M 436 103 Q 448 115, 458 125" 
        stroke="#122cb4" 
        strokeWidth="14" 
        strokeLinecap="round" 
      />
    </svg>
  );
}
