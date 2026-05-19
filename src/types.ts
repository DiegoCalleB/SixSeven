export interface GameData {
  id: string;
  ownerId: string;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: any;
  players: Record<string, {
    name: string;
    joinedAt: any;
  }>;
}

export interface GameAction {
  id: string;
  uid: string;
  type: 'throw' | 'smash';
  cardValue?: number;
  pattern?: string;
  createdAt: any;
  playerIds: string[];
}
