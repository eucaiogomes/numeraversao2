type Props = { className?: string };

/**
 * Numera — marca em "N" formada por traços diagonais conectados,
 * inspirada em fluxo contábil. Segue currentColor.
 */
export function NumeraMark({ className }: Props) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={3.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* haste esquerda */}
      <path d="M8 32 L8 10" />
      {/* diagonal */}
      <path d="M8 10 L32 32" />
      {/* haste direita */}
      <path d="M32 32 L32 10" />
      {/* ponto/nó superior esquerdo */}
      <circle cx="8" cy="8" r="2.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
