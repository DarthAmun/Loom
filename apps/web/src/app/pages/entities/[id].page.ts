import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { safeParseEntity, type EntityParseResult } from 'loom';
import { EntityStoreService } from '../../services/entity-store.service';

const BLANK_ENTITY_TEMPLATE = {
  id: '',
  name: '',
  tags: [],
  prerequisites: [],
  conflicts: [],
  cost: { type: 'actions', count: 1 },
  effects: [],
};

type ParseOutcome = EntityParseResult | { success: false; error: string };

function parseJsonText(text: string): ParseOutcome {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    return { success: false, error: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}` };
  }
  return safeParseEntity(json);
}

@Component({
  selector: 'app-entity-editor',
  imports: [RouterLink],
  template: `
    <div class="mx-auto max-w-3xl p-6">
      <header class="mb-4 flex items-center justify-between">
        <a routerLink="/" class="text-sm text-gray-500 hover:underline">← Entities</a>
        @if (!isNew()) {
          <button
            type="button"
            class="rounded border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
            (click)="delete()"
          >
            Delete
          </button>
        }
      </header>

      <h1 class="mb-1 text-xl font-semibold">
        {{ isNew() ? 'New Entity' : originalId() }}
      </h1>
      <p class="mb-4 text-sm text-gray-500">
        Review and edit the JSON below, then save. Generate the draft
        elsewhere and paste it here — this isn't a generator.
      </p>

      <textarea
        class="h-96 w-full rounded border p-3 font-mono text-sm"
        spellcheck="false"
        [value]="jsonText()"
        (input)="jsonText.set($any($event.target).value)"
      ></textarea>

      <div class="mt-3">
        @if (outcome(); as result) {
          @if (result.success) {
            <div class="rounded border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
              Valid — "{{ result.data.name }}" ({{ result.data.id }})
            </div>
          } @else {
            <pre class="whitespace-pre-wrap rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{{ result.error }}</pre>
          }
        }
      </div>

      <div class="mt-4 flex gap-2">
        <button
          type="button"
          class="rounded bg-gray-900 px-4 py-1.5 text-sm text-white hover:bg-gray-700 disabled:opacity-40"
          [disabled]="!outcome().success"
          (click)="save()"
        >
          Save
        </button>
        <a routerLink="/" class="rounded border px-4 py-1.5 text-sm hover:bg-gray-50">Cancel</a>
      </div>
    </div>
  `,
})
export default class EntityEditorPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly store = inject(EntityStoreService);

  // Angular reuses this component instance across /entities/new ->
  // /entities/:id navigations (same route config, different param) — a
  // one-shot ngOnInit read of the id would go stale right after Save
  // navigates to the newly-created entity's URL. Reading the param as a
  // signal and reacting to it in an effect keeps isNew/originalId/jsonText
  // correct across those in-place navigations, not just on first load.
  private readonly idParam = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  protected readonly isNew = signal(true);
  protected readonly originalId = signal<string | null>(null);

  protected readonly jsonText = signal('');
  protected readonly outcome = computed<ParseOutcome>(() => parseJsonText(this.jsonText()));

  constructor() {
    effect(() => {
      void this.loadForId(this.idParam().get('id'));
    });
  }

  private async loadForId(id: string | null): Promise<void> {
    if (!id || id === 'new') {
      this.isNew.set(true);
      this.originalId.set(null);
      this.jsonText.set(JSON.stringify(BLANK_ENTITY_TEMPLATE, null, 2));
      return;
    }

    this.isNew.set(false);
    this.originalId.set(id);
    const existing = await this.store.get(id);
    this.jsonText.set(existing ? JSON.stringify(existing, null, 2) : `// "${id}" was not found — it may have been deleted.`);
  }

  async save(): Promise<void> {
    const result = this.outcome();
    if (!result.success) return;

    await this.store.save(result.data);

    // A rename (id changed while editing an existing entity) would
    // otherwise leave the old row behind as an orphaned duplicate.
    const previousId = this.originalId();
    if (previousId && previousId !== result.data.id) {
      await this.store.remove(previousId);
    }

    await this.router.navigate(['/entities', result.data.id]);
  }

  async delete(): Promise<void> {
    const id = this.originalId();
    if (this.isNew() || !id) return;
    if (!confirm(`Delete "${id}"?`)) return;
    await this.store.remove(id);
    await this.router.navigate(['/']);
  }
}
