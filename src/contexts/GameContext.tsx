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
  updateCellsWithShips,
} from "../lib/boardUtils"; // updateCellsWithShips もインポート

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

// ヘルパー関数: 初期プレイヤー設定を生成
const generateInitialPlayers = (): PlayerSettings[] => {
  return [
    { id: 0, name: "プレイヤー1", type: "human" }, // name は汎用的に
    { id: 1, name: "プレイヤー2", type: "ai", difficulty: "easy" },
    { id: 2, name: "プレイヤー3", type: "none" },
    { id: 3, name: "プレイヤー4", type: "none" },
  ];
};

export const GameProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [gameState, setGameState] = useState<GameState>(() => {
    const initialPlayers = generateInitialPlayers();

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
      currentPlayerTurnId: -1,
      winnerId: null,
    };
  });

  const updatePlayers = useCallback((newPlayers: PlayerSettings[]) => {
    setGameState((prev) => {
      const updatedPlayerBoards = { ...prev.playerBoards };
      const nextPlayers = newPlayers.map((player) => {
        // nameを強制的に更新（例：タイプに基づいて）
        let newName = `プレイヤー${player.id + 1}`;
        if (player.type === "human") newName += " (人間)";
        if (player.type === "ai") newName += ` (AI)`;
        if (player.type === "none") newName += ` (なし)`;
        return { ...player, name: newName };
      });

      nextPlayers.forEach((player) => {
        // 新しく「なし」から「人間」や「AI」になったプレイヤー、または初期化時にボードを作成
        if (player.type !== "none" && !updatedPlayerBoards[player.id]) {
          updatedPlayerBoards[player.id] = {
            ...createEmptyBoard(player.id),
            attackedCells: {},
            placedShips: [],
          };
        }
        // 「人間」や「AI」から「なし」になったプレイヤーのボードを削除
        if (player.type === "none" && updatedPlayerBoards[player.id]) {
          delete updatedPlayerBoards[player.id];
        }
      });

      return {
        ...prev,
        players: nextPlayers, // 更新されたプレイヤーリストを使用
        playerBoards: updatedPlayerBoards,
      };
    });
  }, []);

  const advancePhase = useCallback((newPhase: GamePhase) => {
    setGameState((prev) => {
      let updatedCurrentPlayerTurnId = prev.currentPlayerTurnId;

      if (newPhase === "ship-placement") {
        // App.tsx で currentPlayerTurnId を設定するので、ここではフェーズ変更のみ
        // ただし、念のため最初の有効なプレイヤーに設定するロジックは残しておく
        // App.tsx が呼ばれないケースもあるかもしれないため
        const firstActivePlayer = prev.players.find((p) => p.type !== "none");
        if (firstActivePlayer && updatedCurrentPlayerTurnId === -1) {
          // -1の場合のみ設定
          updatedCurrentPlayerTurnId = firstActivePlayer.id;
        }
      } else if (newPhase === "in-game") {
        const firstActivePlayer = prev.players.find((p) => p.type !== "none");
        if (firstActivePlayer) {
          updatedCurrentPlayerTurnId = firstActivePlayer.id;
        }
      } else if (newPhase === "select-players") {
        updatedCurrentPlayerTurnId = -1;
      }

      return {
        ...prev,
        phase: newPhase,
        currentPlayerTurnId: updatedCurrentPlayerTurnId,
      };
    });
  }, []);

  const advanceTurn = useCallback(() => {
    setGameState((prev) => {
      const activePlayers = prev.players.filter((p) => p.type !== "none");
      if (activePlayers.length === 0) {
        console.warn("No active players to advance turn.");
        return prev;
      }

      const currentActivePlayerIndex = activePlayers.findIndex(
        (p) => p.id === prev.currentPlayerTurnId
      );

      // 次の有効なプレイヤーを見つける
      let nextPlayerIndex =
        (currentActivePlayerIndex + 1) % activePlayers.length;
      let nextPlayerId = activePlayers[nextPlayerIndex].id;

      // 全ての敵が沈没しているかチェック（このロジックは GameScreen での勝敗判定に移動する方が良い）
      // ここはシンプルに次のターンへ進めるロジックに限定する
      // 勝敗判定は攻撃後に handleAttack で行う

      return {
        ...prev,
        currentPlayerTurnId: nextPlayerId,
      };
    });
  }, []);

  const handleAttack = useCallback(
    (
      attackerId: number,
      targetPlayerId: number,
      coord: Coordinate
    ): AttackResult => {
      let result: AttackResult = { hit: false };

      // targetPlayerId が有効な数値であることを確認
      if (typeof targetPlayerId !== "number" || isNaN(targetPlayerId)) {
        console.error(
          `Invalid targetPlayerId provided to handleAttack:`,
          targetPlayerId
        );
        return { hit: false }; // 無効なIDの場合は何もせず終了
      }

      setGameState((prev) => {
        const newPlayerBoards = { ...prev.playerBoards };
        const targetBoard = newPlayerBoards[targetPlayerId];

        if (!targetBoard) {
          console.error(
            `Target board for player ${targetPlayerId} not found. (ID: ${targetPlayerId})`
          );
          return prev;
        }

        const updatedCells = targetBoard.cells.map((row) => [...row]);
        const attackedCell = updatedCells[coord.y][coord.x];

        // すでに攻撃済みのマスは処理しない
        if (
          attackedCell.status === "hit" ||
          attackedCell.status === "miss" ||
          attackedCell.status === "sunk"
        ) {
          console.log(
            `Cell at (${coord.x}, ${coord.y}) for player ${targetPlayerId} already attacked.`
          );
          // 既に攻撃済みの場合は、その結果を返す
          result = {
            hit:
              attackedCell.status === "hit" || attackedCell.status === "sunk",
          };
          return prev; // 状態は変更しない
        }

        let hitShip: PlacedShip | undefined = undefined;
        let isSunk = false;

        if (attackedCell.status === "ship" && attackedCell.shipId) {
          // ヒット！
          updatedCells[coord.y][coord.x].status = "hit";
          result.hit = true;

          // 船のヒット数を更新
          const updatedPlacedShips = targetBoard.placedShips.map((ship) => {
            if (ship.id === attackedCell.shipId) {
              const newHits = [...ship.hits, coord];
              const sunk = newHits.length === ship.definition.size;
              if (sunk) {
                isSunk = true;
                console.log(
                  `Ship ${ship.definition.name} of player ${targetPlayerId} has been sunk!`
                );
              }
              hitShip = { ...ship, hits: newHits, isSunk: sunk };
              return hitShip;
            }
            return ship;
          });

          // もし船が沈没したら、その船の全てのセルを 'sunk' に更新
          if (isSunk && hitShip) {
            hitShip.hits.forEach((hitCoord) => {
              updatedCells[hitCoord.y][hitCoord.x].status = "sunk";
            });
          }

          newPlayerBoards[targetPlayerId] = {
            ...targetBoard,
            cells: updatedCells,
            placedShips: updatedPlacedShips,
          };
          result.sunkShipId = isSunk ? hitShip?.id : undefined;

          // ★ゲーム終了判定ロジックはGameScreenのhandleAttackResultに移すのが理想だが、
          // 現状GameContextで一元的に行われているため、ここで勝敗判定を行う
          // 全ての船が沈没したかチェック
          const allShipsSunk = updatedPlacedShips.every((ship) => ship.isSunk);
          if (allShipsSunk) {
            console.log(
              `Player ${
                prev.players.find((p) => p.id === targetPlayerId)?.name
              } の全ての船が沈没しました！`
            );
            // 攻撃者 (attackerId) が勝者
            result.winnerId = attackerId;
            return {
              ...prev,
              playerBoards: newPlayerBoards,
              phase: "game-over",
              winnerId: attackerId,
            };
          }
        } else {
          // ミス
          updatedCells[coord.y][coord.x].status = "miss";
          result.hit = false;
          newPlayerBoards[targetPlayerId] = {
            ...targetBoard,
            cells: updatedCells,
          };
        }

        return {
          ...prev,
          playerBoards: newPlayerBoards,
        };
      });
      return result;
    },
    []
  );

  const setPlayerBoardShips = useCallback(
    (playerId: number, placedShips: PlacedShip[]) => {
      setGameState((prev) => {
        const updatedPlayerBoards = { ...prev.playerBoards };
        const currentBoard = updatedPlayerBoards[playerId];

        if (currentBoard) {
          const newCells = updateCellsWithShips(playerId, placedShips);
          updatedPlayerBoards[playerId] = {
            ...currentBoard,
            placedShips: placedShips,
            cells: newCells,
          };
        }
        return { ...prev, playerBoards: updatedPlayerBoards };
      });
    },
    []
  );

  const resetGame = useCallback(() => {
    const initialPlayers = generateInitialPlayers(); // ヘルパー関数を使用

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
  if (context === undefined) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return context;
};
