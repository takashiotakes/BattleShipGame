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
  id: string; // 船のID (例: 'carrier-0', 'battleship-0')
  name: string;
  size: number;
}

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

// === ここから変更 ===

// 単一ターゲットへの攻撃結果（MultiAttackResult の要素として使用）
export interface AttackResult {
  hit: boolean;
  sunkShipId?: string; // 沈没した船のID (あれば)
  isAlreadyAttacked: boolean; // すでに攻撃済みのマスだったか
  shipName?: string; // ヒットした場合の船の名前
}

// 1回の攻撃で発生する全ての攻撃結果をまとめる
export interface MultiAttackResult {
  attackerId: number; // 攻撃したプレイヤーのID
  coordinate: Coordinate; // 攻撃したマス
  results: {
    targetPlayerId: number; // 攻撃されたプレイヤーのID
    hit: boolean;
    sunkShipId?: string;
    isAlreadyAttacked: boolean;
    shipName?: string;
  }[];
}

export interface PlayerBoard {
  playerId: number;
  cells: Cell[][];
  placedShips: PlacedShip[]; // 配置済みの船のリスト

  // 自分が「攻撃した」マスの状態（赤ピン/白ピン）。ターゲットプレイヤーIDごとの攻撃記録。
  // 例: attackedCellsByTarget[targetPlayerId]['x,y'] = 'hit'
  attackedCellsByTarget: {
    [targetPlayerId: number]: { [key: string]: "hit" | "miss" };
  };

  // 自分が「攻撃された」マスの状態（自分のボード上の赤ピン/白ピン）。
  // 例: receivedAttacks['x,y'] = 'hit'
  receivedAttacks: { [key: string]: "hit" | "miss" | "sunk" }; // 'sunk'は自分の船が撃沈された場合
}

export interface GameState {
  players: PlayerSettings[];
  playerBoards: { [playerId: number]: PlayerBoard };
  phase: GamePhase;
  currentPlayerTurnId: number; // 現在のターンプレイヤーID
  winnerId: number | null; // 勝者プレイヤーID (単独勝利の場合)
  // 複数人の勝者がありうる場合（例：全員撃沈で引き分け）、または最後の生存者がいない場合を考慮
  // winnerIds?: number[]; // 将来的な拡張で複数勝利者を扱う場合

  // 直前の多人数攻撃の結果を保持
  latestMultiAttackResult: MultiAttackResult | null;
}

export interface Coordinate {
  x: number; // 0〜9
  y: number; // 0〜9
}

// 全ての船の定義
export const ALL_SHIPS: ShipDefinition[] = [
  { id: "carrier-0", name: "空母", size: 5 },
  { id: "battleship-0", name: "戦艦", size: 4 },
  { id: "cruiser-0", name: "巡洋艦", size: 3 },
  { id: "submarine-0", name: "潜水艦", size: 3 },
  { id: "destroyer-0", name: "駆逐艦", size: 2 },
];
