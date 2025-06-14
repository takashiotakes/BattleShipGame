// src/components/PlayerSelector.tsx

import React from 'react';
import { useGame } from '../contexts/GameContext'; // useGame をインポート
import { PlayerType, AIDifficulty, PlayerSettings } from '../models/types'; // PlayerType, AIDifficulty, PlayerSettings をインポート

interface PlayerSelectorProps {
  onNext: () => void;
}

const PlayerSelector: React.FC<PlayerSelectorProps> = ({
  onNext,
}) => {
  const { gameState, updatePlayers } = useGame(); // GameContext から gameState と updatePlayers を取得
  const { players } = gameState;

  const handlePlayerTypeChange = (index: number, type: PlayerType) => {
    const updatedPlayers = [...players];
    updatedPlayers[index].type = type;

    // AIレベルが必要な場合は初期化、不要な場合は削除
    if (type === 'ai' && !updatedPlayers[index].difficulty) { // aiLevel -> difficulty
      updatedPlayers[index].difficulty = 'easy'; // Easy -> easy
    } else if (type !== 'ai') {
      // AIでなくなった場合、difficultyを削除
      const { difficulty, ...rest } = updatedPlayers[index];
      updatedPlayers[index] = rest;
    }

    updatePlayers(updatedPlayers); // Context の updatePlayers を直接呼び出す
  };

  const handleAILevelChange = (index: number, level: AIDifficulty) => {
    const updatedPlayers = [...players];
    if (updatedPlayers[index].type === 'ai') {
      updatedPlayers[index].difficulty = level; // aiLevel -> difficulty
      updatePlayers(updatedPlayers); // Context の updatePlayers を直接呼び出す
    }
  };

  // AIプレイヤーは複数いる可能性があるので、各AIプレイヤーの難易度を設定できるようにする
  // 今回のUIでは最初のAIプレイヤーのみ難易度設定可としていたので、そのロジックを維持
  const firstActiveAIPlayer = players.find(p => p.type === 'ai');


  return (
    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
      {players.map((player, index) => (
        <div key={player.id} style={{ marginBottom: '10px' }}> {/* key を player.id に変更 */}
          <label>
            プレイヤー{index + 1}:
            <select
              value={player.type}
              onChange={(e) =>
                handlePlayerTypeChange(index, e.target.value as PlayerType)
              }
              style={{ marginLeft: '10px' }}
            >
              <option value="human">人間</option>
              <option value="ai">AI</option>
              <option value="none">なし</option>
            </select>
            {player.type === 'ai' && ( // AIの場合のみ難易度選択を表示
              <select
                value={player.difficulty || 'easy'} // デフォルト値 'easy'
                onChange={(e) => handleAILevelChange(index, e.target.value as AIDifficulty)}
                style={{ marginLeft: '10px' }}
              >
                <option value="easy">Easy</option>
                <option value="normal">Normal</option>
                <option value="hard">Hard</option>
              </select>
            )}
          </label>
        </div>
      ))}

      {/* 複数のAIがいる場合、各AIの難易度を個別に設定できるように UI を変更 */}
      {/* 以前のコードでは最初のAIプレイヤーの難易度のみ設定可能だったが、
          ここでは各プレイヤーのセレクトボックスの隣に配置する形に変更 */}

      <button onClick={onNext} style={{ padding: '10px 20px', fontSize: '16px' }}>
        船の配置へ進む
      </button>
    </div>
  );
};

export default PlayerSelector;