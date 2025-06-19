// src/contexts/GameContext.tsx

import React, { createContext, useContext, useState, ReactNode, useCallback, useRef, useEffect } from 'react';
import { GamePhase, PlayerSettings, PlayerBoard, GameState, Coordinate, AttackResult, PlacedShip, ALL_SHIPS, ShipDefinition } from '../models/types';
import { createEmptyBoard, placeShipOnBoard, updateCellsWithShips } from '../lib/boardUtils';

interface GameContextType {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  updatePlayers: (newPlayers: PlayerSettings[]) => void;
  advancePhase: (newPhase: GamePhase) => void;
  advanceTurn: () => void;
  handleAttack: (attackerId: number, targetPlayerId: number, coord: Coordinate) => AttackResult; // 攻撃結果の型を修正
  resetGame: () => void;
  setPlayerBoardShips: (playerId: number, placedShips: PlacedShip[]) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const checkAllShipsSunk = useCallback((playerBoard: PlayerBoard): boolean => {
    return playerBoard.placedShips.every(ship => ship.isSunk);
  }, []);

  const [gameState, setGameState] = useState<GameState>(() => {
    // ここでは初期値を直接返す
    const initialPlayers: PlayerSettings[] = [
      { id: 0, name: 'プレイヤー1 (あなた)', type: 'human' }, // App.tsx で上書きされるため、仮の値でも良い
      { id: 1, name: 'プレイヤー2 (AI)', type: 'ai', difficulty: 'easy' },
      { id: 2, name: 'プレイヤー3 (なし)', type: 'none' },
      { id: 3, name: 'プレイヤー4 (なし)', type: 'none' },
    ];

    const initialPlayerBoards: { [playerId: number]: PlayerBoard } = {};
    initialPlayers.forEach((player) => {
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
      currentPlayerTurnId: 0, // 初期プレイヤーは0番
      winnerId: null,
    };
  });

  const gameStateRef = useRef(gameState); // 最新のgameStateをrefに保持
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);


  // handleAttack のロジック (以前の提供コードから抽出、一部修正)
  const handleAttack = useCallback(
    (attackerId: number, targetPlayerId: number, coord: Coordinate): AttackResult => {
      const currentGameState = gameStateRef.current; // 最新のgameStateを参照
      const { playerBoards: currentBoards, players: currentPlayers } = currentGameState;

      const targetBoard = currentBoards[targetPlayerId];
      if (!targetBoard) {
        console.error("Target board not found.");
        return { hit: false, sunkShipId: undefined, isGameOver: false };
      }

      // 既に攻撃済みのマスは再攻撃できない
      const attackedKey = `${coord.x},${coord.y}`;
      if (targetBoard.attackedCells[attackedKey]) {
        console.warn("Cell already attacked.");
        return { hit: false, sunkShipId: undefined, isGameOver: false }; // 攻撃済みの場合は何もしない
      }

      let hit = false;
      let sunkShipId: string | undefined = undefined;
      let isGameOver = false;

      setGameState((prevGameState) => {
        const newPlayerBoards = { ...prevGameState.playerBoards };
        const newTargetBoard = { ...newPlayerBoards[targetPlayerId] };
        const newCells = newTargetBoard.cells.map((row) => [...row]);
        const newPlacedShips = newTargetBoard.placedShips.map((ship) => ({ ...ship }));

        const cell = newCells[coord.y][coord.x];
        const attackedResult: 'hit' | 'miss' = cell.status === 'ship' ? 'hit' : 'miss';

        // セルの状態を更新
        newCells[coord.y][coord.x].status = attackedResult;

        // 攻撃履歴を更新
        newTargetBoard.attackedCells = {
          ...newTargetBoard.attackedCells,
          [attackedKey]: attackedResult,
        };

        if (attackedResult === 'hit') {
          hit = true;
          // 船のヒット情報を更新
          if (cell.shipId) {
            const shipIndex = newPlacedShips.findIndex(s => s.id === cell.shipId);
            if (shipIndex !== -1) {
              const updatedShip = { ...newPlacedShips[shipIndex] };
              updatedShip.hits = [...updatedShip.hits, coord];
              updatedShip.isSunk = updatedShip.hits.length === updatedShip.definition.size;
              newPlacedShips[shipIndex] = updatedShip;

              if (updatedShip.isSunk) {
                sunkShipId = updatedShip.id;
                // 沈没した船のマスを'sunk'に更新
                // 既にplaceShipOnBoardがないので、手動でセルを更新するか、新しいヘルパーを導入する必要がある
                // ここでは、沈んだ船の全てのマスを 'sunk' にするロジックを追記します。
                const sunkShip = updatedShip;
                for (let i = 0; i < sunkShip.definition.size; i++) {
                  const cellX = sunkShip.orientation === 'horizontal' ? sunkShip.start.x + i : sunkShip.start.x;
                  const cellY = sunkShip.orientation === 'vertical' ? sunkShip.start.y + i : sunkShip.start.y;
                  newCells[cellY][cellX].status = 'sunk';
                }
              }
            }
          }
        }

        newTargetBoard.cells = newCells;
        newTargetBoard.placedShips = newPlacedShips;
        newPlayerBoards[targetPlayerId] = newTargetBoard;

        // ゲーム終了条件のチェック
        const activePlayers = prevGameState.players.filter(p => p.type !== 'none');
        let remainingPlayers = activePlayers.filter(p => {
          const board = newPlayerBoards[p.id];
          return board && !checkAllShipsSunk(board);
        });

        // 攻撃対象が沈んだ場合、そのプレイヤーをremainingPlayersから除外
        if (checkAllShipsSunk(newTargetBoard)) {
          remainingPlayers = remainingPlayers.filter(p => p.id !== targetPlayerId);
        }
        
        if (remainingPlayers.length <= 1) {
          isGameOver = true;
          const winner = remainingPlayers.length === 1 ? remainingPlayers[0].id : null;
          return {
            ...prevGameState,
            playerBoards: newPlayerBoards,
            phase: 'game-over',
            winnerId: winner,
          };
        } else {
          return {
            ...prevGameState,
            playerBoards: newPlayerBoards,
          };
        }
      });
      return { hit, sunkShipId, isGameOver }; // handleAttackの戻り値として結果を返す
    },
    [checkAllShipsSunk] // checkAllShipsSunk を依存配列に追加
  );


  const advancePhase = useCallback((newPhase: GamePhase) => {
    setGameState(prev => {
      let newCurrentPlayerTurnId = prev.currentPlayerTurnId;
      if (newPhase === 'in-game') {
        // 'in-game' フェーズに移行する際に、最初の有効なプレイヤーのターンを設定
        const firstActivePlayer = prev.players.find(p => p.type !== 'none');
        if (firstActivePlayer) {
          newCurrentPlayerTurnId = firstActivePlayer.id;
        } else {
          newCurrentPlayerTurnId = -1; // 誰もいない場合は無効なID
        }
      }
      return { ...prev, phase: newPhase, currentPlayerTurnId: newCurrentPlayerTurnId };
    });
  }, []);

  const advanceTurn = useCallback(() => {
    setGameState(prev => {
      const activePlayers = prev.players.filter(p => p.type !== 'none');
      if (activePlayers.length === 0) {
        return prev; // アクティブなプレイヤーがいない場合、ターンは進まない
      }

      let nextPlayerIndex = (activePlayers.findIndex(p => p.id === prev.currentPlayerTurnId) + 1) % activePlayers.length;
      let nextPlayerId = activePlayers[nextPlayerIndex].id;

      // 撃沈されたプレイヤーをスキップするロジックを追加
      while (checkAllShipsSunk(prev.playerBoards[nextPlayerId]) && remainingPlayersCount > 1) { // 撃沈されていて、かつ他に生き残りがいる場合のみスキップ
        nextPlayerIndex = (nextPlayerIndex + 1) % activePlayers.length;
        nextPlayerId = activePlayers[nextPlayerIndex].id;
        if (nextPlayerId === prev.currentPlayerTurnId) { // 全員が沈んでいるか、自分しかいない場合
          break;
        }
      }

      return {
        ...prev,
        currentPlayerTurnId: nextPlayerId,
      };
    });
  }, [checkAllShipsSunk]);


  const updatePlayers = useCallback((newPlayers: PlayerSettings[]) => {
    setGameState(prev => {
      const newPlayerBoards = { ...prev.playerBoards };
      newPlayers.forEach(player => {
        if (player.type !== 'none' && !newPlayerBoards[player.id]) {
          // 新しく追加されたアクティブプレイヤー用にボードを初期化
          newPlayerBoards[player.id] = {
            ...createEmptyBoard(player.id),
            attackedCells: {},
            placedShips: [],
          };
        } else if (player.type === 'none' && newPlayerBoards[player.id]) {
          // 'none' に変更されたプレイヤーのボードを削除 (または保持しない)
          delete newPlayerBoards[player.id];
        }
      });
      // currentPlayerTurnId の調整
      let newCurrentPlayerTurnId = prev.currentPlayerTurnId;
      const activePlayers = newPlayers.filter(p => p.type !== 'none');
      if (activePlayers.length > 0 && !activePlayers.some(p => p.id === prev.currentPlayerTurnId)) {
        newCurrentPlayerTurnId = activePlayers[0].id; // 現在のターンプレイヤーが非アクティブになった場合、最初の有効なプレイヤーに設定
      } else if (activePlayers.length === 0) {
        newCurrentPlayerTurnId = -1; // 全員非アクティブ
      }

      return {
        ...prev,
        players: newPlayers,
        playerBoards: newPlayerBoards,
        currentPlayerTurnId: newCurrentPlayerTurnId, // ここを更新
      };
    });
  }, []);

  const setPlayerBoardShips = useCallback((playerId: number, placedShips: PlacedShip[]) => {
    setGameState(prev => {
      const playerBoard = prev.playerBoards[playerId];
      if (!playerBoard) {
        console.error(`Board not found for player ${playerId}`);
        return prev;
      }

      let newCells = createEmptyBoard(playerId).cells;
      newCells = updateCellsWithShips(newCells, placedShips, true); // 自分のボードなので船は表示

      const updatedPlayerBoards = {
        ...prev.playerBoards,
        [playerId]: {
          ...playerBoard,
          placedShips: placedShips,
          cells: newCells,
        },
      };

      // 全ての有効なプレイヤーの船が配置されたかチェック
      const allActivePlayers = prev.players.filter(p => p.type !== 'none');
      const allShipsPlaced = allActivePlayers.every(p =>
        updatedPlayerBoards[p.id] && updatedPlayerBoards[p.id].placedShips.length === ALL_SHIPS.length
      );

      let newPhase = prev.phase;
      let newCurrentPlayerTurnId = prev.currentPlayerTurnId;

      if (allShipsPlaced) {
        newPhase = 'in-game';
        // ゲーム開始時の最初のプレイヤーを決定
        const firstActivePlayer = allActivePlayers.find(p => p.type !== 'none');
        if (firstActivePlayer) {
          newCurrentPlayerTurnId = firstActivePlayer.id;
        }
      } else {
        // 次のプレイヤーの船配置フェーズへ
        const currentActivePlayers = prev.players.filter(p => p.type !== 'none');
        const currentIndex = currentActivePlayers.findIndex(p => p.id === playerId);
        let nextPlayerToPlaceIndex = (currentIndex + 1) % currentActivePlayers.length;
        let nextPlayerToPlace = currentActivePlayers[nextPlayerToPlaceIndex];

        // まだ船を配置していない次のプレイヤーを見つける
        let attempts = 0;
        const maxAttempts = currentActivePlayers.length * 2; // 無限ループ防止
        while (
          updatedPlayerBoards[nextPlayerToPlace.id] &&
          updatedPlayerBoards[nextPlayerToPlace.id].placedShips.length === ALL_SHIPS.length &&
          attempts < maxAttempts
        ) {
          nextPlayerToPlaceIndex = (nextPlayerToPlaceIndex + 1) % currentActivePlayers.length;
          nextPlayerToPlace = currentActivePlayers[nextPlayerToPlaceIndex];
          attempts++;
          // 全員配置済みならループを抜ける（このパスはallShipsPlacedで処理されるはずだが念のため）
          if (nextPlayerToPlace.id === playerId) break;
        }

        if (updatedPlayerBoards[nextPlayerToPlace.id]?.placedShips.length !== ALL_SHIPS.length) {
          newCurrentPlayerTurnId = nextPlayerToPlace.id;
        } else if (allShipsPlaced) { // 全員が配置し終えた場合
           newPhase = 'in-game';
           const firstActivePlayer = allActivePlayers.find(p => p.type !== 'none');
           if (firstActivePlayer) {
             newCurrentPlayerTurnId = firstActivePlayer.id;
           }
        }
      }

      return {
        ...prev,
        playerBoards: updatedPlayerBoards,
        phase: newPhase,
        currentPlayerTurnId: newCurrentPlayerTurnId,
      };
    });
  }, [checkAllShipsSunk]); // updateCellsWithShips の修正のため、checkAllShipsSunk を依存配列に追加

  const resetGame = useCallback(() => {
    const initialPlayers: PlayerSettings[] = [
      { id: 0, name: "プレイヤー1 (あなた)", type: "human" },
      { id: 1, name: "プレイヤー2 (AI)", type: "ai", difficulty: "easy" },
      { id: 2, name: "プレイヤー3 (なし)", type: "none" },
      { id: 3, name: "プレイヤー4 (なし)", type: "none" },
    ];

    const initialPlayerBoards: { [playerId: number]: PlayerBoard } = {};
    initialPlayers.forEach((player) => {
      if (player.type !== "none") {
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
      phase: "select-players",
      currentPlayerTurnId: 0, // resetGame時も最初のプレイヤー(0)に設定
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
      {children}</GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};