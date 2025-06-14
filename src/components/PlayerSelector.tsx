import React from 'react';
import { PlayerType, AIDifficulty, PlayerSettings } from '../models/types';

interface PlayerSelectorProps {
  players: PlayerSettings[];
  onPlayersChange: (players: PlayerSettings[]) => void;
  onNext: () => void;
}

const PlayerSelector: React.FC<PlayerSelectorProps> = ({
  players,
  onPlayersChange,
  onNext,
}) => {
  const handlePlayerTypeChange = (index: number, type: PlayerType) => {
    const updatedPlayers = [...players];
    updatedPlayers[index].type = type;

    // AIレベルが必要な場合は初期化、不要な場合は削除
    if (type === 'ai' && !updatedPlayers[index].difficulty) {
      updatedPlayers[index].difficulty = 'easy';
    } else if (type !== 'ai') {
      delete updatedPlayers[index].difficulty;
    }
    // "なし"が選択された場合、後続のプレイヤーを"なし"にする
    if (type === 'none') {
        for (let i = index + 1; i < updatedPlayers.length; i++) {
            updatedPlayers[i].type = 'none';
            delete updatedPlayers[i].difficulty;
        }
    }
    // "なし"以外が選択された場合、後続のプレイヤーはそのまま維持
    // ただし、AI->人間など、AIから人間に変わった場合はAI難易度を削除する
    if (type !== 'ai' && updatedPlayers[index].difficulty) {
      delete updatedPlayers[index].difficulty;
    }

    onPlayersChange(updatedPlayers);
  };

  const handleAILevelChange = (index: number, level: AIDifficulty) => {
    const updatedPlayers = [...players];
    if (updatedPlayers[index].type === 'ai') {
      updatedPlayers[index].difficulty = level;
      onPlayersChange(updatedPlayers);
    }
  };

  // AIプレイヤーが1人でもいるかを確認
  const hasAIPlayer = players.some(p => p.type === 'ai');

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto' }}>
      {players.map((player, index) => (
        <div key={player.id} style={{ marginBottom: '10px' }}>
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
          </label>
        </div>
      ))}

      {/* AIプレイヤーが存在する場合のみ難易度設定を表示 */}
      {hasAIPlayer && (
        <div style={{ margin: '20px 0' }}>
          <label>
            AI難易度設定:
            {/* 複数のAIプレイヤーがいる場合でも、ここでは代表して最初のAIの難易度を表示・変更する。
                あるいは、AIごとに難易度設定を表示するUIに変更することも検討できる。
                今回はシンプルに、最初のAIの難易度を設定対象とする。*/}
            <select
              value={players.find(p => p.type === 'ai')?.difficulty || 'easy'}
              onChange={(e) =>
                handleAILevelChange(
                  players.findIndex(p => p.type === 'ai'), // 最初のAIプレイヤーのインデックス
                  e.target.value as AIDifficulty
                )
              }
              style={{ marginLeft: '10px' }}
            >
              <option value="easy">Easy</option>
              <option value="normal">Normal</option>
              <option value="hard">Hard</option>
            </select>
          </label>
        </div>
      )}

      <button onClick={onNext} style={{ padding: '10px 20px', fontSize: '16px' }}>
        配置設定
      </button>
    </div>
  );
};

export default PlayerSelector;