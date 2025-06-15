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
      cells[y][x] = { x, y, status: "empty" };
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
    return start.x + size <= 10;
  } else {
    return start.y + size <= 10;
  }
}

// 船が他の船と衝突しないかチェック
export function isShipPlacementValid(
  boardCells: Cell[][], // このボードに対して配置可能かチェック
  start: Coordinate,
  size: number,
  orientation: Orientation
): boolean {
  for (let i = 0; i < size; i++) {
    const x = orientation === "horizontal" ? start.x + i : start.x;
    const y = orientation === "vertical" ? start.y + i : start.y;

    // 範囲外チェックと衝突チェック
    if (
      x < 0 ||
      x >= 10 ||
      y < 0 ||
      y >= 10 ||
      boardCells[y][x].status === "ship"
    ) {
      return false; // 範囲外または船と衝突
    }
  }
  return true;
}

// ボードに船を配置し、新しいボードの状態を返す
// これは一時的なボード状態をシミュレートするために使用
export function placeShipOnBoard(
  initialCells: Cell[][], // 元のボードの状態
  shipDefinition: ShipDefinition,
  start: Coordinate,
  orientation: Orientation
): Cell[][] {
  const newCells = initialCells.map((row) => row.map((cell) => ({ ...cell }))); // ディープコピー
  for (let i = 0; i < shipDefinition.size; i++) {
    const x = orientation === "horizontal" ? start.x + i : start.x;
    const y = orientation === "vertical" ? start.y + i : start.y;
    newCells[y][x] = {
      ...newCells[y][x],
      status: "ship",
      shipId: shipDefinition.id,
    };
  }
  return newCells;
}

// 船が配置されたボードのセルを更新する（最終的な表示用）
export function updateCellsWithShips(
  cells: Cell[][],
  placedShips: PlacedShip[]
): Cell[][] {
  const newCells = cells.map((row) =>
    row.map((cell) => ({ ...cell, shipId: undefined }))
  ); // shipId をリセット

  placedShips.forEach((pShip) => {
    for (let i = 0; i < pShip.definition.size; i++) {
      const x =
        pShip.orientation === "horizontal" ? pShip.start.x + i : pShip.start.x;
      const y =
        pShip.orientation === "vertical" ? pShip.start.y + i : pShip.start.y;

      // 範囲チェック (念のため)
      if (x >= 0 && x < 10 && y >= 0 && y < 10) {
        // attackedCells の情報はここに反映されない。それは GameScreen で処理
        // ただし、すでに hit や miss の状態であればそれを維持
        if (
          newCells[y][x].status === "hit" ||
          newCells[y][x].status === "sunk"
        ) {
          newCells[y][x] = { ...newCells[y][x], shipId: pShip.id };
        } else {
          // 何もなければ船として表示
          newCells[y][x] = {
            ...newCells[y][x],
            status: "ship",
            shipId: pShip.id,
          };
        }
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
  const maxAttempts = 2000; // 無限ループ防止のため試行回数を増やす

  while (attempts < maxAttempts) {
    const orientation =
      orientations[Math.floor(Math.random() * orientations.length)];
    const start: Coordinate = {
      x: Math.floor(Math.random() * 10),
      y: Math.floor(Math.random() * 10),
    };

    // 現在のボード状態をシミュレート（既存の船を仮配置）
    let simulatedCells = createEmptyBoard(boardId).cells;
    existingPlacedShips.forEach((pShip) => {
      // 既存の船が全て有効な配置であると仮定して、シミュレートボードに配置
      simulatedCells = placeShipOnBoard(
        simulatedCells,
        pShip.definition,
        pShip.start,
        pShip.orientation
      );
    });

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
      // simulatedCells を渡す
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
  return null; // 有効な配置が見つからなかった場合
}
