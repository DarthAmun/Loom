import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EntityStoreService } from '../services/entity-store.service';
import { costBadge, costLabel, describeEntity, relationshipKind } from '../utils/entity-summary';
import type { Entity } from 'loom';

interface FilterOption {
  key: string;
  label: string;
}

function topTags(entities: readonly Entity[], limit: number): string[] {
  const counts = new Map<string, number>();
  for (const entity of entities) {
    for (const tag of entity.tags) {
      if (tag.startsWith('source:')) continue;
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}

function matchesFilter(entity: Entity, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === 'has:trigger') return !!entity.trigger;
  if (filter === 'has:hook') return !!entity.hooks?.length;
  return entity.tags.includes(filter);
}

@Component({
  selector: 'app-entity-list',
  imports: [RouterLink],
  template: `
    <div style="padding:26px 30px 30px">
      <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:20px">
        <div style="display:flex;flex-direction:column;gap:5px">
          <div class="name-serif" style="font:400 26px/1.1 var(--font-display)">Entities</div>
          <div style="font:400 12.5px/1.4 var(--font-sans);color:var(--text-muted)">
            {{ store.entities().length }} saved · {{ triggerCount() }} with triggers · {{ wrapCount() }} wrapping another entity
          </div>
        </div>
        <div style="display:flex;gap:9px;align-items:center">
          <div style="display:flex;align-items:center;gap:8px;padding:7px 11px;border:1px solid var(--border-strong);border-radius:5px;background:var(--bg-panel);width:210px">
            <span style="width:9px;height:9px;border:1.5px solid var(--text-faint);border-radius:50%"></span>
            <input
              type="text"
              placeholder="name, id, tag…"
              [value]="query()"
              (input)="query.set($any($event.target).value)"
              style="border:none;background:transparent;outline:none;font:400 12px var(--font-mono);color:var(--text);width:100%"
            />
          </div>
          <a routerLink="/entities/new" class="btn-primary" style="text-decoration:none">New Entity</a>
        </div>
      </div>

      @if (store.entities().length === 0) {
        <div style="padding:14px 0">
          <button type="button" class="btn-ghost" (click)="store.seedDraftData()">Load draft data</button>
          <p style="margin-top:12px;font:400 12.5px var(--font-sans);color:var(--text-muted)">
            No entities yet — paste JSON with "New Entity", or load Phase 0's draft mechanics to have something to look at.
          </p>
        </div>
      } @else {
        <div style="display:flex;gap:7px;margin-bottom:18px;flex-wrap:wrap">
          @for (opt of filterOptions(); track opt.key) {
            <button
              type="button"
              class="pill"
              [class.active]="filter() === opt.key"
              (click)="filter.set(opt.key)"
            >
              {{ opt.label }}
            </button>
          }
        </div>

        <div style="display:flex;flex-direction:column;border-top:1px solid var(--border-soft)">
          @for (entity of filteredEntities(); track entity.id) {
            <a
              [routerLink]="['/entities', entity.id]"
              class="entity-row"
              [class.wrap-row]="relationshipKind(entity) === 'wraps'"
            >
              <div style="display:flex;justify-content:center">
                <span
                  class="cost-badge"
                  [class.cost-badge-fill]="entity.cost.type === 'actions'"
                  [class.cost-badge-wrap]="relationshipKind(entity) === 'wraps'"
                >{{ costBadge(entity) }}</span>
              </div>
              <div style="display:flex;flex-direction:column;gap:4px;min-width:0">
                <div style="display:flex;align-items:baseline;gap:10px">
                  <span class="name-serif" style="font:500 18px/1.1 var(--font-display)">{{ entity.name }}</span>
                  <span style="font:400 11px var(--font-mono);color:var(--text-faint)">{{ entity.id }}</span>
                </div>
                <div style="font:400 11.5px/1.4 var(--font-sans);color:var(--text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                  {{ describeEntity(entity, store.entities()) }}
                </div>
              </div>
              <div style="display:flex;gap:5px;flex-wrap:wrap;align-content:flex-start">
                @for (tag of entity.tags.slice(0, 3); track tag) {
                  <span class="chip" [class.chip-accent]="tag.startsWith('source:')">{{ tag }}</span>
                }
              </div>
              <div style="font:400 11.5px var(--font-mono);color:var(--text-faint);text-align:right">{{ costLabel(entity.cost) }}</div>
            </a>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .entity-row {
      display: grid;
      grid-template-columns: 44px 1fr 240px 92px;
      align-items: center;
      gap: 16px;
      padding: 14px 12px;
      border-bottom: 1px solid var(--border-soft);
      text-decoration: none;
      color: inherit;
    }
    .entity-row:hover {
      background: var(--bg-panel);
    }
    .wrap-row {
      border-left: 2px solid var(--wrap);
      opacity: 0.9;
    }
    .cost-badge {
      width: 22px;
      height: 22px;
      border-radius: 3px;
      border: 1px solid var(--border-strong);
      color: var(--text-muted);
      font: 500 10px/22px var(--font-mono);
      text-align: center;
    }
    .cost-badge-fill {
      background: var(--accent);
      border-color: var(--accent);
      color: var(--accent-ink);
      font-weight: 600;
      font-size: 12px;
    }
    .cost-badge-wrap {
      border-color: var(--wrap);
      color: var(--wrap-soft-text);
    }
  `,
})
export default class EntityListPage {
  protected readonly store = inject(EntityStoreService);
  protected readonly costBadge = costBadge;
  protected readonly costLabel = costLabel;
  protected readonly describeEntity = describeEntity;
  protected readonly relationshipKind = relationshipKind;

  protected readonly query = signal('');
  protected readonly filter = signal('all');

  protected readonly triggerCount = computed(() => this.store.entities().filter((e) => e.trigger).length);
  protected readonly wrapCount = computed(() => this.store.entities().filter((e) => e.wraps).length);

  protected readonly filterOptions = computed<FilterOption[]>(() => [
    { key: 'all', label: 'all' },
    ...topTags(this.store.entities(), 4).map((tag) => ({ key: tag, label: tag })),
    { key: 'has:trigger', label: 'has:trigger' },
    { key: 'has:hook', label: 'has:hook' },
  ]);

  protected readonly filteredEntities = computed(() => {
    const q = this.query().trim().toLowerCase();
    const f = this.filter();
    return this.store
      .entities()
      .filter((e) => matchesFilter(e, f))
      .filter((e) => !q || e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q)));
  });
}
