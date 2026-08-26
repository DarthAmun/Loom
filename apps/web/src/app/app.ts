import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { EntityStoreService } from './services/entity-store.service';
import { sourceColor, sourceOf } from './utils/entity-summary';

interface SourceCount {
  source: string;
  count: number;
  color: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div style="display:grid;grid-template-columns:216px 1fr;min-height:100vh">
      <nav
        style="border-right:1px solid var(--border);padding:22px 18px;display:flex;flex-direction:column;gap:26px;background:var(--bg-sidebar)"
      >
        <div style="display:flex;flex-direction:column;gap:3px">
          <div class="name-serif" style="font:400 27px/1 var(--font-display);letter-spacing:-0.01em;color:var(--text)">loom</div>
          <div class="eyebrow">system builder</div>
        </div>

        <div style="display:flex;flex-direction:column;gap:2px">
          <a
            routerLink="/"
            routerLinkActive="nav-active"
            [routerLinkActiveOptions]="{ exact: true }"
            class="nav-link"
          >
            <span class="nav-dot" [style.background]="'var(--accent)'"></span>Entities
            <span class="nav-count">{{ store.entities().length }}</span>
          </a>
          <a routerLink="/characters" routerLinkActive="nav-active" class="nav-link">
            <span class="nav-dot"></span>Characters
          </a>
          <a routerLink="/graph" routerLinkActive="nav-active" class="nav-link">
            <span class="nav-dot"></span>Graph
          </a>
          <span class="nav-link" style="opacity:.45;cursor:default">
            <span class="nav-dot"></span>Provenance
            <span class="nav-count">soon</span>
          </span>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          <div class="eyebrow">sources</div>
          <div style="display:flex;flex-direction:column;gap:5px;font:400 12px/1.5 var(--font-sans);color:var(--text-muted)">
            @for (s of sourceCounts(); track s.source) {
              <div style="display:flex;align-items:center;gap:8px">
                <span style="width:3px;height:13px" [style.background]="s.color"></span>
                {{ s.source }}
                <span style="margin-left:auto;font:400 11px var(--font-mono);color:var(--text-dim)">{{ s.count }}</span>
              </div>
            }
          </div>
        </div>

        <div style="margin-top:auto;font:400 10.5px/1.6 var(--font-mono);color:var(--text-dim)">
          local · indexeddb
        </div>
      </nav>

      <main style="min-width:0">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    .nav-link {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 8px 10px;
      border-radius: 5px;
      font: 400 13px/1 var(--font-sans);
      color: var(--text-muted);
      text-decoration: none;
    }
    .nav-link.nav-active {
      background: var(--bg-chip-hover);
      font-weight: 500;
      color: var(--text);
    }
    .nav-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--text-dim);
    }
    .nav-count {
      margin-left: auto;
      font: 400 11px var(--font-mono);
      color: var(--text-faint);
    }
  `,
})
export class App implements OnInit {
  protected readonly store = inject(EntityStoreService);

  protected readonly sourceCounts = computed<SourceCount[]>(() => {
    const counts = new Map<string, number>();
    for (const entity of this.store.entities()) {
      const source = sourceOf(entity);
      counts.set(source, (counts.get(source) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort(([a], [b]) => (a === 'core' ? -1 : b === 'core' ? 1 : a.localeCompare(b)))
      .map(([source, count]) => ({ source, count, color: sourceColor(source) }));
  });

  ngOnInit(): void {
    void this.store.refresh();
  }
}
