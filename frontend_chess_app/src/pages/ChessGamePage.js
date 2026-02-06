import React, { useMemo, useReducer, useState } from 'react';
import ChessBoard from '../components/ChessBoard';
import StatusPanel from '../components/StatusPanel';
import MoveHistory from '../components/MoveHistory';
import { applyMove, createInitialGameState, getLegalMovesFromSquare } from '../utils/chess';

function keyOf(pos) {
  return `${pos.r},${pos.c}`;
}

function flipPos(pos) {
  return { r: 7 - pos.r, c: 7 - pos.c };
}

function reducer(state, action) {
  switch (action.type) {
    case 'NEW_GAME':
      return createInitialGameState();
    case 'APPLY_MOVE':
      return applyMove(state, action.move);
    default:
      return state;
  }
}

/**
 * PUBLIC_INTERFACE
 * ChessGamePage is the main SPA screen for playing chess locally (2 players).
 */
export default function ChessGamePage() {
  const [game, dispatch] = useReducer(reducer, undefined, createInitialGameState);
  const [selected, setSelected] = useState(null); // board coords in UI orientation
  const [isFlipped, setIsFlipped] = useState(false);

  const lastMove = game.history.length ? game.history[game.history.length - 1].move : null;

  const selectedReal = useMemo(() => {
    if (!selected) return null;
    return isFlipped ? flipPos(selected) : selected;
  }, [selected, isFlipped]);

  const legalMoves = useMemo(() => {
    if (!selectedReal) return [];
    return getLegalMovesFromSquare(game, selectedReal);
  }, [game, selectedReal]);

  const legalTargets = useMemo(() => {
    const s = new Set();
    for (const m of legalMoves) s.add(keyOf(isFlipped ? flipPos(m.to) : m.to));
    return s;
  }, [legalMoves, isFlipped]);

  const displayedBoard = useMemo(() => {
    if (!isFlipped) return game.board;
    // flip for display
    return game.board
      .slice()
      .reverse()
      .map((row) => row.slice().reverse());
  }, [game.board, isFlipped]);

  function onNewGame() {
    setSelected(null);
    dispatch({ type: 'NEW_GAME' });
  }

  function onFlipBoard() {
    setSelected(null);
    setIsFlipped((v) => !v);
  }

  function onSquareClick(posUI) {
    // If game ended, allow exploring but don't move
    if (game.result) return;

    const pos = isFlipped ? flipPos(posUI) : posUI;
    const clickedPiece = game.board[pos.r][pos.c];

    // If nothing selected: only select your own piece
    if (!selectedReal) {
      if (clickedPiece && clickedPiece.color === game.turn) setSelected(posUI);
      return;
    }

    // If selecting another of your pieces, switch selection
    if (clickedPiece && clickedPiece.color === game.turn) {
      setSelected(posUI);
      return;
    }

    // Attempt move to target
    const chosen = legalMoves.find((m) => m.to.r === pos.r && m.to.c === pos.c);
    if (!chosen) {
      // clicking invalid square clears selection
      setSelected(null);
      return;
    }

    // Auto-promote to queen (retro + simple). If user selected promotion variants, prefer queen.
    const move = chosen.promotion ? { ...chosen, promotion: chosen.promotion === 'q' ? 'q' : 'q' } : chosen;

    dispatch({ type: 'APPLY_MOVE', move });
    setSelected(null);
  }

  return (
    <div className="screen">
      <header className="topbar">
        <div className="brand">
          <div className="brand__title">Retro Chess</div>
          <div className="brand__subtitle">Local 2-player · CRA React</div>
        </div>
      </header>

      <main className="layout">
        <section className="boardWrap" aria-label="Board area">
          <ChessBoard
            board={displayedBoard}
            selected={selected}
            legalTargets={legalTargets}
            lastMove={
              lastMove
                ? {
                    from: isFlipped ? flipPos(lastMove.from) : lastMove.from,
                    to: isFlipped ? flipPos(lastMove.to) : lastMove.to
                  }
                : null
            }
            onSquareClick={onSquareClick}
          />

          <div className="hint" role="note">
            Click a piece to see legal moves. Click a highlighted square to move.
          </div>
        </section>

        <aside className="side">
          <StatusPanel
            turn={game.turn}
            status={game.status}
            result={game.result}
            onNewGame={onNewGame}
            onFlipBoard={onFlipBoard}
            isFlipped={isFlipped}
          />
          <MoveHistory history={game.history} />
        </aside>
      </main>

      <footer className="footer">
        <span className="muted">
          Rules: legal moves, check, checkmate, stalemate, castling, en-passant, promotion (auto-queen).
        </span>
      </footer>
    </div>
  );
}
