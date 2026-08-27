import { evaluatePrerequisites, type Character, type Entity } from 'loom';
import { prerequisiteSummary } from './entity-summary';

export type EligibilityStatus = 'eligible' | 'active' | 'blocked' | 'conflict';

export interface Eligibility {
  status: EligibilityStatus;
  reason: string;
}

export interface EligibilityContext {
  character: Character;
  activeIds: ReadonlySet<string>;
  entitiesById: ReadonlyMap<string, Entity>;
}

function activeIdsOf(character: Character): Set<string> {
  return new Set(character.activeEntities.map((i) => i.entityId));
}

/** Built once per render (not once per candidate) — `checkEligibility` gets
 * called once per entity in the picker on every filter-box keystroke, so
 * the Set/Map here are shared across all of them instead of each call
 * re-deriving activeIds from character.activeEntities and re-scanning
 * allEntities with .find(). */
export function buildEligibilityContext(character: Character, allEntities: readonly Entity[]): EligibilityContext {
  return {
    character,
    activeIds: activeIdsOf(character),
    entitiesById: new Map(allEntities.map((e) => [e.id, e])),
  };
}

/** Real prerequisite/conflict evaluation against a Character — the thing
 * Phase 3 ("character builder") is about. Conflicts are checked both ways
 * (the candidate's own `conflicts` list, and any active entity's list
 * naming the candidate) since nothing in the schema guarantees a conflict
 * is declared on just one side. Per-prerequisite pass/fail logic lives in
 * the engine (evaluatePrerequisites, mirroring evaluateConditions) — this
 * layers UI-facing status/conflict handling on top. */
export function checkEligibility(entity: Entity, ctx: EligibilityContext): Eligibility {
  if (ctx.activeIds.has(entity.id)) return { status: 'active', reason: 'already active' };

  for (const activeId of ctx.activeIds) {
    if (entity.conflicts.includes(activeId)) return { status: 'conflict', reason: `already active from ${activeId}` };
    if (ctx.entitiesById.get(activeId)?.conflicts.includes(entity.id)) return { status: 'conflict', reason: `already active from ${activeId}` };
  }

  const result = evaluatePrerequisites(entity.prerequisites, { character: ctx.character, activeIds: ctx.activeIds });
  if (!result.met) return { status: 'blocked', reason: result.reason };

  if (entity.prerequisites.length === 0) return { status: 'eligible', reason: 'no prerequisites' };
  return { status: 'eligible', reason: prerequisiteSummary(entity.prerequisites[0]!) };
}

/** Live warnings for the builder's footer: prerequisites an active entity
 * no longer meets (character state can change after it was added — e.g. a
 * conflicting pick came later), and hook collisions between two active
 * entities targeting the same computation path, which the engine has no
 * defined resolution order for (see engine's README report on Hook). Both
 * are real, computed checks, not placeholder copy. */
export function builderWarnings(character: Character, allEntities: readonly Entity[]): string[] {
  const warnings: string[] = [];
  // Built once and reused across the loop below (rather than via
  // buildEligibilityContext per iteration) — allEntities doesn't change
  // between active entities, only each one's `withoutSelf` activeIds does.
  const entitiesById = new Map(allEntities.map((e) => [e.id, e]));
  const activeEntities = character.activeEntities.map((instance) => entitiesById.get(instance.entityId)).filter((e): e is Entity => !!e);

  for (const entity of activeEntities) {
    const withoutSelf: Character = { ...character, activeEntities: character.activeEntities.filter((i) => i.entityId !== entity.id) };
    const ctx: EligibilityContext = { character: withoutSelf, activeIds: activeIdsOf(withoutSelf), entitiesById };
    const result = checkEligibility(entity, ctx);
    if (result.status === 'blocked') warnings.push(`${entity.name} no longer meets its prerequisites — ${result.reason}`);
  }

  const byAppliesTo = new Map<string, Entity[]>();
  for (const entity of activeEntities) {
    for (const hook of entity.hooks ?? []) {
      const list = byAppliesTo.get(hook.appliesTo) ?? [];
      list.push(entity);
      byAppliesTo.set(hook.appliesTo, list);
    }
  }
  for (const [appliesTo, entities] of byAppliesTo) {
    if (entities.length < 2) continue;
    const names = entities.map((e) => e.name).join(' and ');
    warnings.push(`${names} both hook ${appliesTo} — resolution order isn't defined yet by the engine.`);
  }

  return warnings;
}
