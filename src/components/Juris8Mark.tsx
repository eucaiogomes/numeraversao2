type Props = { className?: string };

/**
 * Juris8 mark — átomo com duas órbitas cruzadas formando um "8"/infinito,
 * com núcleo central. Desenhado em SVG vetorial, segue currentColor.
 */
export function Juris8Mark({ className }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      {/* órbita 1 — inclinada para a direita */}
      <ellipse
        cx="32"
        cy="32"
        rx="26"
        ry="11"
        transform="rotate(35 32 32)"
        opacity="0.85"
      />
      {/* órbita 2 — inclinada para a esquerda (forma o cruzamento do 8) */}
      <ellipse
        cx="32"
        cy="32"
        rx="26"
        ry="11"
        transform="rotate(-35 32 32)"
        opacity="0.85"
      />
      {/* núcleo */}
      <circle cx="32" cy="32" r="3.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
