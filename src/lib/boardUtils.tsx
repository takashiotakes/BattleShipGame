// src/lib/boardUtils.ts

import {
  Cell,
  CellStatus,
  Coordinate,
  Orientation,
  PlacedShip,
  ShipDefinition,
} from "../models/types";

export function createEmptyBoard(playerId: number): {
  playerId: number;
  cells: Cell[][];
} {
  const cells: Cell[][] = [];
  for (let y = 0; y < 10; y++) {
    cells[y] = [];
    for (let x = 0; x < 10; x++) {
      cells[y][x] = { x, y, status: "empty" }; // 明示的にstatusを'empty'に
    }
  }
  return { playerId, cells };
}

// 船がボードの範囲内に収まっているかチェック
export function isShipWithinBounds(
  start: Coordinate,
  size: number,
  orientation: Orientation
): boolean {
  if (orientation === "horizontal") {
    return start.x + size <= 10; // x座標は0-9
  } else {
    return start.y + size <= 10; // y座標は0-9
  }
}

// 船が他の船と衝突しないかチェック
// boardCells は、現在考慮しているボードの状態（既存の船が配置済みなど）を反映している
export function isShipPlacementValid(
  boardCells: Cell[][], // このボードに対して配置可能かチェック
  start: Coordinate,
  size: number,
  orientation: Orientation
): boolean {
  for (let i = 0; i < size; i++) {
    const x = orientation === "horizontal" ? start.x + i : start.x;
    const y = orientation === "vertical" ? start.y + i : start.y;

    // 1. 範囲外チェック
    if (x < 0 || x >= 10 || y < 0 || y >= 10) {
      // console.log(`範囲外エラー: x=${x}, y=${y}`); // デバッグ用
      return false;
    }

    // 2. 衝突チェック
    // 既存の船や、隣接セルへの配置禁止ルールも考慮するならここに追加
    // 現状はstatusが'ship'のセルとの衝突のみをチェック
    if (boardCells[y][x].status === "ship") {
      // console.log(`衝突エラー: x=${x}, y=${y}, status=${boardCells[y][x].status}`); // デバッグ用
      return false; // 船と衝突
    }

    // 船の隣接マスに他の船が配置されないようにする（オプション）
    // バトルシップでは、船同士は隣接して配置されないのが一般的です。
    // このルールを適用すると配置がさらに難しくなる可能性がありますが、
    // エラーが頻発する原因の一つとして、このルールの不足が考えられます。
    // 必要であれば以下のコメントアウトを解除して使用してください。
    /*
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        // 現在の船が占めるセル自身はチェックしない
        if (dx === 0 && dy === 0) continue; 

        const checkX = x + dx;
        const checkY = y + dy;

        if (checkX >= 0 && checkX < 10 && checkY >= 0 && checkY < 10) {
          if (boardCells[checkY][checkX].status === 'ship') {
            console.log(`隣接衝突エラー: x=${checkX}, y=${checkY} (対象セル: ${x},${y})`);
            return false;
          }
        }
      }
    }
    */
  }
  return true;
}

// ボードに船を配置し、新しいボードの状態を返す（ディープコピー）
// これは、isShipPlacementValid のシミュレーションや、
// ホバー時のプレビュー表示のために使用される
export function placeShipOnBoard(
  initialCells: Cell[][],
  shipDefinition: ShipDefinition,
  start: Coordinate,
  orientation: Orientation
): Cell[][] {
  const newCells = initialCells.map((row) => row.map((cell) => ({ ...cell }))); // 重要なディープコピー

  for (let i = 0; i < shipDefinition.size; i++) {
    const x = orientation === "horizontal" ? start.x + i : start.x;
    const y = orientation === "vertical" ? start.y + i : start.y;

    // 範囲チェックを念のため行う。isShipWithinBounds が事前に呼ばれるはずだが、防御的に
    if (x >= 0 && x < 10 && y >= 0 && y >= 10) {
      // ★修正: y >= 10 は y < 10 の間違い
      // 正しい修正:
      if (x >= 0 && x < 10 && y >= 0 && y < 10) {
        newCells[y][x] = {
          ...newCells[y][x],
          status: "ship",
          shipId: shipDefinition.id,
        };
      } else {
        // これは発生しないはずだが、もし発生したらログ出力
        console.error(
          `Attempted to place ship out of bounds in placeShipOnBoard: x=${x}, y=${y}`
        );
      }
    }
  }
  return newCells;
}

// 船が配置されたボードのセルを更新する（表示用、または一時的なボード状態生成用）
export function updateCellsWithShips(
  // cells: Cell[][], // この引数は不要、常に新しい空のボードから始める
  playerId: number, // どのプレイヤーのボードか
  placedShips: PlacedShip[]
): Cell[][] {
  // まず完全に空のボードを作成
  const newCells = createEmptyBoard(playerId).cells.map((row) =>
    row.map((cell) => ({ ...cell }))
  ); // ここで改めてディープコピー

  placedShips.forEach((pShip) => {
    for (let i = 0; i < pShip.definition.size; i++) {
      const x =
        pShip.orientation === "horizontal" ? pShip.start.x + i : pShip.start.x;
      const y =
        pShip.orientation === "vertical" ? pShip.start.y + i : pShip.start.y;

      // 範囲チェックはここでも必須
      if (x >= 0 && x < 10 && y >= 0 && y < 10) {
        // status を 'ship' に設定。hit や sunk の状態は GameScreen で後で適用されるべき
        // ここでは純粋な船の配置状態のみを表現
        newCells[y][x] = {
          ...newCells[y][x],
          status: "ship",
          shipId: pShip.id,
        };
      }
    }
  });
  return newCells;
}

// ランダムに船を配置するヘルパー関数
export function generateRandomShipPlacement(
  boardId: number,
  shipDefinition: ShipDefinition,
  existingPlacedShips: PlacedShip[] // これまでに配置済みの船
): PlacedShip | null {
  const orientations: Orientation[] = ["horizontal", "vertical"];
  let attempts = 0;
  const maxAttempts = 10000; // 試行回数をさらに増やす

  while (attempts < maxAttempts) {
    const orientation =
      orientations[Math.floor(Math.random() * orientations.length)];
    const start: Coordinate = {
      x: Math.floor(Math.random() * 10),
      y: Math.floor(Math.random() * 10),
    };

    // 既存の船が配置されたボードを正確にシミュレート
    // updateCellsWithShips を使って、既存の船が配置されたボードを生成
    // ここで渡す playerId は generateRandomShipPlacement の引数にある boardId を使う
    let simulatedCells = updateCellsWithShips(boardId, existingPlacedShips);

    // 新しい船の配置が既存の船と衝突しないか、ボード範囲内かチェック
    if (
      isShipWithinBounds(start, shipDefinition.size, orientation) &&
      isShipPlacementValid(
        simulatedCells,
        start,
        shipDefinition.size,
        orientation
      )
    ) {
      return {
        id: shipDefinition.id,
        definition: shipDefinition,
        start: start,
        orientation: orientation,
        hits: [],
        isSunk: false,
      };
    }
    attempts++;
  }
  console.warn(
    `Could not find a valid placement for ship ${shipDefinition.id} after ${maxAttempts} attempts.`
  );
  return null;
}
