// src/contexts/GameContext.tsx

import React, { createContext, useContext, useState, ReactNode, useCallback, useRef, useEffect } from 'react';
import { GamePhase, PlayerSettings, PlayerBoard, GameState, Coordinate, AttackResult, PlacedShip, ALL_SHIPS, ShipDefinition, CellStatus } from '../models/types';
import { createEmptyBoard, placeShipOnBoard, isShipSunk, updateCellsWithShips } from '../lib/boardUtils'; // isShipSunkをインポート

interface GameContextType {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  updatePlayers: (newPlayers: PlayerSettings[]) => void;
  advancePhase: (newPhase: GamePhase) => void;
  advanceTurn: () => void;
  handleAttack: (attackerId: number, targetPlayerId: number, coord: Coordinate) => AttackResult;
  resetGame: () => void;
  setPlayerBoardShips: (playerId: number, placedShips: PlacedShip[]) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>(() => {
    // 初期プレイヤー設定に、デフォルトのnameを付与
    const initialPlayers: PlayerSettings[] = [
      { id: 0, name: 'プレイヤー1 (人間)', type: 'human' }, // 初期値を'人間'にする
      { id: 1, name: 'プレイヤー2 (AI)', type: 'ai', difficulty: 'easy' },
      { id: 2, name: 'プレイヤー3 (なし)', type: 'none' },
      { id: 3, name: 'プレイヤー4 (なし)', type: 'none' },
    ];

    const initialPlayerBoards: { [playerId: number]: PlayerBoard } = {};
    initialPlayers.forEach(player => {
      if (player.type !== 'none') {
        initialPlayerBoards[player.id] = {
          ...createEmptyBoard(player.id),
          attackedCells: {},
          placedShips: [],
        };
      }
    });

    return {
      players: initialPlayers,
      playerBoards: initialPlayerBoards,
      phase: 'select-players',
      currentPlayerTurnId: -1,
      winnerId: null,
    };
  });

  const updatePlayers = useCallback((newPlayers: PlayerSettings[]) => {
    setGameState(prev => {
      const newPlayerBoards = { ...prev.playerBoards };
      newPlayers.forEach(player => {
        if (player.type !== 'none' && !newPlayerBoards[player.id]) {
          newPlayerBoards[player.id] = {
            ...createEmptyBoard(player.id),
            attackedCells: {},
            placedShips: [],
          };
        } else if (player.type === 'none' && newPlayerBoards[player.id]) {
          delete newPlayerBoards[player.id];
        }
      });
      return { ...prev, players: newPlayers, playerBoards: newPlayerBoards };
    });
  }, []);

  const advancePhase = useCallback((newPhase: GamePhase) => {
    setGameState(prev => {
      let currentPlayerTurnId = prev.currentPlayerTurnId;
      if (newPhase === 'ship-placement') {
        // 船配置フェーズ開始時、最初の有効なプレイヤーに設定
        const firstPlayer = prev.players.find(p => p.type !== 'none');
        currentPlayerTurnId = firstPlayer ? firstPlayer.id : -1;
      } else if (newPhase === 'in-game') {
        // ゲーム開始時、最初の有効なプレイヤーに設定
        const firstPlayer = prev.players.find(p => p.type !== 'none');
        currentPlayerTurnId = firstPlayer ? firstPlayer.id : -1;
      }
      return { ...prev, phase: newPhase, currentPlayerTurnId: currentPlayerTurnId };
    });
  }, []);

  const advanceTurn = useCallback(() => {
    setGameState(prev => {
      const activePlayers = prev.players.filter(p => p.type !== 'none');
      if (activePlayers.length === 0) {
        console.warn("No active players to advance turn.");
        return prev;
      }

      const currentIndex = activePlayers.findIndex(p => p.id === prev.currentPlayerTurnId);
      let nextIndex = (currentIndex + 1) % activePlayers.length;
      let nextPlayerId = activePlayers[nextIndex].id;

      // 次のプレイヤーが敗北している場合はスキップ
      while (prev.playerBoards[nextPlayerId] && prev.playerBoards[nextPlayerId].placedShips.every(s => s.isSunk)) {
        nextIndex = (nextIndex + 1) % activePlayers.length;
        if (nextIndex === currentIndex) { // 全員敗北している場合（理論上はありえないが念のため）
          return { ...prev, phase: 'game-over', winnerId: null }; // 引き分けまたはエラー
        }
        nextPlayerId = activePlayers[nextIndex].id;
      }

      return { ...prev, currentPlayerTurnId: nextPlayerId };
    });
  }, []);


  const handleAttack = useCallback((attackerId: number, targetPlayerId: number, coord: Coordinate): AttackResult => {
    let result: AttackResult = { hit: false, isGameOver: false };

    setGameState(prev => {
      const newPlayerBoards = { ...prev.playerBoards };
      const targetBoard = { ...newPlayerBoards[targetPlayerId] };
      const newCells = targetBoard.cells.map(row => [...row]);
      const newPlacedShips = targetBoard.placedShips.map(ship => ({ ...ship }));

      // すでに攻撃済みのマスなら何もしない
      if (targetBoard.attackedCells[`${coord.x},${coord.y}`]) {
        console.warn(`Cell ${coord.x},${coord.y} already attacked.`);
        // ここでは便宜的に空の結果を返すか、適切なエラー処理を行う
        return prev; // 状態変更なし
      }

      const cell = newCells[coord.y][coord.x];
      let attackedCellStatus: CellStatus;
      let sunkShipId: string | undefined = undefined;

      if (cell.status === 'ship') {
        attackedCellStatus = 'hit';
        result.hit = true;

        // 船のヒット情報を更新
        const hitShip = newPlacedShips.find(s => s.id === cell.shipId);
        if (hitShip) {
          hitShip.hits.push(coord);
          if (isShipSunk(hitShip)) {
            hitShip.isSunk = true;
            sunkShipId = hitShip.id;
            // 沈没した船のマスを 'sunk' ステータスに更新
            hitShip.definition.size;
            const startX = hitShip.start.x;
            const startY = hitShip.start.y;
            for (let i = 0; i < hitShip.definition.size; i++) {
              const x = hitShip.orientation === 'horizontal' ? startX + i : startX;
              const y = hitShip.orientation === 'vertical' ? startY + i : startY;
              if (newCells[y] && newCells[y][x]) {
                newCells[y][x] = { ...newCells[y][x], status: 'sunk' };
              }
            }
          }
        }
      } else {
        attackedCellStatus = 'miss';
        result.hit = false;
      }

      // セルの状態を更新
      newCells[coord.y][coord.x] = { ...cell, status: attackedCellStatus };

      // attackedCells に記録
      targetBoard.attackedCells[`${coord.x},${coord.y}`] = attackedCellStatus;

      targetBoard.cells = newCells;
      targetBoard.placedShips = newPlacedShips;
      newPlayerBoards[targetPlayerId] = targetBoard;

      // ゲーム終了判定：攻撃された側のプレイヤーの全ての船が沈没したか
      const allShipsSunk = newPlacedShips.every(s => s.isSunk);
      if (allShipsSunk) {
        result.isGameOver = true;
        // 勝者を設定 (攻撃した側が勝者)
        return {
          ...prev,
          playerBoards: newPlayerBoards,
          phase: 'game-over',
          winnerId: attackerId,
        };
      }

      result.sunkShipId = sunkShipId;

      return {
        ...prev,
        playerBoards: newPlayerBoards,
      };
    });
    return result;
  }, []);

  const setPlayerBoardShips = useCallback((playerId: number, placedShips: PlacedShip[]) => {
    setGameState(prev => {
      const updatedPlayerBoards = { ...prev.playerBoards };
      if (updatedPlayerBoards[playerId]) {
        // 既存のplacedShipsを更新し、それに基づいてcellsを再生成
        const emptyBoardCells = createEmptyBoard(playerId).cells;
        const newCells = updateCellsWithShips(emptyBoardCells, placedShips);

        updatedPlayerBoards[playerId] = {
          ...updatedPlayerBoards[playerId],
          placedShips: placedShips,
          cells: newCells,
        };
      }
      return { ...prev, playerBoards: updatedPlayerBoards };
    });
  }, []);


  const resetGame = useCallback(() => {
    // resetGame でも name のロジックを適用
    const initialPlayers: PlayerSettings[] = [
      { id: 0, name: 'プレイヤー1 (人間)', type: 'human' },
      { id: 1, name: 'プレイヤー2 (AI)', type: 'ai', difficulty: 'easy' },
      { id: 2, name: 'プレイヤー3 (なし)', type: 'none' },
      { id: 3, name: 'プレイヤー4 (なし)', type: 'none' },
    ];

    const initialPlayerBoards: { [playerId: number]: PlayerBoard } = {};
    initialPlayers.forEach(player => {
      if (player.type !== 'none') {
        initialPlayerBoards[player.id] = {
          ...createEmptyBoard(player.id),
          attackedCells: {},
          placedShips: [],
        };
      }
    });

    setGameState({
      players: initialPlayers,
      playerBoards: initialPlayerBoards,
      phase: 'select-players',
      currentPlayerTurnId: -1,
      winnerId: null,
    });
  }, []);

  return (
    <GameContext.Provider
      value={{
        gameState,
        setGameState,
        updatePlayers,
        advancePhase,
        advanceTurn,
        handleAttack,
        resetGame,
        setPlayerBoardShips,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};