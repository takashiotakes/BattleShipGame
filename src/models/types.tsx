// src/models/types.tsx

export type PlayerType = 'human' | 'ai' | 'none';

export type AIDifficulty = 'easy' | 'normal' | 'hard';

export type GamePhase =
  | 'select-players'
  | 'ship-placement'
  | 'in-game'
  | 'game-over';

export interface PlayerSettings {
  id: number;
  name: string; // プレイヤー名を追加
  type: PlayerType;
  difficulty?: AIDifficulty; // AI のときだけ有効
}

export type Orientation = 'horizontal' | 'vertical';

export interface ShipDefinition {
  id: string; // 追加: 船のユニークID
  name: string;
  size: number;
}

// 共通の船の定義
export const ALL_SHIPS: ShipDefinition[] = [
  { id: 'carrier', name: '空母', size: 5 },
  { id: 'battleship', name: '戦艦', size: 4 },
  { id: 'cruiser', name: '巡洋艦', size: 3 },
  { id: 'submarine', name: '潜水艦', size: 3 },
  { id: 'destroyer', name: '駆逐艦', size: 2 },
];


export interface Coordinate {
  x: number; // 0〜9
  y: number; // 0〜9
}

export type CellStatus = 'empty' | 'ship' | 'hit' | 'miss' | 'sunk';
export type AttackedCellStatus = 'hit' | 'miss' | 'empty'; // 相手のボードに表示される状態

export interface Cell {
  x: number;
  y: number;
  status: CellStatus;
  shipId?: string; // どの船か（sunk 判定などに使う）
}

export interface PlacedShip {
  id: string; // ShipDefinitionのidと紐付ける
  definition: ShipDefinition;
  start: Coordinate;
  orientation: Orientation;
  hits: Coordinate[]; // ヒットした座標のリスト
  isSunk: boolean;
}

export interface PlayerBoard {
  playerId: number;
  cells: Cell[][]; // 自身のボードのセル状態 (船の位置が分かる)
  placedShips: PlacedShip[]; // 配置済みの船の具体的な情報
  // 相手のボードへの攻撃結果を記録する盤面
  // 攻撃履歴として記録し、UI表示用に変換する方が良いかもしれないが、今回はシンプルに盤面として持つ
  // ただし、このフィールドは自身の攻撃結果のみを記録する
  attackedCells: { [key: string]: AttackedCellStatus }; // 例: "0,0": "hit", "1,2": "miss"
}

export interface GameState {
  players: PlayerSettings[];
  playerBoards: { [playerId: number]: PlayerBoard };
  phase: GamePhase;
  currentPlayerTurnId: number; // 現在のターンプレイヤーのID
  // attackHistory: AttackHistoryEntry[]; // 攻撃履歴 (今後追加)
}

export interface AttackResult {
  hit: boolean;
  sunkShipId?: string; // 沈んだ船のID
}