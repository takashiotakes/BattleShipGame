// src/contexts/GameContext.tsx

import React, { createContext, useContext, useState, ReactNode, useCallback, useRef, useEffect } from 'react';
import { GamePhase, PlayerSettings, PlayerBoard, GameState, Coordinate, AttackResult, PlacedShip, ALL_SHIPS, ShipDefinition } from '../models/types';
import { createEmptyBoard, placeShipOnBoard, updateCellsWithShips } from '../lib/boardUtils'; // updateCellsWithShips を追加

interface GameContextType {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  updatePlayers: (newPlayers: PlayerSettings[]) => void;
  advancePhase: (newPhase: GamePhase) => void;
  advanceTurn: () => void;
  handleAttack: (attackerId: number, coord: Coordinate) => AttackResult[]; // 攻撃結果の配列を返すように変更
  resetGame: () => void;
  setPlayerBoardShips: (playerId: number, placedShips: PlacedShip[]) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // checkAllShipsSunk を GameProvider のスコープ内に定義
  const checkAllShipsSunk = useCallback((playerBoard: PlayerBoard): boolean => {
    return playerBoard.placedShips.every(ship => ship.isSunk);
  }, []);

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
      currentPlayerTurnId: 0, // 最初のプレイヤーから開始
      winnerId: null,
    };
  });

  // playerBoards と players の整合性を取るための useEffect
  useEffect(() => {
    setGameState(prevState => {
      const newPlayerBoards = { ...prevState.playerBoards };
      let changed = false;

      // 存在しないプレイヤーのボードを削除
      for (const playerId in newPlayerBoards) {
        if (!prevState.players.some(p => p.id === Number(playerId))) {
          delete newPlayerBoards[playerId];
          changed = true;
        }
      }

      // 新しく追加されたプレイヤーのボードを作成
      prevState.players.forEach(player => {
        if (player.type !== 'none' && !newPlayerBoards[player.id]) {
          newPlayerBoards[player.id] = {
            ...createEmptyBoard(player.id),
            attackedCells: {},
            placedShips: [],
          };
          changed = true;
        }
      });

      if (changed) {
        return { ...prevState, playerBoards: newPlayerBoards };
      }
      return prevState;
    });
  }, [gameState.players]);


  const updatePlayers = useCallback((newPlayers: PlayerSettings[]) => {
    setGameState(prev => {
      // プレイヤーの型が 'none' になった場合、そのプレイヤーのボード情報を削除する
      const updatedPlayerBoards = { ...prev.playerBoards };
      const newPlayerIds = newPlayers.filter(p => p.type !== 'none').map(p => p.id);

      for (const playerIdStr in updatedPlayerBoards) {
        const playerId = Number(playerIdStr);
        if (!newPlayerIds.includes(playerId)) {
          delete updatedPlayerBoards[playerId];
        }
      }

      // 新しいプレイヤー設定に基づいてplayerBoardsを更新
      newPlayers.forEach(player => {
        if (player.type !== 'none' && !updatedPlayerBoards[player.id]) {
          updatedPlayerBoards[player.id] = {
            ...createEmptyBoard(player.id),
            attackedCells: {},
            placedShips: [],
          };
        }
      });

      // currentPlayerTurnId を更新されたプレイヤーリスト内で有効な ID にする
      let newCurrentPlayerTurnId = prev.currentPlayerTurnId;
      const activePlayers = newPlayers.filter(p => p.type !== 'none');
      if (!activePlayers.some(p => p.id === newCurrentPlayerTurnId)) {
        newCurrentPlayerTurnId = activePlayers.length > 0 ? activePlayers[0].id : -1;
      }

      return {
        ...prev,
        players: newPlayers,
        playerBoards: updatedPlayerBoards,
        currentPlayerTurnId: newCurrentPlayerTurnId,
      };
    });
  }, []);

  const advancePhase = useCallback((newPhase: GamePhase) => {
    setGameState(prev => {
      let newCurrentPlayerTurnId = prev.currentPlayerTurnId;

      if (newPhase === 'ship-placement') {
        // 船配置フェーズでは、最初の「none」でないプレイヤーをカレントプレイヤーにする
        const firstActivePlayer = prev.players.find(p => p.type !== 'none');
        if (firstActivePlayer) {
          newCurrentPlayerTurnId = firstActivePlayer.id;
        }
      } else if (newPhase === 'in-game') {
        // ゲーム開始時も、最初の「none」でないプレイヤーをカレントプレイヤーにする
        const firstActivePlayer = prev.players.find(p => p.type !== 'none');
        if (firstActivePlayer) {
          newCurrentPlayerTurnId = firstActivePlayer.id;
        }
      } else if (newPhase === 'game-over') {
        // ゲームオーバー時はターンを停止
        newCurrentPlayerTurnId = -1;
      }

      return { ...prev, phase: newPhase, currentPlayerTurnId: newCurrentPlayerTurnId };
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

      // 生き残っているプレイヤーをスキップしないように変更
      // 全てのプレイヤーの船が沈んでいないか確認
      let nextPlayerId = activePlayers[nextIndex].id;
      let attempts = 0;
      while (
        prev.playerBoards[nextPlayerId] && // ボードが存在することを確認
        checkAllShipsSunk(prev.playerBoards[nextPlayerId]) && // 全ての船が沈んでいる
        attempts < activePlayers.length // 無限ループ防止
      ) {
        nextIndex = (nextIndex + 1) % activePlayers.length;
        nextPlayerId = activePlayers[nextIndex].id;
        attempts++;
      }

      // 全員沈んでいたらゲームオーバー
      if (attempts === activePlayers.length) {
        return { ...prev, phase: 'game-over', winnerId: null }; // 勝者なし（引き分けなど）
      }

      return { ...prev, currentPlayerTurnId: nextPlayerId };
    });
  }, [checkAllShipsSunk]); // checkAllShipsSunk を依存配列に追加


  // handleAttack 関数の変更: 全ての対戦相手に対して同時攻撃
  const handleAttack = useCallback((attackerId: number, coord: Coordinate): AttackResult[] => {
    const results: AttackResult[] = [];

    setGameState(prevGameState => {
      const newPlayerBoards = { ...prevGameState.playerBoards };
      const currentPlayers = prevGameState.players;

      // 攻撃者以外の全てのプレイヤーに対して攻撃を行う
      const targetPlayers = currentPlayers.filter(p => p.id !== attackerId && p.type !== 'none');

      targetPlayers.forEach(targetPlayer => {
        const targetPlayerBoard = newPlayerBoards[targetPlayer.id];

        // 既に攻撃済みのマスはスキップ (UIで制御されるはずだが念のため)
        // 同時攻撃なので、攻撃済みのマスへの攻撃は通常許されないが、ここでは便宜上スキップし、結果はfalseとする
        if (targetPlayerBoard.attackedCells[`${coord.x},${coord.y}`]) {
          results.push({ hit: false }); // スキップされた攻撃も結果として返す
          return;
        }

        let hit = false;
        let sunkShipId: string | undefined;
        let newCells = targetPlayerBoard.cells.map(row => [...row]);
        let newPlacedShips = targetPlayerBoard.placedShips.map(ship => ({ ...ship, hits: [...ship.hits] }));

        // 攻撃対象マスが船であるかチェック
        const attackedCell = newCells[coord.y][coord.x];
        if (attackedCell.status === 'ship') {
          hit = true;
          attackedCell.status = 'hit'; // マスの状態を 'hit' に更新
          newPlayerBoards[targetPlayer.id].attackedCells[`${coord.x},${coord.y}`] = 'hit';

          // どの船がヒットしたか特定し、ヒット数を更新
          const targetShip = newPlacedShips.find(ship => ship.id === attackedCell.shipId);
          if (targetShip) {
            targetShip.hits.push(coord); // ヒット座標を追加

            // 船が沈没したかチェック
            if (targetShip.hits.length === targetShip.definition.size) {
              targetShip.isSunk = true;
              sunkShipId = targetShip.id;

              // 沈没した船のマスを 'sunk' に更新
              for (let i = 0; i < targetShip.definition.size; i++) {
                const x = targetShip.orientation === 'horizontal' ? targetShip.start.x + i : targetShip.start.x;
                const y = targetShip.orientation === 'vertical' ? targetShip.start.y + i : targetShip.start.y;
                if (newCells[y][x].status === 'hit') { // 既にhitになっているマスのみをsunkにする
                  newCells[y][x].status = 'sunk';
                }
              }
            }
          }
        } else {
          attackedCell.status = 'miss'; // マスの状態を 'miss' に更新
          newPlayerBoards[targetPlayer.id].attackedCells[`${coord.x},${coord.y}`] = 'miss';
        }

        // 更新されたボードと船の情報を newPlayerBoards に適用
        newPlayerBoards[targetPlayer.id] = {
          ...targetPlayerBoard,
          cells: newCells,
          placedShips: newPlacedShips,
        };

        results.push({ hit, sunkShipId });
      });

      // 勝者判定
      let remainingPlayers = currentPlayers.filter(p => p.type !== 'none');
      let alivePlayers = remainingPlayers.filter(p => {
        const board = newPlayerBoards[p.id];
        return board && !checkAllShipsSunk(board);
      });

      let winnerId: number | null = null;
      let nextPhase: GamePhase = prevGameState.phase;
      let nextCurrentPlayerTurnId = prevGameState.currentPlayerTurnId;

      if (alivePlayers.length === 1) {
        winnerId = alivePlayers[0].id;
        nextPhase = 'game-over';
        nextCurrentPlayerTurnId = -1; // ゲーム終了のためターンを停止
      } else if (alivePlayers.length === 0) {
        // 全員沈没した場合（引き分け）
        winnerId = null; // または特別なIDで引き分けを示す
        nextPhase = 'game-over';
        nextCurrentPlayerTurnId = -1;
      } else {
        // ゲームが続く場合は次のターンへ
        // 生き残っているプレイヤー（船がすべて沈んでいないプレイヤー）の中から次のターンプレイヤーを選択
        const activePlayersForNextTurn = prevGameState.players.filter(p => p.type !== 'none' && !checkAllShipsSunk(newPlayerBoards[p.id]));
        const currentIndex = activePlayersForNextTurn.findIndex(p => p.id === prevGameState.currentPlayerTurnId);
        let nextIndex = (currentIndex + 1) % activePlayersForNextTurn.length;

        let attempts = 0;
        let potentialNextPlayerId = activePlayersForNextTurn[nextIndex].id;

        // 次のプレイヤーが既に沈没していたらスキップ
        while (checkAllShipsSunk(newPlayerBoards[potentialNextPlayerId]) && attempts < activePlayersForNextTurn.length) {
            nextIndex = (nextIndex + 1) % activePlayersForNextTurn.length;
            potentialNextPlayerId = activePlayersForNextTurn[nextIndex].id;
            attempts++;
        }

        if (attempts === activePlayersForNextTurn.length) {
            // 全員沈没していて誰も攻撃できない場合
            nextPhase = 'game-over';
            winnerId = null;
            nextCurrentPlayerTurnId = -1;
        } else {
            nextCurrentPlayerTurnId = potentialNextPlayerId;
        }
    }

      return {
        ...prevGameState,
        playerBoards: newPlayerBoards,
        phase: nextPhase,
        winnerId: winnerId,
        currentPlayerTurnId: nextCurrentPlayerTurnId, // 次のターンプレイヤーを更新
      };
    });

    return results; // 攻撃結果の配列を返す
  }, [checkAllShipsSunk]); // ★ここを修正しました★ checkAllShipsSunk を依存配列に追加


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
      currentPlayerTurnId: 0, // ★ここを修正しました★ 初期フェーズでは無効なIDではなく、最初のプレイヤーID (0) に設定
      winnerId: null,
    });
  }, []);

  const setPlayerBoardShips = useCallback((playerId: number, placedShips: PlacedShip[]) => {
    setGameState(prev => {
      const playerBoard = prev.playerBoards[playerId];
      if (!playerBoard) {
        console.error(`Board not found for player ${playerId}`);
        return prev;
      }

      // 新しいボードセルを作成し、船を配置
      let newCells = createEmptyBoard(playerId).cells; // まず空のボードを作成
      newCells = updateCellsWithShips(newCells, placedShips); // その後船を配置

      return {
        ...prev,
        playerBoards: {
          ...prev.playerBoards,
          [playerId]: {
            ...playerBoard,
            cells: newCells,
            placedShips: placedShips,
          },
        },
      };
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