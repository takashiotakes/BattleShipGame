// src/components/GameBoard.tsx

import React from 'react';
import { Cell as CellType, Coordinate } from '../models/types';
import Cell from './Cell'; // Cell コンポーネントをインポート

interface GameBoardProps {
  cells: CellType[][]; // 表示するボードのセルデータ
  isPlayerBoard: boolean; // これは自分のボードか、相手のボードか (表示ロジックに影響)
  onCellClick?: (coord: Coordinate) => void; // セルがクリックされたときのコールバック（攻撃など）
  onCellHover?: (coord: Coordinate) => void; // セルにマウスが乗ったときのコールバック（プレビューなど）
  onBoardLeave?: () => void; // ボードからマウスが離れたときのコールバック
  disableInteraction?: boolean; // クリックやホバーを無効にするフラグ
  // プレビュー用の船情報など、必要に応じて追加
  // previewShipCoords?: Coordinate[]; // プレビュー表示する座標リスト
}

const GameBoard: React.FC<GameBoardProps> = ({
  cells,
  isPlayerBoard,
  onCellClick,
  onCellHover,
  onBoardLeave,
  disableInteraction = false,
  // previewShipCoords,
}) => {
  const columnLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
  const rowLabels = Array.from({ length: 10 }, (_, i) => i + 1);

  return (
    <div style={{ display: 'inline-block', border: '1px solid #444', backgroundColor: '#f8f9fa', padding: '5px' }}>
      <div style={{ display: 'flex' }}>
        {/* Corner empty cell */}
        <div style={{ width: '30px', height: '30px' }}></div>
        {/* Column labels */}
        {columnLabels.map((label, index) => (
          <div key={`col-label-${index}`} style={{ width: '30px', height: '30px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', color: '#333' }}>
            {label}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex' }}>
        {/* Row labels */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {rowLabels.map((label, index) => (
            <div key={`row-label-${index}`} style={{ width: '30px', height: '30px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', color: '#333' }}>
              {label}
            </div>
          ))}
        </div>
        {/* The actual grid of cells */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(10, 30px)',
            gridTemplateRows: 'repeat(10, 30px)',
            // ボード外にマウスが出たときのイベント
          }}
          onMouseLeave={onBoardLeave}
        >
          {cells.map((row, y) => (
            row.map((cell, x) => (
              <Cell
                key={`${x}-${y}`}
                cell={cell}
                onClick={onCellClick}
                onHover={onCellHover}
                onLeave={onBoardLeave} // Cellからマウスが離れた時もGameBoardのonBoardLeaveを呼ぶ
                isPlayerBoard={isPlayerBoard}
                disableInteraction={disableInteraction}
                // preview={previewShipCoords?.some(coord => coord.x === x && coord.y === y)} // プレビューロジック
              />
            ))
          ))}
        </div>
      </div>
    </div>
  );
};

export default GameBoard;