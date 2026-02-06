import React from 'react';
import { pieceGlyph, toSquare } from '../utils/chess';

/**
 * PUBLIC_INTERFACE
 * ChessBoard renders an 8x8 board.
 * Props:
 * - board: 8x8 piece array
 * - selected: {r,c} | null
 * - legalTargets: Set<string> of "r,c" for target squares
 * - lastMove: {from:{r,c}, to:{r,c}} | null
 * - onSquareClick: (pos:{r,c}) => void
 */
export default function ChessBoard({ board, selected, legalTargets, lastMove, onSquareClick }) {
  return (
    <div className="board" role="grid" aria-label="Chess board">
      {board.map((row, r) =>
        row.map((piece, c) => {
          const isLight = (r + c) % 2 === 0;
          const key = `${r},${c}`;
          const isSelected = selected && selected.r === r && selected.c === c;
          const isTarget = legalTargets.has(key);
          const isLastFrom = lastMove && lastMove.from.r === r && lastMove.from.c === c;
          const isLastTo = lastMove && lastMove.to.r === r && lastMove.to.c === c;

          const className = [
            'square',
            isLight ? 'square--light' : 'square--dark',
            isSelected ? 'square--selected' : '',
            isTarget ? 'square--target' : '',
            isLastFrom ? 'square--lastfrom' : '',
            isLastTo ? 'square--lastto' : ''
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <button
              key={key}
              type="button"
              className={className}
              onClick={() => onSquareClick({ r, c })}
              role="gridcell"
              aria-label={`${toSquare({ r, c })}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : ''}`}
            >
              <span className="piece" aria-hidden="true">
                {pieceGlyph(piece)}
              </span>
              {isTarget ? <span className="dot" aria-hidden="true" /> : null}
            </button>
          );
        })
      )}
    </div>
  );
}
