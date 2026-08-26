import { Injectable, signal } from '@angular/core';
import {
  entityStore,
  allMechanics,
  allPackageEntities,
  type Entity,
} from 'loom';

@Injectable({ providedIn: 'root' })
export class EntityStoreService {
  readonly entities = signal<Entity[]>([]);
  readonly loading = signal(false);

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      const all = await entityStore.list();
      all.sort((a, b) => a.name.localeCompare(b.name));
      this.entities.set(all);
    } finally {
      this.loading.set(false);
    }
  }

  get(id: string): Promise<Entity | undefined> {
    return entityStore.get(id);
  }

  async save(entity: Entity): Promise<void> {
    await entityStore.put(entity);
    await this.refresh();
  }

  async remove(id: string): Promise<void> {
    await entityStore.delete(id);
    await this.refresh();
  }

  /** Loads Phase 0's drafted mechanics/packages — a quick way to have
   * something to look at without hand-writing JSON first. */
  async seedDraftData(): Promise<void> {
    await entityStore.putAll([...allMechanics, ...allPackageEntities]);
    await this.refresh();
  }
}
