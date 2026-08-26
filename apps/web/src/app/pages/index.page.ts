import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EntityStoreService } from '../services/entity-store.service';
import { formatCost } from '../utils/format-cost';

@Component({
  selector: 'app-entity-list',
  imports: [RouterLink],
  template: `
    <div class="mx-auto max-w-3xl p-6">
      <header class="mb-6 flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold">Loom — Entities</h1>
          <p class="text-sm text-gray-500">
            Paste externally-drafted Entity JSON, review it, and save.
          </p>
        </div>
        <div class="flex gap-2">
          @if (store.entities().length === 0) {
            <button
              type="button"
              class="rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
              (click)="store.seedDraftData()"
            >
              Load draft data
            </button>
          }
          <a
            routerLink="/entities/new"
            class="rounded bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700"
          >
            New Entity
          </a>
        </div>
      </header>

      @if (store.loading()) {
        <p class="text-sm text-gray-500">Loading…</p>
      } @else if (store.entities().length === 0) {
        <p class="text-sm text-gray-500">
          No entities yet — paste some JSON with "New Entity", or load Phase
          0's draft mechanics to have something to look at.
        </p>
      } @else {
        <ul class="divide-y rounded border">
          @for (entity of store.entities(); track entity.id) {
            <li>
              <a
                [routerLink]="['/entities', entity.id]"
                class="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50"
              >
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-medium">{{ entity.name }}</span>
                    <span class="text-xs text-gray-400">{{ entity.id }}</span>
                  </div>
                  @if (entity.tags.length > 0) {
                    <div class="mt-1 flex flex-wrap gap-1">
                      @for (tag of entity.tags; track tag) {
                        <span class="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{{ tag }}</span>
                      }
                    </div>
                  }
                </div>
                <span class="shrink-0 text-xs text-gray-500">{{ formatCost(entity.cost) }}</span>
              </a>
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export default class EntityListPage implements OnInit {
  protected readonly store = inject(EntityStoreService);
  protected readonly formatCost = formatCost;

  ngOnInit(): void {
    void this.store.refresh();
  }
}
