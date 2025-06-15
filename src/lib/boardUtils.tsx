// src/lib/boardUtils.ts

import { Cell, CellStatus, Coordinate, Orientation, PlacedShip, ShipDefinition } from '../models/types';
import { ALL_SHIPS } from '../models/types'; // ALL_SHIPS をインポート

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

// 船をボードに配置するヘルパー関数（実際にCellの状態を更新）
export function placeShipOnBoard(
  initialCells: Cell[][],
  shipDefinition: ShipDefinition,
  start: Coordinate,
  orientation: Orientation
): Cell[][] {
  const newCells = initialCells.map(row => [...row]); // ディープコピー
  for (let i = 0; i < shipDefinition.size; i++) {
    const x = orientation === 'horizontal' ? start.x + i : start.x;
    const y = orientation === 'vertical' ? start.y + i : start.y;
    if (newCells[y] && newCells[y][x]) { // 範囲チェック
      newCells[y][x] = { ...newCells[y][x], status: 'ship', shipId: shipDefinition.id };
    }
  }
  return newCells;
}

// 既存のplacedShipsに基づいてcellsの状態を更新する関数
// isShipVisible: 自分のボードの船を表示するか、相手のボードのように非表示にするか
export function updateCellsWithShips(
  initialCells: Cell[][],
  placedShips: PlacedShip[],
  isShipVisible: boolean
): Cell[][] {
  let newCells = initialCells.map(row => row.map(cell => ({ ...cell, status: 'empty', shipId: undefined }))); // 初期化

  placedShips.forEach(pShip => {
    for (let i = 0; i < pShip.definition.size; i++) {
      const x = pShip.orientation === 'horizontal' ? pShip.start.x + i : pShip.start.x;
      const y = pShip.orientation === 'vertical' ? pShip.start.y + i : pShip.start.y;

      if (newCells[y] && newCells[y][x]) {
        // まずは 'empty' で初期化されているので、船があるマスを 'ship' に設定
        newCells[y][x] = { ...newCells[y][x], status: 'ship', shipId: pShip.id };

        // ヒットしたマス、沈没したマスを上書き
        const hitCoord = pShip.hits.find(h => h.x === x && h.y === y);
        if (hitCoord) {
          newCells[y][x] = { ...newCells[y][x], status: pShip.isSunk ? 'sunk' : 'hit', shipId: pShip.id };
        } else if (!isShipVisible && newCells[y][x].status === 'ship') {
          // 相手のボードで、まだ攻撃されていない船は 'empty' として表示（見えない状態）
          newCells[y][x] = { ...newCells[y][x], status: 'empty' };
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
  // ここでの currentCells は、まだplacedShipsが反映されていない（empty）ボードを使用
  // isShipPlacementValid が既存のshipと衝突しないか見ているため、
  // 既存の船を考慮した配置が可能になるように修正する
  const tempCellsForValidation = createEmptyBoard(boardId).cells;
  let currentCellsForValidation = tempCellsForValidation;

  existingPlacedShips.forEach(pShip => {
    currentCellsForValidation = placeShipOnBoard(currentCellsForValidation, pShip.definition, pShip.start, pShip.orientation);
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
      isShipPlacementValid(currentCellsForValidation, start, shipDefinition.size, orientation)) { // ここで既存船を考慮したボードを使う
      return {
        id: shipDefinition.id, // ShipDefinition の id をそのまま使用
        definition: shipDefinition,
        start: start,
        orientation: orientation,
        hits: [],
        isSunk: false,
      };
    }
    attempts++;
  }
  console.warn(`Failed to place ship ${shipDefinition.name} after ${maxAttempts} attempts.`);
  return null;
}

// 船が完全に沈没したかを判定する関数
export function isShipSunk(ship: PlacedShip): boolean {
  // 船のサイズとヒット数が同じであれば沈没
  return ship.definition.size === ship.hits.length;
}

// ボード上の全ての船が沈没したか判定する関数
export function areAllShipsSunk(placedShips: PlacedShip[]): boolean {
  return placedShips.every(ship => ship.isSunk);
}