"use client";
import { motion } from "framer-motion";

export function PublicIllustration() {
  return (
    <svg
      viewBox="0 0 320 220"
      className="w-full h-auto max-w-[280px]"
      role="img"
      aria-label="Terrain de foot avec scores en direct"
    >
      {/* Terrain */}
      <motion.rect
        x="30"
        y="30"
        width="260"
        height="160"
        rx="8"
        fill="var(--primary)"
        fillOpacity="0.08"
        stroke="var(--primary)"
        strokeWidth="2"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      />
      {/* Ligne médiane */}
      <motion.line
        x1="160"
        y1="30"
        x2="160"
        y2="190"
        stroke="var(--primary)"
        strokeWidth="1.5"
        strokeOpacity="0.5"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      />
      {/* Cercle central */}
      <motion.circle
        cx="160"
        cy="110"
        r="25"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="1.5"
        strokeOpacity="0.5"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      />
      {/* Surfaces de réparation */}
      <motion.rect
        x="30"
        y="75"
        width="25"
        height="70"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="1.5"
        strokeOpacity="0.5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      />
      <motion.rect
        x="265"
        y="75"
        width="25"
        height="70"
        fill="none"
        stroke="var(--primary)"
        strokeWidth="1.5"
        strokeOpacity="0.5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      />

      {/* Scoreboard flottant */}
      <motion.g
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7, duration: 0.4 }}
      >
        <rect
          x="100"
          y="8"
          width="120"
          height="28"
          rx="14"
          fill="var(--background)"
          stroke="var(--primary)"
          strokeWidth="1.5"
        />
        <text
          x="135"
          y="27"
          textAnchor="middle"
          fill="currentColor"
          fontSize="14"
          fontWeight="700"
          fontFamily="sans-serif"
        >
          FCL
        </text>
        <motion.text
          x="160"
          y="27"
          textAnchor="middle"
          fill="var(--primary)"
          fontSize="16"
          fontWeight="800"
          fontFamily="sans-serif"
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.4, 1] }}
          transition={{
            delay: 1.5,
            duration: 0.5,
            repeat: Infinity,
            repeatDelay: 2,
          }}
        >
          3-1
        </motion.text>
        <text
          x="185"
          y="27"
          textAnchor="middle"
          fill="currentColor"
          fontSize="14"
          fontWeight="700"
          fontFamily="sans-serif"
        >
          SER
        </text>
      </motion.g>

      {/* Badge LIVE pulsant */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <motion.circle
          cx="240"
          cy="22"
          r="4"
          fill="#ef4444"
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <text
          x="250"
          y="26"
          fill="#ef4444"
          fontSize="10"
          fontWeight="700"
          fontFamily="sans-serif"
        >
          LIVE
        </text>
      </motion.g>

      {/* Étoile de favoris flottante */}
      <motion.text
        x="55"
        y="55"
        fontSize="16"
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: [0, 1, 1, 0], y: [-5, -15, -25] }}
        transition={{
          delay: 1.2,
          duration: 2,
          repeat: Infinity,
          repeatDelay: 1,
        }}
      >
        ⭐
      </motion.text>
    </svg>
  );
}
