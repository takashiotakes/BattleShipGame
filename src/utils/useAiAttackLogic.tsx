// src/utils/useAiAttackLogic.tsx

import { useCallback } from "react";
import { useGame } from "../contexts/GameContext";
import { Coordinate, PlayerBoard } from "../models/types";
import { getCoordinatesAroundShip } from "../lib/boardUtils";

interface UseAiAttackLogicProps {
  gameState: ReturnType<typeof useGame>["gameState"];
  setGameState: ReturnType<typeof useGame>["setGameState"];
  advancePhase: ReturnType<typeof useGame>["advancePhase"];
}

const useAiAttackLogic = ({
  gameState,
  setGameState,
  advancePhase,
}: UseAiAttackLogicProps) => {
  const { players, playerBoards, currentPlayerTurnId } = gameState;

  const currentPlayer = players.find((p) => p.id === currentPlayerTurnId);
  const opponentPlayer = players.find(
    (p) => p.id !== currentPlayerTurnId && p.type !== "none"
  );

  const handleAiAttack = useCallback(() => {
    if (!currentPlayer || currentPlayer.type !== "ai" || !opponentPlayer) {
      console.warn(
        "AI攻撃ロジック: AIのターンでないか、対戦相手が見つかりません。"
      );
      return;
    }

    const opponentBoard = playerBoards[opponentPlayer.id];
    if (!opponentBoard) {
      console.error(
        `AI攻撃ロジック: 対戦相手 ${opponentPlayer.id} のボードが見つかりません。`
      );
      return;
    }

    let attackTarget: Coordinate | null = null;
    const availableCells: Coordinate[] = [];

    // まだ攻撃していないマスを収集
    for (let y = 0; y < opponentBoard.cells.length; y++) {
      for (let x = 0; x < opponentBoard.cells[y].length; x++) {
        const cell = opponentBoard.cells[y][x];
        if (!cell.hit && !cell.missed) {
          availableCells.push({ x, y });
        }
      }
    }

    if (availableCells.length > 0) {
      // シンプルなランダム攻撃
      const randomIndex = Math.floor(Math.random() * availableCells.length);
      attackTarget = availableCells[randomIndex];

      console.log(
        `[DEBUG - AI Attack Logic] AI (${currentPlayer.name}) が (${attackTarget.x}, ${attackTarget.y}) を攻撃します。`
      );

      let newCells = opponentBoard.cells.map((row) => [...row]);
      let newPlacedShips = opponentBoard.placedShips.map((s) => ({
        ...s,
        hits: [...s.hits],
      }));

      // 命中判定
      const hitShip = newPlacedShips.find((pShip) =>
        getCoordinatesAroundShip(
          pShip.start,
          pShip.definition.size,
          pShip.orientation
        ).some((c) => c.x === attackTarget.x && c.y === attackTarget.y)
      );

      if (hitShip) {
        console.log(
          `[DEBUG - AI Attack Logic] 攻撃が命中！船: ${hitShip.definition.name}`
        );
        newCells[attackTarget.y][attackTarget.x] = {
          ...newCells[attackTarget.y][attackTarget.x],
          hit: true,
          shipId: hitShip.id,
        };
        hitShip.hits.push(attackTarget);

        if (hitShip.hits.length === hitShip.definition.size) {
          hitShip.isSunk = true;
          console.log(
            `[DEBUG - AI Attack Logic] ${hitShip.definition.name} を撃沈しました！`
          );
        }
      } else {
        console.log(`[DEBUG - AI Attack Logic] 攻撃は外れました。`);
        newCells[attackTarget.y][attackTarget.x] = {
          ...newCells[attackTarget.y][attackTarget.x],
          missed: true,
        };
      }

      setGameState((prev) => {
        const updatedPlayerBoards = {
          ...prev.playerBoards,
          [opponentPlayer.id]: {
            ...prev.playerBoards[opponentPlayer.id],
            cells: newCells,
            placedShips: newPlacedShips,
          },
        };
        return { ...prev, playerBoards: updatedPlayerBoards };
      });

      const allOpponentShipsSunk = newPlacedShips.every((s) => s.isSunk);
      if (allOpponentShipsSunk) {
        console.log(
          `[DEBUG - AI Attack Logic] 全ての船を撃沈！プレイヤー ${currentPlayer.name} の勝利！`
        );
        advancePhase("game-over");
        return;
      }
    } else {
      // **** 修正箇所: 攻撃可能なマスがない場合でもターンを切り替える ****
      console.warn(
        `[DEBUG - AI Attack Logic] AI (${currentPlayer.name}) が攻撃可能なマスを見つけられませんでした。強制的にターンを切り替えます。`
      );
      // ゲームが続行できない場合はエラーハンドリング
    }

    // **** 修正箇所: 攻撃成功/失敗にかかわらず、ターン切り替えはここで行う ****
    setTimeout(() => {
      const nextPlayerId = opponentPlayer.id;
      console.log(
        `[DEBUG - AI Attack Logic] ターン終了。currentPlayerTurnId を ${currentPlayer.id} から ${nextPlayerId} に変更します。`
      );
      setGameState((prev) => ({ ...prev, currentPlayerTurnId: nextPlayerId }));
    }, 1000); // 1秒後にターンを切り替え
  }, [currentPlayer, opponentPlayer, playerBoards, setGameState, advancePhase]);

  return handleAiAttack;
};

export default useAiAttackLogic;
