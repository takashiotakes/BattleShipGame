// src/utils/useAiAttackLogic.tsx
import { useCallback } from 'react';
import { PlayerBoard, Coordinate, CellStatus, AIDifficulty, PlacedShip, ALL_SHIPS, ShipDefinition } from '../models/types';

interface AiAttackLogic {
  getAiAttackCoordinate: (
    difficulty: AIDifficulty,
    opponentBoard: PlayerBoard,
    sunkShips: PlacedShip[], // 撃沈された船のリスト
    remainingShipDefinitions: ShipDefinition[] // まだ見つかっていない船の定義リスト
  ) => Coordinate;
}

export const useAiAttackLogic = (): AiAttackLogic => {

  // EasyモードのAIロジック
  const getEasyAttack = useCallback((opponentBoard: PlayerBoard): Coordinate => {
    const availableCells: Coordinate[] = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const cellStatus = opponentBoard.cells[r][c].status;
        if (cellStatus === 'empty' || cellStatus === 'ship') { // まだ攻撃していないマス
          availableCells.push({ x: c, y: r });
        }
      }
    }
    const randomIndex = Math.floor(Math.random() * availableCells.length);
    return availableCells[randomIndex];
  }, []);

  // NormalモードのAIロジック
  const getNormalAttack = useCallback((opponentBoard: PlayerBoard): Coordinate => {
    // 1. ヒットした船の周囲を探す (船が沈んでいない場合)
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (opponentBoard.cells[r][c].status === 'hit') {
          // ヒットしたマスの周囲4方向をチェック
          const neighbors: Coordinate[] = [
            { x: c, y: r - 1 }, // 上
            { x: c, y: r + 1 }, // 下
            { x: c - 1, y: r }, // 左
            { x: c + 1, y: r }, // 右
          ];

          // まだ攻撃していない隣接セルがあれば、そこを優先
          for (const neighbor of neighbors) {
            if (
              neighbor.y >= 0 && neighbor.y < 10 &&
              neighbor.x >= 0 && neighbor.x < 10 &&
              (opponentBoard.cells[neighbor.y][neighbor.x].status === 'empty' ||
               opponentBoard.cells[neighbor.y][neighbor.x].status === 'ship')
            ) {
              return neighbor;
            }
          }
        }
      }
    }

    // 2. ヒットしているマスがない場合、または周囲がすべて攻撃済みの場合は、市松模様（チェッカーボード）で攻撃
    // これにより、効率的に船を発見しやすくなる
    const availableCheckerboardCells: Coordinate[] = [];
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        // (行 + 列) が偶数のマスのみを対象にする (市松模様)
        if ((r + c) % 2 === 0 &&
            (opponentBoard.cells[r][c].status === 'empty' ||
             opponentBoard.cells[r][c].status === 'ship')) {
          availableCheckerboardCells.push({ x: c, y: r });
        }
      }
    }

    if (availableCheckerboardCells.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableCheckerboardCells.length);
      return availableCheckerboardCells[randomIndex];
    }

    // 3. 市松模様のマスが全て攻撃済みの場合、残りの未攻撃マスからランダムに選択（最終手段）
    return getEasyAttack(opponentBoard); // Easyモードと同じロジックで残りを攻撃
  }, [getEasyAttack]);

  // HardモードのAIロジック (Normalモードをベースに拡張)
  const getHardAttack = useCallback((
    opponentBoard: PlayerBoard,
    sunkShips: PlacedShip[],
    remainingShipDefinitions: ShipDefinition[]
  ): Coordinate => {
    // 1. ヒットした船の周囲を探す (Normalと同じく優先)
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (opponentBoard.cells[r][c].status === 'hit') {
          const hitShipId = opponentBoard.cells[r][c].shipId;
          const placedShip = opponentBoard.placedShips.find(s => s.id === hitShipId);

          // 既に沈んでいる船のIDと一致する場合はスキップ（念のため）
          if (placedShip && placedShip.isSunk) continue;

          // ヒットしたマスの周囲4方向をチェック
          const neighbors: Coordinate[] = [
            { x: c, y: r - 1 }, // 上
            { x: c, y: r + 1 }, // 下
            { x: c - 1, y: r }, // 左
            { x: c + 1, y: r }, // 右
          ];

          // まだ攻撃していない隣接セルがあれば、そこを優先
          // 特に、もし複数のヒットがある場合は、それらのヒットが一直線になるように攻撃を試みる
          const hitsForThisShip = placedShip ? placedShip.hits : [];
          if (hitsForThisShip.length > 1) { // 既に2つ以上のヒットがある場合、船の方向が判明している可能性
            const firstHit = hitsForThisShip[0];
            const secondHit = hitsForThisShip[1];
            const isHorizontal = firstHit.y === secondHit.y;
            const isVertical = firstHit.x === secondHit.x;

            if (isHorizontal) { // 横方向の船
              const minX = Math.min(...hitsForThisShip.map(h => h.x));
              const maxX = Math.max(...hitsForThisShip.map(h => h.x));
              // 左隣と右隣を優先
              const potentialTargets: Coordinate[] = [
                { x: minX - 1, y: firstHit.y },
                { x: maxX + 1, y: firstHit.y }
              ];
              for (const target of potentialTargets) {
                if (
                  target.y >= 0 && target.y < 10 &&
                  target.x >= 0 && target.x < 10 &&
                  (opponentBoard.cells[target.y][target.x].status === 'empty' ||
                   opponentBoard.cells[target.y][target.x].status === 'ship')
                ) {
                  return target;
                }
              }
            } else if (isVertical) { // 縦方向の船
              const minY = Math.min(...hitsForThisShip.map(h => h.y));
              const maxY = Math.max(...hitsForThisShip.map(h => h.y));
              // 上隣と下隣を優先
              const potentialTargets: Coordinate[] = [
                { x: firstHit.x, y: minY - 1 },
                { x: firstHit.x, y: maxY + 1 }
              ];
              for (const target of potentialTargets) {
                if (
                  target.y >= 0 && target.y < 10 &&
                  target.x >= 0 && target.x < 10 &&
                  (opponentBoard.cells[target.y][target.x].status === 'empty' ||
                   opponentBoard.cells[target.y][target.x].status === 'ship')
                ) {
                  return target;
                }
              }
            }
          }

          // 船の方向が不明な場合、または直線攻撃でヒットしなかった場合、Normalと同じ周囲攻撃
          for (const neighbor of neighbors) {
            if (
              neighbor.y >= 0 && neighbor.y < 10 &&
              neighbor.x >= 0 && neighbor.x < 10 &&
              (opponentBoard.cells[neighbor.y][neighbor.x].status === 'empty' ||
               opponentBoard.cells[neighbor.y][neighbor.x].status === 'ship')
            ) {
              return neighbor;
            }
          }
        }
      }
    }

    // 2. ヒットしているマスがない場合、または周囲が全て攻撃済みの場合は、確率論に基づいた攻撃
    // 未攻撃のマスそれぞれについて、まだ沈んでいない各船がそこに配置されうる確率を計算する
    const probabilities: { [key: string]: number } = {}; // "y,x" -> 確率値

    const BOARD_SIZE = 10;

    // 各マスを初期化
    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        probabilities[`${r},${c}`] = 0;
      }
    }

    // まだ見つかっていない船について、考えられるすべての配置パターンを試す
    remainingShipDefinitions.forEach(shipDef => {
      for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          // 横方向
          if (c + shipDef.size <= BOARD_SIZE) {
            let isValidPlacement = true;
            for (let i = 0; i < shipDef.size; i++) {
              const cell = opponentBoard.cells[r][c + i];
              if (cell.status === 'hit' || cell.status === 'miss' || cell.status === 'sunk') {
                // 攻撃済みのマスや沈んだ船の一部がある場合は配置不可
                isValidPlacement = false;
                break;
              }
            }
            if (isValidPlacement) {
              for (let i = 0; i < shipDef.size; i++) {
                probabilities[`${r},${c + i}`]++;
              }
            }
          }
          // 縦方向
          if (r + shipDef.size <= BOARD_SIZE) {
            let isValidPlacement = true;
            for (let i = 0; i < shipDef.size; i++) {
              const cell = opponentBoard.cells[r + i][c];
              if (cell.status === 'hit' || cell.status === 'miss' || cell.status === 'sunk') {
                isValidPlacement = false;
                break;
              }
            }
            if (isValidPlacement) {
              for (let i = 0; i < shipDef.size; i++) {
                probabilities[`${r + i},${c}`]++;
              }
            }
          }
        }
      }
    });

    let maxProbability = -1;
    let bestCandidates: Coordinate[] = [];

    for (let r = 0; r < BOARD_SIZE; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        const coordKey = `${r},${c}`;
        const currentProbability = probabilities[coordKey];
        const cellStatus = opponentBoard.cells[r][c].status;

        // 既に攻撃済みのマスは対象外
        if (cellStatus === 'hit' || cellStatus === 'miss' || cellStatus === 'sunk') {
          continue;
        }

        if (currentProbability > maxProbability) {
          maxProbability = currentProbability;
          bestCandidates = [{ x: c, y: r }];
        } else if (currentProbability === maxProbability) {
          bestCandidates.push({ x: c, y: r });
        }
      }
    }

    if (bestCandidates.length > 0) {
      // 確率が最も高いマスが複数ある場合、ランダムに選択
      return bestCandidates[Math.floor(Math.random() * bestCandidates.length)];
    }

    // 3. 確率計算でも候補が見つからない場合（ほぼ発生しないはずだが念のため）、Easyモードと同じランダム攻撃
    return getEasyAttack(opponentBoard);

  }, [getEasyAttack]);


  const getAiAttackCoordinate = useCallback((
    difficulty: AIDifficulty,
    opponentBoard: PlayerBoard,
    sunkShips: PlacedShip[],
    remainingShipDefinitions: ShipDefinition[]
  ): Coordinate => {
    if (difficulty === 'easy') {
      return getEasyAttack(opponentBoard);
    } else if (difficulty === 'normal') {
      return getNormalAttack(opponentBoard);
    } else if (difficulty === 'hard') {
      return getHardAttack(opponentBoard, sunkShips, remainingShipDefinitions);
    }
    // デフォルトはEasy
    return getEasyAttack(opponentBoard);
  }, [getEasyAttack, getNormalAttack, getHardAttack]);

  return { getAiAttackCoordinate };
};