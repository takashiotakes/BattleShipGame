// src/models/types.tsx

export type PlayerType = "human" | "ai" | "none";

export type AIDifficulty = "easy" | "normal" | "hard";

export type GamePhase =
  | "select-players"
  | "ship-placement"
  | "in-game"
  | "game-over";

export interface PlayerSettings {
  id: number;
  name: string; // プレイヤー名を追加
  type: PlayerType;
  difficulty?: AIDifficulty; // AI のときだけ有効
}

export type Orientation = "horizontal" | "vertical";

export interface ShipDefinition {
  name: string;
  size: number;
}

export interface PlacedShip {
  id: string; // 各配置された船のユニークID (UUIDなど)
  definition: ShipDefinition;
  start: Coordinate;
  orientation: Orientation;
  hits: Coordinate[]; // ヒットした座標のリスト
  isSunk: boolean; // 撃沈したかどうか
}

export type CellStatus = "empty" | "ship" | "hit" | "miss" | "sunk";

export interface Cell {
  x: number; // 0〜9
  y: number; // 0〜9
  status: CellStatus;
  shipId?: string; // どの船の一部か（sunk 判定などに使う）
}

export interface Coordinate {
  x: number; // 0〜9
  y: number; // 0〜9
}

export interface AttackedCellInfo {
  result: "hit" | "miss" | "sunk";
  shipId?: string;
}

export interface PlayerBoard {
  playerId: number;
  cells: Cell[][];
  placedShips: PlacedShip[];
  attackedCells: { [key: string]: AttackedCellInfo }; // 例: {'0,0': { result: 'hit', shipId: 'carrier-1' }}
}

export const ALL_SHIPS: ShipDefinition[] = [
  { name: "空母", size: 5 },
  { name: "戦艦", size: 4 },
  { name: "巡洋艦", size: 3 },
  { name: "潜水艦", size: 3 },
  { name: "駆逐艦", size: 2 },
];

export interface GameState {
  players: PlayerSettings[];
  playerBoards: { [playerId: number]: PlayerBoard }; // プレイヤーIDをキーとする
  phase: GamePhase;
  currentPlayerTurnId: number; // 現在のターンプレイヤーのID
  winnerId: number | null; // 勝者のプレイヤーID
}

export interface AttackResult {
  playerId: number; // 攻撃したプレイヤーID
  targetPlayerId: number; // 攻撃されたプレイヤーID
  target: Coordinate;
  result: "hit" | "miss" | "sunk";
  sunkShipName?: string; // 撃沈した船の名前 (追加)
}

export interface AttackHistoryEntry {
  attackerId: number;
  defenderId: number;
  coord: Coordinate;
  result: "hit" | "miss" | "sunk";
  sunkShipName?: string; // 撃沈した船の名前 (追加)
}
