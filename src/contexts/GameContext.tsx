// src/contexts/GameContext.tsx

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useRef,
  useEffect,
} from "react";
import {
  GamePhase,
  PlayerSettings,
  PlayerBoard,
  GameState,
  Coordinate,
  AttackResult,
  PlacedShip,
  ALL_SHIPS,
  ShipDefinition,
} from "../models/types";
import { createEmptyBoard, placeShipOnBoard } from "../lib/boardUtils";

interface GameContextType {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  updatePlayers: (newPlayers: PlayerSettings[]) => void;
  advancePhase: (newPhase: GamePhase) => void;
  advanceTurn: () => void;
  handleAttack: (
    attackerId: number,
    targetPlayerId: number,
    coord: Coordinate
  ) => AttackResult;
  resetGame: () => void;
  setPlayerBoardShips: (playerId: number, placedShips: PlacedShip[]) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [gameState, setGameState] = useState<GameState>(() => {
    // 初期プレイヤー設定に、デフォルトのnameを付与
    const initialPlayers: PlayerSettings[] = [
      { id: 0, name: "プレイヤー1 (人間)", type: "human" }, // 初期値を'人間'にする
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

    return {
      players: initialPlayers,
      playerBoards: initialPlayerBoards,
      phase: "select-players",
      currentPlayerTurnId: -1, // ゲーム開始前なので無効なID
      winnerId: null,
    };
  });

  const gameStateRef = useRef(gameState);

  // gameState が更新されたら ref も更新する
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const updatePlayers = useCallback((newPlayers: PlayerSettings[]) => {
    setGameState((prev) => {
      const newPlayerBoards = { ...prev.playerBoards };
      newPlayers.forEach((player) => {
        if (player.type !== "none" && !newPlayerBoards[player.id]) {
          // 新しく追加されたアクティブプレイヤーのボードを初期化
          newPlayerBoards[player.id] = {
            ...createEmptyBoard(player.id),
            attackedCells: {},
            placedShips: [],
          };
        } else if (player.type === "none" && newPlayerBoards[player.id]) {
          // 「なし」になったプレイヤーのボードを削除
          delete newPlayerBoards[player.id];
        }
      });

      // 存在しなくなったプレイヤーのボードをplayerBoardsから削除
      for (const id in newPlayerBoards) {
        if (!newPlayers.some((p) => p.id === Number(id) && p.type !== "none")) {
          delete newPlayerBoards[id];
        }
      }

      return {
        ...prev,
        players: newPlayers,
        playerBoards: newPlayerBoards,
      };
    });
  }, []);

  const advancePhase = useCallback((newPhase: GamePhase) => {
    setGameState((prev) => {
      let nextState = { ...prev, phase: newPhase };

      if (newPhase === "in-game") {
        // 'in-game' フェーズに移行する際に最初のターンプレイヤーを設定
        // アクティブな（noneでない）プレイヤーの中から最初のプレイヤーを選択
        const activePlayers = prev.players.filter((p) => p.type !== "none");
        if (activePlayers.length > 0) {
          nextState.currentPlayerTurnId = activePlayers[0].id;
        } else {
          console.warn("No active players to start game.");
          nextState.phase = "select-players"; // プレイヤーがいない場合は選択画面に戻す
        }
      } else if (newPhase === "game-over") {
        // ゲームオーバーフェーズでは特に何もしない
      }
      return nextState;
    });
  }, []);

  const advanceTurn = useCallback(() => {
    setGameState((prev) => {
      const activePlayers = prev.players.filter((p) => p.type !== "none");
      if (activePlayers.length === 0) {
        console.warn("No active players to advance turn.");
        return prev;
      }

      // 現在のプレイヤーのインデックスを見つける
      const currentIndex = activePlayers.findIndex(
        (p) => p.id === prev.currentPlayerTurnId
      );
      if (currentIndex === -1) {
        // 見つからない場合、最初のプレイヤーに設定 (エラー回復)
        return { ...prev, currentPlayerTurnId: activePlayers[0].id };
      }

      // 次のプレイヤーのインデックスを計算
      let nextIndex = (currentIndex + 1) % activePlayers.length;
      let nextPlayerId = activePlayers[nextIndex].id;

      // もし次のプレイヤーのボードが全て沈没していたら、その次のプレイヤーを探す
      let attempts = 0;
      while (attempts < activePlayers.length) {
        const nextPlayerBoard = prev.playerBoards[nextPlayerId];
        if (
          nextPlayerBoard &&
          nextPlayerBoard.placedShips.every((ship) => ship.isSunk)
        ) {
          console.log(
            `Player ${nextPlayerId} (${activePlayers[nextIndex].name}) has no ships left, skipping turn.`
          );
          nextIndex = (nextIndex + 1) % activePlayers.length;
          nextPlayerId = activePlayers[nextIndex].id;
          attempts++;
        } else {
          break; // 沈没していないプレイヤーが見つかった
        }
      }

      if (attempts === activePlayers.length) {
        console.warn(
          "All remaining players have sunk ships. Game should be over."
        );
        return {
          ...prev,
          phase: "game-over",
          winnerId: prev.currentPlayerTurnId,
        }; // 全員沈没ならゲームオーバー
      }

      return { ...prev, currentPlayerTurnId: nextPlayerId };
    });
  }, []);

  const handleAttack = useCallback(
    (
      attackerId: number,
      targetPlayerId: number,
      coord: Coordinate
    ): AttackResult => {
      // useRef を使って最新の gameState を参照
      const currentPlayers = gameStateRef.current.players;
      const currentBoards = { ...gameStateRef.current.playerBoards };

      const attacker = currentPlayers.find((p) => p.id === attackerId);
      let targetBoard = currentBoards[targetPlayerId];

      if (!attacker || !targetBoard) {
        console.error("Attacker or target board not found for attack.");
        return { hit: false, winnerId: null };
      }

      const newCells = targetBoard.cells.map((row) => [...row]);
      const cellToAttack = newCells[coord.y][coord.x];

      if (
        cellToAttack.status === "hit" ||
        cellToAttack.status === "miss" ||
        cellToAttack.status === "sunk"
      ) {
        console.log("Already attacked this cell.");
        return { hit: false, winnerId: null }; // 既に攻撃済みの場合は何もしない
      }

      let hit = false;
      let sunkShipId: string | undefined;
      let sunkShipName: string | undefined; // ★追加: 沈没した船の名前を保持する変数★

      if (cellToAttack.status === "ship") {
        hit = true;
        cellToAttack.status = "hit";
        const hitShipId = cellToAttack.shipId;
        const placedShipIndex = targetBoard.placedShips.findIndex(
          (s) => s.id === hitShipId
        );

        if (placedShipIndex !== -1) {
          const placedShip = targetBoard.placedShips[placedShipIndex];
          const newHits = [...placedShip.hits, coord];
          const isSunk = newHits.length === placedShip.definition.size;

          const updatedPlacedShip: PlacedShip = {
            ...placedShip,
            hits: newHits,
            isSunk: isSunk,
          };

          const newPlacedShips = targetBoard.placedShips.map((s, idx) =>
            idx === placedShipIndex ? updatedPlacedShip : s
          );

          if (isSunk) {
            sunkShipId = updatedPlacedShip.id;
            sunkShipName = updatedPlacedShip.definition.name; // ★ここで船の名前を設定★
            // 沈没した船のすべてのセルを 'sunk' に更新
            newPlacedShips.forEach((ship) => {
              if (ship.id === sunkShipId) {
                const { start, orientation, definition } = ship;
                for (let i = 0; i < definition.size; i++) {
                  const x =
                    orientation === "horizontal" ? start.x + i : start.x;
                  const y = orientation === "vertical" ? start.y + i : start.y;
                  newCells[y][x].status = "sunk";
                }
              }
            });
          }

          targetBoard = {
            ...targetBoard,
            cells: newCells,
            placedShips: newPlacedShips,
          };
        }
      } else {
        cellToAttack.status = "miss";
        targetBoard = { ...targetBoard, cells: newCells };
      }

      currentBoards[targetPlayerId] = targetBoard;

      // 勝者判定
      let winnerId: number | null = null;
      // アクティブなプレイヤーリストを取得 (自分以外のnoneではないプレイヤー)
      const activeEnemyPlayers = currentPlayers.filter(
        (p) => p.id !== attackerId && p.type !== "none"
      );

      if (activeEnemyPlayers.length > 0) {
        const allEnemyPlayersSunk = activeEnemyPlayers.every((enemyPlayer) => {
          const enemyBoard = currentBoards[enemyPlayer.id];
          return (
            enemyBoard && enemyBoard.placedShips.every((ship) => ship.isSunk)
          );
        });

        if (allEnemyPlayersSunk) {
          winnerId = attackerId;
        }
      } else {
        // 敵プレイヤーが一人もいない場合（ありえないが念のため）
        console.warn("No enemy players to determine winner.");
      }

      // setGameState を非同期で更新
      setGameState((prev) => {
        const updatedPlayerBoards = {
          ...prev.playerBoards,
          [targetPlayerId]: targetBoard,
        };
        return {
          ...prev,
          playerBoards: updatedPlayerBoards,
          winnerId: winnerId,
          phase: winnerId !== null ? "game-over" : prev.phase,
        };
      });

      return { hit, sunkShipId, winnerId, sunkShipName }; // ★sunkShipName を返すように修正★
    },
    [] // handleAttack は gameStateRef.current を使うため、依存配列は空でOK
  );

  const setPlayerBoardShips = useCallback(
    (playerId: number, placedShips: PlacedShip[]) => {
      setGameState((prev) => {
        const playerBoard = prev.playerBoards[playerId];
        if (!playerBoard) {
          console.warn(`PlayerBoard for ID ${playerId} not found.`);
          return prev;
        }

        // 新しい船の配置に基づいて新しいセル状態を生成
        let newCells = createEmptyBoard(playerId).cells; // 一度空のボードを作成
        placedShips.forEach((pShip) => {
          newCells = placeShipOnBoard(
            newCells,
            pShip.definition,
            pShip.start,
            pShip.orientation
          );
        });

        // 既存のヒット/ミス情報を新しいボードに適用
        // (この関数は主にShipPlacementで呼ばれるため、in-game中のヒット情報は通常ないはずだが、念のため)
        // attackedCells からは更新しない。セル自体の status を直接参照
        const updatedPlayerBoards = {
          ...prev.playerBoards,
          [playerId]: {
            ...playerBoard,
            placedShips: placedShips,
            cells: newCells, // ★ここが重要: 新しい cells を設定★
          },
        };
        return { ...prev, playerBoards: updatedPlayerBoards };
      });
    },
    []
  );

  const resetGame = useCallback(() => {
    // resetGame でも name のロジックを適用
    const initialPlayers: PlayerSettings[] = [
      { id: 0, name: "プレイヤー1 (人間)", type: "human" },
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
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
};
