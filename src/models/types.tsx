// src/models/types.tsx (修正・追記)

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
  id: string; // 船のID (例: 'carrier-0', 'battleship-0')
  name: string;
  size: number;
}

// すべての船の定義 (AIロジックで使用)
export const ALL_SHIPS: ShipDefinition[] = [
  { id: "carrier-0", name: "空母", size: 5 },
  { id: "battleship-0", name: "戦艦", size: 4 },
  { id: "cruiser-0", name: "巡洋艦", size: 3 },
  { id: "submarine-0", name: "潜水艦", size: 3 },
  { id: "destroyer-0", name: "駆逐艦", size: 2 },
];

// 船の配置情報（まだボードに置かれていない、プレイヤーが選択中の船など）
export interface TemporaryShipPlacement {
  ship: ShipDefinition;
  start: Coordinate | null; // 配置候補位置
  orientation: Orientation;
  placed: boolean; // 配置済みか
}

// ボードに配置された船の情報
export interface PlacedShip {
  id: string; // ShipDefinition の id と同じ
  definition: ShipDefinition;
  start: Coordinate;
  orientation: Orientation;
  hits: Coordinate[]; // ヒットした座標のリスト
  isSunk: boolean; // 沈没したか
}

export type CellStatus = "empty" | "ship" | "hit" | "miss" | "sunk";

export interface Cell {
  x: number; // 0〜9
  y: number; // 0〜9
  status: CellStatus;
  shipId?: string; // どの船か（sunk 判定などに使う）
}

export interface PlayerBoard {
  playerId: number;
  cells: Cell[][];
  placedShips: PlacedShip[]; // 配置済みの船のリスト
  attackedCells: { [key: string]: "hit" | "miss" }; // 攻撃した座標と結果
}

export interface GameState {
  players: PlayerSettings[];
  playerBoards: { [playerId: number]: PlayerBoard };
  phase: GamePhase;
  currentPlayerTurnId: number; // 現在のターンプレイヤーID
  winnerId: number | null; // 勝者プレイヤーID
}

export interface Coordinate {
  x: number; // 0〜9
  y: number; // 0〜9
}

// AttackResult を修正
export interface AttackResult {
  hit: boolean;
  sunkShipId?: string; // 船が沈んだ場合にそのIDを返す
}
