import type { Entity, EntityRef } from "./types.js"

export class EntityRegistry {
  private readonly byId = new Map<string, Entity>()

  register(entity: Entity): void {
    if (this.byId.has(entity.id)) {
      throw new Error(`Entity "${entity.id}" already registered`)
    }
    this.byId.set(entity.id, entity)
  }

  registerAll(entities: Entity[]): void {
    for (const entity of entities) this.register(entity)
  }

  get(ref: EntityRef): Entity {
    const entity = this.byId.get(ref)
    if (!entity) throw new Error(`Unknown entity "${ref}"`)
    return entity
  }

  tryGet(ref: EntityRef): Entity | undefined {
    return this.byId.get(ref)
  }
}
