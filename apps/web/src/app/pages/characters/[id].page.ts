import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PROFICIENCY_RANK_ORDER, type Entity, type ProficiencyRank, type StoredCharacter } from 'loom';
import { CharacterStoreService } from '../../services/character-store.service';
import { EntityStoreService } from '../../services/entity-store.service';
import { costLabel, relationshipKind, sourceOf } from '../../utils/entity-summary';
import { builderWarnings, checkEligibility, type Eligibility } from '../../utils/eligibility';

interface ActiveRow {
  entity: Entity;
  instanceSource: string;
  duration: string | null;
  stripeColor: string;
}

interface CandidateRow {
  entity: Entity;
  eligibility: Eligibility;
}

@Component({
  selector: 'app-character-builder',
  imports: [RouterLink],
  template: `
    @if (character(); as c) {
      <div style="display:grid;grid-template-columns:250px 1fr 290px;min-height:100vh">
        <div class="side-col">
          <a routerLink="/characters" style="font:400 11px var(--font-sans);color:var(--text-faint);text-decoration:none">← Characters</a>
          <div style="display:flex;flex-direction:column;gap:4px">
            <div class="name-serif" style="font:400 24px/1.1 var(--font-display)">{{ c.name }}</div>
            <div style="font:400 11px var(--font-mono);color:var(--text-faint)">level {{ c.level }}</div>
          </div>

          <div class="side-section">
            <div class="eyebrow">attributes</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font:400 12px var(--font-mono)">
              @for (a of attributeEntries(); track a.key) {
                <span style="display:flex;justify-content:space-between;color:var(--text-muted)">
                  {{ a.key }}
                  <span style="display:flex;align-items:center;gap:4px;color:var(--text)">
                    {{ a.value >= 0 ? '+' : '' }}{{ a.value }}
                    <button type="button" class="mini-x" (click)="removeAttribute(c, a.key)">×</button>
                  </span>
                </span>
              }
            </div>
            <div style="display:flex;gap:4px;margin-top:4px">
              <input #attrKey type="text" placeholder="key" class="mini-input" style="width:64px" />
              <input #attrVal type="number" placeholder="0" class="mini-input" style="width:50px" />
              <button type="button" class="link-btn" (click)="addAttribute(c, attrKey.value, attrVal.value); attrKey.value = ''; attrVal.value = ''">+ add</button>
            </div>
          </div>

          <div class="side-section">
            <div class="eyebrow">proficiencies</div>
            <div style="display:flex;flex-direction:column;gap:5px;font:400 11.5px var(--font-sans)">
              @for (p of proficiencyEntries(); track p.key) {
                <span style="display:flex;justify-content:space-between;align-items:center">
                  <span style="color:var(--text-muted)">{{ p.key }}</span>
                  <span style="display:flex;align-items:center;gap:4px">
                    <span style="font:500 10.5px var(--font-mono)">{{ p.rank }}</span>
                    <button type="button" class="mini-x" (click)="removeProficiency(c, p.key)">×</button>
                  </span>
                </span>
              }
            </div>
            <div style="display:flex;gap:4px;margin-top:4px">
              <input #profKey type="text" placeholder="key" class="mini-input" style="width:80px" />
              <select #profRank class="mini-input" style="width:70px">
                @for (r of ranks; track r) {
                  <option [value]="r">{{ r }}</option>
                }
              </select>
              <button type="button" class="link-btn" (click)="addProficiency(c, profKey.value, $any(profRank.value)); profKey.value = ''">+ add</button>
            </div>
          </div>

          <div class="side-section">
            <div class="eyebrow">resources</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              @for (r of resourceEntries(); track r.key) {
                <div style="display:flex;flex-direction:column;gap:4px">
                  <span style="display:flex;justify-content:space-between;font:400 11.5px var(--font-sans)">
                    <span style="color:var(--text-muted)">{{ r.key }}</span>
                    <span style="font:500 10.5px var(--font-mono)">{{ r.current }} / {{ r.max }}</span>
                  </span>
                  <span style="height:5px;border-radius:3px;background:var(--border-strong);display:block">
                    <span [style.width.%]="r.pct" style="display:block;height:5px;border-radius:3px;background:var(--accent)"></span>
                  </span>
                </div>
              }
              @if (resourceEntries().length === 0) {
                <span style="font:400 11px var(--font-sans);color:var(--text-dim)">none</span>
              }
            </div>
          </div>

          <div style="margin-top:auto;font:400 10.5px/1.6 var(--font-mono);color:var(--text-dim)">
            {{ sourceMix() }} source{{ sourceMix() === 1 ? '' : 's' }} mixed<br />
            {{ warnings().length === 0 ? 'no unmet prerequisites' : warnings().length + ' issue' + (warnings().length === 1 ? '' : 's') }}
          </div>
        </div>

        <div class="mid-col">
          <div style="display:flex;align-items:baseline;justify-content:space-between">
            <div class="name-serif" style="font:400 20px/1 var(--font-display)">Active entities</div>
            <div style="font:400 11px var(--font-mono);color:var(--text-faint)">{{ activeRows().length }}</div>
          </div>

          <div style="display:flex;flex-direction:column;gap:8px">
            @for (row of activeRows(); track row.entity.id) {
              <div class="active-row" [style.borderLeftColor]="row.stripeColor">
                <span class="cost-badge">{{ costLabel(row.entity.cost).split(' ')[0] }}</span>
                <span class="name-serif" style="font:500 16px/1 var(--font-display)">{{ row.entity.name }}</span>
                <span style="font:400 10.5px var(--font-mono);color:var(--text-faint)">{{ row.entity.id }}</span>
                @if (row.duration) {
                  <span class="chip chip-accent">{{ row.duration }}</span>
                }
                <span style="margin-left:auto;font:400 11px var(--font-mono);color:var(--text-muted)">{{ row.instanceSource }}</span>
                <button type="button" class="mini-x" (click)="removeActive(c, row.entity.id)">remove</button>
              </div>
            }
            @if (activeRows().length === 0) {
              <p style="font:400 12.5px var(--font-sans);color:var(--text-dim)">Nothing active yet — add entities from the panel on the right.</p>
            }
          </div>

          @for (w of warnings(); track w) {
            <div class="warning-banner">
              <span class="warning-dot"></span>
              {{ w }}
            </div>
          }
        </div>

        <div class="right-col">
          <div style="display:flex;flex-direction:column;gap:4px">
            <div class="name-serif" style="font:400 18px/1 var(--font-display)">Add entity</div>
            <div style="font:400 11.5px/1.4 var(--font-sans);color:var(--text-muted)">Checked against level {{ c.level }}, proficiencies and conflicts.</div>
          </div>
          <input
            type="text"
            [placeholder]="'filter ' + store.entities().length + ' entities…'"
            [value]="query()"
            (input)="query.set($any($event.target).value)"
            style="padding:7px 11px;border:1px solid var(--border-strong);border-radius:4px;background:var(--bg-code);color:var(--text);font:400 12px var(--font-mono)"
          />
          <div style="display:flex;flex-direction:column;gap:7px;overflow:auto">
            @for (row of candidates(); track row.entity.id) {
              <button
                type="button"
                class="candidate-card"
                [class.eligible]="row.eligibility.status === 'eligible'"
                [disabled]="row.eligibility.status !== 'eligible'"
                (click)="addActive(c, row.entity.id)"
              >
                <div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px">
                  <span class="name-serif" style="font:500 15px/1.1 var(--font-display)">{{ row.entity.name }}</span>
                  <span class="status-tag" [class]="'status-' + row.eligibility.status">{{ row.eligibility.status }}</span>
                </div>
                <div style="font:400 11px/1.4 var(--font-sans);color:var(--text-faint);text-align:left">{{ row.eligibility.reason }}</div>
              </button>
            }
          </div>
        </div>
      </div>
    } @else {
      <div style="padding:30px;font:400 13px var(--font-sans);color:var(--text-dim)">
        <a routerLink="/characters">← Characters</a>
        <p>Character not found.</p>
      </div>
    }
  `,
  styles: `
    .side-col {
      border-right: 1px solid var(--border);
      padding: 22px 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      background: var(--bg-sidebar);
    }
    .side-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .mid-col {
      padding: 22px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .right-col {
      border-left: 1px solid var(--border);
      padding: 22px 20px;
      display: flex;
      flex-direction: column;
      gap: 14px;
      background: var(--bg-panel);
    }
    .mini-input {
      padding: 4px 6px;
      border: 1px solid var(--border-strong);
      border-radius: 3px;
      background: var(--bg-code);
      color: var(--text);
      font: 400 11px var(--font-mono);
    }
    .mini-x {
      background: none;
      border: none;
      color: var(--text-dim);
      cursor: pointer;
      font: 400 11px var(--font-sans);
      padding: 0;
    }
    .mini-x:hover {
      color: var(--warn-text);
    }
    .active-row {
      display: flex;
      align-items: center;
      gap: 12px;
      background: var(--bg-panel);
      border: 1px solid var(--border);
      border-left: 3px solid var(--border-strong);
      border-radius: 5px;
      padding: 11px 14px;
    }
    .cost-badge {
      width: 22px;
      height: 22px;
      border-radius: 3px;
      border: 1px solid var(--border-strong);
      color: var(--text-muted);
      font: 500 10px/22px var(--font-mono);
      text-align: center;
      flex: none;
    }
    .warning-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 11px 14px;
      border-radius: 5px;
      background: var(--note-bg);
      font: 400 12px/1.5 var(--font-sans);
      color: var(--note-text);
    }
    .warning-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      flex: none;
    }
    .candidate-card {
      background: var(--bg-panel-2);
      border: 1px solid var(--border-strong);
      border-radius: 5px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 5px;
      cursor: not-allowed;
      opacity: 0.75;
      text-align: left;
      font: inherit;
      color: inherit;
    }
    .candidate-card.eligible {
      cursor: pointer;
      opacity: 1;
    }
    .candidate-card.eligible:hover {
      border-color: var(--accent);
    }
    .status-tag {
      font: 500 10px var(--font-mono);
      flex: none;
    }
    .status-eligible {
      color: var(--success-text);
    }
    .status-blocked {
      color: var(--wrap-soft-text);
    }
    .status-conflict {
      color: var(--warn-text);
    }
    .status-active {
      color: var(--text-dim);
    }
  `,
})
export default class CharacterBuilderPage {
  private readonly route = inject(ActivatedRoute);
  protected readonly charStore = inject(CharacterStoreService);
  protected readonly store = inject(EntityStoreService);

  private readonly idParam = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  protected readonly character = signal<StoredCharacter | null>(null);
  protected readonly query = signal('');
  protected readonly ranks = PROFICIENCY_RANK_ORDER;

  protected readonly costLabel = costLabel;

  protected readonly attributeEntries = computed(() => {
    const c = this.character();
    return c ? Object.entries(c.attributes).map(([key, value]) => ({ key, value })) : [];
  });
  protected readonly proficiencyEntries = computed(() => {
    const c = this.character();
    return c ? [...c.proficiencies.entries()].map(([key, rank]) => ({ key, rank })) : [];
  });
  protected readonly resourceEntries = computed(() => {
    const c = this.character();
    if (!c) return [];
    return [...c.resources.entries()].map(([key, r]) => ({ key, current: r.current, max: r.max, pct: r.max > 0 ? (100 * r.current) / r.max : 0 }));
  });

  protected readonly activeRows = computed<ActiveRow[]>(() => {
    const c = this.character();
    if (!c) return [];
    const all = this.store.entities();
    return c.activeEntities
      .map((instance) => {
        const entity = all.find((e) => e.id === instance.entityId);
        if (!entity) return null;
        const kind = relationshipKind(entity);
        const stripeColor = kind === 'wraps' ? 'var(--wrap)' : kind === 'trigger' ? 'var(--accent)' : kind === 'hook' ? 'var(--hook)' : kind === 'applies' ? 'var(--applies)' : 'var(--border-strong)';
        const duration = instance.duration ? `${instance.duration.value ?? ''} ${instance.duration.unit}`.trim() : null;
        return { entity, instanceSource: instance.source ?? 'added manually', duration, stripeColor };
      })
      .filter((r): r is ActiveRow => r !== null);
  });

  protected readonly sourceMix = computed(() => new Set(this.activeRows().map((r) => sourceOf(r.entity))).size);
  protected readonly warnings = computed(() => {
    const c = this.character();
    return c ? builderWarnings(c, this.store.entities()) : [];
  });

  protected readonly candidates = computed<CandidateRow[]>(() => {
    const c = this.character();
    if (!c) return [];
    const q = this.query().trim().toLowerCase();
    return this.store
      .entities()
      .filter((e) => !q || e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q) || e.tags.some((t) => t.toLowerCase().includes(q)))
      .map((entity) => ({ entity, eligibility: checkEligibility(entity, c, this.store.entities()) }))
      .filter((row) => row.eligibility.status !== 'active')
      .sort((a, b) => (a.eligibility.status === 'eligible' ? -1 : 1) - (b.eligibility.status === 'eligible' ? -1 : 1));
  });

  constructor() {
    effect(() => {
      void this.loadForId(this.idParam().get('id'));
    });
    void this.store.refresh();
  }

  private async loadForId(idParam: string | null): Promise<void> {
    const id = idParam ? Number(idParam) : NaN;
    this.character.set(Number.isFinite(id) ? ((await this.charStore.get(id)) ?? null) : null);
  }

  private async persist(character: StoredCharacter, changes: Partial<StoredCharacter>): Promise<void> {
    const updated = { ...character, ...changes };
    this.character.set(updated);
    await this.charStore.update(character.id!, changes);
  }

  addAttribute(c: StoredCharacter, key: string, rawValue: string): void {
    if (!key.trim()) return;
    const value = Number(rawValue) || 0;
    void this.persist(c, { attributes: { ...c.attributes, [key.trim()]: value } });
  }
  removeAttribute(c: StoredCharacter, key: string): void {
    const { [key]: _removed, ...rest } = c.attributes;
    void this.persist(c, { attributes: rest });
  }

  addProficiency(c: StoredCharacter, key: string, rank: ProficiencyRank): void {
    if (!key.trim()) return;
    const next = new Map(c.proficiencies);
    next.set(key.trim(), rank);
    void this.persist(c, { proficiencies: next });
  }
  removeProficiency(c: StoredCharacter, key: string): void {
    const next = new Map(c.proficiencies);
    next.delete(key);
    void this.persist(c, { proficiencies: next });
  }

  addActive(c: StoredCharacter, entityId: string): void {
    void this.persist(c, { activeEntities: [...c.activeEntities, { entityId, source: 'added manually' }] });
  }
  removeActive(c: StoredCharacter, entityId: string): void {
    void this.persist(c, { activeEntities: c.activeEntities.filter((i) => i.entityId !== entityId) });
  }
}
