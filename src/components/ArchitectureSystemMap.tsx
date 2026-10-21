import { useId, useMemo, useState, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { ArchitectureDiagram, ArchitectureRelationship, RelationshipKind } from '../services/architectureDiagrams'

// The gap between columns (COLUMN_WIDTH - NODE_WIDTH) holds a wrapped edge label.
const COLUMN_WIDTH = 338
const NODE_WIDTH = 178
const NODE_HEIGHT = 64
const ROW_HEIGHT = 124
const PAD_X = 22
const PAD_Y = 64
const ARC_LIFT = 58

const KIND_LABELS: Record<RelationshipKind, string> = {
  data: 'data',
  embedded: 'embedded app',
  link: 'reference link',
}

interface PlacedNode {
  diagram: ArchitectureDiagram
  rank: number
  x: number
  y: number
}

interface PlacedEdge {
  relationship: ArchitectureRelationship
  index: number
  path: string
  labelX: number
  labelY: number
  dataFlow: boolean
}

/**
 * Columns follow the handoffs: a system sits one column right of everything
 * that feeds it, so data reads left to right whatever the manifest lists.
 * Edges that skip a column arc above or below the column they cross.
 */
export function layoutSystemMap(diagrams: ArchitectureDiagram[], relationships: ArchitectureRelationship[]) {
  const rank = new Map(diagrams.map((diagram) => [diagram.key, 0]))
  const limit = Math.max(diagrams.length - 1, 0)
  for (let pass = 0; pass < diagrams.length; pass += 1) {
    for (const { from, to } of relationships) {
      const next = Math.min((rank.get(from) ?? 0) + 1, limit)
      if ((rank.get(to) ?? 0) < next) rank.set(to, next)
    }
  }
  const columns = new Map<number, ArchitectureDiagram[]>()
  for (const diagram of diagrams) {
    const column = rank.get(diagram.key) ?? 0
    columns.set(column, [...(columns.get(column) || []), diagram])
  }
  const columnIndexes = [...columns.keys()].sort((a, b) => a - b)
  const maxRows = Math.max(...[...columns.values()].map((column) => column.length), 1)
  const width = PAD_X * 2 + (columnIndexes.length - 1) * COLUMN_WIDTH + NODE_WIDTH
  const height = PAD_Y * 2 + maxRows * ROW_HEIGHT
  const nodes = new Map<string, PlacedNode>()
  columnIndexes.forEach((columnIndex, position) => {
    const column = columns.get(columnIndex)!
    const offset = ((maxRows - column.length) * ROW_HEIGHT) / 2
    column.forEach((diagram, row) => {
      nodes.set(diagram.key, {
        diagram,
        rank: position,
        x: PAD_X + position * COLUMN_WIDTH + NODE_WIDTH / 2,
        y: PAD_Y + offset + row * ROW_HEIGHT + ROW_HEIGHT / 2,
      })
    })
  })
  const midY = height / 2
  const edges = relationships.flatMap((relationship, index): PlacedEdge[] => {
    const source = nodes.get(relationship.from)
    const target = nodes.get(relationship.to)
    if (!source || !target) return []
    const x1 = source.x + NODE_WIDTH / 2
    const x2 = target.x - NODE_WIDTH / 2
    let c1: [number, number]
    let c2: [number, number]
    if (target.rank - source.rank > 1) {
      const up = source.y <= midY
      const bend = up ? Math.min(source.y, target.y) - ARC_LIFT - NODE_HEIGHT / 2 : Math.max(source.y, target.y) + ARC_LIFT + NODE_HEIGHT / 2
      c1 = [x1 + 70, bend]
      c2 = [x2 - 70, bend]
    } else {
      const mid = (x1 + x2) / 2
      c1 = [mid, source.y]
      c2 = [mid, target.y]
    }
    // Midpoint of the cubic, where the label sits.
    const labelX = 0.125 * x1 + 0.375 * c1[0] + 0.375 * c2[0] + 0.125 * x2
    const labelY = 0.125 * source.y + 0.375 * c1[1] + 0.375 * c2[1] + 0.125 * target.y
    return [{
      relationship,
      index,
      path: `M ${x1} ${source.y} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${x2 - 6} ${target.y}`,
      labelX,
      labelY,
      dataFlow: relationship.kinds.includes('data'),
    }]
  })
  return { width, height, nodes: [...nodes.values()], edges }
}

/** Long labels break at the space nearest their middle, so they fit between columns. */
export function labelLines(label: string) {
  if (label.length <= 18) return [label]
  const middle = label.length / 2
  let split = -1
  for (let index = label.indexOf(' '); index !== -1; index = label.indexOf(' ', index + 1)) {
    if (split === -1 || Math.abs(index - middle) < Math.abs(split - middle)) split = index
  }
  return split === -1 ? [label] : [label.slice(0, split), label.slice(split + 1)]
}

function kindsText(kinds: RelationshipKind[]) {
  return kinds.map((kind) => KIND_LABELS[kind]).join(' · ')
}

export function ArchitectureSystemMap({ diagrams, relationships, selectedKey }: {
  diagrams: ArchitectureDiagram[]
  relationships: ArchitectureRelationship[]
  selectedKey?: string
}) {
  const navigate = useNavigate()
  const markerId = useId().replace(/:/g, '')
  const captionId = `${markerId}-caption`
  const [activeNode, setActiveNode] = useState<string | null>(null)
  const [activeEdge, setActiveEdge] = useState<number | null>(null)
  const { width, height, nodes, edges } = useMemo(() => layoutSystemMap(diagrams, relationships), [diagrams, relationships])
  const titles = useMemo(() => new Map(diagrams.map((diagram) => [diagram.key, diagram.title])), [diagrams])

  const edgeIsActive = (edge: PlacedEdge) => activeEdge === edge.index
    || (activeNode !== null && (edge.relationship.from === activeNode || edge.relationship.to === activeNode))
  const anyActive = activeNode !== null || activeEdge !== null
  const focusedEdge = edges.find((edge) => edge.index === activeEdge)
  const focusedNode = nodes.find((node) => node.diagram.key === activeNode)

  const open = (event: MouseEvent<Element>, key: string) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
    event.preventDefault()
    navigate(`/architecture/${key}`)
  }

  return (
    <figure className={`architecture-map${anyActive ? ' has-focus' : ''}`}>
      <svg
        className="architecture-map-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-label="How the DIEM systems connect. Each system opens its diagram; each connection describes a handoff."
        aria-describedby={captionId}
      >
        <defs>
          <marker id={`${markerId}-data`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" className="architecture-map-arrow" />
          </marker>
          <marker id={`${markerId}-link`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0,0 L10,5 L0,10 z" className="architecture-map-arrow is-link" />
          </marker>
        </defs>
        {edges.map((edge) => {
          const active = edgeIsActive(edge)
          const label = edge.relationship.label
          const kinds = kindsText(edge.relationship.kinds)
          const lines = labelLines(label)
          const labelWidth = Math.max(...lines.map((line) => line.length * 6.6), kinds.length * 5.8) + 18
          const labelHeight = lines.length * 14 + 22
          return (
            <g
              key={edge.index}
              className={`architecture-map-edge${edge.dataFlow ? '' : ' is-link'}${active ? ' is-active' : ''}`}
              tabIndex={0}
              role="img"
              aria-label={`${titles.get(edge.relationship.from)} to ${titles.get(edge.relationship.to)}: ${label} (${kinds}). ${edge.relationship.detail}`}
              onMouseEnter={() => setActiveEdge(edge.index)}
              onMouseLeave={() => setActiveEdge(null)}
              onFocus={() => setActiveEdge(edge.index)}
              onBlur={() => setActiveEdge(null)}
            >
              <path className="architecture-map-hit" d={edge.path} />
              <path className="architecture-map-line" d={edge.path} markerEnd={`url(#${markerId}-${edge.dataFlow ? 'data' : 'link'})`} />
              <g className="architecture-map-label" transform={`translate(${edge.labelX} ${edge.labelY})`}>
                <rect x={-labelWidth / 2} y={-labelHeight / 2} width={labelWidth} height={labelHeight} rx={6} />
                {lines.map((line, index) => (
                  <text key={line} y={-labelHeight / 2 + 16 + index * 14} textAnchor="middle">{line}</text>
                ))}
                <text y={labelHeight / 2 - 8} textAnchor="middle" className="architecture-map-kinds">{kinds}</text>
              </g>
            </g>
          )
        })}
        {nodes.map((node) => {
          const selected = node.diagram.key === selectedKey
          return (
            <a
              key={node.diagram.key}
              href={`/architecture/${node.diagram.key}`}
              className={`architecture-map-node${selected ? ' is-selected' : ''}${activeNode === node.diagram.key ? ' is-active' : ''}`}
              aria-label={`Open the ${node.diagram.title} diagram`}
              aria-current={selected ? 'page' : undefined}
              onClick={(event) => open(event, node.diagram.key)}
              onMouseEnter={() => setActiveNode(node.diagram.key)}
              onMouseLeave={() => setActiveNode(null)}
              onFocus={() => setActiveNode(node.diagram.key)}
              onBlur={() => setActiveNode(null)}
            >
              <rect x={node.x - NODE_WIDTH / 2} y={node.y - NODE_HEIGHT / 2} width={NODE_WIDTH} height={NODE_HEIGHT} rx={10} />
              <text x={node.x} y={node.y - 4} textAnchor="middle" className="architecture-map-title">{node.diagram.title}</text>
              <text x={node.x} y={node.y + 15} textAnchor="middle" className="architecture-map-open">{selected ? 'Showing below' : 'Open diagram →'}</text>
            </a>
          )
        })}
      </svg>
      <figcaption id={captionId} className="architecture-map-caption" aria-live="polite">
        {focusedEdge ? (
          <>
            <strong>{titles.get(focusedEdge.relationship.from)} → {titles.get(focusedEdge.relationship.to)}</strong>
            <span>{focusedEdge.relationship.detail}</span>
          </>
        ) : focusedNode ? (
          <>
            <strong>{focusedNode.diagram.system}</strong>
            <span>{focusedNode.diagram.summary}</span>
          </>
        ) : (
          <span>Point at or tab to a connection to read the handoff. Select a system to open its diagram.</span>
        )}
      </figcaption>
      {/* Narrow screens get the same handoffs as a list instead of a map that
          would have to scroll sideways. */}
      <ul className="architecture-map-list">
        {relationships.map((relationship) => (
          <li key={`${relationship.from}-${relationship.to}`} className={relationship.kinds.includes('data') ? undefined : 'is-link'}>
            <span className="architecture-map-list-route">
              <Link to={`/architecture/${relationship.from}`}>{titles.get(relationship.from)}</Link>
              <span aria-hidden="true">→</span>
              <span className="sr-only">to</span>
              <Link to={`/architecture/${relationship.to}`}>{titles.get(relationship.to)}</Link>
            </span>
            <strong>{relationship.label}</strong>
            <small>{kindsText(relationship.kinds)}</small>
          </li>
        ))}
      </ul>
    </figure>
  )
}
