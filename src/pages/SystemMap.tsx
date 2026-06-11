import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Maximize2, RefreshCw, Loader2, X } from 'lucide-react';
import { useSystemHealth, type HealthStatus } from '@/hooks/useSystemHealth';
import { useSystemMapRegistry, type RadialNodeData, type Connection } from '@/hooks/useSystemMapRegistry';

// ─── Constants ──────────────────────────────────────────────────
const CX = 3000, CY = 3000;
const RING_RADII = [0, 280, 500, 780, 1100, 1480, 1850, 2220, 2550];
const RING_LABELS = ['', 'Main Apps', 'Feature Areas', 'Screens', 'UI Parts', 'Data Connectors', 'Database', 'Backend Services', 'Core Technology'];

const SECTOR_COLORS: Record<number, string> = {
  0: '#3b82f6', 1: '#f59e0b', 2: '#14b8a6', 3: '#a855f7', 4: '#8b5cf6', 5: '#22c55e',
};

// ═══════════════════════════════════════════════════════════════
// RADIAL PLACEMENT ALGORITHM
// ═══════════════════════════════════════════════════════════════
function placeNodes(allNodes: RadialNodeData[]): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  positions.set('hub', { x: CX, y: CY });

  const NUM_SECTORS = 6;
  const sectorCounts = [0, 0, 0, 0, 0, 0];
  for (const nd of allNodes) {
    if (nd.id === 'hub') continue;
    sectorCounts[nd.sector ?? 0]++;
  }
  const totalNodes = sectorCounts.reduce((a, b) => a + b, 0);

  const MIN_ANGLE = 0.4;
  const FULL_CIRCLE = 2 * Math.PI;
  let reserved = 0;
  const needsMinimum = sectorCounts.map(c => {
    const proportional = totalNodes > 0 ? (c / totalNodes) * FULL_CIRCLE : FULL_CIRCLE / NUM_SECTORS;
    if (proportional < MIN_ANGLE) { reserved += MIN_ANGLE; return true; }
    return false;
  });
  const remaining = FULL_CIRCLE - reserved;
  const bigTotal = sectorCounts.reduce((sum, c, i) => needsMinimum[i] ? sum : sum + c, 0);

  const sectorAngles = sectorCounts.map((c, i) =>
    needsMinimum[i] ? MIN_ANGLE : (bigTotal > 0 ? (c / bigTotal) * remaining : remaining / NUM_SECTORS)
  );

  const SECTOR_START = -Math.PI / 2;
  const sectorStarts: number[] = [];
  let cumulative = SECTOR_START;
  for (let s = 0; s < NUM_SECTORS; s++) {
    sectorStarts.push(cumulative);
    cumulative += sectorAngles[s];
  }

  const byRing = new Map<number, RadialNodeData[]>();
  for (const nd of allNodes) {
    if (nd.id === 'hub') continue;
    const arr = byRing.get(nd.ring) || [];
    arr.push(nd);
    byRing.set(nd.ring, arr);
  }

  for (let ring = 1; ring <= 8; ring++) {
    const nodes = byRing.get(ring) || [];
    const radius = RING_RADII[ring];

    const bySector = new Map<number, RadialNodeData[]>();
    for (const nd of nodes) {
      const s = nd.sector ?? 0;
      const arr = bySector.get(s) || [];
      arr.push(nd);
      bySector.set(s, arr);
    }

    for (let s = 0; s < NUM_SECTORS; s++) {
      const sectorNodes = bySector.get(s) || [];
      if (sectorNodes.length === 0) continue;

      const startAngle = sectorStarts[s];
      const sectorSize = sectorAngles[s];
      const padding = sectorSize * 0.05;
      const usable = sectorSize - 2 * padding;

      const nodeWidth = ring <= 2 ? 110 : ring <= 4 ? 90 : 80;
      const minGap = nodeWidth + 12;
      const arcLength = radius * usable;
      const capacity = Math.max(1, Math.floor(arcLength / minGap));

      if (sectorNodes.length <= capacity) {
        for (let i = 0; i < sectorNodes.length; i++) {
          const t = sectorNodes.length === 1 ? 0.5 : i / (sectorNodes.length - 1);
          const angle = startAngle + padding + t * usable;
          positions.set(sectorNodes[i].id, {
            x: CX + radius * Math.cos(angle),
            y: CY + radius * Math.sin(angle),
          });
        }
      } else {
        const numRows = Math.ceil(sectorNodes.length / capacity);
        const rowOffset = 35;
        for (let i = 0; i < sectorNodes.length; i++) {
          const row = Math.floor(i / capacity);
          const indexInRow = i % capacity;
          const rowCount = Math.min(capacity, sectorNodes.length - row * capacity);
          const t = rowCount === 1 ? 0.5 : indexInRow / (rowCount - 1);
          const angle = startAngle + padding + t * usable;
          const rOffset = (row - (numRows - 1) / 2) * rowOffset;
          const r = radius + rOffset;
          positions.set(sectorNodes[i].id, {
            x: CX + r * Math.cos(angle),
            y: CY + r * Math.sin(angle),
          });
        }
      }
    }
  }

  return positions;
}

// ═══════════════════════════════════════════════════════════════
// HIGHLIGHT / IMPACT ANALYSIS
// ═══════════════════════════════════════════════════════════════
function getConnectedNodes(nodeId: string, connections: Connection[], maxHops: number = 3): Set<string> {
  const visited = new Set<string>();
  const queue: [string, number][] = [[nodeId, 0]];
  visited.add(nodeId);

  while (queue.length > 0) {
    const [current, hops] = queue.shift()!;
    if (hops >= maxHops) continue;

    for (const conn of connections) {
      let neighbor: string | null = null;
      if (conn.from === current) neighbor = conn.to;
      else if (conn.to === current) neighbor = conn.from;
      if (neighbor && !visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([neighbor, hops + 1]);
      }
    }
  }

  return visited;
}

// ═══════════════════════════════════════════════════════════════
// PER-NODE HEALTH CLOUD
// ═══════════════════════════════════════════════════════════════
const CLOUD_RADIUS_BY_RING: Record<number, number> = {
  0: 180, 1: 140, 2: 120, 3: 100, 4: 90, 5: 80, 6: 80, 7: 80, 8: 70,
};

const CLOUD_OPACITY_BY_HEALTH: Record<HealthStatus, number> = {
  red: 0.45, amber: 0.30, green: 0.15,
};

const HealthCloud: React.FC<{
  cx: number;
  cy: number;
  radius: number;
  status: HealthStatus;
}> = React.memo(({ cx, cy, radius, status }) => (
  <circle
    cx={cx}
    cy={cy}
    r={radius}
    fill={`url(#health-cloud-${status})`}
    opacity={CLOUD_OPACITY_BY_HEALTH[status]}
  />
));

HealthCloud.displayName = 'HealthCloud';

// ═══════════════════════════════════════════════════════════════
// SVG COMPONENTS
// ═══════════════════════════════════════════════════════════════
const HEALTH_COLORS: Record<HealthStatus, string> = {
  green: '#22c55e',
  amber: '#f59e0b',
  red: '#ef4444',
};

const RadialNodeSVG: React.FC<{
  node: RadialNodeData;
  x: number;
  y: number;
  highlighted: boolean;
  dimmed: boolean;
  onHover: (id: string | null) => void;
  onDoubleClick: (id: string) => void;
  onClick: (id: string) => void;
  healthStatus?: HealthStatus;
}> = React.memo(({ node, x, y, highlighted, dimmed, onHover, onDoubleClick, onClick, healthStatus }) => {
  const isCenter = node.ring === 0;
  const w = isCenter ? 160 : node.ring <= 2 ? 110 : node.ring <= 4 ? 90 : 80;
  const h = isCenter ? 40 : node.ring <= 2 ? 28 : 22;
  const fontSize = isCenter ? 12 : node.ring <= 2 ? 9 : node.ring <= 4 ? 7 : 6;
  const opacity = dimmed ? 0.06 : highlighted ? 1 : 0.8;

  const NEUTRAL = node.ring === 0 ? '#e2e8f0' : '#8892a4';
  const fillColor = healthStatus ? HEALTH_COLORS[healthStatus] : NEUTRAL;
  const strokeColor = healthStatus ? HEALTH_COLORS[healthStatus] : NEUTRAL;

  return (
    <g
      opacity={opacity}
      style={{ transition: 'opacity 0.3s ease' }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(node.id); }}
      onClick={(e) => { e.stopPropagation(); onClick(node.id); }}
      cursor="pointer"
    >
      <rect
        x={x - w / 2} y={y - h / 2}
        width={w} height={h}
        rx={isCenter ? 12 : 6}
        fill={fillColor + '30'}
        stroke={strokeColor}
        strokeWidth={highlighted ? 2 : 1}
        strokeOpacity={0.7}
      />
      <text
        x={x} y={y + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill={highlighted ? '#fff' : fillColor}
        fontSize={fontSize}
        fontWeight={isCenter ? 700 : node.ring <= 2 ? 600 : 400}
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {node.label}
      </text>
      {healthStatus && (
        <circle
          cx={x + w / 2 - 4}
          cy={y - h / 2 + 4}
          r={3}
          fill={HEALTH_COLORS[healthStatus]}
          stroke="#0a0a1a"
          strokeWidth={1}
        >
          {healthStatus === 'red' && (
            <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
          )}
        </circle>
      )}
    </g>
  );
});

RadialNodeSVG.displayName = 'RadialNodeSVG';

const RadialConnectionSVG: React.FC<{
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  opacity: number;
  dashed: boolean;
  highlighted: boolean;
  dimmed: boolean;
}> = React.memo(({ from, to, color, opacity: baseOpacity, dashed, highlighted, dimmed }) => {
  const finalOpacity = dimmed ? 0.02 : highlighted ? Math.min(baseOpacity * 2, 0.8) : baseOpacity;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const toCenterX = CX - mx;
  const toCenterY = CY - my;
  const toCenterDist = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);
  const pull = Math.min(dist * 0.15, 80);
  const cx1 = mx + (toCenterDist > 0 ? (toCenterX / toCenterDist) * pull : 0);
  const cy1 = my + (toCenterDist > 0 ? (toCenterY / toCenterDist) * pull : 0);

  return (
    <path
      d={`M ${from.x} ${from.y} Q ${cx1} ${cy1}, ${to.x} ${to.y}`}
      fill="none"
      stroke={color}
      strokeWidth={highlighted ? 1.5 : 0.8}
      strokeOpacity={finalOpacity}
      strokeDasharray={dashed ? '4 3' : undefined}
      style={{ transition: 'stroke-opacity 0.3s ease' }}
    />
  );
});

RadialConnectionSVG.displayName = 'RadialConnectionSVG';

// ═══════════════════════════════════════════════════════════════
// NODE INFO PANEL
// ═══════════════════════════════════════════════════════════════
const RING_TYPE_LABELS: Record<number, string> = {
  0: 'Hub', 1: 'Main App', 2: 'Feature Area', 3: 'Screen',
  4: 'UI Part', 5: 'Data Connector', 6: 'Database Table', 7: 'Backend Service', 8: 'Core Technology',
};

const SECTOR_PORTAL_NAMES: Record<number, string> = {
  0: 'Student Portal', 1: 'Staff CRM', 2: 'University Staff',
  3: 'Interview Practice', 4: 'Study Plan Trainer', 5: 'Public Pages',
};

// Per-node specific descriptions for the most important nodes
const NODE_DESCRIPTIONS: Record<string, string> = {
  'hub': 'The central core connecting all portals, services, and data layers of the platform.',
  'portal-student': 'The Student Portal — where students track applications, upload documents, explore Korean universities, and practice interviews.',
  'portal-crm': 'The Staff CRM — the operations hub where staff manage students, leads, payments, tasks, and communications.',
  'portal-uni': 'The University Staff Portal — where university-side staff view enrolled students, announcements, and application decisions.',
  'portal-interview': 'The Interview Practice Portal — an AI-powered space for students to rehearse Korean university admission interviews.',
  'portal-study': 'The Study Plan Trainer — a structured AI workspace for writing and refining personal study plans for Korean university applications.',
  'portal-public': 'Public-facing pages including the welcome screen, install instructions, privacy policy, and terms of service.',
  'db-profiles': 'Stores all user profile data — names, contact info, contract dates, language levels, and preferences for both students and staff.',
  'db-payments': 'Records all student payment transactions, invoices, and payment status across the platform.',
  'db-documents': 'Stores uploaded student documents (passports, transcripts, etc.) linked to their applications.',
  'db-applications': 'Tracks each student\'s university applications including status, decision, and submission history.',
  'db-universities': 'The master list of Korean universities with details used across program search, applications, and comparisons.',
  'db-leads': 'CRM lead records for prospective students, including contact info, interest level, and follow-up schedule.',
  'db-tasks': 'Task records for staff — assignments, deadlines, and completion status used in the Kanban board.',
  'db-interview-sessions': 'Records each student\'s interview practice session including duration, score, and feedback.',
  'db-room-members': 'Tracks which students and staff belong to each university collaboration room.',
};

function getNodeDescription(node: RadialNodeData): string {
  if (NODE_DESCRIPTIONS[node.id]) return NODE_DESCRIPTIONS[node.id];
  const portal = SECTOR_PORTAL_NAMES[node.sector ?? 0] ?? 'the platform';
  const label = node.label;
  switch (node.ring) {
    case 0: return 'The central core that ties all parts of the system together.';
    case 1: return `A major portal section of the platform that users can navigate to.`;
    case 2: return `A group of related features within the ${portal}.`;
    case 3: return `A page or view that users see and interact with inside the ${portal}.`;
    case 4: return `A reusable UI component displayed on screen inside the ${portal}.`;
    case 5: return `A data hook that fetches and manages ${label.toLowerCase()} data for the ${portal}.`;
    case 6: return `A database table that stores ${label} data, powering features across the ${portal}.`;
    case 7: return `A backend service that handles ${label.toLowerCase()} processing for the ${portal}.`;
    case 8: return `A core technology or library that underpins the entire platform.`;
    default: return `A part of the ${portal}.`;
  }
}

function getHealthText(status?: HealthStatus): { text: string; color: string } {
  switch (status) {
    case 'green': return { text: 'Everything looks healthy', color: '#22c55e' };
    case 'amber': return { text: 'Needs some attention', color: '#f59e0b' };
    case 'red': return { text: 'Has a problem right now', color: '#ef4444' };
    default: return { text: 'No health data available', color: '#6b7280' };
  }
}

const NodeInfoPanel: React.FC<{
  node: RadialNodeData | null;
  onClose: () => void;
  healthStatus?: HealthStatus;
  healthMessage?: string;
  connectionCount: number;
}> = ({ node, onClose, healthStatus, healthMessage, connectionCount }) => {
  const isOpen = node !== null;
  const typeLabel = node ? (RING_TYPE_LABELS[node.ring] ?? 'Part') : '';
  const portalLabel = node ? (SECTOR_PORTAL_NAMES[node.sector ?? 0] ?? '') : '';
  const description = node ? getNodeDescription(node) : '';
  const { text: healthText, color: healthColor } = getHealthText(healthStatus);

  // Mirror canvas neutral logic — no sector color in panel header
  const NEUTRAL_PANEL = node?.ring === 0 ? '#e2e8f0' : '#8892a4';
  const nodeColor = healthStatus ? HEALTH_COLORS[healthStatus] : NEUTRAL_PANEL;

  // Sector color only used in the portal badge for identity
  const sectorColor = SECTOR_COLORS[node?.sector ?? 0] ?? '#8892a4';

  const diagnosticMessage = healthMessage ?? (
    (healthStatus === 'amber' || healthStatus === 'red')
      ? 'One or more connected parts have issues — click those nodes for details'
      : undefined
  );

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={onClose}
        />
      )}
      {/* Panel */}
      <div
        className="fixed right-4 top-16 bottom-4 z-50 w-72 transition-transform duration-300 ease-out"
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(calc(100% + 1rem))' }}
      >
        <div className="h-full rounded-xl bg-black/85 backdrop-blur-md border border-white/10 shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-start justify-between p-4 pb-3 border-b border-white/8">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Fix 2: Pulse animation when red */}
              <div
                className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${healthStatus === 'red' ? 'animate-pulse' : ''}`}
                style={{ backgroundColor: nodeColor }}
              />
              <span
                className="text-base font-semibold leading-tight truncate"
                style={{ color: nodeColor }}
              >
                {node?.label ?? ''}
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded-md text-white/40 hover:text-white/70 transition-colors flex-shrink-0 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Badges — Fix 9: type badge neutral, portal badge retains sector color */}
          <div className="px-4 pt-3 flex flex-wrap gap-1.5">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border border-white/20 bg-white/8 text-white/55"
            >
              {typeLabel}
            </span>
            {portalLabel && node?.ring !== 0 && (
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                style={{
                  color: sectorColor,
                  borderColor: sectorColor + '50',
                  backgroundColor: sectorColor + '18',
                }}
              >
                {portalLabel}
              </span>
            )}
          </div>

          {/* Description */}
          <div className="px-4 pt-3 flex-1 overflow-y-auto">
            <div className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">What is this?</div>
            <p className="text-[13px] text-white/75 leading-relaxed">{description}</p>

            {/* Health */}
            <div className="mt-4 pt-3 border-t border-white/8">
              <div className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-2">Health</div>
              <div className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: healthColor }}
                />
                <span className="text-[12px] text-white/70">{healthText}</span>
              </div>

              {/* Diagnostic message box */}
              {(healthStatus === 'amber' || healthStatus === 'red') && diagnosticMessage && (
                <div
                  className={`mt-2.5 rounded-lg p-2.5 border text-[11px] leading-relaxed ${healthStatus === 'red'
                      ? 'bg-destructive/10 border-destructive/20 text-destructive/80'
                      : 'bg-warning/10 border-warning/20 text-warning/80'
                    }`}
                >
                  <div className="flex gap-1.5 items-start">
                    <span className="flex-shrink-0 mt-px">{healthStatus === 'red' ? '✕' : '⚠'}</span>
                    <span>{diagnosticMessage}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Connections */}
            <div className="mt-3 pt-3 border-t border-white/8">
              <div className="text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">Connections</div>
              <div className="text-[12px] text-white/60">
                Connected to <span className="text-white/90 font-semibold">{connectionCount}</span> other {connectionCount === 1 ? 'part' : 'parts'}
              </div>
            </div>

            {/* Ring info */}
            <div className="mt-3 pt-3 border-t border-white/8">
              <div className="text-[10px] text-white/25 font-mono">Ring {node?.ring ?? 0} · Sector {node?.sector ?? 0}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function SystemMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.35);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [lockedNode, setLockedNode] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [healthFilter, setHealthFilter] = useState<Set<HealthStatus>>(new Set());

  // Fetch nodes and connections from database
  const { nodes: registryNodes, connections: registryConnections, loading: registryLoading } = useSystemMapRegistry();

  const toggleHealthFilter = (status: HealthStatus) => {
    setHealthFilter(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const allNodes = registryNodes;
  const allConnections = registryConnections;
  const positions = useMemo(() => placeNodes(allNodes), [allNodes]);

  // Derive DB table node IDs from registry for health checks
  const tableHealthNodeIds = useMemo(() => allNodes.filter(n => n.ring === 6).map(n => n.id), [allNodes]);

  const connectionsForHealth = useMemo(() => allConnections.map(c => ({ from: c.from, to: c.to })), [allConnections]);
  const { nodeHealth, healthMessages, loading: healthLoading, lastRefreshed, refresh: refreshHealth, summary: healthSummary } = useSystemHealth(connectionsForHealth, tableHealthNodeIds);

  // Compute per-node health clouds data
  const healthCloudNodes = useMemo(() => {
    const clouds: Array<{ id: string; x: number; y: number; radius: number; status: HealthStatus }> = [];
    for (const node of allNodes) {
      const status = nodeHealth.get(node.id);
      if (!status) continue;
      const pos = positions.get(node.id);
      if (!pos) continue;
      clouds.push({
        id: node.id,
        x: pos.x,
        y: pos.y,
        radius: CLOUD_RADIUS_BY_RING[node.ring] ?? 60,
        status,
      });
    }
    return clouds;
  }, [allNodes, nodeHealth, positions]);

  // Selected node info panel
  const selectedNode = useMemo(() => allNodes.find(n => n.id === selectedNodeId) ?? null, [allNodes, selectedNodeId]);
  const selectedNodeConnectionCount = useMemo(() => {
    if (!selectedNodeId) return 0;
    return allConnections.filter(c => c.from === selectedNodeId || c.to === selectedNodeId).length;
  }, [allConnections, selectedNodeId]);

  const activeNode = hoveredNode ?? lockedNode;
  const highlightedNodes = useMemo(() => {
    if (!activeNode) return null;
    return getConnectedNodes(activeNode, allConnections, 3);
  }, [activeNode, allConnections]);

  // Pan & zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    setScale(prevScale => {
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      const newScale = Math.max(0.08, Math.min(2, prevScale + delta));
      const svgX = (mouseX - panX) / prevScale;
      const svgY = (mouseY - panY) / prevScale;
      setPanX(mouseX - svgX * newScale);
      setPanY(mouseY - svgY * newScale);
      return newScale;
    });
  }, [panX, panY]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panX, y: e.clientY - panY });
  }, [panX, panY]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanX(e.clientX - dragStart.x);
    setPanY(e.clientY - dragStart.y);
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (containerRef.current) {
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      setPanX(w / 2 - CX * scale);
      setPanY(h / 2 - CY * scale);
    }
  }, []);

  const fitAll = useCallback(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    const newScale = Math.min(w / 6000, h / 6000) * 0.9;
    setScale(newScale);
    setPanX(w / 2 - CX * newScale);
    setPanY(h / 2 - CY * newScale);
  }, []);

  const recenter = useCallback(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth;
    const h = containerRef.current.clientHeight;
    setPanX(w / 2 - CX * scale);
    setPanY(h / 2 - CY * scale);
  }, [scale]);

  // Loading state
  if (registryLoading) {
    return (
      <div className="w-[100vw] h-[100dvh] flex items-center justify-center bg-[#0a0a1a]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
          <span className="text-white/40 text-sm">Loading system map...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-[100vw] h-[100dvh] overflow-hidden bg-[#0a0a1a] relative select-none"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Zoom Controls */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-1 bg-black/80 backdrop-blur border border-white/10 rounded-lg p-1 shadow-xl">
        <button onClick={() => { if (!containerRef.current) return; const w = containerRef.current.clientWidth / 2; const h = containerRef.current.clientHeight / 2; const newS = Math.min(scale + 0.1, 2); const svgX = (w - panX) / scale; const svgY = (h - panY) / scale; setPanX(w - svgX * newS); setPanY(h - svgY * newS); setScale(newS); }} className="p-1.5 hover:bg-white/10 rounded text-white/70"><ZoomIn className="w-4 h-4" /></button>
        <span className="text-xs font-mono px-2 text-white/50 min-w-[40px] text-center">{Math.round(scale * 100)}%</span>
        <button onClick={() => { if (!containerRef.current) return; const w = containerRef.current.clientWidth / 2; const h = containerRef.current.clientHeight / 2; const newS = Math.max(scale - 0.1, 0.08); const svgX = (w - panX) / scale; const svgY = (h - panY) / scale; setPanX(w - svgX * newS); setPanY(h - svgY * newS); setScale(newS); }} className="p-1.5 hover:bg-white/10 rounded text-white/70"><ZoomOut className="w-4 h-4" /></button>
        <div className="w-px h-5 bg-white/10 mx-0.5" />
        <button onClick={() => setScale(0.15)} className="p-1 hover:bg-white/10 rounded text-[10px] text-white/50">15%</button>
        <button onClick={() => setScale(0.25)} className="p-1 hover:bg-white/10 rounded text-[10px] text-white/50">25%</button>
        <button onClick={() => setScale(0.5)} className="p-1 hover:bg-white/10 rounded text-[10px] text-white/50">50%</button>
        <button onClick={() => setScale(1)} className="p-1 hover:bg-white/10 rounded text-[10px] text-white/50">100%</button>
        <div className="w-px h-5 bg-white/10 mx-0.5" />
        <button onClick={fitAll} className="p-1.5 hover:bg-white/10 rounded text-white/70" title="Fit All"><Maximize2 className="w-3.5 h-3.5" /></button>
        <button onClick={recenter} className="p-1.5 hover:bg-white/10 rounded text-[10px] text-white/70" title="Recenter">⌂</button>
      </div>

      {/* Legend */}
      <div className="fixed bottom-4 left-4 z-50 bg-black/80 backdrop-blur border border-white/10 rounded-lg p-3 shadow-xl">
        <div className="text-[10px] text-white/50 mb-2 font-bold">RINGS</div>
        {RING_LABELS.slice(1).map((label, i) => (
          <div key={i} className="flex items-center gap-2 text-[9px] text-white/40">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: [SECTOR_COLORS[0], SECTOR_COLORS[1], SECTOR_COLORS[1], SECTOR_COLORS[1], '#22d3ee', '#06b6d4', '#ec4899', '#f472b6'][i] }} />
            <span>R{i + 1}: {label}</span>
          </div>
        ))}
        <div className="mt-2 text-[10px] text-white/50 font-bold">PORTALS</div>
        {['Student', 'CRM', 'University', 'Interview', 'Study', 'Public'].map((name, i) => (
          <div key={i} className="flex items-center gap-2 text-[9px] text-white/40">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#8892a4' }} />
            <span>{name}</span>
          </div>
        ))}
        <div className="mt-2 text-[9px] text-white/30">Hover any node for impact analysis</div>
        <div className="mt-3 border-t border-white/10 pt-2">
          <div className="text-[10px] text-white/50 font-bold mb-1">SYSTEM HEALTH</div>
          {[
            { color: '#22c55e', label: 'Healthy', count: healthSummary.green, status: 'green' as HealthStatus },
            { color: '#f59e0b', label: 'Needs attention', count: healthSummary.amber, status: 'amber' as HealthStatus },
            { color: '#ef4444', label: 'Has problems', count: healthSummary.red, status: 'red' as HealthStatus },
          ].map((item, i) => (
            <div
              key={i}
              onClick={() => toggleHealthFilter(item.status)}
              className={`flex items-center gap-2 text-[9px] cursor-pointer rounded px-1 py-0.5 transition-colors ${healthFilter.has(item.status)
                  ? 'bg-white/15 text-white/70'
                  : 'text-white/40 hover:bg-white/5'
                }`}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span>{item.label}</span>
              <span className="ml-auto font-mono">{item.count}</span>
            </div>
          ))}
          <div className="flex items-center gap-1 mt-1.5">
            <span className="text-[8px] text-white/25">
              {lastRefreshed ? `Updated ${lastRefreshed.toLocaleTimeString()}` : 'Loading...'}
            </span>
            <button
              onClick={refreshHealth}
              className="ml-auto p-0.5 hover:bg-white/10 rounded text-white/30 hover:text-white/60"
              title="Refresh health data"
            >
              <RefreshCw className={`w-2.5 h-2.5 ${healthLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Node count badge */}
      <div className="fixed top-4 left-4 z-50 bg-black/80 backdrop-blur border border-white/10 rounded-lg px-3 py-2 shadow-xl">
        <div className="text-[10px] text-white/50 font-mono flex items-center gap-2">
          <span>{allNodes.length} nodes · {allConnections.length} connections</span>
          {healthSummary.total > 0 && (
            <>
              <span className="text-white/20">|</span>
              <span className="text-[#22c55e]">{Math.round((healthSummary.green / healthSummary.total) * 100)}%</span>
              {healthSummary.red > 0 && (
                <span className="text-[#ef4444] animate-pulse">● {healthSummary.red}</span>
              )}
              {healthSummary.amber > 0 && (
                <span className="text-[#f59e0b]">● {healthSummary.amber}</span>
              )}
            </>
          )}
          {healthLoading && <RefreshCw className="w-3 h-3 text-white/30 animate-spin" />}
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        width={6000}
        height={6000}
        viewBox="0 0 6000 6000"
        onDoubleClick={(e) => { if (e.target === e.currentTarget) setLockedNode(null); }}
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Health cloud gradient definitions */}
        <defs>
          <radialGradient id="health-cloud-green">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0.05" />
          </radialGradient>
          <radialGradient id="health-cloud-amber">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.05" />
          </radialGradient>
          <radialGradient id="health-cloud-red">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0.05" />
          </radialGradient>
        </defs>

        {/* Per-node health clouds (behind everything) */}
        {healthCloudNodes
          .filter(cloud => healthFilter.size === 0 || healthFilter.has(cloud.status))
          .map(cloud => (
            <HealthCloud key={`cloud-${cloud.id}`} cx={cloud.x} cy={cloud.y} radius={cloud.radius} status={cloud.status} />
          ))}

        {/* Ring circles */}
        {RING_RADII.slice(1).map((r, i) => (
          <circle key={i} cx={CX} cy={CY} r={r} fill="none" stroke="white" strokeOpacity={0.06} strokeDasharray="8 6" />
        ))}

        {/* Ring labels */}
        {RING_LABELS.slice(1).map((label, i) => (
          <text key={i} x={CX + RING_RADII[i + 1] + 10} y={CY - 10} fill="white" fillOpacity={0.15} fontSize={14} fontFamily="system-ui">
            {label}
          </text>
        ))}

        {/* Connections */}
        {allConnections.map((conn, i) => {
          const from = positions.get(conn.from);
          const to = positions.get(conn.to);
          if (!from || !to) return null;

          const isHighlighted = highlightedNodes
            ? highlightedNodes.has(conn.from) && highlightedNodes.has(conn.to)
            : false;
          const fromHealth = nodeHealth.get(conn.from);
          const toHealth = nodeHealth.get(conn.to);
          const isConnHealthFiltered = healthFilter.size > 0 && (
            (!fromHealth || !healthFilter.has(fromHealth)) &&
            (!toHealth || !healthFilter.has(toHealth))
          );
          const isDimmed = (highlightedNodes ? !isHighlighted : false) || isConnHealthFiltered;

          return (
            <RadialConnectionSVG
              key={i}
              from={from}
              to={to}
              color={'#ffffff'}
              opacity={conn.opacity ?? 0.3}
              dashed={conn.dashed || false}
              highlighted={isHighlighted}
              dimmed={isDimmed}
            />
          );
        })}

        {/* Nodes */}
        {allNodes.map(node => {
          const pos = positions.get(node.id);
          if (!pos) return null;

          const isHighlighted = highlightedNodes ? highlightedNodes.has(node.id) : false;
          const nodeHealthStatus = nodeHealth.get(node.id);
          const isHealthFiltered = healthFilter.size > 0 &&
            (!nodeHealthStatus || !healthFilter.has(nodeHealthStatus));
          const isDimmed = (highlightedNodes ? !isHighlighted : false) || isHealthFiltered;

          return (
            <RadialNodeSVG
              key={node.id}
              node={node}
              x={pos.x}
              y={pos.y}
              highlighted={isHighlighted}
              dimmed={isDimmed}
              onHover={setHoveredNode}
              onDoubleClick={setLockedNode}
              onClick={setSelectedNodeId}
              healthStatus={nodeHealth.get(node.id)}
            />
          );
        })}
      </svg>

      {/* Node Info Panel */}
      <NodeInfoPanel
        node={selectedNode}
        onClose={() => setSelectedNodeId(null)}
        healthStatus={selectedNode ? nodeHealth.get(selectedNode.id) : undefined}
        healthMessage={selectedNode ? healthMessages.get(selectedNode.id) : undefined}
        connectionCount={selectedNodeConnectionCount}
      />
    </div>
  );
}
