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
import {
  createEmptyBoard,
  placeShipOnBoard,
  isAllShipsSunk,
  initializePlayerBoard,
} from "../lib/boardUtils"; // isAllShipsSunk をインポート

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
      { id: 0, name: "プレイヤー1 (あなた)", type: "human" }, // 初期値を'人間'にする
      { id: 1, name: "プレイヤー2 (AI)", type: "ai", difficulty: "easy" },
      { id: 2, name: "プレイヤー3 (なし)", type: "none" },
      { id: 3, name: "プレイヤー4 (なし)", type: "none" },
    ];

    const initialPlayerBoards: { [playerId: number]: PlayerBoard } = {};
    initialPlayers.forEach((player) => {
      if (player.type !== "none") {
        initialPlayerBoards[player.id] = initializePlayerBoard(player.id);
      }
    });

    return {
      players: initialPlayers,
      playerBoards: initialPlayerBoards,
      phase: "select-players",
      currentPlayerTurnId: 0, // 初期ターンプレイヤーは0番目のプレイヤー
      winnerId: null,
    };
  });

  // playersの状態が更新されたら playerBoards も適切に更新する
  // select-players フェーズでプレイヤー設定が変更された場合に動的にボードを生成するため
  useEffect(() => {
    setGameState((prevGameState) => {
      const newPlayerBoards = { ...prevGameState.playerBoards };
      let changed = false;

      prevGameState.players.forEach((player) => {
        if (player.type !== "none" && !newPlayerBoards[player.id]) {
          // 新しく追加されたアクティブなプレイヤーのボードを初期化
          newPlayerBoards[player.id] = initializePlayerBoard(player.id);
          changed = true;
        } else if (player.type === "none" && newPlayerBoards[player.id]) {
          // 'none' に変更されたプレイヤーのボードを削除
          delete newPlayerBoards[player.id];
          changed = true;
        }
      });

      if (changed) {
        return { ...prevGameState, playerBoards: newPlayerBoards };
      }
      return prevGameState;
    });
  }, [gameState.players]); // players の変更を監視

  const updatePlayers = useCallback((newPlayers: PlayerSettings[]) => {
    setGameState((prevGameState) => {
      // プレイヤーIDを保持したまま、新しいプレイヤー設定で更新
      // 特にプレイヤーの追加・削除によってIDが変わらないように注意
      const updatedPlayersWithIds = newPlayers.map((p, index) => ({
        id: index, // IDは配列のインデックスに固定
        name: `プレイヤー${index + 1} (${
          p.type === "human" ? "あなた" : p.type === "ai" ? "AI" : "なし"
        })`,
        ...p,
      }));

      // PlayerBoardsの調整
      const newPlayerBoards = { ...prevGameState.playerBoards };
      updatedPlayersWithIds.forEach((player) => {
        if (player.type !== "none") {
          if (!newPlayerBoards[player.id]) {
            newPlayerBoards[player.id] = initializePlayerBoard(player.id);
          }
        } else {
          delete newPlayerBoards[player.id]; // noneになったプレイヤーのボードを削除
        }
      });

      return {
        ...prevGameState,
        players: updatedPlayersWithIds,
        playerBoards: newPlayerBoards, // 更新されたボードリスト
      };
    });
  }, []);

  const advancePhase = useCallback((newPhase: GamePhase) => {
    setGameState((prevGameState) => {
      let nextCurrentPlayerId = prevGameState.currentPlayerTurnId;
      // フェーズが ship-placement に変わる際に、最初のアクティブなプレイヤーのターンにする
      if (newPhase === "ship-placement") {
        const firstActivePlayer = prevGameState.players.find(
          (p) => p.type !== "none"
        );
        if (firstActivePlayer) {
          nextCurrentPlayerId = firstActivePlayer.id;
        }
      } else if (
        newPhase === "in-game" &&
        prevGameState.currentPlayerTurnId === -1
      ) {
        // ゲーム開始時にターンプレイヤーが未設定の場合、最初のアクティブなプレイヤーに設定
        const firstActivePlayer = prevGameState.players.find(
          (p) => p.type !== "none"
        );
        if (firstActivePlayer) {
          nextCurrentPlayerId = firstActivePlayer.id;
        }
      }

      return {
        ...prevGameState,
        phase: newPhase,
        currentPlayerTurnId: nextCurrentPlayerId,
      };
    });
  }, []);

  const setPlayerBoardShips = useCallback(
    (playerId: number, placedShips: PlacedShip[]) => {
      setGameState((prevGameState) => {
        const updatedPlayerBoards = { ...prevGameState.playerBoards };
        if (updatedPlayerBoards[playerId]) {
          // placedShips に基づいて cells を更新
          let newCells = createEmptyBoard(playerId).cells; // まず空のボードを作成
          placedShips.forEach((ship) => {
            newCells = placeShipOnBoard(newCells, ship, ship.id); // 船を配置
          });

          updatedPlayerBoards[playerId] = {
            ...updatedPlayerBoards[playerId],
            placedShips: placedShips,
            cells: newCells,
          };
        }
        return { ...prev, playerBoards: updatedPlayerBoards };
      });
    },
    []
  );

  const handleAttack = useCallback(
    (
      attackerId: number,
      targetPlayerId: number,
      coord: Coordinate
    ): AttackResult => {
      let result: "hit" | "miss" | "sunk" = "miss";
      let sunkShipName: string | undefined = undefined;

      setGameState((prevGameState) => {
        const newPlayerBoards = { ...prevGameState.playerBoards };
        const targetBoard = newPlayerBoards[targetPlayerId];

        if (!targetBoard) {
          console.error(
            `攻撃対象のボード（ID: ${targetPlayerId}）が見つかりません。`
          );
          // エラーが発生した場合も、整合性のために AttackResult を返す
          return { ...prevGameState };
        }

        const attackedKey = `${coord.x},${coord.y}`;
        if (targetBoard.attackedCells[attackedKey]) {
          // 既に攻撃済みのマスの場合、そのままの状態を返し、結果は 'miss' とみなすか、UIで防ぐ
          return prevGameState; // ここでは state を変更しない
        }

        const newCells = targetBoard.cells.map((row) =>
          row.map((cell) => ({ ...cell }))
        );
        const hitCell = newCells[coord.y][coord.x];

        const newPlacedShips = targetBoard.placedShips.map((s) => ({ ...s }));
        let shipHit: PlacedShip | undefined;

        if (hitCell.status === "ship" || hitCell.status === "sunk") {
          result = "hit";
          hitCell.status = "hit";

          shipHit = newPlacedShips.find((s) => {
            for (let i = 0; i < s.definition.size; i++) {
              const shipX =
                s.orientation === "horizontal" ? s.start.x + i : s.start.x;
              const shipY =
                s.orientation === "vertical" ? s.start.y + i : s.start.y;
              if (shipX === coord.x && shipY === coord.y) {
                return true;
              }
            }
            return false;
          });

          if (shipHit) {
            if (!shipHit.hits.some((h) => h.x === coord.x && h.y === coord.y)) {
              shipHit.hits.push(coord);
            }
            if (shipHit.hits.length === shipHit.definition.size) {
              shipHit.isSunk = true;
              result = "sunk";
              sunkShipName = shipHit.definition.name;
              for (let i = 0; i < shipHit.definition.size; i++) {
                const sunkX =
                  shipHit.orientation === "horizontal"
                    ? shipHit.start.x + i
                    : shipHit.start.x;
                const sunkY =
                  shipHit.orientation === "vertical"
                    ? shipHit.start.y + i
                    : shipHit.start.y;
                if (newCells[sunkY] && newCells[sunkY][sunkX]) {
                  newCells[sunkY][sunkX].status = "sunk";
                }
              }
            }
          }
        } else {
          hitCell.status = "miss";
          result = "miss";
        }

        targetBoard.attackedCells[attackedKey] = {
          result: hitCell.status,
          shipId: hitCell.shipId,
        };

        newPlayerBoards[targetPlayerId] = {
          ...targetBoard,
          cells: newCells,
          placedShips: newPlacedShips,
        };

        // 勝敗判定ロジックをここで実行
        const activePlayers = prevGameState.players.filter(
          (p) => p.type !== "none"
        );
        const livingPlayers = activePlayers.filter((p) => {
          const board = newPlayerBoards[p.id];
          return !isAllShipsSunk(board.placedShips); // boardUtilsからisAllShipsSunkを使用
        });

        let newWinnerId: number | null = null;
        if (livingPlayers.length === 1) {
          newWinnerId = livingPlayers[0].id; // 最後の1人が勝者
        } else if (livingPlayers.length === 0 && activePlayers.length > 0) {
          // 全員撃沈（理論上この状態にはなりにくいが念のため）
          newWinnerId = null; // 引き分けなど
        }

        const newPhase =
          newWinnerId !== null ? "game-over" : prevGameState.phase;
        const newCurrentPlayerTurnId =
          newWinnerId !== null ? -1 : prevGameState.currentPlayerTurnId; // ゲーム終了ならターンを無効化

        return {
          ...prevGameState,
          playerBoards: newPlayerBoards,
          phase: newPhase,
          winnerId: newWinnerId,
          currentPlayerTurnId: newCurrentPlayerTurnId,
        };
      });

      return {
        playerId: attackerId,
        targetPlayerId,
        target: coord,
        result,
        sunkShipName,
      }; // targetPlayerId を追加して返す
    },
    []
  );

  const advanceTurn = useCallback(() => {
    setGameState((prevGameState) => {
      const activePlayers = prevGameState.players.filter(
        (p) => p.type !== "none"
      );
      if (activePlayers.length === 0) {
        return prevGameState;
      }

      let nextPlayerIndex = -1;
      const currentIdx = activePlayers.findIndex(
        (p) => p.id === prevGameState.currentPlayerTurnId
      );

      for (let i = 1; i <= activePlayers.length; i++) {
        const potentialNextIndex = (currentIdx + i) % activePlayers.length;
        const potentialNextPlayer = activePlayers[potentialNextIndex];

        const board = prevGameState.playerBoards[potentialNextPlayer.id];
        // プレイヤーの船が全て沈んでいないかチェック
        const allShipsSunk = board.placedShips.every(
          (ship) => ship.hits.length === ship.definition.size
        );

        if (!allShipsSunk) {
          // 全ての船が沈んでいなければ、次のターンプレイヤーとする
          nextPlayerIndex = potentialNextIndex;
          break;
        }
      }

      if (nextPlayerIndex === -1) {
        // 全員沈んでいる、または次のプレイヤーが見つからない
        // この場合はゲーム終了となるはず (handleAttackで既に判定されている)
        console.warn(
          "次のターンプレイヤーが見つかりません。ゲームはすでに終了しているか、エラーです。"
        );
        return { ...prevGameState, phase: "game-over", winnerId: null };
      }

      const nextPlayerId = activePlayers[nextPlayerIndex].id;

      return {
        ...prevGameState,
        currentPlayerTurnId: nextPlayerId,
      };
    });
  }, []);

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
        initialPlayerBoards[player.id] = initializePlayerBoard(player.id);
      }
    });

    setGameState({
      players: initialPlayers,
      playerBoards: initialPlayerBoards,
      phase: "select-players",
      currentPlayerTurnId: 0, // ゲームリセット時もプレイヤー1のターンから開始
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
