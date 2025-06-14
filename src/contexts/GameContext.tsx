// src/contexts/GameContext.tsx

import React, { createContext, useContext, useState, ReactNode, useCallback, useRef, useEffect } from 'react';
import { GamePhase, PlayerSettings, PlayerBoard, GameState, Coordinate, AttackResult, PlacedShip, ALL_SHIPS, ShipDefinition } from '../models/types'; // ALL_SHIPS, ShipDefinition をインポート
import { createEmptyBoard, placeShipOnBoard } from '../lib/boardUtils'; // placeShipOnBoard をインポート

interface GameContextType {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  updatePlayers: (newPlayers: PlayerSettings[]) => void;
  advancePhase: (newPhase: GamePhase) => void;
  advanceTurn: () => void; // ★重要: GameScreenで必要なので残す
  handleAttack: (attackerId: number, targetPlayerId: number, coord: Coordinate) => AttackResult;
  resetGame: () => void;
  // ★追加★ 船の配置を更新する関数
  setPlayerBoardShips: (playerId: number, placedShips: PlacedShip[]) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>(() => {
    const initialPlayers: PlayerSettings[] = [
      { id: 0, name: 'プレイヤー1 (あなた)', type: 'human' },
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
          placedShips: [], // ここで初期化
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

  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);


  const updatePlayers = useCallback((newPlayers: PlayerSettings[]) => {
    setGameState(prev => {
      const newPlayerBoards: { [playerId: number]: PlayerBoard } = {};
      newPlayers.forEach(player => {
        if (player.type !== 'none') {
          newPlayerBoards[player.id] = prev.playerBoards[player.id] || {
            ...createEmptyBoard(player.id),
            attackedCells: {},
            placedShips: [],
          };
        }
      });
      return { ...prev, players: newPlayers, playerBoards: newPlayerBoards };
    });
  }, []);

  const advancePhase = useCallback((newPhase: GamePhase) => {
    setGameState(prev => {
      let updatedState = { ...prev, phase: newPhase };

      if (newPhase === 'in-game') {
        // ゲーム開始時、アクティブプレイヤーから最初のプレイヤーを設定
        const firstActivePlayer = prev.players.find(p => p.type !== 'none');
        if (firstActivePlayer) {
          updatedState.currentPlayerTurnId = firstActivePlayer.id;
        } else {
          console.error("No active players to start game.");
          updatedState.currentPlayerTurnId = -1;
        }
      } else if (newPhase === 'ship-placement') {
        // 船配置フェーズに入るときは、最初の有効プレイヤーのボードを準備
        const firstPlayerToPlace = prev.players.find(p => p.type !== 'none');
        if (firstPlayerToPlace) {
            updatedState.currentPlayerTurnId = firstPlayerToPlace.id;
        } else {
            updatedState.currentPlayerTurnId = -1;
        }
      } else { // select-players や game-over の場合
          updatedState.currentPlayerTurnId = -1;
      }
      return updatedState;
    });
  }, []);

  const advanceTurn = useCallback(() => {
    setGameState(prev => {
      if (prev.phase === 'game-over') {
        return prev;
      }

      const activePlayers = prev.players.filter(p => p.type !== 'none');
      if (activePlayers.length === 0) {
          console.warn("No active players to advance turn.");
          return prev;
      }

      const currentIndex = activePlayers.findIndex(p => p.id === prev.currentPlayerTurnId);
      let nextIndex;
      if (currentIndex === -1) {
          nextIndex = 0;
      } else {
          nextIndex = (currentIndex + 1) % activePlayers.length;
      }
      const nextPlayerId = activePlayers[nextIndex].id;

      return {
        ...prev,
        currentPlayerTurnId: nextPlayerId,
      };
    });
  }, []);

  const handleAttack = useCallback((attackerId: number, targetPlayerId: number, coord: Coordinate): AttackResult => {
    let currentAttackResult: AttackResult = { hit: false };

    setGameState(prev => {
      const updatedPlayerBoards = { ...prev.playerBoards };
      const targetBoard = JSON.parse(JSON.stringify(updatedPlayerBoards[targetPlayerId]));
      const attackingPlayerBoard = JSON.parse(JSON.stringify(updatedPlayerBoards[attackerId]));

      if (attackingPlayerBoard.attackedCells[`${coord.x},${coord.y}`]) {
          console.warn('Already attacked this cell:', coord);
          currentAttackResult = { hit: false, alreadyAttacked: true };
          return prev;
      }

      const targetCellOnOpponentBoard = targetBoard.cells[coord.y][coord.x];

      if (targetCellOnOpponentBoard.status === 'ship') {
        currentAttackResult.hit = true;

        const hitShip = targetBoard.placedShips.find((s: PlacedShip) => s.id === targetCellOnOpponentBoard.shipId);
        if (hitShip) {
          if (!hitShip.hits.some((h: Coordinate) => h.x === coord.x && h.y === coord.y)) {
            hitShip.hits.push(coord);
          }
          const isSunk = hitShip.hits.length === hitShip.definition.size;
          hitShip.isSunk = isSunk;

          if (isSunk) {
            currentAttackResult.sunkShipId = hitShip.id;
            for (let i = 0; i < hitShip.definition.size; i++) {
                let x = hitShip.start.x;
                let y = hitShip.start.y;
                if (hitShip.orientation === 'horizontal') x += i;
                else y += i;
                if (targetBoard.cells[y] && targetBoard.cells[y][x]) {
                    targetBoard.cells[y][x].status = 'sunk';
                }
            }
          }
        }
        attackingPlayerBoard.attackedCells[`${coord.x},${coord.y}`] = 'hit';
        targetBoard.cells[coord.y][coord.x].status = 'hit';
      } else {
        currentAttackResult.hit = false;
        attackingPlayerBoard.attackedCells[`${coord.x},${coord.y}`] = 'miss';
        targetBoard.cells[coord.y][coord.x].status = 'miss';
      }

      updatedPlayerBoards[targetPlayerId] = targetBoard;
      updatedPlayerBoards[attackerId] = attackingPlayerBoard;

      const allOpponentShipsSunk = targetBoard.placedShips.every((ship: PlacedShip) => ship.isSunk);
      let newWinnerId: number | null = prev.winnerId;
      let newPhase: GamePhase = prev.phase;

      if (allOpponentShipsSunk) {
        newWinnerId = attackerId;
        newPhase = 'game-over';
      }

      return {
        ...prev,
        playerBoards: updatedPlayerBoards,
        phase: newPhase,
        winnerId: newWinnerId,
      };
    });

    return currentAttackResult;
  }, []);

  // ★修正なし★ 船の配置情報を更新する関数 (前回と同一)
  const setPlayerBoardShips = useCallback((playerId: number, placedShips: PlacedShip[]) => {
    setGameState(prev => {
      const updatedPlayerBoards = { ...prev.playerBoards };
      if (updatedPlayerBoards[playerId]) {
        // 新しい cells を生成し、そこに配置された船を反映させる
        const newCells = placedShips.reduce((currentCells, ship) => {
            // placeShipOnBoard は新しい配列を返すので、イミュータブルに処理できる
            return placeShipOnBoard(currentCells, ship.definition, ship.start, ship.orientation);
          }, createEmptyBoard(playerId).cells); // 空のボードから開始して船を配置

        updatedPlayerBoards[playerId] = {
          ...updatedPlayerBoards[playerId],
          placedShips: placedShips,
          cells: newCells, // 更新された cells を設定
        };
      }
      return { ...prev, playerBoards: updatedPlayerBoards };
    });
  }, []);


  const resetGame = useCallback(() => {
    const initialPlayers: PlayerSettings[] = [
      { id: 0, name: 'プレイヤー1 (あなた)', type: 'human' },
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
        advanceTurn, // GameScreen からは advanceTurn を呼び出せるように提供する
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
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};