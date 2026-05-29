// DonutChart — a reusable SVG ring-progress chart.
// Props:
//   size        — overall width/height in px (default 64)
//   strokeWidth — ring thickness in px (default 6)
//   pct         — fill percentage 0-100 (default 0)
//   color       — ring fill color (default 'var(--teal)')
//   trackColor  — background ring color (default 'rgba(0,0,0,0.08)')
//   textColor   — center text color (default 'inherit')
//   showText    — whether to show the pct% label (default true)

export default function DonutChart({
  size = 64,
  strokeWidth = 6,
  pct = 0,
  color = 'var(--teal)',
  trackColor = 'rgba(0,0,0,0.08)',
  textColor = 'inherit',
  showText = true,
}) {
  const clampedPct = Math.min(100, Math.max(0, Math.round(pct)))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (clampedPct / 100) * circumference
  const cx = size / 2
  const cy = size / 2
  const fontSize = Math.round(size * 0.23)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-hidden="true"
      style={{ flexShrink: 0, display: 'block' }}
    >
      {/* track ring */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      {/* progress ring */}
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
      {showText && (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontSize: `${fontSize}px`,
            fontWeight: 600,
            fill: textColor,
            fontFamily: 'var(--font-body)',
          }}
        >
          {clampedPct}%
        </text>
      )}
    </svg>
  )
}
