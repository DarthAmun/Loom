import type { Entity, EntityRef } from 'loom';
import { sourceOf, type RelationshipKind } from './entity-summary';

// An edge always connects two entities, so it's never 'none' — the one
// RelationshipKind case that doesn't apply here.
export type EdgeKind = Exclude<RelationshipKind, 'none'>;

export interface GraphEdge {
  from: EntityRef;
  to: EntityRef;
  kind: EdgeKind;
  resolved: boolean;
}

const STRIKE_HOOK_PREFIXES = ['attackRoll.', 'multipleAttackPenalty.'];

/** Structural edges only — wraps and applyEntity are literal id references
 * in the schema. `trigger` and `hook` edges are a heuristic: Strike is the
 * only engine-native event emitter today (see engine/engine.ts), so a
 * strike.* trigger is drawn back to core.strike, and a hook is only drawn
 * to core.strike when its `appliesTo` is attack-roll-shaped. Hooks with an
 * unrelated appliesTo (check.flatPenalty, damage.type, …) get no edge —
 * that's an honest "no known target", not a guess. */
export function computeEdges(entities: readonly Entity[]): GraphEdge[] {
  const byId = new Set(entities.map((e) => e.id));
  const edges: GraphEdge[] = [];

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
