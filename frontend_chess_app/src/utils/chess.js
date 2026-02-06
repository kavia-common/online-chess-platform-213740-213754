/**
 * Minimal chess engine utilities for a two-player local chess SPA.
 * Focus: legal move generation (including checks), move application, game status.
 *
 * Board representation:
 * - board is 8x8 array board[r][c], where r=0 is rank 8, r=7 is rank 1.
 * - each square is either null or a piece object: { type: 'p|r|n|b|q|k', color: 'w|b' }
 */

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/** @typedef {{type: 'p'|'r'|'n'|'b'|'q'|'k', color: 'w'|'b'}} Piece */
/** @typedef {{from: {r:number,c:number}, to: {r:number,c:number}, promotion?: 'q'|'r'|'b'|'n', isCastle?: boolean, isEnPassant?: boolean}} Move */

/**
 * PUBLIC_INTERFACE
 * Create a fresh chess position.
 * Castling rights: all available; en-passant target: null.
 */
export function createInitialGameState() {
  /** @type {(Piece|null)[][]} */
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));

  const placeBackRank = (r, color) => {
    board[r][0] = { type: 'r', color };
    board[r][1] = { type: 'n', color };
    board[r][2] = { type: 'b', color };
    board[r][3] = { type: 'q', color };
    board[r][4] = { type: 'k', color };
    board[r][5] = { type: 'b', color };
    board[r][6] = { type: 'n', color };
    board[r][7] = { type: 'r', color };
  };

  placeBackRank(0, 'b');
  placeBackRank(7, 'w');

  for (let c = 0; c < 8; c += 1) {
    board[1][c] = { type: 'p', color: 'b' };
    board[6][c] = { type: 'p', color: 'w' };
  }

  return {
    board,
    turn: 'w',
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassant: null, // {r,c} square that can be captured onto
    halfmoveClock: 0,
    fullmoveNumber: 1,
    history: /** @type {any[]} */ ([]),
    result: null, // '1-0' | '0-1' | '1/2-1/2'
    status: 'White to move'
  };
}

/**
 * PUBLIC_INTERFACE
 * Convert board coords to algebraic square like "e4".
 */
export function toSquare({ r, c }) {
  return `${FILES[c]}${8 - r}`;
}

/**
 * PUBLIC_INTERFACE
 * Deep clone a board.
 */
export function cloneBoard(board) {
  return board.map((row) => row.map((p) => (p ? { ...p } : null)));
}

function inBounds(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function other(color) {
  return color === 'w' ? 'b' : 'w';
}

function findKing(board, color) {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = board[r][c];
      if (p && p.type === 'k' && p.color === color) return { r, c };
    }
  }
  return null;
}

/**
 * Squares attacked by a given color (pseudo-attacks; ignores pins, but correct for check detection).
 */
function isSquareAttacked(board, target, byColor) {
  const { r: tr, c: tc } = target;

  // Pawn attacks
  const pawnDir = byColor === 'w' ? -1 : 1;
  for (const dc of [-1, 1]) {
    const pr = tr - pawnDir;
    const pc = tc - dc;
    if (inBounds(pr, pc)) {
      const p = board[pr][pc];
      if (p && p.color === byColor && p.type === 'p') return true;
    }
  }

  // Knight attacks
  const knightDeltas = [
    [-2, -1], [-2, 1],
    [-1, -2], [-1, 2],
    [1, -2], [1, 2],
    [2, -1], [2, 1]
  ];
  for (const [dr, dc] of knightDeltas) {
    const r = tr + dr;
    const c = tc + dc;
    if (!inBounds(r, c)) continue;
    const p = board[r][c];
    if (p && p.color === byColor && p.type === 'n') return true;
  }

  // Sliding pieces: bishops/queens (diagonals), rooks/queens (orthogonals)
  const rays = [
    // diagonals
    [-1, -1], [-1, 1], [1, -1], [1, 1],
    // orthogonals
    [-1, 0], [1, 0], [0, -1], [0, 1]
  ];

  for (const [dr, dc] of rays) {
    let r = tr + dr;
    let c = tc + dc;
    while (inBounds(r, c)) {
      const p = board[r][c];
      if (p) {
        if (p.color === byColor) {
          const isDiag = Math.abs(dr) === 1 && Math.abs(dc) === 1;
          const isOrtho = dr === 0 || dc === 0;
          if (p.type === 'q') return true;
          if (isDiag && p.type === 'b') return true;
          if (isOrtho && p.type === 'r') return true;
          // King adjacency counts as attack too (for castling checks)
          if (p.type === 'k' && Math.max(Math.abs(r - tr), Math.abs(c - tc)) === 1) return true;
        }
        break; // blocked
      }
      r += dr;
      c += dc;
    }
  }

  // King adjacent (already partially covered above but include explicitly)
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const r = tr + dr;
      const c = tc + dc;
      if (!inBounds(r, c)) continue;
      const p = board[r][c];
      if (p && p.color === byColor && p.type === 'k') return true;
    }
  }

  return false;
}

function isInCheck(state, color) {
  const king = findKing(state.board, color);
  if (!king) return false;
  return isSquareAttacked(state.board, king, other(color));
}

/**
 * Apply a move (assumes move is legal). Returns new state.
 */
function applyMoveUnchecked(state, move) {
  const board = cloneBoard(state.board);
  const piece = board[move.from.r][move.from.c];
  const captured = board[move.to.r][move.to.c];

  board[move.from.r][move.from.c] = null;

  // En passant capture
  let didEnPassantCapture = false;
  if (move.isEnPassant && piece && piece.type === 'p' && state.enPassant) {
    const capR = piece.color === 'w' ? move.to.r + 1 : move.to.r - 1;
    board[capR][move.to.c] = null;
    didEnPassantCapture = true;
  }

  // Castling
  let didCastle = false;
  if (move.isCastle && piece && piece.type === 'k') {
    didCastle = true;
    // King already moves to destination. Move rook accordingly.
    if (move.to.c === 6) {
      // king-side
      board[move.to.r][5] = board[move.to.r][7];
      board[move.to.r][7] = null;
    } else if (move.to.c === 2) {
      // queen-side
      board[move.to.r][3] = board[move.to.r][0];
      board[move.to.r][0] = null;
    }
  }

  // Promotion
  if (piece && piece.type === 'p' && (move.to.r === 0 || move.to.r === 7)) {
    board[move.to.r][move.to.c] = { type: move.promotion || 'q', color: piece.color };
  } else {
    board[move.to.r][move.to.c] = piece ? { ...piece } : null;
  }

  // Update castling rights
  const castling = { ...state.castling };
  if (piece && piece.type === 'k') {
    if (piece.color === 'w') {
      castling.wK = false;
      castling.wQ = false;
    } else {
      castling.bK = false;
      castling.bQ = false;
    }
  }
  if (piece && piece.type === 'r') {
    // rook moved from corner loses that side
    if (piece.color === 'w') {
      if (move.from.r === 7 && move.from.c === 0) castling.wQ = false;
      if (move.from.r === 7 && move.from.c === 7) castling.wK = false;
    } else {
      if (move.from.r === 0 && move.from.c === 0) castling.bQ = false;
      if (move.from.r === 0 && move.from.c === 7) castling.bK = false;
    }
  }
  // rook captured on corner loses that side
  if (captured && captured.type === 'r') {
    if (captured.color === 'w') {
      if (move.to.r === 7 && move.to.c === 0) castling.wQ = false;
      if (move.to.r === 7 && move.to.c === 7) castling.wK = false;
    } else {
      if (move.to.r === 0 && move.to.c === 0) castling.bQ = false;
      if (move.to.r === 0 && move.to.c === 7) castling.bK = false;
    }
  }

  // En passant target: only after a 2-square pawn push
  let enPassant = null;
  if (piece && piece.type === 'p' && Math.abs(move.to.r - move.from.r) === 2) {
    const midR = (move.to.r + move.from.r) / 2;
    enPassant = { r: midR, c: move.from.c };
  }

  const turn = other(state.turn);
  const halfmoveClock =
    piece && piece.type === 'p' ? 0 : (captured || didEnPassantCapture ? 0 : state.halfmoveClock + 1);
  const fullmoveNumber = state.turn === 'b' ? state.fullmoveNumber + 1 : state.fullmoveNumber;

  const nextState = {
    ...state,
    board,
    turn,
    castling,
    enPassant,
    halfmoveClock,
    fullmoveNumber
  };

  const notation = moveToSimpleNotation(state, move, { didCastle });
  const historyEntry = {
    move,
    notation,
    turn: state.turn,
    captured: captured || (didEnPassantCapture ? { type: 'p', color: other(state.turn) } : null)
  };

  nextState.history = [...state.history, historyEntry];

  return nextState;
}

function moveToSimpleNotation(state, move, { didCastle }) {
  const piece = state.board[move.from.r][move.from.c];
  const captured = state.board[move.to.r][move.to.c];
  if (!piece) return '';

  if (didCastle) {
    return move.to.c === 6 ? 'O-O' : 'O-O-O';
  }

  const pieceLetterMap = { p: '', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };
  const pieceLetter = pieceLetterMap[piece.type];

  const isCapture = Boolean(captured) || Boolean(move.isEnPassant);
  const fromFile = FILES[move.from.c];

  if (piece.type === 'p') {
    const promo = move.promotion ? `=${pieceLetterMap[move.promotion]}` : '';
    return `${isCapture ? `${fromFile}x` : ''}${toSquare(move.to)}${promo}`;
  }

  return `${pieceLetter}${isCapture ? 'x' : ''}${toSquare(move.to)}`;
}

function generatePseudoMovesForPiece(state, from) {
  const { board } = state;
  const piece = board[from.r][from.c];
  if (!piece) return [];

  /** @type {Move[]} */
  const moves = [];
  const color = piece.color;
  const forward = color === 'w' ? -1 : 1;

  const addIfEmpty = (toR, toC) => {
    if (!inBounds(toR, toC)) return false;
    if (board[toR][toC] !== null) return false;
    moves.push({ from, to: { r: toR, c: toC } });
    return true;
  };

  const addIfEnemy = (toR, toC) => {
    if (!inBounds(toR, toC)) return;
    const target = board[toR][toC];
    if (target && target.color !== color) {
      moves.push({ from, to: { r: toR, c: toC } });
    }
  };

  if (piece.type === 'p') {
    // forward move
    const oneR = from.r + forward;
    if (inBounds(oneR, from.c) && board[oneR][from.c] === null) {
      // promotion handled on apply (but we should allow specifying promotion options for UI)
      moves.push({ from, to: { r: oneR, c: from.c } });

      // two-step from starting rank
      const startRank = color === 'w' ? 6 : 1;
      const twoR = from.r + 2 * forward;
      if (from.r === startRank && board[twoR][from.c] === null) {
        moves.push({ from, to: { r: twoR, c: from.c } });
      }
    }

    // captures
    addIfEnemy(from.r + forward, from.c - 1);
    addIfEnemy(from.r + forward, from.c + 1);

    // en passant
    if (state.enPassant) {
      const ep = state.enPassant;
      if (ep.r === from.r + forward && Math.abs(ep.c - from.c) === 1) {
        moves.push({ from, to: { r: ep.r, c: ep.c }, isEnPassant: true });
      }
    }

    return moves;
  }

  if (piece.type === 'n') {
    const deltas = [
      [-2, -1], [-2, 1],
      [-1, -2], [-1, 2],
      [1, -2], [1, 2],
      [2, -1], [2, 1]
    ];
    for (const [dr, dc] of deltas) {
      const r = from.r + dr;
      const c = from.c + dc;
      if (!inBounds(r, c)) continue;
      const target = board[r][c];
      if (!target || target.color !== color) moves.push({ from, to: { r, c } });
    }
    return moves;
  }

  if (piece.type === 'b' || piece.type === 'r' || piece.type === 'q') {
    const dirs = [];
    if (piece.type === 'b' || piece.type === 'q') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
    if (piece.type === 'r' || piece.type === 'q') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);

    for (const [dr, dc] of dirs) {
      let r = from.r + dr;
      let c = from.c + dc;
      while (inBounds(r, c)) {
        const target = board[r][c];
        if (!target) {
          moves.push({ from, to: { r, c } });
        } else {
          if (target.color !== color) moves.push({ from, to: { r, c } });
          break;
        }
        r += dr;
        c += dc;
      }
    }
    return moves;
  }

  if (piece.type === 'k') {
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (dr === 0 && dc === 0) continue;
        const r = from.r + dr;
        const c = from.c + dc;
        if (!inBounds(r, c)) continue;
        const target = board[r][c];
        if (!target || target.color !== color) moves.push({ from, to: { r, c } });
      }
    }

    // castling (pseudo; we will validate check squares in legality filter)
    const homeRank = color === 'w' ? 7 : 0;
    if (from.r === homeRank && from.c === 4) {
      const opp = other(color);
      const inCheck = isSquareAttacked(board, { r: homeRank, c: 4 }, opp);
      if (!inCheck) {
        // king-side
        const canK = color === 'w' ? state.castling.wK : state.castling.bK;
        if (canK && board[homeRank][5] === null && board[homeRank][6] === null) {
          const sq5 = isSquareAttacked(board, { r: homeRank, c: 5 }, opp);
          const sq6 = isSquareAttacked(board, { r: homeRank, c: 6 }, opp);
          if (!sq5 && !sq6) moves.push({ from, to: { r: homeRank, c: 6 }, isCastle: true });
        }
        // queen-side
        const canQ = color === 'w' ? state.castling.wQ : state.castling.bQ;
        if (canQ && board[homeRank][1] === null && board[homeRank][2] === null && board[homeRank][3] === null) {
          const sq3 = isSquareAttacked(board, { r: homeRank, c: 3 }, opp);
          const sq2 = isSquareAttacked(board, { r: homeRank, c: 2 }, opp);
          if (!sq3 && !sq2) moves.push({ from, to: { r: homeRank, c: 2 }, isCastle: true });
        }
      }
    }

    return moves;
  }

  return moves;
}

/**
 * PUBLIC_INTERFACE
 * Get legal moves from a square, filtered so your king is not left in check.
 */
export function getLegalMovesFromSquare(state, from) {
  const piece = state.board[from.r][from.c];
  if (!piece) return [];
  if (piece.color !== state.turn) return [];

  const pseudo = generatePseudoMovesForPiece(state, from);

  // Add promotion options explicitly so UI can offer them; default to queen for apply
  const withPromos = pseudo.flatMap((m) => {
    const p = state.board[m.from.r][m.from.c];
    if (!p || p.type !== 'p') return [m];
    const toR = m.to.r;
    if (toR !== 0 && toR !== 7) return [m];
    // Provide 4 promotion choices for legality; UI will choose, default is queen.
    return ['q', 'r', 'b', 'n'].map((promo) => ({ ...m, promotion: promo }));
  });

  return withPromos.filter((m) => {
    const next = applyMoveUnchecked(state, m);
    // after move, original color's king must not be in check
    return !isInCheck(next, piece.color);
  });
}

/**
 * PUBLIC_INTERFACE
 * Apply a legal move and update game status (check, checkmate, stalemate).
 */
export function applyMove(state, move) {
  const legal = getLegalMovesFromSquare(state, move.from).some(
    (m) =>
      m.to.r === move.to.r &&
      m.to.c === move.to.c &&
      Boolean(m.isCastle) === Boolean(move.isCastle) &&
      Boolean(m.isEnPassant) === Boolean(move.isEnPassant) &&
      (m.promotion ? m.promotion === move.promotion : true)
  );

  if (!legal) {
    return {
      ...state,
      status: 'Illegal move'
    };
  }

  const next = applyMoveUnchecked(state, move);

  // Determine status/result
  const sideToMove = next.turn;
  const inCheckNow = isInCheck(next, sideToMove);

  // any legal moves for sideToMove?
  let hasAnyLegal = false;
  for (let r = 0; r < 8 && !hasAnyLegal; r += 1) {
    for (let c = 0; c < 8 && !hasAnyLegal; c += 1) {
      const p = next.board[r][c];
      if (p && p.color === sideToMove) {
        const ms = getLegalMovesFromSquare(next, { r, c });
        if (ms.length > 0) hasAnyLegal = true;
      }
    }
  }

  let result = null;
  let status = `${sideToMove === 'w' ? 'White' : 'Black'} to move`;

  if (!hasAnyLegal) {
    if (inCheckNow) {
      // checkmate
      result = sideToMove === 'w' ? '0-1' : '1-0';
      status = `Checkmate — ${result === '1-0' ? 'White wins' : 'Black wins'}`;
    } else {
      result = '1/2-1/2';
      status = 'Stalemate — draw';
    }
  } else if (inCheckNow) {
    status = `${sideToMove === 'w' ? 'White' : 'Black'} to move — Check`;
  }

  return { ...next, result, status };
}

/**
 * PUBLIC_INTERFACE
 * Utility to list all legal moves for current player (used for mate/stalemate checks and potential future features).
 */
export function getAllLegalMoves(state) {
  /** @type {Move[]} */
  const all = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = state.board[r][c];
      if (p && p.color === state.turn) {
        all.push(...getLegalMovesFromSquare(state, { r, c }));
      }
    }
  }
  return all;
}

/**
 * PUBLIC_INTERFACE
 * Get a user-friendly label for a piece (retro ASCII style).
 */
export function pieceGlyph(piece) {
  if (!piece) return '';
  const map = {
    w: { k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N', p: 'P' },
    b: { k: 'k', q: 'q', r: 'r', b: 'b', n: 'n', p: 'p' }
  };
  return map[piece.color][piece.type];
}
