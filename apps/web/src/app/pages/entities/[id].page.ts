import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { safeParseEntity, type Entity, type EntityParseResult } from 'loom';
import { EntityStoreService } from '../../services/entity-store.service';
import { conditionSummary, costLabel, describeEffect, prereqConflictSummary, relatedItems, scalingChartFor } from '../../utils/entity-summary';

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
    <div style="display:flex;flex-direction:column;min-height:100vh">
      <header style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 24px;border-bottom:1px solid var(--border);background:var(--bg-sidebar)">
        <div style="display:flex;align-items:baseline;gap:14px;min-width:0">
          <a routerLink="/" style="font:400 12px var(--font-sans);color:var(--text-faint);text-decoration:none">Entities /</a>
          <span class="name-serif" style="font:500 20px/1 var(--font-display);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ headerName() }}</span>
          @if (!isNew()) {
            <span style="font:400 11px var(--font-mono);color:var(--text-faint)">{{ originalId() }}</span>
          }
        </div>
        <div style="display:flex;align-items:center;gap:10px;flex:none">
          <span class="status-pill" [class.status-valid]="outcome().success" [class.status-invalid]="!outcome().success">
            <span class="status-dot"></span>
            {{ outcome().success ? (hasUnsavedChanges() ? 'Valid · unsaved changes' : 'Valid · saved') : 'Invalid' }}
          </span>
          @if (!isNew()) {
            <button type="button" class="btn-ghost" (click)="discard()">Discard</button>
            <button type="button" class="btn-ghost btn-danger" (click)="delete()">Delete</button>
          }
          <button type="button" class="btn-primary" [disabled]="!outcome().success" (click)="save()">Save</button>
        </div>
      </header>

      <div style="display:grid;grid-template-columns:1fr 1fr;flex:1;min-height:0">
        <div style="border-right:1px solid var(--border);display:flex;flex-direction:column;min-height:0;background:var(--bg-code)">
          <div class="panel-header">
            <span>entity.json</span>
            <span class="panel-header-meta">
              <button type="button" class="link-btn" [disabled]="!outcome().success" (click)="formatJson()">format</button>
              · <button type="button" class="link-btn" (click)="copyJson()">{{ copied() ? 'copied' : 'copy' }}</button>
              · {{ lineCount() }} lines
            </span>
          </div>
          <div class="code-area">
            <div class="line-gutter" #gutter>
              @for (n of lineNumbers(); track n) {
                <div>{{ n }}</div>
              }
            </div>
            <textarea
              #ta
              class="code-textarea"
              spellcheck="false"
              [value]="jsonText()"
              (input)="onTextareaChange($any($event.target))"
              (click)="onCursorMove($any($event.target))"
              (keyup)="onCursorMove($any($event.target))"
              (scroll)="gutter.scrollTop = ta.scrollTop"
            ></textarea>
          </div>
          <div class="code-footer">
            <span class="code-footer-line">line {{ cursorLine() }}</span>
            @if (outcome(); as result) {
              @if (!result.success) {
                <span class="code-footer-msg">{{ result.error }}</span>
              }
            }
          </div>
        </div>

        <div style="display:flex;flex-direction:column;background:var(--bg-panel);overflow:auto">
          <div class="panel-header">
            <span>reads as</span>
            <span class="panel-header-meta">live from the JSON</span>
          </div>

          @if (validEntity(); as e) {
            <div style="padding:20px 22px;display:flex;flex-direction:column;gap:18px">
              <div style="display:flex;align-items:baseline;gap:10px">
                <span class="name-serif" style="font:500 25px/1.1 var(--font-display)">{{ e.name }}</span>
                <span class="chip" style="border:1px solid var(--border-strong);background:transparent">{{ costLabel(e.cost) }}</span>
              </div>

              @if (e.trigger) {
                <div class="read-section">
                  <div class="eyebrow">fires when</div>
                  <div class="read-box">
                    <div class="read-line"><span class="read-dot" style="background:var(--accent)"></span>the bus emits <span class="mono-accent">{{ e.trigger.event }}</span></div>
                    @for (c of e.condition ?? []; track $index) {
                      <div class="read-line" style="padding-left:16px"><span class="read-and">and</span> {{ conditionSummary(c) }}</div>
                    }
                  </div>
                </div>
              }

              @if (e.effects.length) {
                <div class="read-section">
                  <div class="eyebrow">then</div>
                  <div class="read-box" style="gap:12px">
                    @for (eff of e.effects; track $index) {
                      <div style="font:400 13px/1.4 var(--font-sans)">{{ describeEffect(eff) }}</div>
                    }
                    @if (chart(); as points) {
                      <div style="display:flex;gap:0;align-items:flex-end;min-height:96px">
                        @for (p of points; track p.x) {
                          <div style="display:flex;flex-direction:column;align-items:center;gap:5px;width:56px">
                            <span style="font:400 11px var(--font-mono);color:var(--text-muted)">{{ p.y >= 0 ? '+' : '' }}{{ p.y }}</span>
                            <span [style.height.px]="barHeight(p.y)" style="width:26px;background:var(--accent);display:block;border-radius:2px 2px 0 0"></span>
                            <span style="font:400 10px var(--font-mono);color:var(--text-dim)">{{ p.x }}</span>
                          </div>
                        }
                      </div>
                    }
                  </div>
                </div>
              }

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
                <div class="read-section">
                  <div class="eyebrow">prerequisites · conflicts</div>
                  <div style="font:400 12.5px/1.6 var(--font-sans);color:var(--text-muted)">{{ prereqConflictSummary(e) }}</div>
                </div>
                <div class="read-section">
                  <div class="eyebrow">tags</div>
                  <div style="display:flex;gap:5px;flex-wrap:wrap">
                    @for (tag of e.tags; track tag) {
                      <span class="chip" [class.chip-accent]="tag.startsWith('source:')">{{ tag }}</span>
                    }
                  </div>
                </div>
              </div>

              @if (related().length) {
                <div class="read-section">
                  <div class="eyebrow">related</div>
                  <div style="display:flex;flex-direction:column;gap:6px">
                    @for (r of related(); track r.id + r.label) {
                      <a [routerLink]="['/entities', r.id]" class="related-row">
                        <span style="font:500 10px var(--font-mono);color:var(--text-faint);width:74px;flex:none">{{ r.label }}</span>
                        <span class="name-serif" style="font:500 14px/1 var(--font-display)">{{ r.name }}</span>
                        <span style="font:400 10.5px var(--font-mono);color:var(--text-faint)">{{ r.sub || r.id }}</span>
                      </a>
                    }
                  </div>
                </div>
              }
            </div>
          } @else {
            <div style="padding:20px 22px;font:400 12.5px var(--font-sans);color:var(--text-dim)">Fix the JSON to see a readable preview.</div>
          }
        </div>
      </div>
    </div>
  `,
  styles: `
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 9px 18px;
      border-bottom: 1px solid var(--border-soft);
      font: 500 9.5px var(--font-mono);
      letter-spacing: 0.13em;
      text-transform: uppercase;
      color: var(--text-faint);
    }
    .panel-header-meta {
      text-transform: none;
      letter-spacing: 0;
      font-weight: 400;
    }
    .link-btn {
      background: none;
      border: none;
      color: var(--text-faint);
      font: inherit;
      cursor: pointer;
      padding: 0;
    }
    .link-btn:hover {
      color: var(--text);
    }
    .link-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .code-area {
      display: grid;
      grid-template-columns: 40px 1fr;
      flex: 1;
      min-height: 0;
      font: 400 12.5px/1.85 var(--font-mono);
    }
    .line-gutter {
      text-align: right;
      padding: 14px 8px 14px 0;
      color: var(--text-dim);
      border-right: 1px solid var(--border-soft);
      overflow: hidden;
    }
    .code-textarea {
      padding: 14px 16px;
      white-space: pre;
      color: oklch(0.78 0.01 80);
      background: transparent;
      border: none;
      outline: none;
      resize: none;
      font: inherit;
      overflow: auto;
    }
    .code-footer {
      border-top: 1px solid var(--border-soft);
      padding: 10px 18px;
      background: var(--bg-panel-2);
      display: flex;
      gap: 10px;
      align-items: baseline;
    }
    .code-footer-line {
      font: 500 10.5px var(--font-mono);
      color: var(--gold);
      flex: none;
    }
    .code-footer-msg {
      font: 400 11.5px/1.5 var(--font-sans);
      color: var(--text-muted);
      white-space: pre-wrap;
    }
    .status-pill {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 5px 10px;
      border-radius: 100px;
      font: 500 11.5px var(--font-sans);
    }
    .status-valid {
      background: var(--success-bg);
      color: var(--success-text);
    }
    .status-invalid {
      background: var(--warn-bg);
      color: var(--warn-text);
    }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }
    .read-section {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .read-box {
      background: var(--bg-panel-2);
      border: 1px solid var(--border-strong);
      border-radius: 5px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .read-line {
      display: flex;
      align-items: center;
      gap: 9px;
      font: 400 13px/1.4 var(--font-sans);
    }
    .read-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex: none;
    }
    .read-and {
      font: 400 12px var(--font-mono);
      color: var(--text-faint);
    }
    .mono-accent {
      font: 500 12.5px var(--font-mono);
      color: var(--accent-soft-text);
    }
    .related-row {
      display: flex;
      align-items: center;
      gap: 10px;
      background: var(--bg-panel-2);
      border: 1px solid var(--border-strong);
      border-radius: 5px;
      padding: 9px 12px;
      text-decoration: none;
      color: var(--text);
    }
    .related-row:hover {
      border-color: var(--accent);
    }
  `,
})
export default class EntityEditorPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly store = inject(EntityStoreService);

  private readonly idParam = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  protected readonly isNew = signal(true);
  protected readonly originalId = signal<string | null>(null);

  protected readonly jsonText = signal('');
  private readonly savedText = signal('');
  protected readonly hasUnsavedChanges = computed(() => this.jsonText() !== this.savedText());
  protected readonly outcome = computed<ParseOutcome>(() => parseJsonText(this.jsonText()));
  protected readonly validEntity = computed<Entity | null>(() => {
    const outcome = this.outcome();
    return outcome.success ? outcome.data : null;
  });

  protected readonly headerName = computed(() => this.validEntity()?.name ?? (this.isNew() ? 'New Entity' : this.originalId()));
  protected readonly lineCount = computed(() => this.jsonText().split('\n').length);
  protected readonly lineNumbers = computed(() => Array.from({ length: this.lineCount() }, (_, i) => i + 1));
  protected readonly cursorLine = signal(1);

  protected readonly related = computed(() => {
    const e = this.validEntity();
    return e ? relatedItems(e, this.store.entities()) : [];
  });
  protected readonly chart = computed(() => {
    const e = this.validEntity();
    return e ? scalingChartFor(e) : null;
  });
  private readonly maxChartAbsY = computed(() => {
    const points = this.chart();
    return points ? Math.max(1, ...points.map((p) => Math.abs(p.y))) : 1;
  });

  protected readonly copied = signal(false);

  protected readonly costLabel = costLabel;
  protected readonly describeEffect = describeEffect;
  protected readonly conditionSummary = conditionSummary;
  protected readonly prereqConflictSummary = prereqConflictSummary;

  constructor() {
    effect(() => {
      void this.loadForId(this.idParam().get('id'));
    });
  }

  private async loadForId(id: string | null): Promise<void> {
    if (!id || id === 'new') {
      this.isNew.set(true);
      this.originalId.set(null);
      const text = JSON.stringify(BLANK_ENTITY_TEMPLATE, null, 2);
      this.jsonText.set(text);
      this.savedText.set(text);
      return;
    }

    this.isNew.set(false);
    this.originalId.set(id);
    const existing = await this.store.get(id);
    const text = existing ? JSON.stringify(existing, null, 2) : `// "${id}" was not found — it may have been deleted.`;
    this.jsonText.set(text);
    this.savedText.set(text);
  }

  onTextareaChange(target: HTMLTextAreaElement): void {
    this.jsonText.set(target.value);
    this.onCursorMove(target);
  }

  onCursorMove(target: HTMLTextAreaElement): void {
    this.cursorLine.set(this.jsonText().slice(0, target.selectionStart).split('\n').length);
  }

  barHeight(value: number): number {
    return 6 + (Math.abs(value) / this.maxChartAbsY()) * 44;
  }

  formatJson(): void {
    const entity = this.validEntity();
    if (!entity) return;
    this.jsonText.set(JSON.stringify(entity, null, 2));
  }

  async copyJson(): Promise<void> {
    await navigator.clipboard.writeText(this.jsonText());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1200);
  }

  discard(): void {
    this.jsonText.set(this.savedText());
  }

  async save(): Promise<void> {
    const result = this.outcome();
    if (!result.success) return;

    await this.store.save(result.data);
    this.savedText.set(JSON.stringify(result.data, null, 2));

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
