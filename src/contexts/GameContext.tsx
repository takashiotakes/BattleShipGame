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

// ヘルパー関数: 全ての船が沈没したかチェック
const checkAllShipsSunk = (placedShips: PlacedShip[]): boolean => {
  return placedShips.every((ship) => ship.isSunk);
};

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
      currentPlayerTurnId: 0, // 初期ターンはプレイヤー0
      winnerId: null,
    };
  });

  // プレイヤー設定の更新
  const updatePlayers = useCallback((newPlayers: PlayerSettings[]) => {
    setGameState((prev) => {
      const newPlayerBoards = { ...prev.playerBoards };
      newPlayers.forEach((player) => {
        if (player.type !== "none" && !newPlayerBoards[player.id]) {
          // 新しいプレイヤーが追加された場合、ボードを初期化
          newPlayerBoards[player.id] = {
            ...createEmptyBoard(player.id),
            attackedCells: {},
            placedShips: [],
          };
        } else if (player.type === "none" && newPlayerBoards[player.id]) {
          // プレイヤーが'none'になった場合、ボードを削除（オプション）
          delete newPlayerBoards[player.id];
        }
      });

      // 最初の有効なプレイヤーを探し、currentPlayerTurnId を設定
      const firstActivePlayer = newPlayers.find((p) => p.type !== "none");
      const newCurrentPlayerTurnId = firstActivePlayer
        ? firstActivePlayer.id
        : -1;

      return {
        ...prev,
        players: newPlayers,
        playerBoards: newPlayerBoards,
        // プレイヤー設定が変わった場合、ターンプレイヤーをリセット
        currentPlayerTurnId: newCurrentPlayerTurnId,
      };
    });
  }, []);

  // フェーズの進行
  const advancePhase = useCallback((newPhase: GamePhase) => {
    setGameState((prev) => {
      let nextCurrentPlayerTurnId = prev.currentPlayerTurnId;
      if (newPhase === "in-game" && nextCurrentPlayerTurnId === -1) {
        // ゲーム開始時、最初の有効なプレイヤーにターンを設定
        const firstActivePlayer = prev.players.find((p) => p.type !== "none");
        if (firstActivePlayer) {
          nextCurrentPlayerTurnId = firstActivePlayer.id;
        }
      }
      return {
        ...prev,
        phase: newPhase,
        currentPlayerTurnId: nextCurrentPlayerTurnId,
      };
    });
  }, []);

  // ターンの進行
  const advanceTurn = useCallback(() => {
    setGameState((prev) => {
      const activePlayers = prev.players.filter((p) => p.type !== "none");
      if (activePlayers.length === 0) {
        return prev; // アクティブなプレイヤーがいない場合
      }

      const currentPlayerIndex = activePlayers.findIndex(
        (p) => p.id === prev.currentPlayerTurnId
      );
      let nextPlayerIndex = (currentPlayerIndex + 1) % activePlayers.length;
      let nextPlayerId = activePlayers[nextPlayerIndex].id;

      // もし次のプレイヤーが「なし」であればスキップ (updatePlayersで既にフィルタリングされているはずだが念のため)
      while (
        activePlayers[nextPlayerIndex].type === "none" &&
        nextPlayerIndex !== currentPlayerIndex
      ) {
        nextPlayerIndex = (nextPlayerIndex + 1) % activePlayers.length;
        nextPlayerId = activePlayers[nextPlayerIndex].id;
      }
      return { ...prev, currentPlayerTurnId: nextPlayerId };
    });
  }, []);

  // 攻撃処理
  const handleAttack = useCallback(
    (
      attackerId: number,
      targetPlayerId: number,
      coord: Coordinate
    ): AttackResult => {
      let result: AttackResult = { hit: false };

      setGameState((prev) => {
        const newPlayerBoards = { ...prev.playerBoards };
        const targetBoard = { ...newPlayerBoards[targetPlayerId] };
        const attackerBoard = { ...newPlayerBoards[attackerId] };

        // 既に攻撃済みのマスかどうかをチェック (UI側でも制御するが、念のため)
        if (
          targetBoard.cells[coord.y][coord.x].status === "hit" ||
          targetBoard.cells[coord.y][coord.x].status === "miss"
        ) {
          console.warn(`Cell at ${coord.x},${coord.y} already attacked.`);
          return prev; // 既に攻撃済みの場合は状態を更新しない
        }

        const cellToAttack = targetBoard.cells[coord.y][coord.x];
        let newStatus: typeof cellToAttack.status;
        let isHit = false;
        let sunkShipId: string | undefined;

        if (cellToAttack.status === "ship") {
          newStatus = "hit";
          isHit = true;
          // 船がヒットした場合は、その船のhits配列を更新
          const hitShip = targetBoard.placedShips.find(
            (s) => s.id === cellToAttack.shipId
          );
          if (hitShip) {
            const newHits = [...hitShip.hits, coord];
            const isSunk = newHits.length === hitShip.definition.size;
            if (isSunk) {
              sunkShipId = hitShip.id;
            }
            const updatedPlacedShips = targetBoard.placedShips.map((s) =>
              s.id === hitShip.id ? { ...s, hits: newHits, isSunk: isSunk } : s
            );
            targetBoard.placedShips = updatedPlacedShips;
            result.sunkShipId = sunkShipId; // 結果に撃沈情報を追加
          }
        } else {
          newStatus = "miss";
        }

        // セルの状態を更新
        const newCells = targetBoard.cells.map((row) =>
          row.map((cell) => ({ ...cell }))
        );
        newCells[coord.y][coord.x] = { ...cellToAttack, status: newStatus };
        targetBoard.cells = newCells;

        // 攻撃結果を attackerBoard に記録 (攻撃したマスの色を変えるため)
        attackerBoard.attackedCells = {
          ...attackerBoard.attackedCells,
          [`${coord.x},${coord.y}`]: isHit ? "hit" : "miss",
        };

        newPlayerBoards[targetPlayerId] = targetBoard;
        newPlayerBoards[attackerId] = attackerBoard;

        result.hit = isHit;

        // 勝敗判定
        const allShipsSunk = checkAllShipsSunk(targetBoard.placedShips);
        if (allShipsSunk) {
          // 勝者が決定した場合
          return {
            ...prev,
            playerBoards: newPlayerBoards,
            winnerId: attackerId,
            phase: "game-over",
          };
        } else {
          // 勝者がまだ決まっていない場合、ターン進行はGameScreenで制御される
          return {
            ...prev,
            playerBoards: newPlayerBoards,
          };
        }
      });
      return result; // 結果を即座に返す
    },
    []
  );

  // handleAttack の結果を受けて、ターンを進めるロジック
  // この useEffect は GameScreen.tsx でのターン進行ロジックと重複するため削除します
  /*
  useEffect(() => {
    // phase が 'in-game' で、かつ winnerId が null の場合のみターンを進める
    if (gameState.phase === 'in-game' && gameState.winnerId === null) {
      const attackingPlayer = gameState.players.find(p => p.id === gameState.currentPlayerTurnId);
      if (attackingPlayer && attackingPlayer.type === 'human') {
         // Human turn - handled in handleCellClick in GameScreen
      } else if (attackingPlayer && attackingPlayer.type === 'ai') {
        // AI turn - handled in useEffect in GameScreen
      }
    }
  }, [gameState.playerBoards, gameState.phase, gameState.winnerId, gameState.currentPlayerTurnId, advanceTurn]);
  */

  const setPlayerBoardShips = useCallback(
    (playerId: number, placedShips: PlacedShip[]) => {
      setGameState((prev) => {
        const updatedPlayerBoards = { ...prev.playerBoards };
        if (updatedPlayerBoards[playerId]) {
          // 既存のセルを元に、配置された船の情報を反映して新しいセルを作成
          const initialCells = createEmptyBoard(playerId).cells;
          const newCells = placedShips.reduce((currentCells, pShip) => {
            return placeShipOnBoard(
              currentCells,
              pShip.definition,
              pShip.start,
              pShip.orientation
            );
          }, initialCells);

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
      currentPlayerTurnId: 0, // ゲームリセット時もプレイヤー0から開始
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
