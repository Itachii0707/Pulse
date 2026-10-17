import { useFormatSpeed } from '../hooks/useFormatSpeed'

const ROW_HEIGHT = 38
// Gaps between the label column and the rest of the diagram stay fixed — only the label
// column's own width flexes with the longest network name.
const DOT_GAP = 10
const CURVE_GAP = 8
const CURVE_LEN = 68
const STREAM_LEN = 48
const END_PAD = 12
const MIN_LABEL_X = 72
const MAX_LABEL_CHARS = 18
const CHAR_WIDTH = 6.4
const LABEL_EDGE_PAD = 4

export interface CombineDiagramNetwork {
  solid: string
  label: string
  speedBytesPerSec?: number
}

/** Draws the Neubrutalist multiple-links-into-one-stream diagram: individual networks
 * with their real-time speed on the left, converging into a single combined stream pointing
 * directly to the final total speed on the right. */
export function CombineDiagram({
  networks,
  muted = false,
  paused = false
}: {
  networks: CombineDiagramNetwork[]
  muted?: boolean
  paused?: boolean
}): React.JSX.Element {
  const formatSpeed = useFormatSpeed()
  const height = Math.max(82, networks.length * ROW_HEIGHT + 12)
  const midY = height / 2

  const longestLabelChars = Math.min(
    MAX_LABEL_CHARS,
    networks.reduce((max, network) => Math.max(max, network.label.trim().length), 0)
  )
  const LABEL_X = Math.max(MIN_LABEL_X, longestLabelChars * CHAR_WIDTH + LABEL_EDGE_PAD)
  const DOT_X = LABEL_X + DOT_GAP
  const CURVE_START_X = DOT_X + CURVE_GAP
  const COMBINE_X = CURVE_START_X + CURVE_LEN
  const STREAM_END_X = COMBINE_X + STREAM_LEN
  const WIDTH = STREAM_END_X + END_PAD

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      className="block shrink-0"
      style={{ width: WIDTH, height }}
    >
      <defs>
        {/* Glow & Shadow filters for high-energy Neubrutalism */}
        <filter id="hub-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow
            dx="1.5"
            dy="1.5"
            stdDeviation="0"
            floodColor="#000000"
            floodOpacity="0.8"
          />
        </filter>
        <filter id="arrow-shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow
            dx="1.5"
            dy="1.5"
            stdDeviation="0"
            floodColor="#000000"
            floodOpacity="0.8"
          />
        </filter>
      </defs>

      {/* 1. Curve Backdrops (Thick black contour) */}
      <g fill="none" stroke="#000000" strokeWidth={5} strokeLinecap="round" opacity={0.85}>
        {networks.map((network, index) => {
          const y = (index + 0.5) * (height / networks.length)
          return (
            <path
              key={`bg-curve-${network.label}-${index}`}
              d={`M${CURVE_START_X},${y.toFixed(1)} C${CURVE_START_X + 36},${y.toFixed(1)} ${COMBINE_X - 26},${midY.toFixed(1)} ${COMBINE_X},${midY.toFixed(1)}`}
            />
          )
        })}
      </g>

      {/* 2. Curve Flow Lines (Vibrant Neon Pipes with animated dashes) */}
      <g fill="none" strokeWidth={3} strokeLinecap="round">
        {networks.map((network, index) => {
          const y = (index + 0.5) * (height / networks.length)
          const color = muted ? 'var(--icon-muted)' : network.solid
          return (
            <path
              key={`fg-curve-${network.label}-${index}`}
              d={`M${CURVE_START_X},${y.toFixed(1)} C${CURVE_START_X + 36},${y.toFixed(1)} ${COMBINE_X - 26},${midY.toFixed(1)} ${COMBINE_X},${midY.toFixed(1)}`}
              stroke={color}
              strokeDasharray="6 6"
              opacity={paused ? 0.6 : 1}
              style={
                paused
                  ? undefined
                  : { animation: `pulse-dash ${1.0 + index * 0.18}s linear infinite` }
              }
            />
          )
        })}
      </g>

      {/* 3. Combined Stream Pipeline (Thick Outlined Power Stream) */}
      {/* Outer pipe border */}
      <path
        d={`M${COMBINE_X},${midY} L${STREAM_END_X},${midY}`}
        stroke="#000000"
        strokeWidth={8}
        strokeLinecap="round"
        opacity={paused ? 0.6 : 1}
      />
      {/* Inner power beam */}
      <path
        d={`M${COMBINE_X},${midY} L${STREAM_END_X - 2},${midY}`}
        stroke={muted ? 'var(--icon-muted)' : paused ? '#888888' : '#4CAF50'}
        strokeWidth={4.5}
        strokeLinecap="round"
        opacity={paused ? 0.6 : 1}
      />

      {/* 4. Stream Arrowhead with Neubrutalist contour */}
      <polygon
        points={`${STREAM_END_X - 2},${midY - 6.5} ${STREAM_END_X + 8},${midY} ${STREAM_END_X - 2},${midY + 6.5}`}
        fill={muted ? 'var(--icon-muted)' : paused ? '#888888' : '#4CAF50'}
        stroke="#000000"
        strokeWidth={2}
        strokeLinejoin="round"
        filter="url(#arrow-shadow)"
        opacity={paused ? 0.6 : 1}
      />

      {/* 5. The Convergence Junction (The Hub) */}
      {/* Outer dashed ring */}
      <circle
        cx={COMBINE_X}
        cy={midY}
        r={12}
        fill="none"
        stroke="#000000"
        strokeWidth={2}
        strokeDasharray="3 3"
        opacity={muted ? 0.4 : 0.8}
      />
      {/* Energetic pulse node */}
      <circle
        cx={COMBINE_X}
        cy={midY}
        r={6.5}
        fill={muted ? 'var(--icon-muted)' : '#FFEB3B'}
        stroke="#000000"
        strokeWidth={2.2}
        filter="url(#hub-shadow)"
      />
      <circle cx={COMBINE_X} cy={midY} r={2.2} fill="#000000" />

      {/* 6. Source Network Dots */}
      {networks.map((network, index) => {
        const y = (index + 0.5) * (height / networks.length)
        const color = muted ? 'var(--icon-muted)' : network.solid
        return (
          <g key={`dot-group-${index}`}>
            <circle
              cx={DOT_X}
              cy={y}
              r={4.5}
              fill={color}
              stroke="#000000"
              strokeWidth={2}
              filter="url(#hub-shadow)"
            />
            <circle cx={DOT_X} cy={y} r={1.5} fill="#FFFFFF" />
          </g>
        )
      })}

      {/* 7. Network Labels & Speed Readouts */}
      {networks.map((network, index) => {
        const y = (index + 0.5) * (height / networks.length)
        const label =
          network.label.trim().length > MAX_LABEL_CHARS
            ? `${network.label
                .trim()
                .slice(0, MAX_LABEL_CHARS - 1)
                .toUpperCase()}…`
            : network.label.trim().toUpperCase()
        const hasSpeed = network.speedBytesPerSec != null && network.speedBytesPerSec > 0
        const speedText = hasSpeed ? formatSpeed(network.speedBytesPerSec!) : 'READY'

        return (
          <g key={`info-${index}`}>
            <text
              x={LABEL_X}
              y={y - 5.5}
              textAnchor="end"
              fill="var(--text)"
              className="font-mono text-[9px] font-bold tracking-[0.1em]"
              style={{ letterSpacing: '0.08em' }}
            >
              <title>{network.label}</title>
              {label}
            </text>
            <text
              x={LABEL_X}
              y={y + 8}
              textAnchor="end"
              fill={hasSpeed ? network.solid : 'var(--text-tertiary)'}
              className="font-mono text-[11px] font-bold tabular-nums"
            >
              {speedText}
            </text>
          </g>
        )
      })}

      {/* 8. Combined Indicator Text */}
      {!muted && !paused && (
        <text
          x={STREAM_END_X + 2}
          y={midY - 12}
          textAnchor="end"
          fill="var(--text)"
          className="font-mono text-[9px] tracking-[0.14em] font-extrabold"
          style={{ letterSpacing: '0.12em' }}
        >
          BONDED ⚡
        </text>
      )}
    </svg>
  )
}
