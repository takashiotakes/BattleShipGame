// src/components/GameOverScreen.tsx

import React, { useMemo } from 'react';
import { useGame } from '../contexts/GameContext';

const GameOverScreen: React.FC = () => {
  const { gameState, resetGame } = useGame();
  const { winnerId, players } = gameState;

  const winnerPlayer = useMemo(() => players.find(p => p.id === winnerId), [players, winnerId]);

  return (
    <div style={{ maxWidth: '600px', margin: '50px auto', textAlign: 'center', backgroundColor: '#333', padding: '30px', borderRadius: '10px', boxShadow: '0 0 15px rgba(0,0,0,0.5)' }}>
      {/* 以下の行を削除またはコメントアウト */}
      {/* <h2 style={{ color: '#fff', fontSize: '2.5rem', marginBottom: '20px' }}>ゲームオーバー！</h2> */}
      <h3 style={{ color: '#fff', fontSize: '2.5rem', marginBottom: '20px' }}>ゲームオーバー！</h3> {/* この行は残す */}
      {winnerPlayer ? (
        <h3 style={{ color: '#0f0', fontSize: '1.8rem', marginBottom: '30px' }}>
          🏆 {winnerPlayer.name} の勝利です！ 🏆
        </h3>
      ) : (
        <h3 style={{ color: '#ff0', fontSize: '1.8rem', marginBottom: '30px' }}>
          引き分け（またはエラー）
        </h3>
      )}

      <button
        onClick={resetGame}
        style={{
          padding: '15px 30px',
          fontSize: '1.2rem',
          backgroundColor: '#007bff',
          color: '#fff',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer',
          transition: 'background-color 0.3s ease',
        }}
      >
        もう一度プレイ
      </button>
    </div>
  );
};

export default GameOverScreen;