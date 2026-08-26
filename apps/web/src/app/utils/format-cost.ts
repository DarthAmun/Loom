import type { ActionCost } from 'loom';

export function formatCost(cost: ActionCost): string {
  switch (cost.type) {
    case 'actions':
      return cost.count === 1 ? '1 action' : `${cost.count} actions`;
    case 'reaction':
      return 'Reaction';
    case 'free':
      return 'Free';
    case 'inherit':
      return 'Inherit';
  }
}
