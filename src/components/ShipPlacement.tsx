import React from 'react';
import { PlayerType, AIDifficulty } from '../App';

interface PlayerSettings {
  type: PlayerType;
  aiLevel?: AIDifficulty;
}

interface ShipPlacementProps {
  players: PlayerSettings[];
  currentPlayerIndex: number;
}

const ShipPlacement: React.FC<ShipPlacementProps> = ({ players, currentPlayerIndex }) => {
  const player = players[currentPlayerIndex];
  const playerLabel =
    player.type === 'human'
      ? `プレイヤー${currentPlayerIndex + 1} (あなた)`
      : `プレイヤー${currentPlayerIndex + 1} (AI)`;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center' }}>⚓ Battle Ship Game ⚓</h2>
      <h3 style={{ textAlign: 'center' }}>
        [{playerLabel}] の船を配置してください
      </h3>

      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '20px',
        }}
      >
        <table
          style={{
            borderCollapse: 'collapse',
            marginRight: '20px',
            textAlign: 'center',
          }}
        >
          <thead>
            <tr>
              <th></th>
              {Array.from({ length: 10 }, (_, i) => (
                <th key={i}>{String.fromCharCode(65 + i)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }, (_, row) => (
              <tr key={row}>
                <td>{row + 1}</td>
                {Array.from({ length: 10 }, (_, col) => (
                  <td
                    key={col}
                    style={{
                      width: '25px',
                      height: '25px',
                      border: '1px solid #333',
                      backgroundColor: '#eef',
                    }}
                  ></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <strong>残りの船:</strong>
        <ul>
          <li>空母 (5マス): [配置済み]</li>
          <li>戦艦 (4マス): [配置済み]</li>
          <li>巡洋艦 (3マス): [配置済み]</li>
          <li>潜水艦 (3マス): [配置済み]</li>
          <li>駆逐艦 (2マス): [配置済み]</li>
        </ul>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button disabled style={{ marginRight: '10px' }}>
          船を回転 (R)
        </button>
        <button disabled>ランダム配置</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
        <button>再配置</button>
        <button>ゲーム開始</button>
      </div>
    </div>
  );
};

export default ShipPlacement;
