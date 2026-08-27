import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { EntityStoreService } from './services/entity-store.service';
import { groupBySource } from './utils/entity-summary';

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
          <a routerLink="/provenance" routerLinkActive="nav-active" class="nav-link">
            <span class="nav-dot"></span>Provenance
          </a>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          <div class="eyebrow">sources</div>
          <div style="display:flex;flex-direction:column;gap:5px;font:400 12px/1.5 var(--font-sans);color:var(--text-muted)">
            @for (g of sourceGroups(); track g.source) {
              <div style="display:flex;align-items:center;gap:8px">
                <span style="width:3px;height:13px" [style.background]="g.color"></span>
                {{ g.source }}
                <span style="margin-left:auto;font:400 11px var(--font-mono);color:var(--text-dim)">{{ g.entities.length }}</span>
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

  protected readonly sourceGroups = computed(() => groupBySource(this.store.entities()));

  ngOnInit(): void {
    void this.store.refresh();
  }
}
