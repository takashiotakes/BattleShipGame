// src/components/GameScreen.tsx

import React, {
  useMemo,
  useCallback,
  useEffect,
  useState,
  useRef,
} from "react";
import { useGame } from "../contexts/GameContext";
import BoardGrid from "./BoardGrid";
import { updateCellsWithShips, createEmptyBoard } from "../lib/boardUtils";
import {
  PlayerBoard,
  AttackResult,
  Coordinate,
  PlayerSettings,
  ALL_SHIPS,
} from "../models/types";
import { useAiAttackLogic } from "../utils/useAiAttackLogic";

const GameScreen: React.FC = () => {
  const { gameState, advanceTurn, handleAttack } = useGame(); // setGameState はここで直接使用しない
  const { players, playerBoards, currentPlayerTurnId, phase, winnerId } =
    gameState;

  // 最新の gameState を useRef で保持する (非同期処理内で最新の状態を参照するため)
  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const currentPlayer = useMemo(
    () => players.find((p) => p.id === currentPlayerTurnId),
    [players, currentPlayerTurnId]
  );
  const myBoard = useMemo(
    () => playerBoards[currentPlayerTurnId],
    [playerBoards, currentPlayerTurnId]
  );
  const opponentPlayer = useMemo(() => {
    return players.find(
      (p) => p.id !== currentPlayerTurnId && p.type !== "none"
    );
  }, [players, currentPlayerTurnId]);
  const opponentBoard = useMemo(
    () => (opponentPlayer ? playerBoards[opponentPlayer.id] : null),
    [opponentPlayer, playerBoards]
  );

  const [message, setMessage] = useState<string>("");
  const [isAttackOngoing, setIsAttackOngoing] = useState<boolean>(false); // 攻撃アニメーション中かどうか

  const { getAiAttackCoordinate } = useAiAttackLogic();

  const myDisplayCells = useMemo(() => {
    if (!myBoard) return createEmptyBoard(currentPlayerTurnId).cells;
    return updateCellsWithShips(myBoard.cells, myBoard.placedShips);
  }, [myBoard, currentPlayerTurnId]);

  const opponentDisplayCells = useMemo(() => {
    if (!opponentBoard) return createEmptyBoard(opponentPlayer?.id || 0).cells;
    const cells = opponentBoard.cells.map((row) =>
      row.map((cell) => {
        // 相手のボードでは船のマスは「empty」として扱う（見えないため）。
        // 'empty', 'hit', 'miss', 'sunk' はそのまま表示。
        if (cell.status === "ship") {
          return { ...cell, status: "empty" }; // 船のマスのみ 'empty' に設定して隠す
        }
        return cell;
      })
    );
    // 撃沈された船は表示する
    return updateCellsWithShips(
      cells,
      opponentBoard.placedShips.filter((ship) => ship.isSunk)
    );
  }, [opponentBoard, opponentPlayer?.id]);

  const handleCellClick = useCallback(
    (coord: Coordinate) => {
      // ゲーム終了済み、AIのターン、または攻撃アニメーション中の場合はクリックを無効化
      if (
        winnerId !== null ||
        currentPlayer?.type === "ai" ||
        isAttackOngoing
      ) {
        return;
      }

      if (currentPlayer?.type === "human" && opponentPlayer) {
        setIsAttackOngoing(true); // 攻撃開始
        setMessage(
          `攻撃中... ${String.fromCharCode(65 + coord.x)}${coord.y + 1} へ！`
        );

        setTimeout(() => {
          const result = handleAttack(
            currentPlayer.id,
            opponentPlayer.id,
            coord
          );
          if (result.hit) {
            setMessage(
              `ヒット！ ${
                result.sunkShipId
                  ? ALL_SHIPS.find((s) => s.id === result.sunkShipId)?.name +
                    " を撃沈！"
                  : ""
              }`
            );
          } else {
            setMessage("ミス！");
          }

          setTimeout(() => {
            // メッセージ表示後に少し間をおいてターンを渡す
            setIsAttackOngoing(false); // 攻撃終了フラグをリセット
            // 勝者がまだ決まっていなければターンを進める
            // handleAttackの内部でwinnerIdが設定されるため、gameStateRef.currentで最新の状態を確認
            if (gameStateRef.current.winnerId === null) {
              advanceTurn();
            }
          }, 1000); // 1秒遅延
        }, 500); // 攻撃アニメーションの待機時間
      }
    },
    [
      currentPlayer,
      opponentPlayer,
      handleAttack,
      isAttackOngoing,
      winnerId,
      advanceTurn,
    ]
  );

  // AIの攻撃ターン処理
  useEffect(() => {
    const handleAiTurn = async () => {
      // ゲームが進行中でない、または勝者が決定済み、または攻撃中の場合は何もしない
      if (phase !== "in-game" || winnerId !== null || isAttackOngoing) {
        return;
      }
      // 現在のプレイヤーがAIでなければ何もしない
      if (currentPlayer?.type !== "ai") {
        return;
      }

      setIsAttackOngoing(true); // AI攻撃開始フラグを立てる

      setMessage(`AI (${currentPlayer.name}) のターンです...`);
      await new Promise((resolve) => setTimeout(resolve, 1500)); // AI思考時間

      const currentOpponentBoard =
        gameStateRef.current.playerBoards[opponentPlayer!.id]; // ! で undefined でないことを保証
      const currentAttackerBoard =
        gameStateRef.current.playerBoards[currentPlayer!.id];

      const sunkShips = currentOpponentBoard.placedShips.filter(
        (ship) => ship.isSunk
      );
      const remainingShipDefinitions = ALL_SHIPS.filter(
        (shipDef) =>
          !sunkShips.some((sunkShip) => sunkShip.definition.id === shipDef.id)
      );

      const attackCoord = getAiAttackCoordinate(
        currentPlayer!.difficulty || "easy",
        currentOpponentBoard,
        sunkShips,
        remainingShipDefinitions
      );

      setMessage(
        `AI (${currentPlayer.name}) が ${String.fromCharCode(
          65 + attackCoord.x
        )}${attackCoord.y + 1} へ攻撃！`
      );
      await new Promise((resolve) => setTimeout(resolve, 1000)); // 攻撃アニメーションの待機

      const result = handleAttack(
        currentPlayer!.id,
        opponentPlayer!.id,
        attackCoord
      );

      if (result.hit) {
        setMessage(
          `AI (${currentPlayer.name}) がヒット！ ${
            result.sunkShipId
              ? ALL_SHIPS.find((s) => s.id === result.sunkShipId)?.name +
                " を撃沈！"
              : ""
          }`
        );
      } else {
        setMessage(`AI (${currentPlayer.name}) がミス！`);
      }

      await new Promise((resolve) => setTimeout(resolve, 1000)); // 結果表示のための待機

      setIsAttackOngoing(false); // AI攻撃終了
      // AI攻撃が完了し、勝者がまだ決まっていない場合のみターンを進める
      if (gameStateRef.current.winnerId === null) {
        advanceTurn(); // ターンを進める
      }
    };

    // AIのターンになったら、AIの攻撃処理を開始
    // isAttackOngoing が false の場合のみ実行し、連続攻撃を防ぐ
    if (
      phase === "in-game" &&
      currentPlayer?.type === "ai" &&
      !isAttackOngoing
    ) {
      handleAiTurn();
    }
  }, [
    currentPlayer,
    opponentPlayer,
    handleAttack,
    phase,
    isAttackOngoing,
    getAiAttackCoordinate,
    winnerId,
    advanceTurn,
  ]);

  if (!myBoard || !opponentBoard || !currentPlayer || phase !== "in-game") {
    return <div>ゲームボードを準備中...</div>;
  }

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <h3 style={{ textAlign: "center" }}>
        現在のターン: {currentPlayer?.name}
      </h3>

      {message && (
        <p style={{ color: "yellow", fontWeight: "bold" }}>{message}</p>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          width: "100%",
          gap: "20px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <h4>
            あなたのボード (
            {myBoard.playerId === currentPlayerTurnId ? "ターン" : "待機中"})
          </h4>
          <BoardGrid cells={myDisplayCells} isPlayerBoard={true} />
        </div>

        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <h4>
            {opponentPlayer?.name} のボード (
            {opponentPlayer?.id === currentPlayerTurnId ? "ターン" : "待機中"})
          </h4>
          <BoardGrid
            cells={opponentDisplayCells}
            isPlayerBoard={false}
            onCellClick={handleCellClick}
            disableClick={
              currentPlayer?.type === "ai" ||
              isAttackOngoing ||
              winnerId !== null
            } // AIのターン中、攻撃中、またはゲーム終了時はクリック無効
          />
        </div>
      </div>
    </div>
  );
};

export default GameScreen;
