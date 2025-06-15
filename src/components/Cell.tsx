// src/components/Cell.tsx

import React from 'react';
import { Cell as CellType } from '../models/types';

interface CellProps {
  cell: CellType;
  onClick?: (x: number, y: number) => void;
  onHover?: (x: number, y: number) => void;
  onLeave?: () => void;
  isPlayerBoard?: boolean; // 自分のボードか敵のボードか
  isPreview?: boolean; // 船配置時のプレビュー用
  disableInteraction?: boolean; // クリックやホバーを無効にする
}

const Cell: React.FC<CellProps> = ({ cell, onClick, onHover, onLeave, isPlayerBoard, isPreview, disableInteraction = false }) => {
  const handleClick = () => {
    if (onClick && !disableInteraction) onClick(cell.x, cell.y);
  };

  const handleHover = () => {
    if (onHover && !disableInteraction) onHover(cell.x, cell.y);
  };

  const handleLeave = () => {
    if (onLeave && !disableInteraction) onLeave();
  };

  const cellStyle: React.CSSProperties = {
    width: '30px', // マス目のサイズ
    height: '30px',
    border: '1px solid #666',
    backgroundColor: '#eee',
    cursor: (!disableInteraction && onClick) ? 'pointer' : 'default',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    fontSize: '0.8em',
    fontWeight: 'bold',
  };

  // セルの状態に応じた背景色や表示ロジック
  let displayChar: string = ''; // マスに表示する文字 (ヒットマークなど)
  switch (cell.status) {
    case 'ship':
      // 自分のボードまたはプレビュー時のみ船を表示
      if (isPlayerBoard || isPreview) {
        cellStyle.backgroundColor = '#6c757d'; // 船の色
      } else {
        cellStyle.backgroundColor = '#dee2e6'; // 相手の未発見の船は空として表示
      }
      break;
    case 'hit':
      cellStyle.backgroundColor = '#dc3545'; // ヒットした船の色 (赤)
      displayChar = 'X'; // ヒットマーク
      cellStyle.color = 'white';
      break;
    case 'miss':
      cellStyle.backgroundColor = '#6c757d'; // ミスしたマスの色 (薄い青)
      displayChar = '○'; // ミスマーク
      cellStyle.color = 'white';
      break;
    case 'sunk':
      cellStyle.backgroundColor = '#343a40'; // 沈んだ船の色 (濃い赤)
      displayChar = '🔥'; // 沈没マーク
      cellStyle.color = 'white';
      break;
    default:
      // 'empty'
      cellStyle.backgroundColor = '#dee2e6'; // 空のマス
      break;
  }

  return (
    <div
      style={cellStyle}
      onClick={handleClick}
      onMouseEnter={handleHover}
      onMouseLeave={handleLeave}
    >
      {displayChar}
    </div>
  );
};

export default Cell;