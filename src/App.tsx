import React from 'react';
import { GameProvider, useGame } from './contexts/GameContext';
import PlayerSelector from './components/PlayerSelector';
import ShipPlacement from './components/ShipPlacement';
import GameScreen from './components/GameScreen'; // 新しくインポート

const AppContent: React.FC = () => {
  const { gameState, updatePlayers, advancePhase } = useGame();

  const handleStartPlacement = () => {
    advancePhase('ship-placement'); // フェーズを進める
  };

  const handlePlayersChange = (newPlayers: PlayerSettings[]) => {
    updatePlayers(newPlayers);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>⚓ Battle Ship Game ⚓</h1>
      {gameState.phase === 'select-players' ? (
        <PlayerSelector
          players={gameState.players}
          onPlayersChange={handlePlayersChange}
          onNext={handleStartPlacement}
        />
      ) : gameState.phase === 'ship-placement' ? (
        <ShipPlacement />
      ) : gameState.phase === 'in-game' ? ( // 新しいフェーズの条件
        <GameScreen />
      ) : (
        // 他のフェーズ（game-over）の表示は今後追加
        <div>ゲーム進行中... (またはゲームオーバー)</div>
      )}
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