// src/lib/boardUtils.ts

import { Cell, CellStatus, Coordinate, Orientation, PlacedShip, ShipDefinition } from '../models/types';

export function createEmptyBoard(playerId: number): { playerId: number; cells: Cell[][] } {
  const cells: Cell[][] = [];
  for (let y = 0; y < 10; y++) {
    cells[y] = [];
    for (let x = 0; x < 10; x++) {
      cells[y][x] = { x, y, status: 'empty' };
    }
  }
  return { playerId, cells };
}

// 船がボードの範囲内に収まっているかチェック
export function isShipWithinBounds(start: Coordinate, size: number, orientation: Orientation): boolean {
  if (orientation === 'horizontal') {
    return start.x + size <= 10;
  } else {
    return start.y + size <= 10;
  }
}

// 船が他の船と衝突しないかチェック
export function isShipPlacementValid(
  boardCells: Cell[][],
  start: Coordinate,
  size: number,
  orientation: Orientation
): boolean {
  for (let i = 0; i < size; i++) {
    const x = orientation === 'horizontal' ? start.x + i : start.x;
    const y = orientation === 'vertical' ? start.y + i : start.y;

    if (x < 0 || x >= 10 || y < 0 || y >= 10 || boardCells[y][x].status === 'ship') {
      return false; // 範囲外または既存の船と衝突
    }
  }
  return true;
}

// 船が配置されたボードを更新する関数
export function placeShipOnBoard(
  initialCells: Cell[][],
  ship: ShipDefinition,
  start: Coordinate,
  orientation: Orientation
): Cell[][] {
  const newCells = initialCells.map(row => row.map(cell => ({ ...cell }))); // ディープコピー

  for (let i = 0; i < ship.size; i++) {
    const x = orientation === 'horizontal' ? start.x + i : start.x;
    const y = orientation === 'vertical' ? start.y + i : start.y;
    newCells[y][x] = { ...newCells[y][x], status: 'ship', shipId: ship.id };
  }
  return newCells;
}

// ボードのセルに船の状態を反映させる (表示用)
export function updateCellsWithShips(cells: Cell[][], placedShips: PlacedShip[]): Cell[][] {
  const newCells = cells.map(row => row.map(cell => ({ ...cell }))); // ディープコピー

  placedShips.forEach(pShip => {
    for (let i = 0; i < pShip.definition.size; i++) {
      const x = pShip.orientation === 'horizontal' ? pShip.start.x + i : pShip.start.x;
      const y = pShip.orientation === 'vertical' ? pShip.start.y + i : pShip.start.y;

      if (newCells[y] && newCells[y][x]) {
        // すでにヒットしているセルや沈んでいるセルは上書きしない
        if (pShip.isSunk) {
            newCells[y][x] = { ...newCells[y][x], status: 'sunk', shipId: pShip.id };
        } else if (pShip.hits.some(h => h.x === x && h.y === y)) {
            newCells[y][x] = { ...newCells[y][x], status: 'hit', shipId: pShip.id };
        } else {
            // 何もなければ船として表示
            newCells[y][x] = { ...newCells[y][x], status: 'ship', shipId: pShip.id };
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
  existingPlacedShips: PlacedShip[]
): PlacedShip | null {
  const emptyBoard = createEmptyBoard(boardId);
  // 既存の船を仮に配置して、空きマスを正確に判断する
  let currentCells = emptyBoard.cells;
  existingPlacedShips.forEach(pShip => {
    currentCells = placeShipOnBoard(currentCells, pShip.definition, pShip.start, pShip.orientation);
  });

  const orientations: Orientation[] = ['horizontal', 'vertical'];
  let attempts = 0;
  const maxAttempts = 1000; // 無限ループ防止

  while (attempts < maxAttempts) {
    const orientation = orientations[Math.floor(Math.random() * orientations.length)];
    const start: Coordinate = {
      x: Math.floor(Math.random() * 10),
      y: Math.floor(Math.random() * 10),
    };

    if (isShipWithinBounds(start, shipDefinition.size, orientation) &&
        isShipPlacementValid(currentCells, start, shipDefinition.size, orientation)) {

      return {
        id: shipDefinition.id,
        definition: shipDefinition,
        start,
        orientation,
        hits: [],
        isSunk: false,
      };
    }
    attempts++;
  }
  console.warn(`Failed to place ship ${shipDefinition.name} after ${maxAttempts} attempts.`);
  return null; // 配置できなかった場合
}