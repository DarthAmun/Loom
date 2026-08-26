import { Injectable, signal } from '@angular/core';
import { characterStore, type Character, type NewCharacterParams, type StoredCharacter } from 'loom';

@Injectable({ providedIn: 'root' })
export class CharacterStoreService {
  readonly characters = signal<StoredCharacter[]>([]);
  readonly loading = signal(false);

  async refresh(): Promise<void> {
    this.loading.set(true);
    try {
      this.characters.set(await characterStore.list());
    } finally {
      this.loading.set(false);
    }
  }

  get(id: number): Promise<StoredCharacter | undefined> {
    return characterStore.get(id);
  }

  async create(params: NewCharacterParams): Promise<StoredCharacter> {
    const created = await characterStore.create(params);
    await this.refresh();
    return created;
  }

  async update(id: number, changes: Partial<Character>): Promise<void> {
    await characterStore.update(id, changes);
    await this.refresh();
  }

  async remove(id: number): Promise<void> {
    await characterStore.delete(id);
    await this.refresh();
  }
}
