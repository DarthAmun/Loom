import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EntityStoreService } from '../services/entity-store.service';
import { groupBySource } from '../utils/entity-summary';
import { STATUS_LABEL } from '../utils/balance';
import { allBalanceReports, BALANCE_LEVELS, BALANCE_THRESHOLDS } from 'loom';

@Component({
  selector: 'app-provenance',
  imports: [RouterLink],
  template: `
    <div style="padding:26px 30px 30px">
      <div style="display:flex;flex-direction:column;gap:4px;margin-bottom:24px">
        <div class="name-serif" style="font:400 26px/1.1 var(--font-display)">Provenance &amp; Balance</div>
        <div style="font:400 12.5px var(--font-sans);color:var(--text-muted)">
          {{ store.entities().length }} entities · {{ sourceGroups().length }} sources · {{ comparableCount() }} level-comparable effects
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:30px">
        <div class="eyebrow">sources</div>
        <div style="display:flex;flex-direction:column;gap:1px;border-top:1px solid var(--border-soft)">
          @for (group of sourceGroups(); track group.source) {
            <div style="display:grid;grid-template-columns:160px 60px 1fr;gap:14px;align-items:start;padding:12px;border-bottom:1px solid var(--border-soft)">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="width:3px;height:13px;flex:none" [style.background]="group.color"></span>
                <span style="font:500 13px var(--font-sans)">{{ group.source }}</span>
              </div>
              <div style="font:400 11px var(--font-mono);color:var(--text-faint)">{{ group.entities.length }}</div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                @for (entity of group.entities; track entity.id) {
                  <a [routerLink]="['/entities', entity.id]" class="chip" style="text-decoration:none">{{ entity.name }}</a>
                }
              </div>
            </div>
          }
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:26px">
        <div class="eyebrow">balance — level-scaled effects vs Layer 0 envelope</div>
        <div style="font:400 11.5px/1.5 var(--font-sans);color:var(--text-dim);max-width:640px">
          Deviation bands are a starting default (±{{ watchPct }}% = watch, ±{{ offPct }}% = off envelope), not a tuned target — Layer 0's own curves are still partly placeholder.
        </div>

        @if (comparableCount() === 0) {
          <p style="font:400 12.5px var(--font-sans);color:var(--text-dim)">No level-scaled effects to compare yet.</p>
        } @else {
          <div style="overflow-x:auto">
            <table style="border-collapse:collapse;width:100%;min-width:640px">
              <thead>
                <tr style="border-bottom:1px solid var(--border-soft)">
                  <th class="eyebrow bal-th" style="text-align:left">entity</th>
                  <th class="eyebrow bal-th" style="text-align:left">target</th>
                  @for (level of levels; track level) {
                    <th class="eyebrow bal-th" style="text-align:right">lv {{ level }}</th>
                  }
                  <th class="eyebrow bal-th" style="text-align:right">status</th>
                </tr>
              </thead>
              <tbody>
                @for (report of reports(); track report.entity.id) {
                  @for (row of report.comparable; track row.target) {
                    <tr style="border-bottom:1px solid var(--border-soft)">
                      <td style="padding:9px 8px">
                        <a [routerLink]="['/entities', report.entity.id]" class="name-serif" style="font:500 13.5px var(--font-display);color:var(--text);text-decoration:none">{{ report.entity.name }}</a>
                      </td>
                      <td style="padding:9px 8px;font:400 11.5px var(--font-mono);color:var(--text-muted)">{{ row.target }}</td>
                      @for (point of row.points; track point.level) {
                        <td style="padding:9px 8px;text-align:right;font:400 11px var(--font-mono);color:var(--text-faint)">
                          {{ point.actual }} <span style="color:var(--text-dim)">/ {{ point.envelope }}</span>
                        </td>
                      }
                      <td style="padding:9px 8px;text-align:right">
                        <span class="status-pill" [class]="'status-' + row.status">{{ statusLabel[row.status] }}</span>
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>
        }
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
        <div style="display:flex;flex-direction:column;gap:8px">
          <div class="eyebrow">unscaled effects</div>
          <div style="font:400 11.5px/1.5 var(--font-sans);color:var(--text-dim)">
            Flat placeholder numbers with no level basis — not compared against the envelope yet.
          </div>
          <div style="display:flex;flex-direction:column;gap:1px;border-top:1px solid var(--border-soft)">
            @for (report of reports(); track report.entity.id) {
              @for (row of report.unscaled; track row.target) {
                <div class="bal-row">
                  <a [routerLink]="['/entities', report.entity.id]" style="color:var(--text);text-decoration:none">{{ report.entity.name }}</a>
                  <span style="font:400 11px var(--font-mono);color:var(--text-faint)">{{ row.target }} = {{ row.amount }}</span>
                </div>
              }
            }
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:8px">
          <div class="eyebrow">not level-comparable</div>
          <div style="font:400 11.5px/1.5 var(--font-sans);color:var(--text-dim)">
            Level- or castLevel-scaled but with no Layer 0 curve for the target, or scaled by proficiency rank instead of level.
          </div>
          <div style="display:flex;flex-direction:column;gap:1px;border-top:1px solid var(--border-soft)">
            @for (report of reports(); track report.entity.id) {
              @for (row of report.noEnvelope; track row.target) {
                <div class="bal-row" style="flex-direction:column;align-items:flex-start;gap:2px">
                  <div style="display:flex;justify-content:space-between;gap:10px;width:100%">
                    <a [routerLink]="['/entities', report.entity.id]" style="color:var(--text);text-decoration:none">{{ report.entity.name }}</a>
                    <span style="font:400 11px var(--font-mono);color:var(--text-faint)">{{ row.target }}</span>
                  </div>
                  <span style="font:400 11px var(--font-sans);color:var(--text-dim)">{{ row.reason }}</span>
                </div>
              }
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .bal-th {
      padding: 8px;
    }
    .bal-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding: 8px;
      border-bottom: 1px solid var(--border-soft);
      font: 400 12px var(--font-sans);
    }
    .status-pill {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 100px;
      font: 500 10.5px var(--font-mono);
      white-space: nowrap;
    }
    .status-in {
      background: var(--success-bg);
      color: var(--success-text);
    }
    .status-watch {
      background: var(--note-bg);
      color: var(--note-text);
    }
    .status-off {
      background: var(--warn-bg);
      color: var(--warn-text);
    }
  `,
})
export default class ProvenancePage implements OnInit {
  protected readonly store = inject(EntityStoreService);
  protected readonly levels = BALANCE_LEVELS;
  protected readonly watchPct = (BALANCE_THRESHOLDS.watch * 100).toFixed(0);
  protected readonly offPct = (BALANCE_THRESHOLDS.off * 100).toFixed(0);
  protected readonly statusLabel = STATUS_LABEL;

  protected readonly sourceGroups = computed(() => groupBySource(this.store.entities()));
  protected readonly reports = computed(() => allBalanceReports(this.store.entities()));
  protected readonly comparableCount = computed(() => this.reports().reduce((n, r) => n + r.comparable.length, 0));

  ngOnInit(): void {
    void this.store.refresh();
  }
}
