import React from 'react';

/**
 * PUBLIC_INTERFACE
 * MoveHistory displays the recorded moves list.
 */
export default function MoveHistory({ history }) {
  const rows = [];
  for (let i = 0; i < history.length; i += 2) {
    rows.push({
      moveNo: Math.floor(i / 2) + 1,
      white: history[i]?.notation || '',
      black: history[i + 1]?.notation || ''
    });
  }

  return (
    <section className="panel" aria-label="Move history panel">
      <div className="panel__header">
        <h2 className="panel__title">History</h2>
      </div>

      <div className="panel__body panel__body--scroll">
        {rows.length === 0 ? (
          <div className="muted">No moves yet.</div>
        ) : (
          <table className="history" aria-label="Move history">
            <thead>
              <tr>
                <th>#</th>
                <th>White</th>
                <th>Black</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const isLastRow = idx === rows.length - 1;
                return (
                  <tr key={row.moveNo} className={isLastRow ? 'history__row--last' : ''}>
                    <td className="history__no">{row.moveNo}</td>
                    <td>{row.white}</td>
                    <td>{row.black}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
