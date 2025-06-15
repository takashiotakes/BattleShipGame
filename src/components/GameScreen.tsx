// src/components/GameScreen.tsx (修正)

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
  PlacedShip,
  ShipDefinition,
  ALL_SHIPS,
} from "../models/types"; // PlacedShip, ShipDefinition, ALL_SHIPS をインポート
import { useAiAttackLogic } from "../utils/useAiAttackLogic"; // 新しく作成したカスタムフックをインポート

const GameScreen: React.FC = () => {
  const { gameState, advanceTurn, handleAttack, setGameState } = useGame(); // setGameState も使用
  const { players, playerBoards, currentPlayerTurnId, phase } = gameState;

  // AI攻撃ロジックフック
  const { getAiAttackCoordinate } = useAiAttackLogic();

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
    // currentPlayerTurnId 以外の、最初の「none」ではないプレイヤーを見つける
    return players.find(
      (p) => p.id !== currentPlayerTurnId && p.type !== "none"
    );
  }, [players, currentPlayerTurnId]);

  const opponentBoard = useMemo(
    () => (opponentPlayer ? playerBoards[opponentPlayer.id] : null),
    [opponentPlayer, playerBoards]
  );

  // ★修正箇所★ myDisplayCells
  const myDisplayCells = useMemo(() => {
    // myBoard が存在しない場合は空のボードを返す
    if (!myBoard) return createEmptyBoard(-1).cells;

    // 自分のボードは船が見えるようにする
    return updateCellsWithShips(myBoard.cells, myBoard.placedShips, true);
  }, [myBoard]);

  // 相手のボード表示用（船は非表示）
  const opponentDisplayCells = useMemo(() => {
    if (!opponentBoard) return createEmptyBoard(-1).cells;
    // 相手のボードは船が見えないようにする
    return updateCellsWithShips(
      opponentBoard.cells,
      opponentBoard.placedShips,
      false
    );
  }, [opponentBoard]);

  const [message, setMessage] = useState<string>("");
  const [isAttackOngoing, setIsAttackOngoing] = useState<boolean>(false); // 攻撃処理中フラグ

  // 撃沈された船の情報を取得するヘルパー関数
  const getSunkShips = useCallback((board: PlayerBoard): PlacedShip[] => {
    return board.placedShips.filter((ship) => ship.isSunk);
  }, []);

  // まだ見つかっていない船の定義を取得するヘルパー関数
  const getRemainingShipDefinitions = useCallback(
    (board: PlayerBoard): ShipDefinition[] => {
      const sunkShipIds = board.placedShips
        .filter((ship) => ship.isSunk)
        .map((ship) => ship.id);
      return ALL_SHIPS.filter((shipDef) => !sunkShipIds.includes(shipDef.id));
    },
    []
  );

  // AIの攻撃ロジック
  const handleAiAttack = useCallback(async () => {
    if (
      !opponentPlayer ||
      !opponentBoard ||
      !currentPlayer ||
      isAttackOngoing
    ) {
      return;
    }

    setIsAttackOngoing(true);
    setMessage(`${currentPlayer.name} が攻撃中...`);

    // AIの思考時間（ユーザーに見せるためのディレイ）
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 最新のボード状態を取得するために gameStateRef を参照
    const currentOpponentBoard =
      gameStateRef.current.playerBoards[opponentPlayer.id];

    // 撃沈された船とまだ見つかっていない船の定義を渡す
    const sunkShips = getSunkShips(currentOpponentBoard);
    const remainingShipDefinitions =
      getRemainingShipDefinitions(currentOpponentBoard);

    // AIの難易度に応じた攻撃座標の取得
    const attackCoord = getAiAttackCoordinate(
      currentPlayer.difficulty || "easy", // difficultyがない場合はeasyをデフォルトに
      currentOpponentBoard,
      sunkShips,
      remainingShipDefinitions
    );

    const result = handleAttack(
      currentPlayer.id,
      opponentPlayer.id,
      attackCoord
    );

    if (result.hit) {
      setMessage(
        `攻撃成功！ ${String.fromCharCode(65 + attackCoord.x)}${
          attackCoord.y + 1
        } にヒット！`
      );
      if (result.sunkShipId) {
        const sunkShipName = ALL_SHIPS.find(
          (s) => s.id === result.sunkShipId
        )?.name;
        setMessage((prev) => `${prev} そして相手の${sunkShipName}を撃沈！`);
      }
    } else {
      setMessage(
        `攻撃失敗... ${String.fromCharCode(65 + attackCoord.x)}${
          attackCoord.y + 1
        } はミス！`
      );
    }

    // 勝敗判定
    const updatedGameState = gameStateRef.current; // 最新の gameState を取得し直す
    const targetBoardAfterAttack =
      updatedGameState.playerBoards[opponentPlayer.id];
    const allOpponentShipsSunk = targetBoardAfterAttack.placedShips.every(
      (ship) => ship.isSunk
    );

    if (allOpponentShipsSunk) {
      setGameState((prev) => ({
        ...prev,
        phase: "game-over",
        winnerId: currentPlayer.id,
      }));
      setMessage(`${currentPlayer.name} の勝利です！`);
    } else {
      // 攻撃がヒットした場合は、AIは続けて攻撃できる（Normal/Hardモードのみ。今回は実装しないが拡張の余地）
      // if (result.hit && (currentPlayer.difficulty === 'normal' || currentPlayer.difficulty === 'hard')) {
      //   // AIが連続攻撃する場合、再度handleAiAttackを呼び出す
      //   // ただし無限ループにならないように注意深く設計する必要がある
      //   // 今回はシンプルにターンを渡す
      //   advanceTurn();
      // } else {
      //   advanceTurn();
      // }
      advanceTurn(); // ヒットしてもミスしても次のターンへ
    }
    setIsAttackOngoing(false);
  }, [
    currentPlayer,
    opponentPlayer,
    opponentBoard,
    handleAttack,
    advanceTurn,
    setGameState,
    getAiAttackCoordinate,
    isAttackOngoing,
    getSunkShips,
    getRemainingShipDefinitions,
  ]);

  // プレイヤーが人間の場合の攻撃処理
  const handleHumanAttack = useCallback(
    (coord: Coordinate) => {
      if (!opponentPlayer || !opponentBoard || isAttackOngoing) {
        return;
      }

      setIsAttackOngoing(true);
      setMessage(""); // メッセージをクリア

      // 既に攻撃済みのマスは選択できないようにする
      const cellStatus = opponentBoard.cells[coord.y][coord.x].status;
      if (
        cellStatus === "hit" ||
        cellStatus === "miss" ||
        cellStatus === "sunk"
      ) {
        setMessage("そのマスは既に攻撃済みです！");
        setIsAttackOngoing(false);
        return;
      }

      const result = handleAttack(
        currentPlayerTurnId,
        opponentPlayer.id,
        coord
      );

      if (result.hit) {
        setMessage(
          `攻撃成功！ ${String.fromCharCode(65 + coord.x)}${
            coord.y + 1
          } にヒット！`
        );
        if (result.sunkShipId) {
          const sunkShipName = ALL_SHIPS.find(
            (s) => s.id === result.sunkShipId
          )?.name;
          setMessage((prev) => `${prev} そして相手の${sunkShipName}を撃沈！`);
        }
      } else {
        setMessage(
          `攻撃失敗... ${String.fromCharCode(65 + coord.x)}${
            coord.y + 1
          } はミス！`
        );
      }

      // 勝敗判定
      const updatedGameState = gameStateRef.current; // 最新の gameState を取得し直す
      const targetBoardAfterAttack =
        updatedGameState.playerBoards[opponentPlayer.id];
      const allOpponentShipsSunk = targetBoardAfterAttack.placedShips.every(
        (ship) => ship.isSunk
      );

      if (allOpponentShipsSunk) {
        setGameState((prev) => ({
          ...prev,
          phase: "game-over",
          winnerId: currentPlayerTurnId,
        }));
        setMessage("あなたの勝利です！");
      } else {
        advanceTurn(); // 次のターンへ
      }
      setIsAttackOngoing(false);
    },
    [
      currentPlayerTurnId,
      opponentPlayer,
      opponentBoard,
      handleAttack,
      advanceTurn,
      setGameState,
      isAttackOngoing,
    ]
  );

  useEffect(() => {
    // AIのターンになったら自動で攻撃を実行
    if (
      currentPlayer &&
      currentPlayer.type === "ai" &&
      phase === "in-game" &&
      !isAttackOngoing
    ) {
      // 処理を遅延させて、AIが考えているように見せる
      const timer = setTimeout(() => {
        handleAiAttack();
      }, 1500); // 1.5秒のディレイ

      return () => clearTimeout(timer);
    }
  }, [currentPlayer, phase, handleAiAttack, isAttackOngoing]); // 依存配列に isAttackOngoing を含める

  // ★重要★ ロード中の表示やデータの存在チェックを強化
  // これらのデータが全て揃ってからレンダリングを開始する
  if (!myBoard || !opponentBoard || !currentPlayer || phase !== "in-game") {
    // 進行中のフェーズでない場合もここで待機
    console.log(
      "GameScreen: Waiting for all data to be ready or phase to be in-game.",
      { myBoard, opponentBoard, currentPlayer, phase }
    );
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
          {/* AIが攻撃中の場合、人間のクリックを無効化 */}
          <BoardGrid
            cells={opponentDisplayCells}
            isPlayerBoard={false}
            onCellClick={
              currentPlayer.type === "human" ? handleHumanAttack : undefined
            }
            disableClick={currentPlayer.type !== "human" || isAttackOngoing} // AIのターン中または攻撃処理中はクリック無効
          />
        </div>
      </div>
    </div>
  );
};

export default GameScreen;
