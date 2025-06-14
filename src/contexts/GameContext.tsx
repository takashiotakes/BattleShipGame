// src/contexts/GameContext.tsx

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { GamePhase, PlayerSettings, PlayerBoard, GameState, ALL_SHIPS, Coordinate, AttackResult, CellStatus, PlacedShip } from '../models/types';
import { createEmptyBoard, updateCellsWithShips } from '../lib/boardUtils'; // updateCellsWithShips をインポート

interface GameContextType {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  updatePlayers: (newPlayers: PlayerSettings[]) => void;
  advancePhase: (newPhase: GamePhase) => void;
  advanceTurn: () => void; // 新しく追加
  handleAttack: (attackerId: number, targetPlayerId: number, coord: Coordinate) => AttackResult; // 新しく追加
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>(() => {
    // 初期プレイヤー設定
    const initialPlayers: PlayerSettings[] = [
      { id: 0, name: 'プレイヤー1 (あなた)', type: 'human' },
      { id: 1, name: 'プレイヤー2 (AI)', type: 'ai', difficulty: 'easy' },
      { id: 2, name: 'プレイヤー3 (なし)', type: 'none' },
      { id: 3, name: 'プレイヤー4 (なし)', type: 'none' },
    ];

    // 各プレイヤーのボードを初期化
    const initialPlayerBoards: { [playerId: number]: PlayerBoard } = {};
    initialPlayers.forEach(player => {
      if (player.type !== 'none') {
        initialPlayerBoards[player.id] = {
          ...createEmptyBoard(player.id), // boardUtilsから取得
          attackedCells: {}, // 攻撃結果を記録するマップを初期化
        };
      }
    });

    return {
      players: initialPlayers,
      playerBoards: initialPlayerBoards,
      phase: 'select-players',
      currentPlayerTurnId: -1, // 初期ターンプレイヤーは未設定
    };
  });

  const updatePlayers = useCallback((newPlayers: PlayerSettings[]) => {
    setGameState(prev => {
      const newPlayerBoards: { [playerId: number]: PlayerBoard } = {};
      newPlayers.forEach(player => {
        if (player.type !== 'none') {
          // 既存のボードがあれば引き継ぎ、なければ新しく作成
          newPlayerBoards[player.id] = prev.playerBoards[player.id] || {
            ...createEmptyBoard(player.id),
            attackedCells: {},
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
        // ゲーム開始時、最初の人間プレイヤーをターンプレイヤーに設定
        const firstHumanPlayer = prev.players.find(p => p.type === 'human');
        if (firstHumanPlayer) {
          updatedState.currentPlayerTurnId = firstHumanPlayer.id;
        } else {
          // 人間プレイヤーがいない場合は最初のAIプレイヤーにする
          const firstAIPlayer = prev.players.find(p => p.type === 'ai');
          if (firstAIPlayer) {
            updatedState.currentPlayerTurnId = firstAIPlayer.id;
          } else {
            // エラーハンドリング: ゲームを開始できるプレイヤーがいない
            console.error("No active players to start game.");
            updatedState.currentPlayerTurnId = -1; // 無効なID
          }
        }
      }
      return updatedState;
    });
  }, []);

  // ターンを進めるロジック
  const advanceTurn = useCallback(() => {
    setGameState(prev => {
      const activePlayers = prev.players.filter(p => p.type !== 'none');
      const currentIndex = activePlayers.findIndex(p => p.id === prev.currentPlayerTurnId);
      const nextIndex = (currentIndex + 1) % activePlayers.length;
      const nextPlayerId = activePlayers[nextIndex].id;

      return {
        ...prev,
        currentPlayerTurnId: nextPlayerId,
      };
    });
  }, []);

  // 攻撃処理ロジック
  const handleAttack = useCallback((attackerId: number, targetPlayerId: number, coord: Coordinate): AttackResult => {
    let attackResult: AttackResult = { hit: false };

    setGameState(prev => {
      const updatedPlayerBoards = { ...prev.playerBoards };
      const targetBoard = { ...updatedPlayerBoards[targetPlayerId] };
      const attackingPlayerBoard = { ...updatedPlayerBoards[attackerId] };

      // ターゲットセルの確認
      const targetCell = targetBoard.cells[coord.y][coord.x];
      const newTargetCells = targetBoard.cells.map(row => row.map(cell => ({ ...cell })));

      // 既に攻撃済みのセルかどうかをチェック
      if (attackingPlayerBoard.attackedCells[`${coord.x},${coord.y}`]) {
          // 既に攻撃済みの場合は何もしない（UI側でクリック不可にするべきだが、念のため）
          console.warn('Already attacked this cell:', coord);
          attackResult = { hit: false }; // 攻撃結果はミスとする
          return prev; // ステートを変更しない
      }

      if (targetCell.status === 'ship') {
        // ヒット！
        attackResult.hit = true;

        // ターゲットボードのセル状態を 'hit' に更新
        newTargetCells[coord.y][coord.x].status = 'hit';

        // ターゲットボードの船のヒット情報を更新
        const hitShip = targetBoard.placedShips.find(s => s.id === targetCell.shipId);
        if (hitShip) {
          const updatedHits = [...hitShip.hits, coord];
          const updatedPlacedShips = targetBoard.placedShips.map(s => {
            if (s.id === hitShip.id) {
              const isSunk = updatedHits.length === s.definition.size;
              if (isSunk) {
                attackResult.sunkShipId = s.id; // 沈んだ船のIDを結果に含める
                // 沈んだ船のセルを 'sunk' 状態に更新
                for (let i = 0; i < s.definition.size; i++) {
                  let x = s.start.x;
                  let y = s.start.y;
                  if (s.orientation === 'horizontal') x += i;
                  else y += i;
                  if (newTargetCells[y] && newTargetCells[y][x]) {
                    newTargetCells[y][x].status = 'sunk';
                  }
                }
              }
              return { ...s, hits: updatedHits, isSunk: isSunk };
            }
            return s;
          });
          targetBoard.placedShips = updatedPlacedShips;
        }

        // 攻撃者の attackedCells を更新
        attackingPlayerBoard.attackedCells[`${coord.x},${coord.y}`] = 'hit';

      } else {
        // ミス！
        attackResult.hit = false;
        // ターゲットボードのセル状態を 'miss' に更新
        newTargetCells[coord.y][coord.x].status = 'miss';
        // 攻撃者の attackedCells を更新
        attackingPlayerBoard.attackedCells[`${coord.x},${coord.y}`] = 'miss';
      }

      updatedPlayerBoards[targetPlayerId] = { ...targetBoard, cells: newTargetCells }; // ターゲットボードのセル更新を反映
      updatedPlayerBoards[attackerId] = attackingPlayerBoard; // 攻撃者のボードを更新

      return {
        ...prev,
        playerBoards: updatedPlayerBoards,
      };
    });

    return attackResult; // 攻撃結果を返す
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