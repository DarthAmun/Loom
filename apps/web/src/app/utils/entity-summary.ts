import { BALANCE_LEVELS, evaluateScalingRule, expectedDiceValue, isDiceExpression, type ActionCost, type ChoiceSource, type ConditionSpec, type DiceExpression, type Effect, type Entity, type EntityRef, type ScalingRule } from 'loom';

export function costLabel(cost: ActionCost): string {
  switch (cost.type) {
    case 'actions':
      return cost.count === 1 ? '1 action' : `${cost.count} actions`;
    case 'reaction':
      return 'reaction';
    case 'free':
      return 'free';
    case 'inherit':
      return 'inherit';
  }
}

/** Short badge for the list's leftmost column. Actions show their count;
 * everything else gets a short code. "re" vs "fr" for free-cost entities
 * distinguishes trigger-driven ones (reacts to an event) from truly inert
 * ones (hooks, tag-only conditions) — not an engine concept, just a
 * display heuristic for scanning the list quickly. */
export function costBadge(entity: Entity): string {
  switch (entity.cost.type) {
    case 'actions':
      return String(entity.cost.count);
    case 'inherit':
      return 'inh';
    case 'reaction':
      return 'rct';
    case 'free':
      return entity.trigger ? 're' : 'fr';
  }
}

export function conditionSummary(condition: ConditionSpec): string {
  switch (condition.kind) {
    case 'hasTag':
      return `${condition.on === 'self' ? 'you have' : condition.on === 'event.target' ? 'target has' : 'attacker has'} ${condition.tag}`;
    case 'attribute':
      return `${condition.attribute} ${condition.op} ${condition.value}`;
    case 'proficiency':
      return `${condition.proficiencyKey} ≥ ${condition.minRank}`;
    case 'resource':
      return `${condition.resourceKey} ${condition.op} ${condition.value}`;
    case 'eventField':
      return `${condition.field} = ${JSON.stringify(condition.equals)}`;
  }
}

function scalingSummary(rule: ScalingRule): string {
  if (rule.by === 'proficiencyRank') return 'by proficiency';
  return 'by level';
}

function diceSummary(dice: DiceExpression): string {
  if (typeof dice.count === 'number') return `${dice.count}d${dice.faces}`;
  return `d${dice.faces} × count ${scalingSummary(dice.count)}`;
}

/** Renders a value effect's amount (flat number, dice, or level/proficiency
 * scaling) as a short display string — shared by describeEntity and
 * describeEffect so the three amount shapes read consistently everywhere. */
function amountSummary(amount: number | ScalingRule | DiceExpression): string {
  if (typeof amount === 'number') return String(amount);
  if (isDiceExpression(amount)) return diceSummary(amount);
  return scalingSummary(amount);
}

function choiceSourceSummary(from: ChoiceSource): string {
  switch (from.kind) {
    case 'entitiesByTag':
      return `tag:${from.tag}`;
    case 'entitiesByRefs':
      return `${from.refs.length} entities`;
    case 'literal':
      return `${from.options.length} options`;
  }
}

/** Pulls flat numeric "set" leaves out of a (possibly nested) variant
 * effect tree — enough to show e.g. "6 / 12 / 18 damage" for a
 * castLevel-heightened spell without re-deriving the whole resolution engine. */
function flattenSetAmounts(effect: Entity['effects'][number]): number[] {
  if (effect.kind === 'value' && effect.op === 'set' && typeof effect.amount === 'number') return [effect.amount];
  if (effect.kind === 'variant') return effect.variants.flatMap(flattenSetAmounts);
  return [];
}

/** Best-effort, single-line "what does this actually do" summary for the
 * list. Heuristic, not authoritative engine behavior — e.g. "emits X" is
 * inferred from tags/wraps, not from actually running the resolver. Where
 * the shape doesn't match a known pattern, falls back to a generic
 * effect count rather than guessing further. */
export function describeEntity(entity: Entity, allEntities: readonly Entity[]): string {
  const clauses: string[] = [];

  const wrapsStrike = entity.wraps === 'core.strike' || (entity.wraps && findEntity(entity.wraps, allEntities)?.wraps === 'core.strike');
  const isStrikeLike = entity.id === 'core.strike' || wrapsStrike;

  if (entity.wraps) {
    clauses.push(`wraps ${entity.wraps}`);
    if (entity.hooks?.length) clauses.push(`${entity.hooks.length} hook${entity.hooks.length === 1 ? '' : 's'} on ${entity.hooks[0]!.appliesTo}`);
  } else if (entity.trigger) {
    clauses.push(`on ${entity.trigger.event}`);
    if (entity.condition?.length) clauses.push(`if ${entity.condition.map(conditionSummary).join(' and ')}`);
    const valueEffect = entity.effects.find((e) => e.kind === 'value');
    if (valueEffect?.kind === 'value') {
      clauses.push(`${valueEffect.target} ${valueEffect.op} ${amountSummary(valueEffect.amount)}`);
    }
  } else if (entity.hooks?.length && entity.effects.length === 0) {
    const hook = entity.hooks[0]!;
    clauses.push(`hook · ${hook.operation} on ${hook.appliesTo}`);
    if (entity.hooks.length > 1) clauses.push(`+${entity.hooks.length - 1} more`);
  } else if (entity.effects.length === 1 && entity.effects[0]!.kind === 'applyEntity') {
    const applied = entity.effects[0]!;
    if (applied.kind === 'applyEntity') {
      clauses.push(`applies ${applied.entityId}${applied.duration ? ` for ${applied.duration.value ?? ''} ${applied.duration.unit}` : ''}`);
    }
    if (entity.prerequisites.length) clauses.push(`needs ${prerequisiteSummary(entity.prerequisites[0]!)}`);
  } else if (entity.effects.length === 0) {
    const appliedBy = allEntities.filter((e) => e.effects.some((eff) => eff.kind === 'applyEntity' && eff.entityId === entity.id));
    clauses.push(appliedBy.length ? `tag-only buff · applied by ${appliedBy[0]!.id}` : 'tag-only marker');
  } else if (isStrikeLike) {
    clauses.push(`${entity.effects.length} effect${entity.effects.length === 1 ? '' : 's'}`);
    clauses.push('emits strike.hit');
  } else if (entity.effects[0]!.kind === 'variant' && entity.effects[0]!.selectBy === 'castLevel') {
    const amounts = flattenSetAmounts(entity.effects[0]!);
    clauses.push(`${(entity.effects[0] as Extract<Entity['effects'][number], { kind: 'variant' }>).variants.length} castLevel variants`);
    if (amounts.length) clauses.push(`${amounts.join(' / ')} damage`);
  } else {
    clauses.push(`${entity.effects.length} effect${entity.effects.length === 1 ? '' : 's'}`);
  }

  const wrappedByCount = allEntities.filter((e) => e.wraps === entity.id).length;
  if (wrappedByCount > 0 && !entity.wraps) clauses.push(`wrapped by ${wrappedByCount}`);

  return clauses.join(' · ');
}

export function prerequisiteSummary(prereq: Entity['prerequisites'][number]): string {
  switch (prereq.kind) {
    case 'proficiency':
      return `${prereq.proficiencyKey} ${prereq.minRank}`;
    case 'level':
      return `level ${prereq.minLevel}`;
    case 'attribute':
      return `${prereq.attribute} ≥ ${prereq.minValue}`;
    case 'entity':
      return prereq.entityId;
  }
}

/** Source group used for the sidebar's counts and the source-stripe color
 * on character-builder rows — derived from the first "source:" tag. */
export function sourceOf(entity: Entity): string {
  const tag = entity.tags.find((t) => t.startsWith('source:'));
  return tag ? tag.slice('source:'.length) : 'unknown';
}

const SOURCE_COLORS: Record<string, string> = {
  core: 'var(--accent)',
  'pkg-martial': 'var(--wrap)',
  'pkg-caster': 'var(--caster)',
  'pkg-hooks': 'var(--gold)',
};
const FALLBACK_SOURCE_COLORS = ['var(--hook)', 'var(--applies)', 'oklch(0.7 0.12 200)', 'oklch(0.7 0.12 20)'];

/** Stable color per source, falling back to a small rotating palette for
 * sources beyond the four seeded ones so a newly-invented `source:` tag
 * still gets a consistent (if arbitrary) color rather than crashing. */
export function sourceColor(source: string): string {
  if (SOURCE_COLORS[source]) return SOURCE_COLORS[source];
  let hash = 0;
  for (let i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  return FALLBACK_SOURCE_COLORS[hash % FALLBACK_SOURCE_COLORS.length]!;
}

export interface SourceGroup {
  source: string;
  color: string;
  entities: Entity[];
}

/** Groups entities by sourceOf, `core` first then alphabetical — shared by
 * the sidebar's per-source counts (app.ts) and the provenance page's
 * per-source entity lists (provenance.page.ts), so both read the same
 * grouping/sort. */
export function groupBySource(entities: readonly Entity[]): SourceGroup[] {
  const groups = new Map<string, Entity[]>();
  for (const entity of entities) {
    const source = sourceOf(entity);
    groups.set(source, [...(groups.get(source) ?? []), entity]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === 'core' ? -1 : b === 'core' ? 1 : a.localeCompare(b)))
    .map(([source, sourceEntities]) => ({ source, color: sourceColor(source), entities: sourceEntities }));
}

/** Canonical union for "how does this entity relate to others" — graph.ts's
 * EdgeKind is `Exclude<RelationshipKind, 'none'>` (an edge always connects
 * two entities, so it never has 'none'), kept as the derived type rather
 * than the source, since this module is the shared one (consumed by both
 * the graph page and the character builder) and shouldn't depend back on a
 * page-adjacent util for its own return type. */
export type RelationshipKind = 'wraps' | 'trigger' | 'hook' | 'applies' | 'none';

export function relationshipKind(entity: Entity): RelationshipKind {
  if (entity.wraps) return 'wraps';
  if (entity.trigger) return 'trigger';
  if (entity.hooks?.length) return 'hook';
  if (entity.effects.some((e) => e.kind === 'applyEntity')) return 'applies';
  return 'none';
}

/** Indexed by relationshipKind's return value — shared by the graph page's
 * edge coloring and the character builder's active-entity stripe color, so
 * the same relationship reads the same color everywhere it appears. */
export const RELATIONSHIP_COLOR: Record<RelationshipKind, string> = {
  wraps: 'var(--wrap)',
  trigger: 'var(--accent)',
  hook: 'var(--hook)',
  applies: 'var(--applies)',
  none: 'var(--border-strong)',
};

export function findEntity(id: EntityRef, all: readonly Entity[]): Entity | undefined {
  return all.find((e) => e.id === id);
}

export interface RelatedItem {
  label: string;
  name: string;
  id: string;
  sub: string;
}

/** Cross-references for the editor's "related" panel. `listens to` is a
 * heuristic limited to strike.* events since Strike is the only
 * engine-native emitter today (see engine/engine.ts's resolveStrike) —
 * everything else is a direct structural reference (wraps/applyEntity),
 * not a guess. */
export function relatedItems(entity: Entity, all: readonly Entity[]): RelatedItem[] {
  const items: RelatedItem[] = [];

  if (entity.wraps) {
    const target = findEntity(entity.wraps, all);
    if (target) items.push({ label: 'wraps', name: target.name, id: target.id, sub: '' });
  }

  if (entity.trigger?.event.startsWith('strike.')) {
    const strike = findEntity('core.strike', all);
    if (strike && strike.id !== entity.id) items.push({ label: 'listens to', name: strike.name, id: strike.id, sub: '' });
  }

  for (const wrapper of all.filter((e) => e.wraps === entity.id)) {
    items.push({ label: 'wrapped by', name: wrapper.name, id: wrapper.id, sub: 'via wraps' });
  }

  for (const effect of entity.effects) {
    if (effect.kind !== 'applyEntity') continue;
    const target = findEntity(effect.entityId, all);
    if (target) items.push({ label: 'applies', name: target.name, id: target.id, sub: effect.duration ? `${effect.duration.value ?? ''} ${effect.duration.unit}`.trim() : '' });
  }

  for (const applier of all.filter((e) => e.effects.some((eff) => eff.kind === 'applyEntity' && eff.entityId === entity.id))) {
    items.push({ label: 'applied by', name: applier.name, id: applier.id, sub: '' });
  }

  return items;
}

/** One readable line per top-level Effect, for the editor's "then" panel.
 * `variant` is summarized rather than walked recursively — the tree can
 * nest arbitrarily (see pkg.caster.emberBurst's castLevel-over-degree
 * example) and a one-line count is more scannable than reproducing it. */
export function describeEffect(effect: Effect): string {
  switch (effect.kind) {
    case 'value':
      return `${effect.target} ${effect.op} ${amountSummary(effect.amount)}`;
    case 'applyEntity':
      return `applies ${effect.entityId}${effect.duration ? ` for ${effect.duration.value ?? ''} ${effect.duration.unit}`.trimEnd() : ''}`;
    case 'variant':
      return `${effect.variants.length} variants, selected by ${effect.selectBy}`;
    case 'conditionalDuration':
      return `persists while a ${effect.check.against.kind === 'flatDC' ? `DC ${effect.check.against.dc}` : effect.check.against.key} check succeeds`;
    case 'choice':
      return `choose ${effect.count} from ${choiceSourceSummary(effect.from)}, bound as "${effect.bind}"`;
  }
}

export function prereqConflictSummary(entity: Entity): string {
  const parts: string[] = [];
  if (entity.prerequisites.length) parts.push(`needs ${entity.prerequisites.map(prerequisiteSummary).join(', ')}`);
  if (entity.conflicts.length) parts.push(`conflicts with ${entity.conflicts.join(', ')}`);
  return parts.length ? parts.join('. ') + '.' : 'None. Stacks with anything.';
}

export interface ScalingChartPoint {
  x: string;
  y: number;
}

/** Samples a level-based ScalingRule at representative levels for the
 * editor's bar chart — the same points the mock uses (1/5/10/15/20), and
 * the same `evaluateScalingRule` the engine itself resolves against, so
 * the chart can't drift from what a real character would actually get. */
function chartPoints(valueAt: (level: number) => number): ScalingChartPoint[] {
  return BALANCE_LEVELS.map((level) => ({ x: `lv ${level}`, y: valueAt(level) }));
}

export function scalingChartFor(entity: Entity): ScalingChartPoint[] | null {
  const valueEffect = entity.effects.find((e): e is Extract<Effect, { kind: 'value' }> => e.kind === 'value');
  if (!valueEffect || typeof valueEffect.amount !== 'object') return null;
  const amount = valueEffect.amount;

  if (isDiceExpression(amount)) {
    // A flat die count ("2d6") has no level curve to chart; a level-scaled
    // count does — plotted as expected value (count × average face), same
    // math balance.ts uses so a chart and a balance row never drift apart.
    if (typeof amount.count === 'number') return null;
    if (amount.count.by === 'proficiencyRank') return null;
    return chartPoints((level) => expectedDiceValue(amount, { level, castLevel: level }));
  }

  const rule = amount;
  if (rule.by === 'proficiencyRank') return null;
  return chartPoints((level) => evaluateScalingRule(rule, { level, castLevel: level }));
}
