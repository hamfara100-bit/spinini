/**
 * engine.ts — Pure, framework-free logic for the Game Night multiplayer hub.
 *
 * No React, no data store. Every function is deterministic given its inputs
 * (except the explicit shuffle/pick helpers, which use Math.random). This keeps
 * the game rules unit-testable and the screen file focused on UI + turn flow.
 *
 * "Seat" = one of the two active sides in a head-to-head game (0 or 1). The hub
 * maps real players (kids/parent, possibly in teams) onto seats; the engine only
 * cares about seats.
 */

export type Seat = 0 | 1;
export function otherSeat(s: Seat): Seat {
  return (s === 0 ? 1 : 0);
}

// ─── Tic-Tac-Toe (XOXO) ───────────────────────────────────────────────────────
export type TTTMark = "X" | "O";
export type TTTCell = TTTMark | null;
export type TTTBoard = TTTCell[]; // length 9, index = row*3 + col

const TTT_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],            // diagonals
];

export function tttEmpty(): TTTBoard {
  return Array(9).fill(null);
}

/** Returns the winning mark + the 3 cells, or null. */
export function tttWinner(b: TTTBoard): { mark: TTTMark; line: number[] } | null {
  for (const line of TTT_LINES) {
    const [a, c, d] = line;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) {
      return { mark: b[a] as TTTMark, line };
    }
  }
  return null;
}

export function tttFull(b: TTTBoard): boolean {
  return b.every(c => c !== null);
}

/** Seat 0 plays X, seat 1 plays O. */
export function tttMarkForSeat(seat: Seat): TTTMark {
  return seat === 0 ? "X" : "O";
}

// ─── Connect 4 ────────────────────────────────────────────────────────────────
export const C4_COLS = 7;
export const C4_ROWS = 6;
export type C4Cell = Seat | null;
export type C4Board = C4Cell[][]; // [row][col]; row 0 is the TOP

export function c4Empty(): C4Board {
  return Array.from({ length: C4_ROWS }, () => Array<C4Cell>(C4_COLS).fill(null));
}

/** Drop a disc into a column. Returns the new board + landing row, or null if the column is full. */
export function c4Drop(board: C4Board, col: number, seat: Seat): { board: C4Board; row: number } | null {
  if (col < 0 || col >= C4_COLS) return null;
  for (let r = C4_ROWS - 1; r >= 0; r--) {
    if (board[r][col] === null) {
      const nb = board.map(row => row.slice());
      nb[r][col] = seat;
      return { board: nb, row: r };
    }
  }
  return null; // column full
}

const C4_DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

/** Returns the winning seat + the 4 connected cells, or null. */
export function c4Winner(board: C4Board): { seat: Seat; cells: [number, number][] } | null {
  for (let r = 0; r < C4_ROWS; r++) {
    for (let c = 0; c < C4_COLS; c++) {
      const s = board[r][c];
      if (s === null) continue;
      for (const [dr, dc] of C4_DIRS) {
        const cells: [number, number][] = [[r, c]];
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k;
          const nc = c + dc * k;
          if (nr < 0 || nr >= C4_ROWS || nc < 0 || nc >= C4_COLS || board[nr][nc] !== s) break;
          cells.push([nr, nc]);
        }
        if (cells.length === 4) return { seat: s, cells };
      }
    }
  }
  return null;
}

export function c4Full(board: C4Board): boolean {
  return board[0].every(c => c !== null);
}

// ─── Hangman ──────────────────────────────────────────────────────────────────
// Family-friendly words/phrases. Single words only (no spaces) to keep the UI simple.
export const HANGMAN_WORDS = [
  "RAINBOW", "PUPPY", "PLANET", "COOKIE", "GUITAR", "ROCKET", "TURTLE", "PENGUIN",
  "DRAGON", "CASTLE", "JUNGLE", "ROBOT", "PIRATE", "GARDEN", "BICYCLE", "DINOSAUR",
  "VOLCANO", "PRETZEL", "BLANKET", "SANDWICH", "MERMAID", "TREASURE", "BUTTERFLY",
  "ELEPHANT", "KANGAROO", "PANCAKE", "SNOWMAN", "UMBRELLA", "FIREWORKS", "BUBBLES",
];
export const HANGMAN_MAX_WRONG = 6;
export const HANGMAN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function pickHangmanWord(): string {
  return HANGMAN_WORDS[Math.floor(Math.random() * HANGMAN_WORDS.length)];
}

/** True when every letter of `word` is present in `guessed`. */
export function hangmanSolved(word: string, guessed: Set<string>): boolean {
  return word.split("").every(ch => guessed.has(ch));
}

/** Masked display, e.g. "R _ _ N B O W". Unguessed letters become "_". */
export function hangmanMask(word: string, guessed: Set<string>): string[] {
  return word.split("").map(ch => (guessed.has(ch) ? ch : "_"));
}

// ─── Memory Match ─────────────────────────────────────────────────────────────
const MEMORY_EMOJIS = [
  "🐶", "🐱", "🦊", "🐼", "🦁", "🐸", "🐵", "🦄", "🐝", "🦋",
  "🌟", "🍕", "🍦", "🚀", "⚽", "🎈", "🎸", "🌈", "🍩", "🐙",
];

export interface MemoryCard {
  id: number;
  emoji: string;
  matched: boolean;
}

/** Build a shuffled deck of `pairs` matched pairs (so 2*pairs cards). */
export function memoryDeck(pairs: number): MemoryCard[] {
  const count = Math.min(pairs, MEMORY_EMOJIS.length);
  const chosen = MEMORY_EMOJIS.slice(0, count);
  const cards: MemoryCard[] = [];
  chosen.forEach(emoji => {
    cards.push({ id: 0, emoji, matched: false });
    cards.push({ id: 0, emoji, matched: false });
  });
  // Fisher–Yates shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards.map((c, idx) => ({ ...c, id: idx }));
}

// ─── Checkers (Draughts) ──────────────────────────────────────────────────────
// 8×8 board. Seat 0 starts at the BOTTOM (rows 5-7) and moves UP (row decreasing).
// Seat 1 starts at the TOP (rows 0-2) and moves DOWN (row increasing). Kings move
// both ways. Captures are forced (standard rule) and multi-jumps chain.
export const CK_SIZE = 8;
export interface CheckersPiece { seat: Seat; king: boolean; }
export type CheckersCell = CheckersPiece | null;
export type CheckersBoard = CheckersCell[][]; // [row][col]
export interface CkMove { from: [number, number]; to: [number, number]; captures: [number, number][]; }

function ckInBounds(r: number, c: number): boolean {
  return r >= 0 && r < CK_SIZE && c >= 0 && c < CK_SIZE;
}

/** Diagonal directions a piece may travel. Men go forward only; kings go all 4. */
function ckPieceDirs(p: CheckersPiece): [number, number][] {
  if (p.king) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  return p.seat === 0 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
}

export function checkersInit(): CheckersBoard {
  const b: CheckersBoard = Array.from({ length: CK_SIZE }, () => Array<CheckersCell>(CK_SIZE).fill(null));
  for (let r = 0; r < CK_SIZE; r++) {
    for (let c = 0; c < CK_SIZE; c++) {
      if ((r + c) % 2 === 1) {
        if (r < 3) b[r][c] = { seat: 1, king: false };
        else if (r > 4) b[r][c] = { seat: 0, king: false };
      }
    }
  }
  return b;
}

/** Recursively collect all maximal jump chains starting from (sr,sc). */
function ckCollectJumps(
  board: CheckersBoard, sr: number, sc: number, piece: CheckersPiece,
  captured: [number, number][], out: CkMove[], origin: [number, number],
): void {
  let extended = false;
  for (const [dr, dc] of ckPieceDirs(piece)) {
    const mr = sr + dr, mc = sc + dc;       // captured square
    const lr = sr + 2 * dr, lc = sc + 2 * dc; // landing square
    if (!ckInBounds(lr, lc)) continue;
    const mid = board[mr][mc];
    if (mid && mid.seat !== piece.seat && board[lr][lc] === null) {
      extended = true;
      const nb = board.map(row => row.slice());
      nb[sr][sc] = null;
      nb[mr][mc] = null;
      nb[lr][lc] = piece;
      ckCollectJumps(nb, lr, lc, piece, [...captured, [mr, mc]], out, origin);
    }
  }
  if (!extended && captured.length > 0) {
    out.push({ from: origin, to: [sr, sc], captures: captured });
  }
}

/** All legal moves for `seat`. If any jumps exist, only jumps are returned (forced capture). */
export function checkersMoves(board: CheckersBoard, seat: Seat): CkMove[] {
  const simple: CkMove[] = [];
  const jumps: CkMove[] = [];
  for (let r = 0; r < CK_SIZE; r++) {
    for (let c = 0; c < CK_SIZE; c++) {
      const p = board[r][c];
      if (!p || p.seat !== seat) continue;
      for (const [dr, dc] of ckPieceDirs(p)) {
        const nr = r + dr, nc = c + dc;
        if (ckInBounds(nr, nc) && board[nr][nc] === null) {
          simple.push({ from: [r, c], to: [nr, nc], captures: [] });
        }
      }
      ckCollectJumps(board, r, c, p, [], jumps, [r, c]);
    }
  }
  return jumps.length > 0 ? jumps : simple;
}

/** Apply a move, removing captured pieces and promoting to king on the back row. */
export function checkersApply(board: CheckersBoard, move: CkMove): CheckersBoard {
  const nb = board.map(row => row.slice());
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  const p = nb[fr][fc];
  if (!p) return nb;
  nb[fr][fc] = null;
  for (const [cr, cc] of move.captures) nb[cr][cc] = null;
  const king = p.king || (p.seat === 0 && tr === 0) || (p.seat === 1 && tr === CK_SIZE - 1);
  nb[tr][tc] = { seat: p.seat, king };
  return nb;
}

/** Returns the winning seat if the player to move has lost (no pieces or no moves), else null. */
export function checkersWinner(board: CheckersBoard, toMove: Seat): Seat | null {
  const flat = board.flat();
  if (!flat.some(p => p && p.seat === 0)) return 1;
  if (!flat.some(p => p && p.seat === 1)) return 0;
  if (checkersMoves(board, toMove).length === 0) return otherSeat(toMove);
  return null;
}

// ─── Chess ────────────────────────────────────────────────────────────────────
// 8×8. Seat 0 = white, starts at the BOTTOM (rows 6-7) and moves UP (row -1).
// Seat 1 = black, starts at the TOP (rows 0-1) and moves DOWN (row +1).
// Supports castling, en passant, and (auto-queen) promotion. Detects check,
// checkmate, and stalemate.
export const CHESS_SIZE = 8;
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export interface ChessPiece { seat: Seat; type: PieceType; }
export type ChessCell = ChessPiece | null;
export type ChessBoard = ChessCell[][]; // [row][col]; row 0 = black back rank, row 7 = white back rank
export interface ChessMove {
  from: [number, number];
  to: [number, number];
  promotion?: PieceType;   // auto-queen
  castle?: "K" | "Q";      // king-side / queen-side
  enPassant?: boolean;
}
export interface CastlingRights { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean; }
export interface ChessState {
  board: ChessBoard;
  turn: Seat;
  castling: CastlingRights;
  enPassant: [number, number] | null; // square that may be captured en passant this turn
}

function chIn(r: number, c: number): boolean {
  return r >= 0 && r < CHESS_SIZE && c >= 0 && c < CHESS_SIZE;
}
function chClone(board: ChessBoard): ChessBoard {
  return board.map(row => row.map(cell => (cell ? { ...cell } : null)));
}

export function chessInit(): ChessState {
  const board: ChessBoard = Array.from({ length: 8 }, () => Array<ChessCell>(8).fill(null));
  const back: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  for (let c = 0; c < 8; c++) {
    board[0][c] = { seat: 1, type: back[c] }; // black back rank (top)
    board[1][c] = { seat: 1, type: "p" };
    board[6][c] = { seat: 0, type: "p" };
    board[7][c] = { seat: 0, type: back[c] }; // white back rank (bottom)
  }
  return { board, turn: 0, castling: { wK: true, wQ: true, bK: true, bQ: true }, enPassant: null };
}

const KNIGHT_D: [number, number][] = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
const KING_D: [number, number][] = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const BISHOP_D: [number, number][] = [[-1,-1],[-1,1],[1,-1],[1,1]];
const ROOK_D: [number, number][] = [[-1,0],[1,0],[0,-1],[0,1]];

/** Is square (r,c) attacked by any piece of `bySeat`? (Ignores check legality — used for it.) */
export function chessSquareAttacked(board: ChessBoard, r: number, c: number, bySeat: Seat): boolean {
  // Pawn attacks: a pawn of bySeat sits one rank "behind" its attack direction.
  const pawnRow = bySeat === 0 ? r + 1 : r - 1; // white attacks upward, so attacker is below
  for (const dc of [-1, 1]) {
    const pr = pawnRow, pc = c + dc;
    if (chIn(pr, pc)) {
      const p = board[pr][pc];
      if (p && p.seat === bySeat && p.type === "p") return true;
    }
  }
  // Knights
  for (const [dr, dc] of KNIGHT_D) {
    const nr = r + dr, nc = c + dc;
    if (chIn(nr, nc)) {
      const p = board[nr][nc];
      if (p && p.seat === bySeat && p.type === "n") return true;
    }
  }
  // King adjacency
  for (const [dr, dc] of KING_D) {
    const nr = r + dr, nc = c + dc;
    if (chIn(nr, nc)) {
      const p = board[nr][nc];
      if (p && p.seat === bySeat && p.type === "k") return true;
    }
  }
  // Sliding: diagonals (bishop/queen)
  for (const [dr, dc] of BISHOP_D) {
    let nr = r + dr, nc = c + dc;
    while (chIn(nr, nc)) {
      const p = board[nr][nc];
      if (p) {
        if (p.seat === bySeat && (p.type === "b" || p.type === "q")) return true;
        break;
      }
      nr += dr; nc += dc;
    }
  }
  // Sliding: orthogonals (rook/queen)
  for (const [dr, dc] of ROOK_D) {
    let nr = r + dr, nc = c + dc;
    while (chIn(nr, nc)) {
      const p = board[nr][nc];
      if (p) {
        if (p.seat === bySeat && (p.type === "r" || p.type === "q")) return true;
        break;
      }
      nr += dr; nc += dc;
    }
  }
  return false;
}

function findKing(board: ChessBoard, seat: Seat): [number, number] | null {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c];
    if (p && p.seat === seat && p.type === "k") return [r, c];
  }
  return null;
}

export function chessInCheck(board: ChessBoard, seat: Seat): boolean {
  const k = findKing(board, seat);
  if (!k) return false;
  return chessSquareAttacked(board, k[0], k[1], otherSeat(seat));
}

/** Pseudo-legal moves (may leave own king in check). */
function chessPseudoMoves(state: ChessState, seat: Seat): ChessMove[] {
  const { board, enPassant } = state;
  const moves: ChessMove[] = [];
  const fwd = seat === 0 ? -1 : 1;            // white moves up
  const startRow = seat === 0 ? 6 : 1;
  const promoRow = seat === 0 ? 0 : 7;

  const pushPawn = (fr: number, fc: number, tr: number, tc: number, ep = false) => {
    if (tr === promoRow) moves.push({ from: [fr, fc], to: [tr, tc], promotion: "q", enPassant: ep });
    else moves.push({ from: [fr, fc], to: [tr, tc], enPassant: ep });
  };

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p || p.seat !== seat) continue;
      if (p.type === "p") {
        // forward 1
        if (chIn(r + fwd, c) && !board[r + fwd][c]) {
          pushPawn(r, c, r + fwd, c);
          // forward 2 from start
          if (r === startRow && !board[r + 2 * fwd][c]) moves.push({ from: [r, c], to: [r + 2 * fwd, c] });
        }
        // captures
        for (const dc of [-1, 1]) {
          const tr = r + fwd, tc = c + dc;
          if (!chIn(tr, tc)) continue;
          const tgt = board[tr][tc];
          if (tgt && tgt.seat !== seat) pushPawn(r, c, tr, tc);
          else if (enPassant && enPassant[0] === tr && enPassant[1] === tc) pushPawn(r, c, tr, tc, true);
        }
      } else if (p.type === "n") {
        for (const [dr, dc] of KNIGHT_D) {
          const tr = r + dr, tc = c + dc;
          if (chIn(tr, tc) && (!board[tr][tc] || board[tr][tc]!.seat !== seat)) moves.push({ from: [r, c], to: [tr, tc] });
        }
      } else if (p.type === "k") {
        for (const [dr, dc] of KING_D) {
          const tr = r + dr, tc = c + dc;
          if (chIn(tr, tc) && (!board[tr][tc] || board[tr][tc]!.seat !== seat)) moves.push({ from: [r, c], to: [tr, tc] });
        }
        // castling
        const homeRow = seat === 0 ? 7 : 0;
        if (r === homeRow && c === 4 && !chessInCheck(board, seat)) {
          const kingSide = seat === 0 ? state.castling.wK : state.castling.bK;
          const queenSide = seat === 0 ? state.castling.wQ : state.castling.bQ;
          const enemy = otherSeat(seat);
          if (kingSide && !board[homeRow][5] && !board[homeRow][6] &&
              board[homeRow][7]?.type === "r" && board[homeRow][7]?.seat === seat &&
              !chessSquareAttacked(board, homeRow, 5, enemy) && !chessSquareAttacked(board, homeRow, 6, enemy)) {
            moves.push({ from: [r, c], to: [homeRow, 6], castle: "K" });
          }
          if (queenSide && !board[homeRow][3] && !board[homeRow][2] && !board[homeRow][1] &&
              board[homeRow][0]?.type === "r" && board[homeRow][0]?.seat === seat &&
              !chessSquareAttacked(board, homeRow, 3, enemy) && !chessSquareAttacked(board, homeRow, 2, enemy)) {
            moves.push({ from: [r, c], to: [homeRow, 2], castle: "Q" });
          }
        }
      } else {
        // sliding pieces
        const dirs = p.type === "b" ? BISHOP_D : p.type === "r" ? ROOK_D : [...BISHOP_D, ...ROOK_D];
        for (const [dr, dc] of dirs) {
          let tr = r + dr, tc = c + dc;
          while (chIn(tr, tc)) {
            const tgt = board[tr][tc];
            if (!tgt) moves.push({ from: [r, c], to: [tr, tc] });
            else { if (tgt.seat !== seat) moves.push({ from: [r, c], to: [tr, tc] }); break; }
            tr += dr; tc += dc;
          }
        }
      }
    }
  }
  return moves;
}

/** Apply a move and return the resulting state (turn flipped). Assumes the move is legal. */
export function chessApply(state: ChessState, move: ChessMove): ChessState {
  const board = chClone(state.board);
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;
  const piece = board[fr][fc]!;
  const seat = piece.seat;
  const castling: CastlingRights = { ...state.castling };

  // en passant capture removes the pawn beside the destination
  if (move.enPassant) board[fr][tc] = null;

  board[fr][fc] = null;
  board[tr][tc] = move.promotion ? { seat, type: move.promotion } : piece;

  // move the rook when castling
  if (move.castle) {
    const homeRow = seat === 0 ? 7 : 0;
    if (move.castle === "K") { board[homeRow][5] = board[homeRow][7]; board[homeRow][7] = null; }
    else { board[homeRow][3] = board[homeRow][0]; board[homeRow][0] = null; }
  }

  // update castling rights
  if (piece.type === "k") { if (seat === 0) { castling.wK = false; castling.wQ = false; } else { castling.bK = false; castling.bQ = false; } }
  const clearRook = (r: number, c: number) => {
    if (r === 7 && c === 0) castling.wQ = false;
    if (r === 7 && c === 7) castling.wK = false;
    if (r === 0 && c === 0) castling.bQ = false;
    if (r === 0 && c === 7) castling.bK = false;
  };
  clearRook(fr, fc); // rook moved
  clearRook(tr, tc); // rook captured on its home square

  // set en passant target for a pawn double-step
  let ep: [number, number] | null = null;
  if (piece.type === "p" && Math.abs(tr - fr) === 2) ep = [(tr + fr) / 2, fc];

  return { board, turn: otherSeat(seat), castling, enPassant: ep };
}

/** Fully legal moves for `seat` (pseudo moves filtered so the king isn't left in check). */
export function chessLegalMoves(state: ChessState, seat: Seat): ChessMove[] {
  return chessPseudoMoves(state, seat).filter(m => {
    const next = chessApply(state, m);
    return !chessInCheck(next.board, seat);
  });
}

export type ChessStatus = "playing" | "check" | "checkmate" | "stalemate";

/** Status for the side to move. */
export function chessStatus(state: ChessState): ChessStatus {
  const seat = state.turn;
  const hasMoves = chessLegalMoves(state, seat).length > 0;
  const inCheck = chessInCheck(state.board, seat);
  if (!hasMoves) return inCheck ? "checkmate" : "stalemate";
  return inCheck ? "check" : "playing";
}

// ─── Trash / Garbage (card game) ──────────────────────────────────────────────
// Each side has a row of 10 positions. Draw a card and place it at its numbered
// slot (A=1 … 10), flipping up the face-down card there and chaining. Jack = wild
// (auto-placed in the lowest open slot). Queen/King = dead → discard, turn ends.
// First to complete all 10 face-up slots wins.
export const TRASH_SLOTS = 10;
export const TRASH_SUITS = ["♠", "♥", "♦", "♣"];
export interface TrashCard { rank: number; suit: string; } // rank 1..13 (A=1, J=11, Q=12, K=13)
export interface TrashPlayer {
  slots: (TrashCard | null)[]; // index 0 = position 1; non-null = completed face-up
  down: (TrashCard | null)[];  // face-down card still sitting at each position
}
export interface TrashState {
  players: [TrashPlayer, TrashPlayer];
  stock: TrashCard[];
  discard: TrashCard[];
  turn: Seat;
}
export interface TrashTurnResult {
  state: TrashState;
  placed: number[];          // slot indexes filled this turn (in order)
  drawn: TrashCard;          // the card drawn to start the turn
  deadCard: TrashCard | null;// the card that ended the turn (null if won)
  winner: Seat | null;
}

export function trashRankLabel(rank: number): string {
  if (rank === 1) return "A";
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  return String(rank);
}

function trashFullDeck(): TrashCard[] {
  const deck: TrashCard[] = [];
  for (const suit of TRASH_SUITS) for (let rank = 1; rank <= 13; rank++) deck.push({ rank, suit });
  // Fisher–Yates
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function trashInit(): TrashState {
  const deck = trashFullDeck();
  const mkPlayer = (): TrashPlayer => ({
    slots: Array<TrashCard | null>(TRASH_SLOTS).fill(null),
    down: deck.splice(0, TRASH_SLOTS),
  });
  const p0 = mkPlayer();
  const p1 = mkPlayer();
  return { players: [p0, p1], stock: deck, discard: [], turn: 0 };
}

function trashClone(s: TrashState): TrashState {
  return {
    players: [
      { slots: s.players[0].slots.slice(), down: s.players[0].down.slice() },
      { slots: s.players[1].slots.slice(), down: s.players[1].down.slice() },
    ],
    stock: s.stock.slice(),
    discard: s.discard.slice(),
    turn: s.turn,
  };
}

/**
 * Resolve a full turn for `seat`, drawing from "stock" or "discard".
 * Returns the new state plus a summary of what happened.
 */
export function trashTurn(state: TrashState, seat: Seat, source: "stock" | "discard"): TrashTurnResult {
  const st = trashClone(state);
  const p = st.players[seat];

  // Decide the draw. Fall back to stock if discard is empty.
  let useDiscard = source === "discard" && st.discard.length > 0;
  if (!useDiscard && st.stock.length === 0) {
    // reshuffle discard back into stock
    st.stock = st.discard;
    st.discard = [];
    for (let i = st.stock.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [st.stock[i], st.stock[j]] = [st.stock[j], st.stock[i]];
    }
  }
  let card: TrashCard = useDiscard ? st.discard.pop()! : st.stock.pop()!;
  const drawn = card;

  const placed: number[] = [];
  let dead: TrashCard | null = null;

  while (true) {
    let pos: number | null = null;
    if (card.rank === 11) {
      // Jack = wild → lowest open slot
      const idx = p.slots.findIndex(s => s === null);
      pos = idx === -1 ? null : idx;
    } else if (card.rank >= 1 && card.rank <= 10) {
      const target = card.rank - 1;
      if (p.slots[target] === null) pos = target;
    }
    if (pos === null) { dead = card; break; } // Queen/King, or slot already filled

    const flipped = p.down[pos];
    p.slots[pos] = card;
    p.down[pos] = null;
    placed.push(pos);

    if (p.slots.every(s => s !== null)) {
      return { state: st, placed, drawn, deadCard: null, winner: seat };
    }
    card = flipped!; // chain with the freshly flipped face-down card
  }

  st.discard.push(dead);
  st.turn = otherSeat(seat);
  return { state: st, placed, drawn, deadCard: dead, winner: null };
}

// ─── Uno ──────────────────────────────────────────────────────────────────────
// A 2-seat Uno. The full game state (both hands, draw + discard piles, active
// color) lives in the synced board; the UI only reveals YOUR own hand. Apply is
// DETERMINISTIC (reshuffles reverse the discard pile, no RNG) so both devices
// converge — only the initial deal uses RNG, which happens once on the host and
// is synced.
export type UnoColor = "red" | "yellow" | "green" | "blue";
export type UnoValue = number | "skip" | "reverse" | "draw2" | "wild" | "wild4";
export interface UnoCard { color: UnoColor | "wild"; value: UnoValue }
export interface UnoState {
  hands: [UnoCard[], UnoCard[]];
  draw: UnoCard[];
  discard: UnoCard[];
  color: UnoColor;      // active color (chosen color after a wild)
  turn: Seat;
  winner: Seat | null;
}

const UNO_COLORS: UnoColor[] = ["red", "yellow", "green", "blue"];

function unoBuildDeck(): UnoCard[] {
  const deck: UnoCard[] = [];
  for (const color of UNO_COLORS) {
    deck.push({ color, value: 0 });
    for (let v = 1; v <= 9; v++) { deck.push({ color, value: v }); deck.push({ color, value: v }); }
    for (const a of ["skip", "reverse", "draw2"] as const) { deck.push({ color, value: a }); deck.push({ color, value: a }); }
  }
  for (let i = 0; i < 4; i++) { deck.push({ color: "wild", value: "wild" }); deck.push({ color: "wild", value: "wild4" }); }
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return deck;
}

export function unoInit(): UnoState {
  const deck = unoBuildDeck();
  const h0 = deck.splice(0, 7);
  const h1 = deck.splice(0, 7);
  // Start the discard on a plain colored card (never a wild/action mess).
  let first = deck.shift()!;
  while (first.color === "wild" || typeof first.value !== "number") { deck.push(first); first = deck.shift()!; }
  return { hands: [h0, h1], draw: deck, discard: [first], color: first.color as UnoColor, turn: 0, winner: null };
}

function unoTop(s: UnoState): UnoCard { return s.discard[s.discard.length - 1]; }

/** Can `card` legally be played on `top` given the active `color`? */
export function unoPlayable(card: UnoCard, top: UnoCard, color: UnoColor): boolean {
  if (card.color === "wild") return true;
  if (card.color === color) return true;
  return card.value === top.value;
}

export function unoHasMove(hand: UnoCard[], top: UnoCard, color: UnoColor): boolean {
  return hand.some(c => unoPlayable(c, top, color));
}

function unoReshuffleIfNeeded(s: UnoState) {
  if (s.draw.length === 0 && s.discard.length > 1) {
    const top = s.discard.pop()!;
    const rest = s.discard;          // deterministic: reverse, no RNG (sync-safe)
    s.discard = [top];
    s.draw = rest.reverse();
  }
}

function unoDrawN(s: UnoState, seat: Seat, n: number) {
  for (let i = 0; i < n; i++) {
    unoReshuffleIfNeeded(s);
    const c = s.draw.shift();
    if (c) s.hands[seat].push(c);
  }
}

function unoClone(s: UnoState): UnoState {
  return {
    hands: [s.hands[0].slice(), s.hands[1].slice()],
    draw: s.draw.slice(),
    discard: s.discard.slice(),
    color: s.color,
    turn: s.turn,
    winner: s.winner,
  };
}

/**
 * Apply one Uno move. move = { play: number, color?: UnoColor } | { draw: true }.
 * Returns the next { state, turn, winner } or null if illegal.
 */
export function unoApply(state: UnoState, seat: Seat, move: any): { state: UnoState; turn: Seat; winner: Seat | null } | null {
  if (state.winner !== null || state.turn !== seat) return null;
  const s = unoClone(state);
  const other = otherSeat(seat);

  if (move?.draw) {
    unoDrawN(s, seat, 1);
    s.turn = other;
    return { state: s, turn: other, winner: null };
  }

  const idx = move?.play;
  if (typeof idx !== "number") return null;
  const card = s.hands[seat][idx];
  if (!card) return null;
  if (!unoPlayable(card, unoTop(s), s.color)) return null;

  s.hands[seat].splice(idx, 1);
  s.discard.push(card);
  s.color = card.color === "wild"
    ? (UNO_COLORS.includes(move?.color) ? move.color : "red")
    : (card.color as UnoColor);

  if (s.hands[seat].length === 0) { s.winner = seat; return { state: s, turn: seat, winner: seat }; }

  // 2-player effects: action cards skip the opponent (so YOU play again);
  // number/wild pass the turn.
  let next: Seat = other;
  switch (card.value) {
    case "skip": case "reverse": next = seat; break;
    case "draw2": unoDrawN(s, other, 2); next = seat; break;
    case "wild4": unoDrawN(s, other, 4); next = seat; break;
    default: next = other;
  }
  s.turn = next;
  return { state: s, turn: next, winner: null };
}
