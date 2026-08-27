import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { classHpForTier, type DurabilityTier } from 'loom';
import { CharacterStoreService } from '../../services/character-store.service';

// hp/level shown per tier comes from Layer 0's classHpForTier, not a
// hand-typed number — stays correct if the underlying envelope is retuned.
const TIER_VALUES: DurabilityTier[] = ['martial', 'hybrid', 'caster'];
const TIERS = TIER_VALUES.map((value) => ({ value, label: `${value} (${classHpForTier(value, 1)} hp/lv)` }));

@Component({
  selector: 'app-character-list',
  imports: [RouterLink],
  template: `
    <div style="padding:26px 30px 30px;max-width:720px">
      <div class="name-serif" style="font:400 26px/1.1 var(--font-display);margin-bottom:5px">Characters</div>
      <div style="font:400 12.5px var(--font-sans);color:var(--text-muted);margin-bottom:20px">{{ store.characters().length }} saved</div>

      <div class="card" style="padding:16px 18px;margin-bottom:22px;display:flex;flex-direction:column;gap:10px">
        <div class="eyebrow">new character</div>
        <div style="display:flex;gap:9px;flex-wrap:wrap;align-items:center">
          <input
            type="text"
            placeholder="name"
            [value]="name()"
            (input)="name.set($any($event.target).value)"
            style="padding:7px 10px;border:1px solid var(--border-strong);border-radius:5px;background:var(--bg-panel-2);color:var(--text);font:400 12.5px var(--font-sans);width:160px"
          />
          <input
            type="number"
            min="1"
            placeholder="level"
            [value]="level()"
            (input)="level.set(+$any($event.target).value || 1)"
            style="padding:7px 10px;border:1px solid var(--border-strong);border-radius:5px;background:var(--bg-panel-2);color:var(--text);font:400 12.5px var(--font-mono);width:70px"
          />
          <select
            [value]="tier()"
            (change)="tier.set($any($event.target).value)"
            style="padding:7px 10px;border:1px solid var(--border-strong);border-radius:5px;background:var(--bg-panel-2);color:var(--text);font:400 12.5px var(--font-sans)"
          >
            @for (t of tiers; track t.value) {
              <option [value]="t.value">{{ t.label }}</option>
            }
          </select>
          <button type="button" class="btn-primary" [disabled]="!name().trim()" (click)="create()">Create</button>
        </div>
      </div>

      @if (store.characters().length === 0) {
        <p style="font:400 12.5px var(--font-sans);color:var(--text-dim)">No characters yet.</p>
      } @else {
        <div style="display:flex;flex-direction:column;gap:8px">
          @for (c of store.characters(); track c.id) {
            <a [routerLink]="['/characters', c.id]" class="char-row">
              <span class="name-serif" style="font:500 17px/1 var(--font-display)">{{ c.name }}</span>
              <span style="font:400 11px var(--font-mono);color:var(--text-faint)">level {{ c.level }}</span>
              <span style="margin-left:auto;font:400 11px var(--font-mono);color:var(--text-muted)">{{ c.activeEntities.length }} active entities</span>
            </a>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .char-row {
      display: flex;
      align-items: baseline;
      gap: 12px;
      padding: 12px 14px;
      border: 1px solid var(--border-strong);
      border-radius: 6px;
      text-decoration: none;
      color: var(--text);
      background: var(--bg-panel);
    }
    .char-row:hover {
      border-color: var(--accent);
    }
  `,
})
export default class CharacterListPage implements OnInit {
  protected readonly store = inject(CharacterStoreService);
  private readonly router = inject(Router);
  protected readonly tiers = TIERS;

  protected readonly name = signal('');
  protected readonly level = signal(1);
  protected readonly tier = signal<DurabilityTier>('martial');

  ngOnInit(): void {
    void this.store.refresh();
  }

  async create(): Promise<void> {
    if (!this.name().trim()) return;
    const created = await this.store.create({ name: this.name().trim(), level: this.level(), durabilityTier: this.tier() });
    this.name.set('');
    this.level.set(1);
    await this.router.navigate(['/characters', created.id]);
  }
}
