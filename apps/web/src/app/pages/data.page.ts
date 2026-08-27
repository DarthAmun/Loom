import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  buildExportBundle,
  importBundle,
  parseExportBundle,
  type Entity,
  type ExportBundle,
  type ImportSummary,
} from 'loom';
import { EntityStoreService } from '../services/entity-store.service';
import { CharacterStoreService } from '../services/character-store.service';

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

@Component({
  selector: 'app-data',
  template: `
    <div style="padding:26px 30px 40px;max-width:1040px">
      <div class="name-serif" style="font:400 26px/1.1 var(--font-display);margin-bottom:5px">Import & Export</div>
      <div style="font:400 12.5px var(--font-sans);color:var(--text-muted);margin-bottom:24px">
        Move entities and characters as one portable JSON bundle — everything at once, or just the parts you pick.
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">
        <!-- Export -->
        <div class="card" style="padding:18px 20px;display:flex;flex-direction:column;gap:16px">
          <div class="eyebrow">export</div>

          <div style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <span style="font:500 12.5px var(--font-sans);color:var(--text)">Entities ({{ selectedEntityIds().size }}/{{ entityStore.entities().length }})</span>
              <span style="display:flex;gap:8px">
                <button type="button" class="link-btn" (click)="selectAllEntities()">all</button>
                <button type="button" class="link-btn" (click)="selectNoneEntities()">none</button>
              </span>
            </div>
            <div class="pick-list">
              @if (entityStore.entities().length === 0) {
                <div style="padding:10px;font:400 12px var(--font-sans);color:var(--text-dim)">No entities saved yet.</div>
              }
              @for (e of entityStore.entities(); track e.id) {
                <label class="pick-row">
                  <input type="checkbox" [checked]="selectedEntityIds().has(e.id)" (change)="toggleEntity(e.id)" />
                  <span style="font:400 12.5px var(--font-sans);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ e.name }}</span>
                  <span style="margin-left:auto;font:400 10.5px var(--font-mono);color:var(--text-faint)">{{ e.id }}</span>
                </label>
              }
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:8px">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <span style="font:500 12.5px var(--font-sans);color:var(--text)">Characters ({{ selectedCharacterIds().size }}/{{ characterStore.characters().length }})</span>
              <span style="display:flex;gap:8px">
                <button type="button" class="link-btn" (click)="selectAllCharacters()">all</button>
                <button type="button" class="link-btn" (click)="selectNoneCharacters()">none</button>
              </span>
            </div>
            <div class="pick-list">
              @if (characterStore.characters().length === 0) {
                <div style="padding:10px;font:400 12px var(--font-sans);color:var(--text-dim)">No characters saved yet.</div>
              }
              @for (c of characterStore.characters(); track c.id) {
                <label class="pick-row">
                  <input type="checkbox" [checked]="selectedCharacterIds().has(c.id!)" (change)="toggleCharacter(c.id!)" />
                  <span style="font:400 12.5px var(--font-sans)">{{ c.name }}</span>
                  <span style="margin-left:auto;font:400 10.5px var(--font-mono);color:var(--text-faint)">level {{ c.level }}</span>
                </label>
              }
            </div>
          </div>

          <button
            type="button"
            class="btn-primary"
            [disabled]="exporting() || (selectedEntityIds().size === 0 && selectedCharacterIds().size === 0)"
            (click)="exportSelected()"
          >
            {{ exporting() ? 'Building…' : 'Download JSON' }}
          </button>
        </div>

        <!-- Import -->
        <div class="card" style="padding:18px 20px;display:flex;flex-direction:column;gap:14px">
          <div class="eyebrow">import</div>

          <div style="display:flex;gap:9px;align-items:center">
            <label class="btn-ghost" style="cursor:pointer">
              Choose file…
              <input type="file" accept="application/json" style="display:none" (change)="onFileSelected($event)" />
            </label>
            <span style="font:400 11.5px var(--font-sans);color:var(--text-dim)">or paste a bundle below</span>
          </div>

          <textarea
            placeholder="paste exported JSON here…"
            [value]="importText()"
            (input)="importText.set($any($event.target).value)"
            class="import-textarea"
          ></textarea>

          <button type="button" class="btn-ghost" [disabled]="!importText().trim()" (click)="parse()">Parse</button>

          @if (parseError(); as err) {
            <div class="notice notice-error">{{ err }}</div>
          }

          @if (parsedBundle(); as bundle) {
            <div style="display:flex;flex-direction:column;gap:12px;border-top:1px solid var(--border-soft);padding-top:12px">
              <div style="font:400 11.5px var(--font-mono);color:var(--text-faint)">exported {{ bundle.exportedAt }}</div>

              <div style="display:flex;flex-direction:column;gap:8px">
                <div style="display:flex;align-items:center;justify-content:space-between">
                  <span style="font:500 12.5px var(--font-sans);color:var(--text)">
                    Entities ({{ selectedImportEntityIds().size }}/{{ bundle.entities.length }})
                  </span>
                  <span style="display:flex;gap:8px">
                    <button type="button" class="link-btn" (click)="selectAllImportEntities()">all</button>
                    <button type="button" class="link-btn" (click)="selectNoneImportEntities()">none</button>
                  </span>
                </div>
                <div class="pick-list">
                  @for (e of bundle.entities; track e.id) {
                    <label class="pick-row">
                      <input type="checkbox" [checked]="selectedImportEntityIds().has(e.id)" (change)="toggleImportEntity(e.id)" />
                      <span style="font:400 12.5px var(--font-sans);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ e.name }}</span>
                      @if (existingEntityIds().has(e.id)) {
                        <span class="chip" style="flex:none">overwrites existing</span>
                      }
                      <span style="margin-left:auto;font:400 10.5px var(--font-mono);color:var(--text-faint)">{{ e.id }}</span>
                    </label>
                  }
                </div>
              </div>

              <div style="display:flex;flex-direction:column;gap:8px">
                <div style="display:flex;align-items:center;justify-content:space-between">
                  <span style="font:500 12.5px var(--font-sans);color:var(--text)">
                    Characters ({{ selectedImportCharacterIndices().size }}/{{ bundle.characters.length }})
                  </span>
                  <span style="display:flex;gap:8px">
                    <button type="button" class="link-btn" (click)="selectAllImportCharacters()">all</button>
                    <button type="button" class="link-btn" (click)="selectNoneImportCharacters()">none</button>
                  </span>
                </div>
                <div class="pick-list">
                  @for (c of bundle.characters; track $index) {
                    <label class="pick-row">
                      <input type="checkbox" [checked]="selectedImportCharacterIndices().has($index)" (change)="toggleImportCharacter($index)" />
                      <span style="font:400 12.5px var(--font-sans)">{{ c.name }}</span>
                      <span style="margin-left:auto;font:400 10.5px var(--font-mono);color:var(--text-faint)">level {{ c.level }}</span>
                    </label>
                  }
                </div>
                <div style="font:400 11px var(--font-sans);color:var(--text-dim)">Characters always import as new records — nothing existing is overwritten.</div>
              </div>

              <button
                type="button"
                class="btn-primary"
                [disabled]="importing() || (selectedImportEntityIds().size === 0 && selectedImportCharacterIndices().size === 0)"
                (click)="confirmImport()"
              >
                {{ importing() ? 'Importing…' : 'Import selected' }}
              </button>
            </div>
          }

          @if (importSummary(); as summary) {
            <div class="notice notice-ok">Imported {{ summary.entitiesImported }} entities and {{ summary.charactersImported }} characters.</div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .pick-list {
      max-height: 220px;
      overflow-y: auto;
      border: 1px solid var(--border-strong);
      border-radius: 5px;
      background: var(--bg-panel-2);
      display: flex;
      flex-direction: column;
    }
    .pick-row {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 7px 10px;
      border-bottom: 1px solid var(--border-soft);
      cursor: pointer;
    }
    .pick-row:last-child {
      border-bottom: none;
    }
    .pick-row:hover {
      background: var(--bg-chip-hover);
    }
    .link-btn {
      background: none;
      border: none;
      color: var(--text-faint);
      font: 400 11.5px var(--font-sans);
      cursor: pointer;
      padding: 0;
      text-decoration: underline;
    }
    .link-btn:hover {
      color: var(--text);
    }
    .import-textarea {
      min-height: 140px;
      padding: 10px 12px;
      border: 1px solid var(--border-strong);
      border-radius: 5px;
      background: var(--bg-code);
      color: var(--text);
      font: 400 12px/1.6 var(--font-mono);
      resize: vertical;
    }
    .notice {
      padding: 9px 12px;
      border-radius: 5px;
      font: 400 12px/1.5 var(--font-sans);
      white-space: pre-wrap;
    }
    .notice-error {
      background: var(--warn-bg);
      color: var(--warn-text);
    }
    .notice-ok {
      background: var(--success-bg);
      color: var(--success-text);
    }
  `,
})
export default class DataPage implements OnInit {
  protected readonly entityStore = inject(EntityStoreService);
  protected readonly characterStore = inject(CharacterStoreService);

  protected readonly selectedEntityIds = signal<Set<string>>(new Set());
  protected readonly selectedCharacterIds = signal<Set<number>>(new Set());
  protected readonly exporting = signal(false);

  protected readonly importText = signal('');
  protected readonly parseError = signal<string | null>(null);
  protected readonly parsedBundle = signal<ExportBundle | null>(null);
  protected readonly selectedImportEntityIds = signal<Set<string>>(new Set());
  protected readonly selectedImportCharacterIndices = signal<Set<number>>(new Set());
  protected readonly importing = signal(false);
  protected readonly importSummary = signal<ImportSummary | null>(null);

  protected readonly existingEntityIds = computed(() => new Set(this.entityStore.entities().map((e: Entity) => e.id)));

  async ngOnInit(): Promise<void> {
    await Promise.all([this.entityStore.refresh(), this.characterStore.refresh()]);
    this.selectAllEntities();
    this.selectAllCharacters();
  }

  protected selectAllEntities(): void {
    this.selectedEntityIds.set(new Set(this.entityStore.entities().map((e) => e.id)));
  }
  protected selectNoneEntities(): void {
    this.selectedEntityIds.set(new Set());
  }
  protected toggleEntity(id: string): void {
    const next = new Set(this.selectedEntityIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedEntityIds.set(next);
  }

  protected selectAllCharacters(): void {
    this.selectedCharacterIds.set(new Set(this.characterStore.characters().map((c) => c.id!)));
  }
  protected selectNoneCharacters(): void {
    this.selectedCharacterIds.set(new Set());
  }
  protected toggleCharacter(id: number): void {
    const next = new Set(this.selectedCharacterIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedCharacterIds.set(next);
  }

  async exportSelected(): Promise<void> {
    this.exporting.set(true);
    try {
      const bundle = await buildExportBundle([...this.selectedEntityIds()], [...this.selectedCharacterIds()]);
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `loom-export-${todayStamp()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      this.exporting.set(false);
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.importText.set(await file.text());
    input.value = '';
    this.parse();
  }

  protected parse(): void {
    this.importSummary.set(null);
    this.parsedBundle.set(null);

    let json: unknown;
    try {
      json = JSON.parse(this.importText());
    } catch (error) {
      this.parseError.set(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    const result = parseExportBundle(json);
    if (!result.success) {
      this.parseError.set(result.error);
      return;
    }

    this.parseError.set(null);
    this.parsedBundle.set(result.data);
    this.selectedImportEntityIds.set(new Set(result.data.entities.map((e) => e.id)));
    this.selectedImportCharacterIndices.set(new Set(result.data.characters.map((_, i) => i)));
  }

  protected selectAllImportEntities(): void {
    const bundle = this.parsedBundle();
    if (bundle) this.selectedImportEntityIds.set(new Set(bundle.entities.map((e) => e.id)));
  }
  protected selectNoneImportEntities(): void {
    this.selectedImportEntityIds.set(new Set());
  }
  protected toggleImportEntity(id: string): void {
    const next = new Set(this.selectedImportEntityIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.selectedImportEntityIds.set(next);
  }

  protected selectAllImportCharacters(): void {
    const bundle = this.parsedBundle();
    if (bundle) this.selectedImportCharacterIndices.set(new Set(bundle.characters.map((_, i) => i)));
  }
  protected selectNoneImportCharacters(): void {
    this.selectedImportCharacterIndices.set(new Set());
  }
  protected toggleImportCharacter(index: number): void {
    const next = new Set(this.selectedImportCharacterIndices());
    if (next.has(index)) next.delete(index);
    else next.add(index);
    this.selectedImportCharacterIndices.set(next);
  }

  async confirmImport(): Promise<void> {
    const bundle = this.parsedBundle();
    if (!bundle) return;
    this.importing.set(true);
    try {
      const summary = await importBundle(bundle, {
        entityIds: [...this.selectedImportEntityIds()],
        characterIndices: [...this.selectedImportCharacterIndices()],
      });
      this.importSummary.set(summary);
      await Promise.all([this.entityStore.refresh(), this.characterStore.refresh()]);
      this.selectAllEntities();
      this.selectAllCharacters();
    } finally {
      this.importing.set(false);
    }
  }
}
