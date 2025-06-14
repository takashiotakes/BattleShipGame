// models/types.tsx

export type PlayerType = 'human' | 'ai' | 'none';

export type AIDifficulty = 'easy' | 'normal' | 'hard';

export type GamePhase =
  | 'select-players'
  | 'ship-placement'
  | 'in-game'
  | 'game-over';

export interface PlayerSettings {
  id: number;
  type: PlayerType;
  difficulty?: AIDifficulty; // AI のときだけ有効
}

export type Orientation = 'horizontal' | 'vertical';

export interface ShipDefinition {
  name: string;
  size: number;
}

export interface ShipPlacement {
  ship: ShipDefinition;
  start: Coordinate;
  orientation: Orientation;
  placed: boolean;
}

export type CellStatus = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk';

export interface Cell {
  x: number;
  y: number;
  status: CellStatus;
  shipId?: string; // どの船か（sunk 判定などに使う）
}

export interface BoardState {
  cells: Cell[][];
  ships: ShipPlacement[];
}

export interface Coordinate {
  x: number; // 0〜9
  y: number; // 0〜9
}

export interface AttackResult {
  playerId: number;
  target: Coordinate;
  result: 'hit' | 'miss' | 'sunk';
}

export interface AttackHistoryEntry {
  attackerId: number;
  defenderId: number;
  coord: Coordinate;
  result: 'hit' | 'miss' | 'sunk';
}

export interface GameState {
  phase: GamePhase;
  currentTurn: number; // 0〜3のプレイヤーID
  boards: BoardState[]; // プレイヤーごとの盤面
  history: AttackHistoryEntry[];
  players: PlayerSettings[];
}
