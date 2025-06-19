// src/components/BoardGrid.tsx

import React, { useCallback } from 'react';
import { Cell, Coordinate, CellStatus } from '../models/types';

interface BoardGridProps {
  cells: Cell[][];
  isPlayerBoard: boolean; // 自分のボードか相手のボードか (表示を切り替えるため)
  onCellClick?: (coord: Coordinate) => void;
  onCellHover?: (coord: Coordinate) => void;
  onBoardLeave?: () => void;
  disableClick?: boolean; // クリックを無効にするか
  // ★変更: AI攻撃のターゲットをハイライトするための座標をnull許容型に★
  aiAttackHighlightCoord?: Coordinate | null;
}

const BoardGrid: React.FC<BoardGridProps> = ({
  cells,
  isPlayerBoard,
  onCellClick,
  onCellHover,
  onBoardLeave,
  disableClick = false,
  aiAttackHighlightCoord = null, // デフォルト値を追加
}) => {
  const handleCellClick = useCallback(
    (x: number, y: number) => {
      if (!disableClick && onCellClick) {
        onCellClick({ x, y });
      }
    },
    [onCellClick, disableClick]
  );

  const handleCellHover = useCallback(
    (x: number, y: number) => {
      if (onCellHover) {
        onCellHover({ x, y });
      }
    },
    [onCellHover]
  );

  const getCellColor = useCallback(
    (status: CellStatus, x: number, y: number): string => {
      // AIの攻撃ターゲットのハイライト
      if (aiAttackHighlightCoord && aiAttackHighlightCoord.x === x && aiAttackHighlightCoord.y === y) {
          return 'rgba(255, 255, 0, 0.7)'; // 黄色でハイライト
      }

      if (isPlayerBoard) {
        // 自分のボードの場合
        switch (status) {
          case 'empty':
            return '#add8e6'; // 薄い青
          case 'ship':
            return '#00008b'; // 濃い青 (船)
          case 'hit':
            return '#ff4500'; // 赤 (被弾したマス)
          case 'miss':
            return '#6a5acd'; // スレートブルー (攻撃ミス)
          case 'sunk':
            return '#4b0082'; // インディゴ (沈没した船)
          default:
            return '#add8e6';
        }
      } else {
        // 相手のボードの場合
        switch (status) {
          case 'empty':
            return '#add8e6';
          case 'ship': // 相手のボードでは船は見えない (攻撃前は empty と同じ色)
            return '#add8e6';
          case 'hit':
            return '#ff4500'; // 赤 (被弾したマス)
          case 'miss':
            return '#6a5acd'; // スレートブルー (攻撃ミス)
          case 'sunk':
            return '#4b0082'; // インディゴ (沈没した船)
          default:
            return '#add8e6';
        }
      }
    },
    [isPlayerBoard, aiAttackHighlightCoord]
  );

  return (
    <table
      style={{
        borderCollapse: 'collapse',
        margin: '0 auto',
        textAlign: 'center',
        cursor: disableClick ? 'not-allowed' : (onCellClick ? 'pointer' : 'default'),
      }}
      onMouseLeave={onBoardLeave}
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
        {cells.map((row, rowIndex) => (
          <tr key={rowIndex}>
            <td>{rowIndex + 1}</td>
            {row.map((cell, colIndex) => (
              <td
                key={`${cell.x},${cell.y}`}
                style={{
                  width: '30px',
                  height: '30px',
                  border: '1px solid #333',
                  backgroundColor: getCellColor(cell.status, cell.x, cell.y),
                }}
                onClick={() => handleCellClick(cell.x, cell.y)}
                onMouseEnter={() => handleCellHover(cell.x, cell.y)}
              >
                {/* テキスト表示は不要な場合が多いので削除 */}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default BoardGrid;