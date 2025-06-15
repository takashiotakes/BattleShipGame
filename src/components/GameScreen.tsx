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
} from "../models/types"; // PlayerSettings をインポート

const GameScreen: React.FC = () => {
  const { gameState, advanceTurn, handleAttack, setGameState } = useGame(); // setGameState も使用
  const { players, playerBoards, currentPlayerTurnId, phase } = gameState;

  // 最新の gameState を useRef で保持する (非同期処理内で最新の状態を参照するため)
  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const [message, setMessage] = useState<string>("");
  const [isAttackOngoing, setIsAttackOngoing] = useState<boolean>(false); // 攻撃中のフラグ

  const currentPlayer = useMemo(
    () => players.find((p) => p.id === currentPlayerTurnId),
    [players, currentPlayerTurnId]
  );

  const myBoard = useMemo(
    () => playerBoards[currentPlayerTurnId],
    [playerBoards, currentPlayerTurnId]
  );

  // ★修正箇所★ opponentPlayers
  const opponentPlayers = useMemo(() => {
    // currentPlayerTurnId 以外の、タイプが'none'ではないすべてのプレイヤーを見つける
    return players.filter(
      (p) => p.id !== currentPlayerTurnId && p.type !== "none"
    );
  }, [players, currentPlayerTurnId]);

  // ★修正箇所★ myDisplayCells
  const myDisplayCells = useMemo(() => {
    // myBoard が存在しない場合は空の配列を返す
    if (!myBoard) return [];
    // 自分のボードは船が見える状態
    return updateCellsWithShips(myBoard.cells, myBoard.placedShips, true);
  }, [myBoard]);

  // 攻撃処理のコールバック関数
  const handlePlayerAttack = useCallback(
    async (targetPlayerId: number, coord: Coordinate) => {
      if (isAttackOngoing) {
        console.log("Attack is already ongoing, please wait.");
        return;
      }

      setIsAttackOngoing(true);
      setMessage(""); // メッセージをクリア

      // 最新の gameState を参照
      const currentGameState = gameStateRef.current;
      const attacker = currentGameState.players.find(
        (p) => p.id === currentGameState.currentPlayerTurnId
      );
      const defenderBoard = currentGameState.playerBoards[targetPlayerId];

      if (!attacker || !defenderBoard) {
        console.error("Attacker or defender board not found.");
        setIsAttackOngoing(false);
        return;
      }

      if (
        attacker.type === "human" &&
        defenderBoard.cells[coord.y][coord.x].status !== "empty" &&
        defenderBoard.cells[coord.y][coord.x].status !== "ship"
      ) {
        setMessage("そこはすでに攻撃済みのマスです！");
        setIsAttackOngoing(false);
        return;
      }

      const attackResult = handleAttack(attacker.id, targetPlayerId, coord);

      // メッセージ設定
      if (attackResult.hit) {
        setMessage(
          `ヒット！ ${
            attackResult.sunkShipId
              ? `船を撃沈！ (${attackResult.sunkShipId})`
              : ""
          }`
        );
      } else {
        setMessage("ミス！");
      }

      // AIのターンは少し待つ
      const AI_TURN_DELAY = 1000; // 1秒
      if (attacker.type === "ai") {
        await new Promise((resolve) => setTimeout(resolve, AI_TURN_DELAY));
      }

      // 勝敗判定
      // 攻撃されたプレイヤーのボードのplacedShipsを最新のgameStateから取得
      const updatedDefenderBoard =
        gameStateRef.current.playerBoards[targetPlayerId];
      const allShipsSunk = updatedDefenderBoard.placedShips.every(
        (ship) => ship.isSunk
      );

      if (allShipsSunk) {
        setGameState((prevState) => ({
          ...prevState,
          winnerId: attacker.id,
          phase: "game-over",
        }));
        setMessage(`${attacker.name} の勝利！`);
      } else {
        advanceTurn(); // 勝敗が決まっていない場合は次のターンへ
      }
      setIsAttackOngoing(false); // 攻撃終了
    },
    [handleAttack, advanceTurn, setGameState, isAttackOngoing]
  ); // 依存配列に isAttackOngoing を含める

  // AIの攻撃ロジック
  useEffect(() => {
    // ゲームが進行中で、現在のプレイヤーがAIで、かつ攻撃が進行中でない場合
    if (
      phase === "in-game" &&
      currentPlayer?.type === "ai" &&
      !isAttackOngoing
    ) {
      const aiAttack = async () => {
        setIsAttackOngoing(true); // AI攻撃開始フラグを立てる
        setMessage(`AI (${currentPlayer.name}) が攻撃中...`);

        // 攻撃対象プレイヤーの決定 (自分以外の'none'ではない最初のプレイヤー)
        const targetPlayer = players.find(
          (p) => p.id !== currentPlayer.id && p.type !== "none"
        );
        if (!targetPlayer) {
          console.error("No valid target player for AI attack.");
          setIsAttackOngoing(false);
          return;
        }

        const targetBoard = gameStateRef.current.playerBoards[targetPlayer.id];
        if (!targetBoard) {
          console.error("AI target board not found.");
          setIsAttackOngoing(false);
          return;
        }

        let attackedCoord: Coordinate | null = null;
        let attempts = 0;
        const maxAttempts = 100;

        // Simple AI: ランダムに未攻撃のマスを選ぶ
        while (attempts < maxAttempts) {
          const row = Math.floor(Math.random() * 10);
          const col = Math.floor(Math.random() * 10);
          const coord: Coordinate = { x: col, y: row }; // x,y に合わせる

          // 既に攻撃済みのマスではないかチェック
          // attackedCells のキーは "x,y" 形式で保存されていると仮定
          if (!targetBoard.attackedCells[`${coord.x},${coord.y}`]) {
            attackedCoord = coord;
            break;
          }
          attempts++;
        }

        if (attackedCoord) {
          // AIの攻撃は少しディレイを入れる
          await new Promise((resolve) => setTimeout(resolve, 1000)); // 1秒待機
          handlePlayerAttack(targetPlayer.id, attackedCoord);
        } else {
          console.error("AI could not find a valid cell to attack.");
          setIsAttackOngoing(false);
        }
      };
      aiAttack();
    }
  }, [phase, currentPlayer, players, handlePlayerAttack, isAttackOngoing]); // 依存配列に isAttackOngoing を含める

  // ★重要★ ロード中の表示やデータの存在チェックを強化
  // これらのデータが全て揃ってからレンダリングを開始する
  if (!myBoard || !currentPlayer || phase !== "in-game") {
    // 進行中のフェーズでない場合もここで待機
    console.log(
      "GameScreen: Waiting for all data to be ready or phase to be in-game.",
      { myBoard, currentPlayer, phase }
    );
    return <div>ゲームボードを準備中...</div>;
  }

  return (
    <div
      style={{
        maxWidth: "1200px",
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
        {/* 自分のボード */}
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <h4>
            あなたのボード (
            {myBoard.playerId === currentPlayerTurnId ? "ターン" : "待機中"})
          </h4>
          <BoardGrid cells={myDisplayCells} isPlayerBoard={true} />
        </div>

        {/* 相手のボード群 */}
        {opponentPlayers.map((opponentPlayer) => {
          const opponentBoard = playerBoards[opponentPlayer.id];
          if (!opponentBoard) return null; // ボードが存在しない場合はスキップ

          const opponentDisplayCells = updateCellsWithShips(
            opponentBoard.cells,
            opponentBoard.placedShips,
            false // 相手のボードなので船は非表示
          );

          return (
            <div
              key={opponentPlayer.id}
              style={{ textAlign: "center", marginBottom: "20px" }}
            >
              <h4>
                {opponentPlayer.name} のボード (
                {opponentPlayer.id === currentPlayerTurnId
                  ? "ターン"
                  : "待機中"}
                )
              </h4>
              <BoardGrid
                cells={opponentDisplayCells}
                isPlayerBoard={false}
                onCellClick={
                  currentPlayer.type === "human" && !isAttackOngoing
                    ? handlePlayerAttack.bind(null, opponentPlayer.id)
                    : undefined
                }
                disableClick={currentPlayer.type !== "human" || isAttackOngoing} // 人間プレイヤーのターンでない、または攻撃中はクリック不可
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GameScreen;
