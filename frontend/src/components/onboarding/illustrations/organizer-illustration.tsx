"use client";
import { motion } from "framer-motion";

const cards = [
  { x: 30, y: 50, color: "var(--primary)", delay: 0.4 },
  { x: 130, y: 50, color: "#8b5cf6", delay: 0.55 },
  { x: 230, y: 50, color: "#f59e0b", delay: 0.7 },
  { x: 30, y: 105, color: "#ec4899", delay: 0.85 },
  { x: 130, y: 105, color: "var(--primary)", delay: 1.0 },
  { x: 230, y: 105, color: "#8b5cf6", delay: 1.15 },
  { x: 30, y: 160, color: "#f59e0b", delay: 1.3 },
  { x: 130, y: 160, color: "#ec4899", delay: 1.45 },
];

export function OrganizerIllustration() {
  return (
    <svg
      viewBox="0 0 320 220"
      className="w-full h-auto max-w-[280px]"
      role="img"
      aria-label="Planning généré automatiquement"
    >
      {/* Grille de fond */}
      <g stroke="currentColor" strokeOpacity="0.1" strokeWidth="1">
        <line x1="20" y1="45" x2="300" y2="45" />
        <line x1="20" y1="95" x2="300" y2="95" />
        <line x1="20" y1="150" x2="300" y2="150" />
        <line x1="20" y1="205" x2="300" y2="205" />
        <line x1="20" y1="30" x2="20" y2="205" />
        <line x1="120" y1="30" x2="120" y2="205" />
        <line x1="220" y1="30" x2="220" y2="205" />
        <line x1="300" y1="30" x2="300" y2="205" />
      </g>

      {/* Labels colonnes */}
      <text
        x="70"
        y="25"
        textAnchor="middle"
        fill="currentColor"
        fontSize="9"
        fontWeight="600"
        fontFamily="sans-serif"
        opacity="0.5"
      >
        TER. A
      </text>
      <text
        x="170"
        y="25"
        textAnchor="middle"
        fill="currentColor"
        fontSize="9"
        fontWeight="600"
        fontFamily="sans-serif"
        opacity="0.5"
      >
        TER. B
      </text>
      <text
        x="270"
        y="25"
        textAnchor="middle"
        fill="currentColor"
        fontSize="9"
        fontWeight="600"
        fontFamily="sans-serif"
        opacity="0.5"
      >
        TER. C
      </text>

      {/* Cartes de matchs en cascade */}
      {cards.map((card, i) => (
        <motion.g
          key={i}
          initial={{ opacity: 0, y: -30, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{
            delay: card.delay,
            duration: 0.4,
            type: "spring",
            stiffness: 200,
          }}
        >
          <rect
            x={card.x}
            y={card.y}
            width={80}
            height={38}
            rx={5}
            fill={card.color}
            fillOpacity="0.2"
            stroke={card.color}
            strokeWidth="1.5"
          />
          <rect
            x={card.x + 8}
            y={card.y + 10}
            width={50}
            height={3}
            rx={1}
            fill={card.color}
            fillOpacity="0.8"
          />
          <rect
            x={card.x + 8}
            y={card.y + 18}
            width={40}
            height={3}
            rx={1}
            fill={card.color}
            fillOpacity="0.5"
          />
          <rect
            x={card.x + 8}
            y={card.y + 27}
            width={30}
            height={2}
            rx={1}
            fill={card.color}
            fillOpacity="0.4"
          />
        </motion.g>
      ))}

      {/* Baguette magique */}
      <motion.text
        x="150"
        y="15"
        fontSize="14"
        initial={{ opacity: 0, rotate: -20 }}
        animate={{
          opacity: [0, 1, 1, 0],
          rotate: [-20, 0, 10, -20],
        }}
        transition={{ delay: 0.1, duration: 1.5 }}
      >
        ✨
      </motion.text>
    </svg>
  );
}
