import type { Entity, EntityRef } from 'loom';
import { RELATIONSHIP_COLOR, sourceOf } from './entity-summary';

// Not derived from entity-summary's RelationshipKind: that type picks one
// *primary* label per entity (for list-row/stripe coloring), but an entity
// can carry several prerequisites and several conflicts at once, so edges
// need their own kind union rather than reusing a single-label classifier.
export type EdgeKind = 'wraps' | 'trigger' | 'hook' | 'applies' | 'prerequisite' | 'conflict';

export interface GraphEdge {
  from: EntityRef;
  to: EntityRef;
  kind: EdgeKind;
  resolved: boolean;
}

/** Edge stroke color per kind, keyed for the graph page's legend and path
 * rendering — the four kinds shared with entity-summary's RELATIONSHIP_COLOR
 * (single-label-per-entity, no 'prerequisite'/'conflict' entries) read from
 * that map rather than restating the same CSS variables, so the two can't
 * drift apart. */
export const EDGE_COLOR: Record<EdgeKind, string> = {
  wraps: RELATIONSHIP_COLOR.wraps,
  trigger: RELATIONSHIP_COLOR.trigger,
  hook: RELATIONSHIP_COLOR.hook,
  applies: RELATIONSHIP_COLOR.applies,
  prerequisite: 'var(--caster)',
  conflict: 'var(--conflict)',
};

/** Edge kinds drawn dashed instead of solid — for two unrelated reasons:
 * `trigger` is a heuristic inference (no literal id reference backs it),
 * `conflict` is a symmetric "cannot coexist" marker rather than a directed
 * reference. Centralized so the graph page's dashed check and legend swatch
 * stay in sync, and so a future edge kind is a one-line addition here
 * instead of another branch in an inline boolean expression. */
export const DASHED_EDGE_KINDS: ReadonlySet<EdgeKind> = new Set(['trigger', 'conflict']);

const STRIKE_HOOK_PREFIXES = ['attackRoll.', 'multipleAttackPenalty.'];

/** Structural edges only — wraps, applyEntity, entity-kind prerequisites,
 * and conflicts are all literal id references in the schema. `trigger` and
 * `hook` edges are a heuristic: Strike is the only engine-native event
 * emitter today (see engine/engine.ts), so a strike.* trigger is drawn back
 * to core.strike, and a hook is only drawn to core.strike when its
 * `appliesTo` is attack-roll-shaped. Hooks with an unrelated appliesTo
 * (check.flatPenalty, damage.type, …) get no edge — that's an honest "no
 * known target", not a guess. */
export function computeEdges(entities: readonly Entity[]): GraphEdge[] {
  const byId = new Set(entities.map((e) => e.id));
  const edges: GraphEdge[] = [];
  // Conflicts are checked both ways at eligibility time (see eligibility.ts)
  // since the schema doesn't guarantee a conflict is declared on just one
  // side — dedupe by unordered pair here so a mutually-declared conflict
  // draws one line, not two stacked on top of each other.
  const conflictPairsSeen = new Set<string>();

  for (const entity of entities) {
    if (entity.wraps) {
      edges.push({ from: entity.id, to: entity.wraps, kind: 'wraps', resolved: byId.has(entity.wraps) });
    }
    if (entity.trigger?.event.startsWith('strike.') && entity.id !== 'core.strike') {
      edges.push({ from: entity.id, to: 'core.strike', kind: 'trigger', resolved: byId.has('core.strike') });
    }
    for (const hook of entity.hooks ?? []) {
      if (STRIKE_HOOK_PREFIXES.some((p) => hook.appliesTo.startsWith(p)) && entity.id !== 'core.strike') {
        edges.push({ from: entity.id, to: 'core.strike', kind: 'hook', resolved: byId.has('core.strike') });
      }
    }
    for (const effect of entity.effects) {
      if (effect.kind === 'applyEntity') {
        edges.push({ from: entity.id, to: effect.entityId, kind: 'applies', resolved: byId.has(effect.entityId) });
      }
    }
    for (const prereq of entity.prerequisites) {
      if (prereq.kind === 'entity') {
        edges.push({ from: entity.id, to: prereq.entityId, kind: 'prerequisite', resolved: byId.has(prereq.entityId) });
      }
    }
    for (const conflictId of entity.conflicts) {
      const pairKey = [entity.id, conflictId].sort().join('~');
      if (conflictPairsSeen.has(pairKey)) continue;
      conflictPairsSeen.add(pairKey);
      edges.push({ from: entity.id, to: conflictId, kind: 'conflict', resolved: byId.has(conflictId) });
    }
  }

  return edges;
}

export type GraphColumn = 'core' | 'mid' | 'packages';

export interface GraphNode {
  entity: Entity;
  column: GraphColumn;
}

/** Only entities that participate in at least one edge (as source or
 * target) — an exhaustive 19-node layout would mostly be islands with
 * nothing to say; the list page already covers the full catalog. */
export function computeGraphNodes(entities: readonly Entity[], edges: readonly GraphEdge[]): GraphNode[] {
  const isSource = new Set(edges.map((e) => e.from));
  const isTarget = new Set(edges.map((e) => e.to));

  return entities
    .filter((e) => isSource.has(e.id) || isTarget.has(e.id))
    .map((entity) => {
      const source = sourceOf(entity);
      let column: GraphColumn;
      if (isTarget.has(entity.id) && !isSource.has(entity.id)) column = 'core';
      else if (source !== 'core' && source !== 'unknown') column = 'packages';
      else column = 'mid';
      return { entity, column };
    });
}
