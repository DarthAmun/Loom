import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EntityStoreService } from '../services/entity-store.service';
import { costLabel, RELATIONSHIP_COLOR } from '../utils/entity-summary';
import { computeEdges, computeGraphNodes, type GraphColumn, type GraphNode } from '../utils/graph';

const COLUMN_X: Record<GraphColumn, number> = { core: 40, mid: 400, packages: 760 };
const COLUMN_LABEL: Record<GraphColumn, string> = { core: 'core', mid: 'wraps / listeners', packages: 'packages / invented' };
const CARD_WIDTH = 190;
const CARD_HEIGHT = 54;
const ROW_HEIGHT = 78;
const TOP_PADDING = 46;

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

interface PositionedEdge {
  path: string;
  color: string;
  dashed: boolean;
  resolved: boolean;
  from: string;
  to: string;
}

@Component({
  selector: 'app-graph',
  imports: [RouterLink],
  template: `
    <div style="padding:26px 30px 30px">
      <div style="display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:20px;gap:20px">
        <div style="display:flex;flex-direction:column;gap:4px">
          <div class="name-serif" style="font:400 26px/1.1 var(--font-display)">Graph</div>
          <div style="font:400 12.5px var(--font-sans);color:var(--text-muted)">
            {{ store.entities().length }} entities · {{ edges().length }} references
            @if (unresolved().length) {
              · {{ unresolved().length }} unresolved
            }
          </div>
        </div>
        <div style="display:flex;gap:18px;font:400 11.5px var(--font-sans);color:var(--text-muted);align-items:center">
          <span style="display:flex;align-items:center;gap:6px"><span style="width:18px;height:2px;background:var(--wrap)"></span>wraps</span>
          <span style="display:flex;align-items:center;gap:6px"><span class="dash-swatch"></span>trigger</span>
          <span style="display:flex;align-items:center;gap:6px"><span style="width:18px;height:2px;background:var(--hook)"></span>hook</span>
          <span style="display:flex;align-items:center;gap:6px"><span style="width:18px;height:2px;background:var(--applies)"></span>applies</span>
        </div>
      </div>

      @if (nodes().length === 0) {
        <p style="font:400 12.5px var(--font-sans);color:var(--text-dim)">
          No computed relationships yet — wraps, strike-related triggers/hooks, and applyEntity effects show up here once entities reference each other.
        </p>
      } @else {
        <div class="graph-scroll">
          <div class="graph-canvas" [style.height.px]="canvasHeight()" style="width:1050px">
            <svg [attr.width]="1050" [attr.height]="canvasHeight()" style="position:absolute;inset:0">
              @for (edge of positionedEdges(); track edge.path) {
                <path [attr.d]="edge.path" fill="none" [attr.stroke]="edge.color" stroke-width="1.6" [attr.stroke-dasharray]="edge.dashed ? '5 4' : null" [attr.opacity]="edge.resolved ? 1 : 0.4" />
              }
            </svg>

            @for (col of columns; track col) {
              <div class="col-label" [style.left.px]="colLeft(col)">{{ COLUMN_LABEL[col] }}</div>
            }

            @for (node of positionedNodes(); track node.entity.id) {
              <a
                [routerLink]="['/entities', node.entity.id]"
                class="graph-node"
                [style.left.px]="node.x"
                [style.top.px]="node.y"
                [style.width.px]="cardWidth"
                [class.graph-node-core]="node.column === 'core'"
              >
                <span class="name-serif" style="font:500 15px/1.1 var(--font-display)">{{ node.entity.name }}</span>
                <span style="font:400 10px var(--font-mono);color:var(--text-faint)">{{ node.entity.id }} · {{ costLabel(node.entity.cost) }}</span>
              </a>
            }
          </div>
        </div>

        @if (unresolved().length) {
          <div class="unresolved-banner">
            <span class="unresolved-dot"></span>
            {{ unresolved().length }} reference{{ unresolved().length === 1 ? '' : 's' }} point{{ unresolved().length === 1 ? 's' : '' }} at a missing id:
            @for (edge of unresolved(); track edge.to; let last = $last) {
              <span class="mono-strong">{{ edge.to }}</span>{{ last ? '' : ', ' }}
            }
          </div>
        }
      }
    </div>
  `,
  styles: `
    .graph-scroll {
      overflow-x: auto;
      background: var(--bg-code);
      border: 1px solid var(--border);
      border-radius: 6px;
    }
    .graph-canvas {
      position: relative;
    }
    .col-label {
      position: absolute;
      top: 14px;
      font: 500 9.5px var(--font-mono);
      letter-spacing: 0.13em;
      text-transform: uppercase;
      color: var(--text-dim);
    }
    .graph-node {
      position: absolute;
      background: var(--bg-panel);
      border: 1px solid var(--border-strong);
      border-radius: 5px;
      padding: 9px 11px;
      display: flex;
      flex-direction: column;
      gap: 3px;
      text-decoration: none;
      color: var(--text);
    }
    .graph-node:hover {
      border-color: var(--accent);
    }
    .graph-node-core {
      border-color: var(--accent);
    }
    .dash-swatch {
      width: 18px;
      height: 0;
      border-top: 2px dashed var(--accent);
    }
    .unresolved-banner {
      margin-top: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 9px 13px;
      border-radius: 5px;
      background: var(--warn-bg);
      font: 400 12px var(--font-sans);
      color: var(--warn-text);
    }
    .unresolved-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      flex: none;
    }
    .mono-strong {
      font: 500 11.5px var(--font-mono);
    }
  `,
})
export default class GraphPage implements OnInit {
  protected readonly store = inject(EntityStoreService);
  protected readonly costLabel = costLabel;
  protected readonly COLUMN_LABEL = COLUMN_LABEL;
  protected readonly cardWidth = CARD_WIDTH;
  protected readonly columns: GraphColumn[] = ['core', 'mid', 'packages'];

  protected readonly edges = computed(() => computeEdges(this.store.entities()));
  protected readonly unresolved = computed(() => this.edges().filter((e) => !e.resolved));
  protected readonly nodes = computed<GraphNode[]>(() => computeGraphNodes(this.store.entities(), this.edges()));

  private readonly rowsByColumn = computed(() => {
    const grouped: Record<GraphColumn, GraphNode[]> = { core: [], mid: [], packages: [] };
    for (const node of [...this.nodes()].sort((a, b) => a.entity.id.localeCompare(b.entity.id))) {
      grouped[node.column].push(node);
    }
    return grouped;
  });

  protected readonly canvasHeight = computed(() => {
    const rows = this.rowsByColumn();
    const maxRows = Math.max(1, rows.core.length, rows.mid.length, rows.packages.length);
    return TOP_PADDING + maxRows * ROW_HEIGHT + 20;
  });

  protected readonly positionedNodes = computed<PositionedNode[]>(() => {
    const rows = this.rowsByColumn();
    const positioned: PositionedNode[] = [];
    for (const col of this.columns) {
      rows[col].forEach((node, i) => {
        positioned.push({ ...node, x: COLUMN_X[col], y: TOP_PADDING + i * ROW_HEIGHT });
      });
    }
    return positioned;
  });

  protected readonly positionedEdges = computed<PositionedEdge[]>(() => {
    const byId = new Map(this.positionedNodes().map((n) => [n.entity.id, n]));
    const out: PositionedEdge[] = [];
    for (const edge of this.edges()) {
      const from = byId.get(edge.from);
      const to = edge.resolved ? byId.get(edge.to) : undefined;
      if (!from || !to) continue; // unresolved edges have no target node to draw to — surfaced via the banner instead
      const x1 = from.x + CARD_WIDTH;
      const y1 = from.y + CARD_HEIGHT / 2;
      const x2 = to.x;
      const y2 = to.y + CARD_HEIGHT / 2;
      const midX = (x1 + x2) / 2;
      out.push({
        path: `M${x1} ${y1} C${midX} ${y1} ${midX} ${y2} ${x2} ${y2}`,
        color: RELATIONSHIP_COLOR[edge.kind],
        dashed: edge.kind === 'trigger',
        resolved: edge.resolved,
        from: edge.from,
        to: edge.to,
      });
    }
    return out;
  });

  colLeft(col: GraphColumn): number {
    return COLUMN_X[col];
  }

  ngOnInit(): void {
    void this.store.refresh();
  }
}
