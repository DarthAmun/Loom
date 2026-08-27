import type { ChoiceSource } from "../entities/types.js"
import type { EntityRegistry } from "../entities/registry.js"

/** Supplies the actual pick(s) for a "choice" Effect. Unlike D20Roller/
 * DieRoller (injected for determinism, standing in for real randomness), a
 * Chooser stands in for a real build-time player decision — there's no
 * sensible default the engine could compute on its own, so callers that
 * care about "choice" Effects must supply one (see engine.ts's
 * ResolutionContext.chooser, optional — a "choice" effect with no chooser
 * is logged and skipped, same treatment as conditionalDuration). */
export type Chooser = (bind: string, options: string[], count: number) => string[]

/** Resolves a ChoiceSource down to the flat list of pickable values —
 * EntityRefs for "entitiesByTag"/"entitiesByRefs", plain strings for
 * "literal". */
export function resolveChoiceOptions(source: ChoiceSource, registry: EntityRegistry): string[] {
  switch (source.kind) {
    case "entitiesByTag":
      return registry.byTag(source.tag).map((entity) => entity.id)
    case "entitiesByRefs":
      return source.refs
    case "literal":
      return source.options
  }
}

/** Runs a chooser against a ChoiceSource's resolved options, validating the
 * result actually came from the pool. Doesn't itself mutate any character
 * state — engine.ts's resolveEffect does that (recording into the granting
 * instance's runtimeState, and applying entity picks for an "entities"
 * source — engine.ts branches on `effect.from.kind` for that, since it's
 * already unpacked there), matching how rollDiceExpression computes a value
 * but resolveEffect is what writes it into ctx.values. */
export function resolveChoice(
  source: ChoiceSource,
  bind: string,
  count: number,
  chooser: Chooser,
  registry: EntityRegistry,
): string[] {
  const options = resolveChoiceOptions(source, registry)
  const picks = chooser(bind, options, count)
  for (const pick of picks) {
    if (!options.includes(pick)) throw new Error(`choice "${bind}": "${pick}" is not one of the offered options`)
  }
  return picks
}

/** A Chooser that always takes the first `count` options — useful for tests
 * and for entities whose pool happens to be a single option, not a stand-in
 * for real player choice (see this module's doc comment). */
export const firstOptionChooser: Chooser = (_bind, options, count) => options.slice(0, count)
