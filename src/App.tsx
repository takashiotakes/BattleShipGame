// src/App.tsx

import React from "react";
import PlayerSelector from "./components/PlayerSelector";
import ShipPlacement from "./components/ShipPlacement";
import GameScreen from "./components/GameScreen";
import { GameProvider, useGame } from "./contexts/GameContext";
import GameOverScreen from "./components/GameOverScreen"; // GameOverScreen をインポート

const AppContent: React.FC = () => {
  const { gameState, setGameState } = useGame(); // advancePhase は App.tsx では直接呼ばない

  const handleStartPlacement = () => {
    setGameState((prev) => {
      // プレイヤー選択が完了したら、船配置フェーズへ移行
      // ここで最初の有効なプレイヤーのIDを currentPlayerTurnId に設定する
      const firstActivePlayer = prev.players.find((p) => p.type !== "none");
      if (firstActivePlayer) {
        return {
          ...prev,
          phase: "ship-placement",
          currentPlayerTurnId: firstActivePlayer.id,
        };
      } else {
        console.error(
          "有効なプレイヤーがいません。船配置フェーズを開始できません。"
        );
        return prev;
      }
    });
  };

  return (
    <div
      style={{ padding: "20px", fontFamily: "sans-serif", textAlign: "center" }}
    >
      <h1>⚓ Battle Ship Game ⚓</h1>
      {gameState.phase === "select-players" && (
        <PlayerSelector onNext={handleStartPlacement} />
      )}
      {gameState.phase === "ship-placement" && <ShipPlacement />}
      {gameState.phase === "in-game" && <GameScreen />}
      {gameState.phase === "game-over" && <GameOverScreen />}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <GameProvider>
      <AppContent />
    </GameProvider>
  );
};

export default App;
