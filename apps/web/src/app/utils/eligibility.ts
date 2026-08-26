import { rankAtLeast, type Character, type Entity } from 'loom';
import { prerequisiteSummary } from './entity-summary';

export type EligibilityStatus = 'eligible' | 'active' | 'blocked' | 'conflict';

export interface Eligibility {
  status: EligibilityStatus;
  reason: string;
}

function checkPrerequisite(prereq: Entity['prerequisites'][number], character: Character, activeIds: ReadonlySet<string>): Eligibility {
  switch (prereq.kind) {
    case 'level':
      return character.level >= prereq.minLevel
        ? { status: 'eligible', reason: `level ${prereq.minLevel} — you're ${character.level}` }
        : { status: 'blocked', reason: `needs level ${prereq.minLevel} — you're ${character.level}` };
    case 'attribute': {
      const value = character.attributes[prereq.attribute] ?? 0;
      return value >= prereq.minValue
        ? { status: 'eligible', reason: `${prereq.attribute} ≥ ${prereq.minValue} — you have ${value}` }
        : { status: 'blocked', reason: `needs ${prereq.attribute} ≥ ${prereq.minValue} — you have ${value}` };
    }
    case 'proficiency': {
      const rank = character.proficiencies.get(prereq.proficiencyKey) ?? 'untrained';
      return rankAtLeast(rank, prereq.minRank)
        ? { status: 'eligible', reason: `${prereq.proficiencyKey} ${prereq.minRank} — you're ${rank}` }
        : { status: 'blocked', reason: `needs ${prereq.proficiencyKey} ${prereq.minRank} — you're ${rank}` };
    }
    case 'entity':
      return activeIds.has(prereq.entityId)
        ? { status: 'eligible', reason: `${prereq.entityId} active` }
        : { status: 'blocked', reason: `needs ${prereq.entityId} active` };
  }
}

/** Real prerequisite/conflict evaluation against a Character — the thing
 * Phase 3 ("character builder") is about. Conflicts are checked both ways
 * (the candidate's own `conflicts` list, and any active entity's list
 * naming the candidate) since nothing in the schema guarantees a conflict
 * is declared on just one side. */
export function checkEligibility(entity: Entity, character: Character, allEntities: readonly Entity[]): Eligibility {
  const activeIds = new Set(character.activeEntities.map((i) => i.entityId));
  if (activeIds.has(entity.id)) return { status: 'active', reason: 'already active' };

  for (const activeId of activeIds) {
    if (entity.conflicts.includes(activeId)) return { status: 'conflict', reason: `already active from ${activeId}` };
    const activeEntity = allEntities.find((e) => e.id === activeId);
    if (activeEntity?.conflicts.includes(entity.id)) return { status: 'conflict', reason: `already active from ${activeId}` };
  }

  for (const prereq of entity.prerequisites) {
    const result = checkPrerequisite(prereq, character, activeIds);
    if (result.status === 'blocked') return result;
  }

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
  const activeEntities = character.activeEntities
    .map((instance) => allEntities.find((e) => e.id === instance.entityId))
    .filter((e): e is Entity => !!e);

  for (const entity of activeEntities) {
    const withoutSelf: Character = { ...character, activeEntities: character.activeEntities.filter((i) => i.entityId !== entity.id) };
    const result = checkEligibility(entity, withoutSelf, allEntities);
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
