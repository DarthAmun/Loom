// Runtime validation for Entity JSON coming from outside this package (an
// externally-generated draft pasted into the Phase 2 editor). types.ts's
// interfaces only check shape at compile time — anything parsed from JSON
// needs an actual runtime check, hence this zod mirror.
import { z } from "zod"
import type { Entity } from "./types.js"

const ProficiencyRankSchema = z.enum(["untrained", "trained", "expert", "master", "legendary"])

const PrerequisiteSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("entity"), entityId: z.string() }),
  z.object({ kind: z.literal("attribute"), attribute: z.string(), minValue: z.number() }),
  z.object({ kind: z.literal("proficiency"), proficiencyKey: z.string(), minRank: ProficiencyRankSchema }),
  z.object({ kind: z.literal("level"), minLevel: z.number() }),
])

const TriggerSpecSchema = z.object({ event: z.string() })

const ConditionSpecSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("attribute"), attribute: z.string(), op: z.enum(["gte", "lte", "eq"]), value: z.number() }),
  z.object({ kind: z.literal("proficiency"), proficiencyKey: z.string(), minRank: ProficiencyRankSchema }),
  z.object({ kind: z.literal("hasTag"), tag: z.string(), on: z.enum(["self", "event.target", "event.attacker"]) }),
  z.object({ kind: z.literal("eventField"), field: z.string(), equals: z.unknown() }),
  z.object({ kind: z.literal("resource"), resourceKey: z.string(), op: z.enum(["gte", "lte", "eq"]), value: z.number() }),
])

const CheckSpecSchema = z.object({
  against: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("defense"), key: z.string() }),
    z.object({ kind: z.literal("flatDC"), dc: z.number() }),
  ]),
  proficiencyKey: z.string().optional(),
  attribute: z.string().optional(),
})

const DurationSpecSchema = z.object({
  unit: z.enum(["rounds", "minutes", "hours", "encounter", "permanent"]),
  value: z.number().optional(),
})

const ScalingRuleSchema = z.discriminatedUnion("by", [
  z.object({ by: z.literal("level"), base: z.number(), perStep: z.number(), stepSize: z.number().optional() }),
  z.object({ by: z.literal("castLevel"), base: z.number(), perStep: z.number(), stepSize: z.number().optional() }),
  z.object({ by: z.literal("proficiencyRank"), amounts: z.record(z.string(), z.number()) }),
])

const DiceExpressionSchema = z.object({
  kind: z.literal("dice"),
  count: z.union([z.number(), ScalingRuleSchema]),
  faces: z.number(),
})

const ChoiceSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("entitiesByTag"), tag: z.string() }),
  z.object({ kind: z.literal("entitiesByRefs"), refs: z.array(z.string()) }),
  z.object({ kind: z.literal("literal"), options: z.array(z.string()) }),
])

// Effect is recursive (variant.variants: Effect[]) — z.lazy is the standard
// zod pattern for self-referential schemas. Left untyped against the
// hand-written `Effect` type deliberately: zod's inferred optional fields
// are `T | undefined`, which trips exactOptionalPropertyTypes against
// types.ts's plain `field?: T`. The two are structurally the same at
// runtime; safeParseEntity's return casts to `Entity` at the boundary
// instead of fighting that mismatch through every nested schema.
const EffectSchema: z.ZodTypeAny = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("value"),
      target: z.string(),
      op: z.enum(["+", "-", "×", "set"]),
      amount: z.union([z.number(), ScalingRuleSchema, DiceExpressionSchema]),
    }),
    z.object({
      kind: z.literal("applyEntity"),
      entityId: z.string(),
      duration: DurationSpecSchema.optional(),
    }),
    z.object({
      kind: z.literal("variant"),
      selectBy: z.enum(["castLevel", "degreeOfSuccess"]),
      variants: z.array(EffectSchema),
    }),
    z.object({
      kind: z.literal("conditionalDuration"),
      check: CheckSpecSchema,
      onFail: z.literal("remove"),
    }),
    z.object({
      kind: z.literal("choice"),
      bind: z.string(),
      count: z.number(),
      from: ChoiceSourceSchema,
    }),
  ]),
)

const HookSchema = z.object({
  appliesTo: z.string(),
  operation: z.enum(["override", "replaceCurve", "negateIfTagged", "adjustIfTagged"]),
  value: z.unknown(),
})

const ActionCostSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("actions"), count: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]) }),
  z.object({ type: z.literal("reaction") }),
  z.object({ type: z.literal("free") }),
  z.object({ type: z.literal("inherit") }),
])

export const EntitySchema = z.object({
  id: z.string().min(1, "id is required"),
  name: z.string().min(1, "name is required"),
  description: z.string().optional(),
  tags: z.array(z.string()),
  prerequisites: z.array(PrerequisiteSchema),
  conflicts: z.array(z.string()),
  cost: ActionCostSchema,
  wraps: z.string().optional(),
  trigger: TriggerSpecSchema.optional(),
  condition: z.array(ConditionSpecSchema).optional(),
  effects: z.array(EffectSchema),
  hooks: z.array(HookSchema).optional(),
  scaling: z.array(ScalingRuleSchema).optional(),
})

export type EntityParseResult = { success: true; data: Entity } | { success: false; error: string }

/** Human-readable validation, for the editor's review step — not `.parse()`
 * (which throws) since a UI wants to display the problem, not catch an
 * exception. */
export function safeParseEntity(json: unknown): EntityParseResult {
  const result = EntitySchema.safeParse(json)
  if (result.success) return { success: true, data: result.data as Entity }
  return { success: false, error: result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`).join("\n") }
}
