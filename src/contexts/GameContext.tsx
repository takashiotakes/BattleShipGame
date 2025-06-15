// src/contexts/GameContext.tsx

import React, { createContext, useContext, useState, ReactNode, useCallback, useRef, useEffect } from 'react';
import { GamePhase, PlayerSettings, PlayerBoard, GameState, Coordinate, AttackResult, PlacedShip, ALL_SHIPS, ShipDefinition } from '../models/types';
import { createEmptyBoard, applyAttackToBoard, checkAllShipsSunk } from '../lib/boardUtils'; // applyAttackToBoard と checkAllShipsSunk をインポート

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
          attackedCells: {}, // 初期化
          placedShips: [], // 初期化
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

  // gameState の最新の状態を参照するための ref
  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);


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
          // 'none' に変更されたプレイヤーのボードを削除
          delete newPlayerBoards[player.id];
        }
      });

      // 存在するプレイヤーのIDを現在のターンに設定する（いなければ最初の有効なプレイヤー）
      let newCurrentPlayerTurnId = prev.currentPlayerTurnId;
      const activePlayers = newPlayers.filter(p => p.type !== 'none');
      if (newCurrentPlayerTurnId === -1 || !activePlayers.some(p => p.id === newCurrentPlayerTurnId)) {
        if (activePlayers.length > 0) {
          newCurrentPlayerTurnId = activePlayers[0].id;
        } else {
          newCurrentPlayerTurnId = -1; // 有効なプレイヤーがいない場合
        }
      }


      return {
        ...prev,
        players: newPlayers,
        playerBoards: newPlayerBoards,
        currentPlayerTurnId: newCurrentPlayerTurnId, // プレイヤーリスト更新時にターンプレイヤーも調整
      };
    });
  }, []);

  const advancePhase = useCallback((newPhase: GamePhase) => {
    setGameState(prev => {
      let nextState = { ...prev, phase: newPhase };

      if (newPhase === 'ship-placement') {
        // 船配置フェーズに入るとき、最初の有効なプレイヤーを現在のターンにする
        const firstActivePlayer = prev.players.find(p => p.type !== 'none');
        if (firstActivePlayer) {
          nextState.currentPlayerTurnId = firstActivePlayer.id;
        }
      } else if (newPhase === 'in-game') {
        // ゲーム開始時、最初の有効なプレイヤーを現在のターンにする
        const firstActivePlayer = prev.players.find(p => p.type !== 'none');
        if (firstActivePlayer) {
          nextState.currentPlayerTurnId = firstActivePlayer.id;
        }
      }
      return nextState;
    });
  }, []);

  const advanceTurn = useCallback(() => {
    setGameState(prev => {
      const activePlayers = prev.players.filter(p => p.type !== 'none');
      if (activePlayers.length === 0) {
        return prev; // アクティブなプレイヤーがいない場合は何もしない
      }

      const currentIndex = activePlayers.findIndex(p => p.id === prev.currentPlayerTurnId);
      let nextIndex = (currentIndex + 1) % activePlayers.length;
      let nextPlayerId = activePlayers[nextIndex].id;

      // 「なし」プレイヤーをスキップするロジックをここで再度確認
      let attempts = 0;
      while (prev.players.find(p => p.id === nextPlayerId)?.type === 'none' && attempts < activePlayers.length) {
        nextIndex = (nextIndex + 1) % activePlayers.length;
        nextPlayerId = activePlayers[nextIndex].id;
        attempts++;
      }

      return {
        ...prev,
        currentPlayerTurnId: nextPlayerId,
      };
    });
  }, []);


  const handleAttack = useCallback((attackerId: number, targetPlayerId: number, coord: Coordinate): AttackResult => {
    let result: AttackResult = { hit: false, allShipsSunk: false };

    setGameState(prevGameState => {
      const targetBoard = prevGameState.playerBoards[targetPlayerId];
      if (!targetBoard) {
        console.error(`Target board for player ${targetPlayerId} not found.`);
        return prevGameState; // ボードが見つからない場合は状態を更新しない
      }

      // すでに攻撃済みのマスかどうかをチェック
      const coordKey = `${coord.x},${coord.y}`;
      if (targetBoard.attackedCells[coordKey]) {
        console.warn(`Cell at ${coord.x},${coord.y} already attacked.`);
        return prevGameState; // 既に攻撃済みの場合は何もしない
      }

      const { updatedBoard, hitShipId, isSunk, allShipsSunk } = applyAttackToBoard(targetBoard, coord);

      result = {
        hit: updatedBoard.cells[coord.y][coord.x].status === 'hit' || updatedBoard.cells[coord.y][coord.x].status === 'sunk',
        sunkShipId: isSunk ? hitShipId : undefined,
        allShipsSunk: allShipsSunk,
      };

      const newPlayerBoards = {
        ...prevGameState.playerBoards,
        [targetPlayerId]: updatedBoard,
      };

      let newWinnerId: number | null = prevGameState.winnerId;
      let newPhase: GamePhase = prevGameState.phase;

      if (allShipsSunk) {
        newWinnerId = attackerId;
        newPhase = 'game-over';
        console.log(`Player ${attackerId} wins! All ships of player ${targetPlayerId} are sunk.`);
      }

      return {
        ...prevGameState,
        playerBoards: newPlayerBoards,
        winnerId: newWinnerId,
        phase: newPhase,
      };
    });
    return result; // 最新の状態更新後に結果を返す
  }, []);


  const setPlayerBoardShips = useCallback((playerId: number, placedShips: PlacedShip[]) => {
    setGameState(prev => {
      const playerBoard = prev.playerBoards[playerId];
      if (!playerBoard) {
        console.error(`Player board for ID ${playerId} not found.`);
        return prev;
      }

      // 新しい placedShips に基づいて cells を再構築
      let newCells = createEmptyBoard(playerId).cells;
      placedShips.forEach(pShip => {
        for (let i = 0; i < pShip.definition.size; i++) {
          const x = pShip.orientation === 'horizontal' ? pShip.start.x + i : pShip.start.x;
          const y = pShip.orientation === 'vertical' ? pShip.start.y + i : pShip.start.y;
          // 既存の attackedCells からヒット/ミス情報をマージ
          const attackedStatus = playerBoard.attackedCells[`${x},${y}`];
          if (attackedStatus === 'hit') {
            // ヒット済みの場所は 'hit' にする
            newCells[y][x] = { ...newCells[y][x], status: 'hit', shipId: pShip.id };
          } else if (pShip.isSunk) {
            // 沈没済みの船の場所は 'sunk' にする
            newCells[y][x] = { ...newCells[y][x], status: 'sunk', shipId: pShip.id };
          }
          else {
            // 何もなければ船として表示
            newCells[y][x] = { ...newCells[y][x], status: 'ship', shipId: pShip.id };
          }
        }
      });

      // 既存の attackedCells の 'miss' 情報を新しい cells に適用
      for (const key in playerBoard.attackedCells) {
        const status = playerBoard.attackedCells[key];
        if (status === 'miss') {
          const [x, y] = key.split(',').map(Number);
          if (newCells[y] && newCells[y][x] && newCells[y][x].status === 'empty') {
            newCells[y][x] = { ...newCells[y][x], status: 'miss' };
          }
        }
      }

      const updatedPlayerBoards = {
        ...prev.playerBoards,
        [playerId]: {
          ...playerBoard,
          placedShips: placedShips,
          cells: newCells,
        },
      };
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