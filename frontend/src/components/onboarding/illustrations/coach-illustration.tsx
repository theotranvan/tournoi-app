"use client";
import { motion } from "framer-motion";

export function CoachIllustration() {
  // Grille QR déterministe
  const qrCells: Array<{ row: number; col: number }> = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 7; col++) {
      const filled = (row + col * 3) % 2 === 0 || (row * col) % 3 === 1;
      if (filled) qrCells.push({ row, col });
    }
  }

  return (
    <svg
      viewBox="0 0 320 220"
      className="w-full h-auto max-w-[280px]"
      role="img"
      aria-label="Téléphone scannant un QR code"
    >
      {/* Silhouette téléphone */}
      <motion.rect
        x="100"
        y="20"
        width="120"
        height="180"
        rx="16"
        fill="var(--background)"
        stroke="currentColor"
        strokeWidth="2.5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      />
      {/* Notch */}
      <rect
        x="145"
        y="20"
        width="30"
        height="4"
        rx="2"
        fill="currentColor"
      />

      {/* QR code qui apparaît puis disparaît */}
      <motion.g
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{
          opacity: [0, 1, 1, 0],
          scale: [0.8, 1, 1, 0.8],
        }}
        transition={{
          delay: 0.5,
          duration: 2.5,
          times: [0, 0.3, 0.6, 1],
          repeat: Infinity,
          repeatDelay: 1.5,
        }}
      >
        {/* Grille QR simplifiée */}
        {qrCells.map(({ row, col }) => (
          <rect
            key={`${row}-${col}`}
            x={125 + col * 10}
            y={55 + row * 10}
            width={8}
            height={8}
            fill="currentColor"
          />
        ))}
        {/* Coins de positionnement */}
        <rect
          x="125"
          y="55"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        <rect
          x="178"
          y="55"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
        <rect
          x="125"
          y="108"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        />
      </motion.g>

      {/* Carte "prochain match" qui apparaît après le QR */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 1, 1, 0] }}
        transition={{
          delay: 0.5,
          duration: 4,
          times: [0, 0.6, 0.7, 0.9, 1],
          repeat: Infinity,
          repeatDelay: 0,
        }}
      >
        <rect
          x="115"
          y="55"
          width="90"
          height="110"
          rx="8"
          fill="var(--primary)"
          fillOpacity="0.12"
          stroke="var(--primary)"
          strokeWidth="1.5"
        />
        <text
          x="160"
          y="78"
          textAnchor="middle"
          fill="var(--primary)"
          fontSize="9"
          fontWeight="700"
          fontFamily="sans-serif"
        >
          PROCHAIN MATCH
        </text>
        <text
          x="160"
          y="105"
          textAnchor="middle"
          fill="currentColor"
          fontSize="18"
          fontWeight="800"
          fontFamily="sans-serif"
        >
          14:30
        </text>
        <text
          x="160"
          y="122"
          textAnchor="middle"
          fill="currentColor"
          fontSize="9"
          fontFamily="sans-serif"
        >
          Terrain B
        </text>
        <line
          x1="130"
          y1="135"
          x2="190"
          y2="135"
          stroke="currentColor"
          strokeOpacity="0.2"
        />
        <text
          x="160"
          y="152"
          textAnchor="middle"
          fill="currentColor"
          fontSize="10"
          fontWeight="600"
          fontFamily="sans-serif"
        >
          vs Servette
        </text>
      </motion.g>

      {/* Rayon de scan vert animé */}
      <motion.line
        x1="115"
        x2="205"
        stroke="var(--primary)"
        strokeWidth="2"
        initial={{ y1: 55, y2: 55, opacity: 0 }}
        animate={{
          y1: [55, 165, 55],
          y2: [55, 165, 55],
          opacity: [0, 1, 0],
        }}
        transition={{
          delay: 0.5,
          duration: 1.5,
          repeat: Infinity,
          repeatDelay: 2,
        }}
      />

      {/* Icônes décoratives */}
      <motion.text
        x="40"
        y="100"
        fontSize="20"
        initial={{ opacity: 0, x: -5 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.8 }}
      >
        ⚽
      </motion.text>
      <motion.text
        x="260"
        y="130"
        fontSize="20"
        initial={{ opacity: 0, x: 5 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 1 }}
      >
        🏆
      </motion.text>
    </svg>
  );
}
