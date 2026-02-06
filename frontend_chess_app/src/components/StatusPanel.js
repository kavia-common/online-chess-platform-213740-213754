import React from 'react';

/**
 * PUBLIC_INTERFACE
 * StatusPanel shows current turn/status and controls.
 */
export default function StatusPanel({ turn, status, result, onNewGame, onFlipBoard, isFlipped }) {
  return (
    <section className="panel" aria-label="Game status panel">
      <div className="panel__header">
        <h2 className="panel__title">Status</h2>
      </div>

      <div className="panel__body">
        <div className="kv">
          <div className="kv__k">Turn</div>
          <div className="kv__v">{turn === 'w' ? 'White' : 'Black'}</div>
        </div>

        <div className="kv">
          <div className="kv__k">State</div>
          <div className="kv__v">{status}</div>
        </div>

        <div className="kv">
          <div className="kv__k">Result</div>
          <div className="kv__v">{result || '—'}</div>
        </div>

        <div className="panel__actions">
          <button type="button" className="btn" onClick={onNewGame}>
            New Game
          </button>
          <button type="button" className="btn btn--ghost" onClick={onFlipBoard}>
            {isFlipped ? 'Unflip' : 'Flip'} Board
          </button>
        </div>
      </div>
    </section>
  );
}
