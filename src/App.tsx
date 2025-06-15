// src/App.tsx

import React, { useEffect } from 'react';
import PlayerSelector from './components/PlayerSelector';
import ShipPlacement from './components/ShipPlacement';
import GameScreen from './components/GameScreen';
import { GameProvider, useGame } from './contexts/GameContext'; // GameProvider と useGame をインポート

const AppContent: React.FC = () => {
  const { gameState, advancePhase, updatePlayers } = useGame();

  // 初期化時にプレイヤー設定を Context に渡す (初回のみ)
  useEffect(() => {
    // players が初期状態（デフォルトの4つの空オブジェクトなど）の場合にのみ更新
    if (gameState.players.length === 4 && gameState.players[0].name === undefined) {
      updatePlayers([
        { id: 0, name: 'プレイヤー1 (あなた)', type: 'human' },
        { id: 1, name: 'プレイヤー2 (AI)', type: 'ai', difficulty: 'easy' },
        { id: 2, name: 'プレイヤー3 (なし)', type: 'none' },
        { id: 3, name: 'プレイヤー4 (なし)', type: 'none' },
      ]);
    }
  }, [gameState.players, updatePlayers]);


  const handleStartPlacement = () => {
    // プレイヤー選択が完了したら、船配置フェーズへ移行
    advancePhase('ship-placement');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <h1>⚓ Battle Ship Game ⚓</h1>
      {gameState.phase === 'select-players' && (
        <PlayerSelector
          onNext={handleStartPlacement}
        />
      )}
      {gameState.phase === 'ship-placement' && (
        <ShipPlacement />
      )}
      {gameState.phase === 'in-game' && (
        <GameScreen />
      )}
      {gameState.phase === 'game-over' && (
        <div>
          <h2>ゲーム終了！</h2>
          {gameState.winnerId !== null ? (
            <p>{gameState.players.find(p => p.id === gameState.winnerId)?.name} の勝利！</p>
          ) : (
            <p>引き分け！</p>
          )}
          <button onClick={() => window.location.reload()}>もう一度プレイ</button> {/* 簡易リセット */}
        </div>
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