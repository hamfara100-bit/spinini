/**
 * game-night.tsx — Multiplayer "Game Night" hub.
 *
 * Hot-seat (pass-and-play) family games with an alarm-invite to call other kids
 * over to tap in. A parent (or kid) sets reward points; the winning kid(s) earn
 * them via BEHAVIOR_ADD_EVENT. Formats: 1v1, 2v2 (teams), Winner-stays line.
 *
 * Phase 1 games: Tic-Tac-Toe (XOXO), Connect 4, Hangman, Memory Match.
 * (Checkers, Chess, and the Trash card game land in follow-up passes.)
 */

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Animated, Easing,
  Dimensions,
} from "react-native";

// ─── Responsive board sizing — fill the available width ──────────────────────
// Available inner width = screen − ScreenContainer padding (16×2) − board card
// padding (10×2) = screen − 52. Capped at 560 so it scales up nicely on tablets
// without becoming absurd on very wide screens.
const SCREEN_W = Dimensions.get("window").width;
const BOARD    = Math.min(SCREEN_W - 52, 560);          // board edge length
const TTT_CELL = Math.floor(BOARD / 3);                 // tic-tac-toe 3×3
const C4_CELL  = Math.floor((BOARD - 12) / 7);          // connect-4 7 cols (pad 6 each side)
const MEM_CELL = Math.floor((BOARD - 30) / 4);          // memory 4 per row (3 gaps)
const GRID8    = Math.floor(BOARD / 8);                  // checkers / chess 8×8
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";
import type { MascotType } from "../../../../lib/data/types";
import {
  Seat, otherSeat,
  TTTBoard, tttEmpty, tttWinner, tttFull, tttMarkForSeat,
  C4Board, C4_COLS, C4_ROWS, c4Empty, c4Drop, c4Winner, c4Full,
  HANGMAN_ALPHABET, HANGMAN_MAX_WRONG, pickHangmanWord, hangmanSolved, hangmanMask,
  MemoryCard, memoryDeck,
  CK_SIZE, CheckersBoard, CkMove, checkersInit, checkersMoves, checkersApply, checkersWinner,
  CHESS_SIZE, PieceType, ChessState, ChessMove, chessInit, chessLegalMoves, chessApply, chessStatus, chessInCheck,
  TrashState, TrashCard, trashInit, trashTurn, trashRankLabel, TRASH_SLOTS,
} from "../../../../lib/games/engine";

const MASCOT_EMOJI: Record<MascotType, string> = {
  fox: "🦊", panda: "🐼", bunny: "🐰", dino: "🦖", owl: "🦉", cat: "🐱", bear: "🐻", frog: "🐸",
};

const HANGMAN_STAGES = ["😀", "🙂", "😐", "😟", "😣", "😫", "💀"]; // index = wrong count

type GameId = "ttt" | "connect4" | "hangman" | "memory" | "checkers" | "chess" | "trash";
type Format = "1v1" | "2v2" | "line";

const GAMES: { id: GameId; name: string; emoji: string; desc: string }[] = [
  { id: "ttt",      name: "Tic-Tac-Toe", emoji: "⭕", desc: "Get 3 in a row (XOXO)" },
  { id: "connect4", name: "Connect 4",   emoji: "🔴", desc: "Drop 4 in a row to win" },
  { id: "hangman",  name: "Hangman",     emoji: "🔤", desc: "Guess the secret word" },
  { id: "memory",   name: "Memory Match", emoji: "🧠", desc: "Find the matching pairs" },
  { id: "checkers", name: "Checkers",    emoji: "🔵", desc: "Jump & capture all pieces" },
  { id: "chess",    name: "Chess",       emoji: "♟️", desc: "Checkmate the king" },
  { id: "trash",    name: "Trash",       emoji: "🃏", desc: "Fill your row 1–10 first" },
];

const COMING_SOON: string[] = [];

const FORMATS: { id: Format; label: string; emoji: string; hint: string }[] = [
  { id: "1v1",  label: "1 vs 1",       emoji: "🤜", hint: "Two players, head-to-head" },
  { id: "2v2",  label: "2 vs 2 Teams", emoji: "🤝", hint: "Four players, two teams" },
  { id: "line", label: "Winner Stays", emoji: "👑", hint: "Line up — winner keeps playing" },
];

interface Player { id: string; name: string; emoji: string; isParent: boolean; }
interface Side { label: string; emoji: string; memberKidIds: string[]; memberPlayerIds: string[]; }

const SEAT_COLOR: [string, string] = [Colors.error, Colors.warning];

// ─── Build sides from selected players + format ───────────────────────────────
function makeSide(p: Player): Side {
  return { label: `${p.emoji} ${p.name}`, emoji: p.emoji, memberKidIds: p.isParent ? [] : [p.id], memberPlayerIds: [p.id] };
}
function makeTeamSide(members: Player[], name: string): Side {
  return {
    label: `${name}: ${members.map(m => m.emoji).join(" ")}`,
    emoji: "🤝",
    memberKidIds: members.filter(m => !m.isParent).map(m => m.id),
    memberPlayerIds: members.map(m => m.id),
  };
}
function buildSides(format: Format, players: Player[]): [Side, Side] {
  if (format === "2v2") {
    const teamA = [players[0], players[2]];
    const teamB = [players[1], players[3]];
    return [makeTeamSide(teamA, "Team A"), makeTeamSide(teamB, "Team B")];
  }
  // 1v1 and line both start with the first two players as the two sides
  return [makeSide(players[0]), makeSide(players[1])];
}

// ════════════════════════════════════════════════════════════════════════════
// GAME COMPONENTS — each is a self-contained 2-seat game.
// They own their board + whose turn it is, and call onResult once when finished.
// `resetKey` changing forces a fresh board (rematch / next match).
// ════════════════════════════════════════════════════════════════════════════
interface GameProps {
  sideNames: [string, string];
  resetKey: number;
  onResult: (r: Seat | "draw") => void;
  /** Called with the NEW active seat whenever the turn passes to the other side.
   *  MatchView uses this to show the "pass the device" handoff gate. */
  onTurnChange?: (seat: Seat) => void;
}

// ─── Tic-Tac-Toe ──────────────────────────────────────────────────────────────
function TicTacToe({ sideNames, resetKey, onResult, onTurnChange }: GameProps) {
  const [board, setBoard] = useState<TTTBoard>(tttEmpty());
  const [turn, setTurn] = useState<Seat>(0);
  const [over, setOver] = useState(false);
  const win = tttWinner(board);

  useEffect(() => { setBoard(tttEmpty()); setTurn(0); setOver(false); }, [resetKey]);

  function tap(i: number) {
    if (over || board[i]) return;
    const nb = board.slice();
    nb[i] = tttMarkForSeat(turn);
    setBoard(nb);
    const w = tttWinner(nb);
    if (w) { setOver(true); onResult(turn); return; }
    if (tttFull(nb)) { setOver(true); onResult("draw"); return; }
    const next = otherSeat(turn);
    setTurn(next); onTurnChange?.(next);
  }

  return (
    <View style={{ alignItems: "center" }}>
      <TurnBanner sideNames={sideNames} turn={turn} suffix={turn === 0 ? "(X)" : "(O)"} over={over} />
      <View style={gs.tttGrid}>
        {board.map((cell, i) => {
          const inWin = win?.line.includes(i);
          return (
            <TouchableOpacity key={i} style={[gs.tttCell, inWin && gs.tttCellWin]} onPress={() => tap(i)} activeOpacity={0.7}>
              <Text style={[gs.tttMark, { color: cell === "X" ? SEAT_COLOR[0] : SEAT_COLOR[1] }]}>{cell ?? ""}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Connect 4 ────────────────────────────────────────────────────────────────
function Connect4({ sideNames, resetKey, onResult, onTurnChange }: GameProps) {
  const [board, setBoard] = useState<C4Board>(c4Empty());
  const [turn, setTurn] = useState<Seat>(0);
  const [over, setOver] = useState(false);
  const win = c4Winner(board);

  useEffect(() => { setBoard(c4Empty()); setTurn(0); setOver(false); }, [resetKey]);

  function drop(col: number) {
    if (over) return;
    const res = c4Drop(board, col, turn);
    if (!res) return; // column full
    setBoard(res.board);
    const w = c4Winner(res.board);
    if (w) { setOver(true); onResult(turn); return; }
    if (c4Full(res.board)) { setOver(true); onResult("draw"); return; }
    const next = otherSeat(turn);
    setTurn(next); onTurnChange?.(next);
  }

  const isWinCell = (r: number, c: number) => win?.cells.some(([wr, wc]) => wr === r && wc === c);

  return (
    <View style={{ alignItems: "center" }}>
      <TurnBanner sideNames={sideNames} turn={turn} over={over} />
      <View style={gs.c4DropRow}>
        {Array.from({ length: C4_COLS }).map((_, c) => (
          <TouchableOpacity key={c} style={gs.c4DropBtn} onPress={() => drop(c)} disabled={over}>
            <Text style={[gs.c4DropArrow, { color: SEAT_COLOR[turn] }]}>▼</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={gs.c4Board}>
        {board.map((row, r) => (
          <View key={r} style={gs.c4Row}>
            {row.map((cell, c) => (
              <View key={c} style={gs.c4Cell}>
                <View style={[
                  gs.c4Disc,
                  cell === null ? gs.c4Empty : { backgroundColor: SEAT_COLOR[cell] },
                  isWinCell(r, c) && gs.c4DiscWin,
                ]} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Hangman ──────────────────────────────────────────────────────────────────
function Hangman({ sideNames, resetKey, onResult, onTurnChange }: GameProps) {
  const [word, setWord] = useState<string>(() => pickHangmanWord());
  const [guessed, setGuessed] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState(0);
  const [turn, setTurn] = useState<Seat>(0);
  const [over, setOver] = useState(false);

  useEffect(() => {
    setWord(pickHangmanWord()); setGuessed(new Set()); setWrong(0); setTurn(0); setOver(false);
  }, [resetKey]);

  function guess(letter: string) {
    if (over || guessed.has(letter)) return;
    const ng = new Set(guessed); ng.add(letter);
    setGuessed(ng);
    const next = otherSeat(turn);
    if (word.includes(letter)) {
      if (hangmanSolved(word, ng)) { setOver(true); onResult(turn); return; } // completer wins
      setTurn(next); onTurnChange?.(next); // correct but not solved — pass turn (keeps it fair)
    } else {
      const nw = wrong + 1;
      setWrong(nw);
      if (nw >= HANGMAN_MAX_WRONG) { setOver(true); onResult("draw"); return; } // word survives
      setTurn(next); onTurnChange?.(next);
    }
  }

  const mask = hangmanMask(word, guessed);

  return (
    <View style={{ alignItems: "center" }}>
      <TurnBanner sideNames={sideNames} turn={turn} over={over} />
      <Text style={gs.hangFace}>{HANGMAN_STAGES[Math.min(wrong, HANGMAN_STAGES.length - 1)]}</Text>
      <Text style={gs.hangWrong}>Wrong guesses: {wrong} / {HANGMAN_MAX_WRONG}</Text>
      <View style={gs.hangWord}>
        {mask.map((ch, i) => (
          <Text key={i} style={gs.hangChar}>{ch}</Text>
        ))}
      </View>
      <View style={gs.hangKeys}>
        {HANGMAN_ALPHABET.map(letter => {
          const used = guessed.has(letter);
          const hit = used && word.includes(letter);
          return (
            <TouchableOpacity
              key={letter}
              style={[gs.hangKey, used && (hit ? gs.hangKeyHit : gs.hangKeyMiss)]}
              onPress={() => guess(letter)}
              disabled={used || over}
            >
              <Text style={[gs.hangKeyText, used && { color: "#fff" }]}>{letter}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Memory Match ─────────────────────────────────────────────────────────────
const MEMORY_PAIRS = 6;
function Memory({ sideNames, resetKey, onResult, onTurnChange }: GameProps) {
  const [deck, setDeck] = useState<MemoryCard[]>(() => memoryDeck(MEMORY_PAIRS));
  const [flipped, setFlipped] = useState<number[]>([]);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [turn, setTurn] = useState<Seat>(0);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  useEffect(() => {
    setDeck(memoryDeck(MEMORY_PAIRS)); setFlipped([]); setScores([0, 0]); setTurn(0); setBusy(false); setOver(false);
  }, [resetKey]);

  function tap(idx: number) {
    if (over || busy) return;
    const card = deck[idx];
    if (card.matched || flipped.includes(idx)) return;
    const nf = [...flipped, idx];
    setFlipped(nf);
    if (nf.length === 2) {
      setBusy(true);
      const [a, b] = nf;
      if (deck[a].emoji === deck[b].emoji) {
        // match
        setTimeout(() => {
          const nd = deck.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c));
          const ns: [number, number] = turn === 0 ? [scores[0] + 1, scores[1]] : [scores[0], scores[1] + 1];
          setDeck(nd); setScores(ns); setFlipped([]); setBusy(false);
          if (nd.every(c => c.matched)) {
            setOver(true);
            onResult(ns[0] === ns[1] ? "draw" : ns[0] > ns[1] ? 0 : 1);
          }
        }, 600);
      } else {
        setTimeout(() => { const next = otherSeat(turn); setFlipped([]); setBusy(false); setTurn(next); onTurnChange?.(next); }, 900);
      }
    }
  }

  return (
    <View style={{ alignItems: "center" }}>
      <TurnBanner sideNames={sideNames} turn={turn} over={over} />
      <View style={gs.memScore}>
        <Text style={[gs.memScoreText, { color: SEAT_COLOR[0] }]}>{sideNames[0]}: {scores[0]}</Text>
        <Text style={[gs.memScoreText, { color: SEAT_COLOR[1] }]}>{sideNames[1]}: {scores[1]}</Text>
      </View>
      <View style={gs.memGrid}>
        {deck.map((card, idx) => {
          const show = card.matched || flipped.includes(idx);
          return (
            <TouchableOpacity key={card.id} style={[gs.memCard, card.matched && gs.memCardMatched]} onPress={() => tap(idx)} activeOpacity={0.8}>
              <Text style={gs.memEmoji}>{show ? card.emoji : "❓"}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Checkers ─────────────────────────────────────────────────────────────────
const CK_PIECE_COLOR: [string, string] = ["#DC2626", "#1F2937"]; // seat 0 red, seat 1 dark
function Checkers({ sideNames, resetKey, onResult, onTurnChange }: GameProps) {
  const [board, setBoard] = useState<CheckersBoard>(() => checkersInit());
  const [turn, setTurn] = useState<Seat>(0);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [over, setOver] = useState(false);

  useEffect(() => {
    setBoard(checkersInit()); setTurn(0); setSelected(null); setOver(false);
  }, [resetKey]);

  const legal = useMemo(() => (over ? [] : checkersMoves(board, turn)), [board, turn, over]);
  const movable = useMemo(() => {
    const s = new Set<string>();
    legal.forEach(m => s.add(`${m.from[0]},${m.from[1]}`));
    return s;
  }, [legal]);
  const destsForSelected: CkMove[] = useMemo(
    () => (selected ? legal.filter(m => m.from[0] === selected[0] && m.from[1] === selected[1]) : []),
    [legal, selected],
  );
  const destSet = useMemo(() => {
    const s = new Set<string>();
    destsForSelected.forEach(m => s.add(`${m.to[0]},${m.to[1]}`));
    return s;
  }, [destsForSelected]);

  function tapCell(r: number, c: number) {
    if (over) return;
    const dark = (r + c) % 2 === 1;
    if (!dark) return;
    // Tapping a highlighted destination → play that move.
    if (selected && destSet.has(`${r},${c}`)) {
      const move = destsForSelected.find(m => m.to[0] === r && m.to[1] === c)!;
      const nb = checkersApply(board, move);
      const next = otherSeat(turn);
      setBoard(nb);
      setSelected(null);
      const w = checkersWinner(nb, next);
      if (w !== null) { setOver(true); onResult(w); return; }
      setTurn(next); onTurnChange?.(next);
      return;
    }
    // Tapping one of your movable pieces → select it.
    if (movable.has(`${r},${c}`)) {
      setSelected(prev => (prev && prev[0] === r && prev[1] === c ? null : [r, c]));
    } else {
      setSelected(null);
    }
  }

  return (
    <View style={{ alignItems: "center" }}>
      <TurnBanner sideNames={sideNames} turn={turn} over={over} />
      <View style={gs.ckBoard}>
        {board.map((row, r) => (
          <View key={r} style={gs.ckRow}>
            {row.map((cell, c) => {
              const dark = (r + c) % 2 === 1;
              const isSel = selected?.[0] === r && selected?.[1] === c;
              const isDest = destSet.has(`${r},${c}`);
              const canPick = movable.has(`${r},${c}`);
              return (
                <TouchableOpacity
                  key={c}
                  style={[gs.ckCell, { backgroundColor: dark ? "#7C5C3E" : "#E8D3B0" }, isSel && gs.ckCellSel]}
                  onPress={() => tapCell(r, c)}
                  activeOpacity={dark ? 0.7 : 1}
                >
                  {isDest && <View style={gs.ckDot} />}
                  {cell && (
                    <View style={[
                      gs.ckPiece,
                      { backgroundColor: CK_PIECE_COLOR[cell.seat] },
                      canPick && gs.ckPieceMovable,
                    ]}>
                      {cell.king && <Text style={gs.ckKing}>♛</Text>}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
      <Text style={gs.ckHint}>
        {selected ? "Tap a glowing square to move" : "Tap one of your pieces to select"}
      </Text>
    </View>
  );
}

// ─── Chess ────────────────────────────────────────────────────────────────────
const CHESS_GLYPH: Record<PieceType, string> = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" };
const CHESS_PIECE_COLOR: [string, string] = ["#F8FAFC", "#111827"]; // white / black
function Chess({ sideNames, resetKey, onResult, onTurnChange }: GameProps) {
  const [game, setGame] = useState<ChessState>(() => chessInit());
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [over, setOver] = useState(false);
  const turn = game.turn;

  useEffect(() => { setGame(chessInit()); setSelected(null); setOver(false); }, [resetKey]);

  const status = useMemo(() => chessStatus(game), [game]);
  const legal = useMemo(() => (over ? [] : chessLegalMoves(game, turn)), [game, turn, over]);
  const movable = useMemo(() => {
    const s = new Set<string>();
    legal.forEach(m => s.add(`${m.from[0]},${m.from[1]}`));
    return s;
  }, [legal]);
  const destsForSelected: ChessMove[] = useMemo(
    () => (selected ? legal.filter(m => m.from[0] === selected[0] && m.from[1] === selected[1]) : []),
    [legal, selected],
  );
  const destSet = useMemo(() => {
    const s = new Set<string>();
    destsForSelected.forEach(m => s.add(`${m.to[0]},${m.to[1]}`));
    return s;
  }, [destsForSelected]);

  const inCheck = status === "check" || status === "checkmate";
  const checkedKing = inCheck ? findOwnKing(game.board, turn) : null;

  function tapCell(r: number, c: number) {
    if (over) return;
    if (selected && destSet.has(`${r},${c}`)) {
      const move = destsForSelected.find(m => m.to[0] === r && m.to[1] === c)!;
      const next = chessApply(game, move);
      setGame(next);
      setSelected(null);
      const st = chessStatus(next);
      if (st === "checkmate") { setOver(true); onResult(turn); return; }       // mover delivered mate
      if (st === "stalemate") { setOver(true); onResult("draw"); return; }
      onTurnChange?.(next.turn);
      return;
    }
    if (movable.has(`${r},${c}`)) {
      setSelected(prev => (prev && prev[0] === r && prev[1] === c ? null : [r, c]));
    } else {
      setSelected(null);
    }
  }

  return (
    <View style={{ alignItems: "center" }}>
      <TurnBanner sideNames={sideNames} turn={turn} suffix={turn === 0 ? "(White)" : "(Black)"} over={over} />
      {status === "check" && !over && <Text style={gs.chessCheck}>⚠️ Check!</Text>}
      <View style={gs.chBoard}>
        {game.board.map((row, r) => (
          <View key={r} style={gs.chRow}>
            {row.map((cell, c) => {
              const light = (r + c) % 2 === 0;
              const isSel = selected?.[0] === r && selected?.[1] === c;
              const isDest = destSet.has(`${r},${c}`);
              const isCheckSq = checkedKing?.[0] === r && checkedKing?.[1] === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[
                    gs.chCell,
                    { backgroundColor: light ? "#EBECD0" : "#779556" },
                    isSel && gs.chCellSel,
                    isCheckSq && gs.chCellCheck,
                  ]}
                  onPress={() => tapCell(r, c)}
                  activeOpacity={0.7}
                >
                  {isDest && <View style={cell ? gs.chCapture : gs.chDot} />}
                  {cell && (
                    <Text style={[
                      gs.chGlyph,
                      { color: CHESS_PIECE_COLOR[cell.seat] },
                      cell.seat === 0 && gs.chGlyphWhite,
                    ]}>
                      {CHESS_GLYPH[cell.type]}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
      <Text style={gs.ckHint}>
        {selected ? "Tap a highlighted square to move" : "Tap one of your pieces"}
      </Text>
    </View>
  );
}
function findOwnKing(board: ChessState["board"], seat: Seat): [number, number] | null {
  for (let r = 0; r < CHESS_SIZE; r++) for (let c = 0; c < CHESS_SIZE; c++) {
    const p = board[r][c];
    if (p && p.seat === seat && p.type === "k") return [r, c];
  }
  return null;
}

// ─── Trash (Garbage) ──────────────────────────────────────────────────────────
// ─── Playing-card visual (Trash) ──────────────────────────────────────────────
function PlayingCard({
  rank, suit, faceDown, size = "md", style,
}: {
  rank?: number; suit?: string; faceDown?: boolean;
  size?: "sm" | "md" | "lg"; style?: any;
}) {
  const d = size === "lg" ? { w: 86, h: 122, corner: 22, pip: 46 }
          : size === "md" ? { w: 60, h: 84, corner: 15, pip: 30 }
          : { w: 44, h: 62, corner: 12, pip: 24 };
  if (faceDown) {
    return (
      <View style={[cs.card, cs.cardBack, { width: d.w, height: d.h }, style]}>
        <View style={cs.backInner}><Text style={[cs.backGlyph, { fontSize: d.pip }]}>✦</Text></View>
      </View>
    );
  }
  const red = suit === "♥" || suit === "♦";
  const color = red ? "#DC2626" : "#1A1033";
  const label = rank ? trashRankLabel(rank) : "";
  return (
    <View style={[cs.card, { width: d.w, height: d.h }, style]}>
      <Text style={[cs.corner, cs.cornerTL, { color, fontSize: d.corner }]}>{label}{suit}</Text>
      <Text style={[cs.pip, { color, fontSize: d.pip }]}>{suit}</Text>
      <Text style={[cs.corner, cs.cornerBR, { color, fontSize: d.corner }]}>{label}{suit}</Text>
    </View>
  );
}

// A numbered slot in a player's row — springs in when its card lands.
function TrashSlot({ index, card, active }: { index: number; card: TrashCard | null; active: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const wasFilled = useRef(!!card);
  useEffect(() => {
    if (!!card && !wasFilled.current) {
      scale.setValue(0.1);
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }).start();
    }
    wasFilled.current = !!card;
  }, [card]);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      {card ? (
        <PlayingCard rank={card.rank} suit={card.suit} size="sm" />
      ) : (
        <View style={[cs.slotEmpty, active && cs.slotEmptyActive]}>
          <Text style={cs.slotNum}>{index + 1}</Text>
        </View>
      )}
    </Animated.View>
  );
}

function Trash({ sideNames, resetKey, onResult, onTurnChange }: GameProps) {
  const [game, setGame] = useState<TrashState>(() => trashInit());
  const [over, setOver] = useState(false);
  const [log, setLog] = useState<string>("Tap a pile to draw and play your turn.");
  const [drawn, setDrawn] = useState<TrashCard | null>(null);
  const turn = game.turn;

  const floatAnim = useRef(new Animated.Value(0)).current;
  const stockPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setGame(trashInit()); setOver(false); setDrawn(null);
    setLog("Tap a pile to draw and play your turn.");
  }, [resetKey]);

  // Gentle breathing pulse on the stock so the board feels alive.
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(stockPulse, { toValue: 1.06, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(stockPulse, { toValue: 1,    duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  function play(source: "stock" | "discard") {
    if (over) return;
    const res = trashTurn(game, turn, source);

    // Float the drawn card up before the new board settles.
    setDrawn(res.drawn);
    floatAnim.setValue(0);
    Animated.timing(floatAnim, {
      toValue: 1, duration: 850, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start(() => setDrawn(null));

    setGame(res.state);
    const placedTxt = res.placed.length > 0 ? `placed ${res.placed.map(p => p + 1).join(", ")}` : "no spot";
    if (res.winner !== null) {
      setLog(`🎉 ${sideNames[res.winner]} ${placedTxt} and finished the row!`);
      setOver(true);
      onResult(res.winner);
      return;
    }
    setLog(`Drew ${trashRankLabel(res.drawn.rank)}${res.drawn.suit} → ${placedTxt}. Dead card: ${res.deadCard ? trashRankLabel(res.deadCard.rank) + res.deadCard.suit : "—"}. Pass the device!`);
    if (res.state.turn !== turn) onTurnChange?.(res.state.turn);
  }

  const topDiscard = game.discard[game.discard.length - 1];

  return (
    <View style={{ alignItems: "center", width: "100%" }}>
      <TurnBanner sideNames={sideNames} turn={turn} over={over} />

      {[0, 1].map(si => {
        const seat = si as Seat;
        const p = game.players[seat];
        const isActive = turn === seat && !over;
        return (
          <View key={si} style={[cs.row, isActive && cs.rowActive]}>
            <Text style={[cs.rowLabel, { color: SEAT_COLOR[seat] }]}>{sideNames[seat]}</Text>
            <View style={cs.slots}>
              {p.slots.map((card, i) => (
                <TrashSlot key={i} index={i} card={card} active={isActive} />
              ))}
            </View>
          </View>
        );
      })}

      <View style={cs.piles}>
        <Animated.View style={{ transform: [{ scale: stockPulse }] }}>
          <TouchableOpacity style={cs.pileBtn} onPress={() => play("stock")} disabled={over} activeOpacity={0.8}>
            <PlayingCard faceDown size="lg" />
            <Text style={cs.pileLabel}>Draw Stock</Text>
            <Text style={cs.pileCount}>{game.stock.length} left</Text>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          style={[cs.pileBtn, (over || !topDiscard) && cs.pileDisabled]}
          onPress={() => play("discard")}
          disabled={over || !topDiscard}
          activeOpacity={0.8}
        >
          {topDiscard ? (
            <PlayingCard rank={topDiscard.rank} suit={topDiscard.suit} size="lg" />
          ) : (
            <View style={cs.pileEmpty}><Text style={cs.pileEmptyText}>—</Text></View>
          )}
          <Text style={cs.pileLabel}>Take Discard</Text>
          <Text style={cs.pileCount}>{game.discard.length} cards</Text>
        </TouchableOpacity>

        {drawn && (
          <Animated.View
            pointerEvents="none"
            style={[cs.floatCard, {
              opacity: floatAnim.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [10, -64] }) },
                { scale: floatAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.5, 1.15, 1] }) },
                { rotate: floatAnim.interpolate({ inputRange: [0, 1], outputRange: ["-8deg", "6deg"] }) },
              ],
            }]}
          >
            <PlayingCard rank={drawn.rank} suit={drawn.suit} size="lg" />
          </Animated.View>
        )}
      </View>

      <Text style={cs.log}>{log}</Text>
    </View>
  );
}

// ─── Shared turn banner ───────────────────────────────────────────────────────
function TurnBanner({ sideNames, turn, suffix, over }: { sideNames: [string, string]; turn: Seat; suffix?: string; over?: boolean }) {
  if (over) return null;
  return (
    <View style={[gs.turnBanner, { borderColor: SEAT_COLOR[turn], backgroundColor: SEAT_COLOR[turn] + "18" }]}>
      <Text style={[gs.turnText, { color: SEAT_COLOR[turn] }]}>
        ▶ {sideNames[turn]}'s turn {suffix ?? ""}
      </Text>
    </View>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MATCH WRAPPER — scoreboard, end-of-game award, rematch / next-in-line flow
// ════════════════════════════════════════════════════════════════════════════
function MatchView({
  gameId, gameName, format, initialPlayers, reward, onExit, awardKid,
}: {
  gameId: GameId; gameName: string; format: Format; initialPlayers: Player[];
  reward: number; onExit: () => void; awardKid: (kidId: string, reason: string) => void;
}) {
  const [queue, setQueue] = useState<Player[]>(initialPlayers);
  const [sides, setSides] = useState<[Side, Side]>(() => buildSides(format, initialPlayers));
  const [resetKey, setResetKey] = useState(0);
  const [result, setResult] = useState<Seat | "draw" | null>(null);
  const [champStreak, setChampStreak] = useState(0);
  // When set, the board is covered by a "pass the device" gate until the
  // incoming player taps "ready" — this forces the OTHER player to take the
  // next action, so one person can't quietly play both sides.
  const [handoffTo, setHandoffTo] = useState<Seat | null>(null);

  const sideNames: [string, string] = [sides[0].label, sides[1].label];

  // "Single player" = only one distinct human controls the whole match (a kid
  // playing both sides). Points are suppressed only in that case. A real
  // kid-vs-parent or kid-vs-kid match (two distinct players) earns points, as
  // long as the winning side has a kid on it.
  const distinctPlayerCount = useMemo(
    () => new Set([...sides[0].memberPlayerIds, ...sides[1].memberPlayerIds]).size,
    [sides],
  );
  const isSinglePlayer = distinctPlayerCount < 2;

  function handleResult(r: Seat | "draw") {
    setHandoffTo(null);
    setResult(r);
    if (!isSinglePlayer && r !== "draw" && reward > 0) {
      sides[r].memberKidIds.forEach(kidId => awardKid(kidId, `🎮 Won ${gameName} on Game Night`));
    }
  }

  function rematch() {
    setHandoffTo(null);
    setResult(null);
    setResetKey(k => k + 1);
  }

  function nextInLine() {
    // Rotate the queue: winner stays at front, loser to the back.
    if (result === null) return;
    setHandoffTo(null);
    let nq: Player[];
    if (result === "draw") {
      nq = [...queue.slice(2), queue[0], queue[1]]; // both rotate out
      setChampStreak(0);
    } else {
      const winner = queue[result];
      const loser = queue[otherSeat(result as Seat)];
      const rest = queue.filter((_, i) => i !== 0 && i !== 1);
      nq = [winner, ...rest, loser];
      setChampStreak(s => (result === 0 ? s + 1 : 1));
    }
    setQueue(nq);
    setSides([makeSide(nq[0]), makeSide(nq[1])]);
    setResult(null);
    setResetKey(k => k + 1);
  }

  const Game = { ttt: TicTacToe, connect4: Connect4, hangman: Hangman, memory: Memory, checkers: Checkers, chess: Chess, trash: Trash }[gameId];

  return (
    <ScreenContainer scroll bg="#F0F4FF">
      <View style={ms.topRow}>
        <TouchableOpacity onPress={onExit}><Text style={ms.back}>← Lobby</Text></TouchableOpacity>
        <Text style={ms.matchTitle}>{GAMES.find(g => g.id === gameId)?.emoji} {gameName}</Text>
        <Text style={ms.rewardChip}>{reward > 0 ? `🏆 ${reward}⭐` : "Fun!"}</Text>
      </View>

      {format === "line" && (
        <View style={ms.lineBar}>
          <Text style={ms.lineText}>
            👑 {champStreak > 0 ? `${sides[0].label} streak: ${champStreak}` : "Winner stays on!"}
          </Text>
          {queue.length > 2 && (
            <Text style={ms.lineNext} numberOfLines={1}>
              Up next: {queue.slice(2).map(p => p.emoji).join(" ")}
            </Text>
          )}
        </View>
      )}

      <View style={ms.board}>
        <Game sideNames={sideNames} resetKey={resetKey} onResult={handleResult} onTurnChange={setHandoffTo} />
        {handoffTo !== null && (
          <View style={ms.handoff} onStartShouldSetResponder={() => true}>
            <Text style={ms.handoffEmoji}>🔄</Text>
            <Text style={ms.handoffTitle}>Pass the device</Text>
            <Text style={[ms.handoffName, { color: SEAT_COLOR[handoffTo] }]}>{sides[handoffTo].label}</Text>
            <Text style={ms.handoffSub}>It's your turn — tap below when you've got the device.</Text>
            <TouchableOpacity
              style={[ms.handoffBtn, { backgroundColor: SEAT_COLOR[handoffTo] }]}
              onPress={() => setHandoffTo(null)}
              activeOpacity={0.85}
            >
              <Text style={ms.handoffBtnText}>👍 I'm ready — my turn</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {result !== null && (
        <View style={ms.resultCard}>
          <Text style={ms.resultEmoji}>{result === "draw" ? "🤝" : "🎉"}</Text>
          <Text style={ms.resultTitle}>
            {result === "draw" ? "It's a draw!" : `${sides[result].label} wins!`}
          </Text>
          {result !== "draw" && reward > 0 && isSinglePlayer && (
            <Text style={ms.resultRewardMuted}>Solo game — no points. Play with another kid to earn ⭐!</Text>
          )}
          {result !== "draw" && reward > 0 && !isSinglePlayer && sides[result].memberKidIds.length > 0 && (
            <Text style={ms.resultReward}>+{reward}⭐ awarded!</Text>
          )}
          {result !== "draw" && reward > 0 && !isSinglePlayer && sides[result].memberKidIds.length === 0 && (
            <Text style={ms.resultRewardMuted}>Great game! (No points — grown-up won 😄)</Text>
          )}
          <View style={ms.resultBtns}>
            {format === "line" ? (
              <TouchableOpacity style={ms.primaryBtn} onPress={nextInLine}>
                <Text style={ms.primaryBtnText}>Next Match ⏭</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={ms.primaryBtn} onPress={rematch}>
                <Text style={ms.primaryBtnText}>Rematch 🔁</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={ms.secondaryBtn} onPress={onExit}>
              <Text style={ms.secondaryBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN SCREEN — lobby
// ════════════════════════════════════════════════════════════════════════════
export default function GameNightScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const kid = useKid(id);
  const { state, dispatch } = useData();

  const roster: Player[] = useMemo(() => {
    const kids = state.kids.map(k => ({
      id: k.profile.id,
      name: k.profile.name,
      emoji: MASCOT_EMOJI[k.profile.mascot] ?? "🧒",
      isParent: false,
    }));
    const parent: Player = {
      id: state.parent.id ?? "parent-1",
      name: state.parentSettings.name || state.parent.name || "Parent",
      emoji: state.parentSettings.emoji || state.parent.emoji || "👤",
      isParent: true,
    };
    return [...kids, parent];
  }, [state.kids, state.parent, state.parentSettings]);

  const [gameId, setGameId] = useState<GameId>("ttt");
  const [format, setFormat] = useState<Format>("1v1");
  const [selectedIds, setSelectedIds] = useState<string[]>(() => (id ? [id] : []));
  const [reward, setReward] = useState("5");
  const [playing, setPlaying] = useState(false);

  if (!kid) return null;

  const game = GAMES.find(g => g.id === gameId)!;
  const needed = format === "1v1" ? 2 : format === "2v2" ? 4 : 3;
  const selectedPlayers = selectedIds.map(sid => roster.find(p => p.id === sid)!).filter(Boolean);
  const humanKidCount = selectedPlayers.filter(p => !p.isParent).length;

  function toggle(pid: string) {
    setSelectedIds(prev => prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid]);
  }

  function validationMsg(): string | null {
    if (format === "1v1" && selectedIds.length !== 2) return "Pick exactly 2 players for 1 vs 1.";
    if (format === "2v2" && selectedIds.length !== 4) return "Pick exactly 4 players for 2 vs 2.";
    if (format === "line" && selectedIds.length < 3) return "Pick at least 3 players for Winner Stays.";
    return null;
  }

  function callPlayers() {
    const others = selectedIds.filter(sid => sid !== id && roster.find(p => p.id === sid && !p.isParent));
    if (others.length === 0) {
      Alert.alert("Nobody to call", "Pick another kid to send a Game Night alarm to their device.");
      return;
    }
    const inviter = kid?.profile.name ?? "Someone";
    others.forEach(kidId => {
      dispatch({
        type: "NOTIFICATION_ADD",
        kidId,
        notification: {
          id: uid(), kidId, kind: "ping",
          title: "🎮 Game Night!",
          body: `${inviter} wants to play ${game.name} with you! Come over and tap in! 🎉`,
          emoji: "🎮", read: false, createdAt: nowIso(),
          alarmMode: true, soundLevel: "normal", forceVibrate: true,
        },
      });
    });
    Alert.alert("📣 Players Called!", `An alarm is ringing on ${others.length} device${others.length > 1 ? "s" : ""} to come play!`);
  }

  function start() {
    const msg = validationMsg();
    if (msg) { Alert.alert("Almost there!", msg); return; }
    setPlaying(true);
  }

  function awardKid(kidId: string, reason: string) {
    const pts = parseInt(reward) || 0;
    if (pts <= 0) return;
    dispatch({
      type: "BEHAVIOR_ADD_EVENT", kidId,
      event: { id: uid(), points: pts, reason, date: new Date().toISOString().slice(0, 10) },
    });
  }

  if (playing) {
    return (
      <MatchView
        gameId={gameId}
        gameName={game.name}
        format={format}
        initialPlayers={selectedPlayers}
        reward={parseInt(reward) || 0}
        onExit={() => setPlaying(false)}
        awardKid={awardKid}
      />
    );
  }

  const valMsg = validationMsg();

  return (
    <ScreenContainer scroll>
      <Text style={ls.title}>🎮 Game Night</Text>
      <Text style={ls.sub}>Play together! Send an alarm to call the family over, pick a game, and the winner earns reward points.</Text>

      {/* Game picker */}
      <Text style={ls.sectionLabel}>1. Pick a Game</Text>
      <View style={ls.gameGrid}>
        {GAMES.map(g => (
          <TouchableOpacity
            key={g.id}
            style={[ls.gameCard, gameId === g.id && ls.gameCardActive]}
            onPress={() => setGameId(g.id)}
            activeOpacity={0.85}
          >
            <Text style={ls.gameEmoji}>{g.emoji}</Text>
            <Text style={[ls.gameName, gameId === g.id && { color: "#fff" }]}>{g.name}</Text>
            <Text style={[ls.gameDesc, gameId === g.id && { color: "rgba(255,255,255,0.85)" }]}>{g.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {COMING_SOON.length > 0 && (
        <Text style={ls.comingSoon}>Coming soon: {COMING_SOON.join("  ·  ")}</Text>
      )}

      {/* Format picker */}
      <Text style={ls.sectionLabel}>2. Match Type</Text>
      {FORMATS.map(f => (
        <TouchableOpacity
          key={f.id}
          style={[ls.formatRow, format === f.id && ls.formatRowActive]}
          onPress={() => setFormat(f.id)}
          activeOpacity={0.85}
        >
          <Text style={ls.formatEmoji}>{f.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[ls.formatLabel, format === f.id && { color: Colors.primary }]}>{f.label}</Text>
            <Text style={ls.formatHint}>{f.hint}</Text>
          </View>
          <View style={[ls.radio, format === f.id && ls.radioOn]}>
            {format === f.id && <View style={ls.radioDot} />}
          </View>
        </TouchableOpacity>
      ))}

      {/* Player picker */}
      <Text style={ls.sectionLabel}>3. Who's Playing? <Text style={ls.needTxt}>({selectedIds.length} picked · need {format === "line" ? "3+" : needed})</Text></Text>
      <View style={ls.playerWrap}>
        {roster.map(p => {
          const order = selectedIds.indexOf(p.id);
          const sel = order >= 0;
          return (
            <TouchableOpacity
              key={p.id}
              style={[ls.playerChip, sel && ls.playerChipOn]}
              onPress={() => toggle(p.id)}
              activeOpacity={0.8}
            >
              <Text style={ls.playerEmoji}>{p.emoji}</Text>
              <Text style={[ls.playerName, sel && { color: "#fff" }]}>{p.name}{p.isParent ? " 👑" : ""}</Text>
              {sel && <View style={ls.orderBadge}><Text style={ls.orderText}>{order + 1}</Text></View>}
            </TouchableOpacity>
          );
        })}
      </View>
      {format === "2v2" && selectedIds.length === 4 && (
        <Text style={ls.teamHint}>Team A: picks 1 & 3  ·  Team B: picks 2 & 4</Text>
      )}

      {/* Reward */}
      <Text style={ls.sectionLabel}>4. Winner's Reward 🔒</Text>
      <View style={ls.rewardRow}>
        <TextInput
          style={ls.rewardInput}
          value={reward}
          onChangeText={v => setReward(v.replace(/[^0-9]/g, "").slice(0, 4))}
          keyboardType="number-pad"
          placeholder="0"
          placeholderTextColor={Colors.textMuted}
        />
        <Text style={ls.rewardUnit}>⭐ points to the winning kid(s)</Text>
      </View>
      <Text style={ls.rewardNote}>Parents: set points like in Quizzes & Chores. Set 0 to just play for fun.</Text>
      {parseInt(reward) > 0 && selectedIds.length > 0 && humanKidCount === 0 && (
        <Text style={ls.soloNote}>👤 No kids selected — only a kid on the winning side can earn ⭐.</Text>
      )}

      {/* Actions */}
      <TouchableOpacity style={ls.callBtn} onPress={callPlayers} activeOpacity={0.85}>
        <Text style={ls.callBtnText}>📣 Call Players (send alarm)</Text>
      </TouchableOpacity>

      {valMsg && <Text style={ls.valMsg}>⚠️ {valMsg}</Text>}

      <TouchableOpacity
        style={[ls.startBtn, valMsg && ls.startBtnDisabled]}
        onPress={start}
        activeOpacity={0.85}
      >
        <Text style={ls.startBtnText}>▶️ Start {game.name}</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScreenContainer>
  );
}

// ─── Lobby styles ─────────────────────────────────────────────────────────────
const ls = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "900", color: Colors.textPrimary, marginBottom: 4 },
  sub: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginBottom: 16 },
  sectionLabel: { fontSize: 13, fontWeight: "800", color: Colors.primary, marginTop: 14, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  needTxt: { fontSize: 11, fontWeight: "700", color: Colors.textMuted, textTransform: "none" },

  gameGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gameCard: { width: "47%", flexGrow: 1, backgroundColor: Colors.surfaceLight, borderRadius: 16, padding: 14, borderWidth: 2, borderColor: Colors.border, ...Shadow.sm },
  gameCardActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  gameEmoji: { fontSize: 34 },
  gameName: { fontSize: 15, fontWeight: "800", color: Colors.textPrimary, marginTop: 6 },
  gameDesc: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  comingSoon: { fontSize: 11, color: Colors.textMuted, marginTop: 10, fontStyle: "italic", textAlign: "center" },

  formatRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surfaceLight, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 2, borderColor: Colors.border },
  formatRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "08" },
  formatEmoji: { fontSize: 26 },
  formatLabel: { fontSize: 15, fontWeight: "800", color: Colors.textPrimary },
  formatHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  radioOn: { borderColor: Colors.primary },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: Colors.primary },

  playerWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  playerChip: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.surfaceLight, borderRadius: 50, paddingVertical: 8, paddingHorizontal: 14, borderWidth: 2, borderColor: Colors.border },
  playerChipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  playerEmoji: { fontSize: 20 },
  playerName: { fontSize: 14, fontWeight: "700", color: Colors.textPrimary },
  orderBadge: { backgroundColor: "rgba(255,255,255,0.3)", borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  orderText: { fontSize: 12, fontWeight: "900", color: "#fff" },
  teamHint: { fontSize: 12, color: Colors.primary, fontWeight: "700", marginTop: 8 },

  rewardRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  rewardInput: { width: 80, backgroundColor: Colors.surfaceLight, borderRadius: 12, borderWidth: 2, borderColor: Colors.border, paddingVertical: 10, paddingHorizontal: 14, fontSize: 18, fontWeight: "800", color: Colors.textPrimary, textAlign: "center" },
  rewardUnit: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  rewardNote: { fontSize: 11, color: Colors.textMuted, marginTop: 6, lineHeight: 16 },
  soloNote: { fontSize: 11, color: Colors.warning, fontWeight: "700", marginTop: 6, lineHeight: 16 },

  callBtn: { backgroundColor: Colors.warning + "22", borderWidth: 2, borderColor: Colors.warning, borderRadius: 50, alignItems: "center", paddingVertical: 13, marginTop: 18 },
  callBtnText: { color: "#92400E", fontWeight: "800", fontSize: 15 },
  valMsg: { fontSize: 13, color: Colors.error, fontWeight: "700", textAlign: "center", marginTop: 14 },
  startBtn: { backgroundColor: Colors.success, borderRadius: 50, alignItems: "center", paddingVertical: 16, marginTop: 10, ...Shadow.md },
  startBtnDisabled: { backgroundColor: Colors.textMuted, opacity: 0.6 },
  startBtnText: { color: "#fff", fontWeight: "900", fontSize: 17 },
});

// ─── Match wrapper styles ─────────────────────────────────────────────────────
const ms = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  back: { fontSize: 14, fontWeight: "800", color: Colors.primary },
  matchTitle: { fontSize: 16, fontWeight: "900", color: Colors.textPrimary },
  rewardChip: { fontSize: 13, fontWeight: "800", color: Colors.success },
  lineBar: { backgroundColor: Colors.primary + "12", borderRadius: 12, padding: 10, marginBottom: 12 },
  lineText: { fontSize: 13, fontWeight: "800", color: Colors.primary },
  lineNext: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  board: { backgroundColor: Colors.surfaceLight, borderRadius: 20, padding: 10, position: "relative", overflow: "hidden", alignItems: "center", ...Shadow.sm },
  handoff: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.surfaceLight, alignItems: "center", justifyContent: "center", padding: 24, gap: 6 },
  handoffEmoji: { fontSize: 48 },
  handoffTitle: { fontSize: 16, fontWeight: "800", color: Colors.textSecondary },
  handoffName: { fontSize: 26, fontWeight: "900", textAlign: "center", marginVertical: 2 },
  handoffSub: { fontSize: 13, color: Colors.textSecondary, textAlign: "center", lineHeight: 19, marginBottom: 10 },
  handoffBtn: { borderRadius: 50, paddingVertical: 14, paddingHorizontal: 28, ...Shadow.md },
  handoffBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  resultCard: { backgroundColor: Colors.surfaceLight, borderRadius: 22, padding: 22, alignItems: "center", marginTop: 16, ...Shadow.md, borderWidth: 2, borderColor: Colors.success + "40" },
  resultEmoji: { fontSize: 52 },
  resultTitle: { fontSize: 22, fontWeight: "900", color: Colors.textPrimary, marginTop: 4, textAlign: "center" },
  resultReward: { fontSize: 16, fontWeight: "800", color: Colors.success, marginTop: 6 },
  resultRewardMuted: { fontSize: 13, color: Colors.textSecondary, marginTop: 6 },
  resultBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 50, paddingVertical: 13, paddingHorizontal: 26 },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  secondaryBtn: { backgroundColor: Colors.border, borderRadius: 50, paddingVertical: 13, paddingHorizontal: 26 },
  secondaryBtnText: { color: Colors.textSecondary, fontWeight: "800", fontSize: 15 },
});

// ─── Game board styles ────────────────────────────────────────────────────────
const gs = StyleSheet.create({
  turnBanner: { borderWidth: 2, borderRadius: 50, paddingVertical: 8, paddingHorizontal: 18, marginBottom: 16, alignSelf: "center" },
  turnText: { fontSize: 15, fontWeight: "800" },

  // Tic-Tac-Toe
  tttGrid: { width: TTT_CELL * 3, height: TTT_CELL * 3, flexDirection: "row", flexWrap: "wrap", gap: 0 },
  tttCell: { width: TTT_CELL, height: TTT_CELL, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: Colors.border },
  tttCellWin: { backgroundColor: Colors.success + "33" },
  tttMark: { fontSize: Math.round(TTT_CELL * 0.6), fontWeight: "900" },

  // Connect 4
  c4DropRow: { flexDirection: "row", marginBottom: 4 },
  c4DropBtn: { width: C4_CELL, height: 30, alignItems: "center", justifyContent: "center" },
  c4DropArrow: { fontSize: Math.round(C4_CELL * 0.5), fontWeight: "900" },
  c4Board: { backgroundColor: "#2563EB", borderRadius: 14, padding: 6 },
  c4Row: { flexDirection: "row" },
  c4Cell: { width: C4_CELL, height: C4_CELL, alignItems: "center", justifyContent: "center" },
  c4Disc: { width: Math.round(C4_CELL * 0.82), height: Math.round(C4_CELL * 0.82), borderRadius: Math.round(C4_CELL * 0.41) },
  c4Empty: { backgroundColor: "#EFF6FF" },
  c4DiscWin: { borderWidth: 3, borderColor: Colors.success },

  // Hangman
  hangFace: { fontSize: 56 },
  hangWrong: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary, marginBottom: 10 },
  hangWord: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginBottom: 18 },
  hangChar: { fontSize: 26, fontWeight: "900", color: Colors.textPrimary, minWidth: 22, textAlign: "center" },
  hangKeys: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6 },
  hangKey: { width: 36, height: 42, borderRadius: 8, backgroundColor: Colors.surfaceLight, borderWidth: 1.5, borderColor: Colors.border, alignItems: "center", justifyContent: "center" },
  hangKeyHit: { backgroundColor: Colors.success, borderColor: Colors.success },
  hangKeyMiss: { backgroundColor: Colors.error, borderColor: Colors.error },
  hangKeyText: { fontSize: 16, fontWeight: "800", color: Colors.textPrimary },

  // Memory
  memScore: { flexDirection: "row", justifyContent: "space-around", width: "100%", marginBottom: 14 },
  memScoreText: { fontSize: 14, fontWeight: "800" },
  memGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, maxWidth: BOARD },
  memCard: { width: MEM_CELL, height: MEM_CELL, borderRadius: 14, backgroundColor: Colors.primary + "15", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colors.primary + "30" },
  memCardMatched: { backgroundColor: Colors.success + "22", borderColor: Colors.success },
  memEmoji: { fontSize: Math.round(MEM_CELL * 0.5) },

  // Checkers
  ckBoard: { borderWidth: 3, borderColor: "#5C4329", borderRadius: 6, overflow: "hidden" },
  ckRow: { flexDirection: "row" },
  ckCell: { width: GRID8, height: GRID8, alignItems: "center", justifyContent: "center" },
  ckCellSel: { backgroundColor: Colors.warning },
  ckDot: { position: "absolute", width: Math.round(GRID8 * 0.36), height: Math.round(GRID8 * 0.36), borderRadius: Math.round(GRID8 * 0.18), backgroundColor: Colors.success + "CC" },
  ckPiece: { width: Math.round(GRID8 * 0.72), height: Math.round(GRID8 * 0.72), borderRadius: Math.round(GRID8 * 0.36), alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.5)" },
  ckPieceMovable: { borderColor: Colors.success, borderWidth: 2.5 },
  ckKing: { fontSize: Math.round(GRID8 * 0.38), color: "#FCD34D" },
  ckHint: { fontSize: 12, color: Colors.textSecondary, marginTop: 12, fontWeight: "600" },

  // Chess
  chessCheck: { fontSize: 14, fontWeight: "900", color: Colors.error, marginBottom: 6 },
  chBoard: { borderWidth: 3, borderColor: "#4B5320", borderRadius: 4, overflow: "hidden" },
  chRow: { flexDirection: "row" },
  chCell: { width: GRID8, height: GRID8, alignItems: "center", justifyContent: "center" },
  chCellSel: { backgroundColor: "#BACA2B" },
  chCellCheck: { backgroundColor: Colors.error + "99" },
  chGlyph: { fontSize: Math.round(GRID8 * 0.74), lineHeight: Math.round(GRID8 * 0.9) },
  chGlyphWhite: { textShadowColor: "#000", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 1.5 },
  chDot: { position: "absolute", width: Math.round(GRID8 * 0.36), height: Math.round(GRID8 * 0.36), borderRadius: Math.round(GRID8 * 0.18), backgroundColor: "rgba(0,0,0,0.35)" },
  chCapture: { position: "absolute", width: GRID8 - 2, height: GRID8 - 2, borderRadius: (GRID8 - 2) / 2, borderWidth: 4, borderColor: "rgba(0,0,0,0.35)" },

});

// ─── Trash card visuals ───────────────────────────────────────────────────────
const cs = StyleSheet.create({
  // Card face
  card: {
    borderRadius: 9, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  cardBack: { backgroundColor: "#5B3FA8", borderColor: "#4C2F94" },
  backInner: {
    flex: 1, alignSelf: "stretch", margin: 5, borderRadius: 6,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center", justifyContent: "center",
  },
  backGlyph: { color: "rgba(255,255,255,0.55)", fontWeight: "900" },
  corner: { position: "absolute", fontWeight: "900" },
  cornerTL: { top: 3, left: 5 },
  cornerBR: { bottom: 3, right: 5, transform: [{ rotate: "180deg" }] },
  pip: { fontWeight: "800" },

  // Player row
  row: { width: "100%", borderRadius: 14, padding: 10, marginBottom: 10, borderWidth: 2, borderColor: "transparent" },
  rowActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "0C" },
  rowLabel: { fontSize: 14, fontWeight: "800", marginBottom: 8 },
  slots: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" },
  slotEmpty: {
    width: 44, height: 62, borderRadius: 9, backgroundColor: Colors.surfaceLight,
    borderWidth: 1.5, borderColor: Colors.border, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
  },
  slotEmptyActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "10" },
  slotNum: { fontSize: 15, color: Colors.textMuted, fontWeight: "800" },

  // Draw piles
  piles: { flexDirection: "row", gap: 28, marginTop: 14, alignItems: "flex-start", justifyContent: "center", minHeight: 150 },
  pileBtn: { alignItems: "center", gap: 4 },
  pileDisabled: { opacity: 0.4 },
  pileEmpty: {
    width: 86, height: 122, borderRadius: 9, borderWidth: 2, borderStyle: "dashed",
    borderColor: Colors.border, alignItems: "center", justifyContent: "center",
  },
  pileEmptyText: { fontSize: 28, color: Colors.textMuted },
  pileLabel: { fontSize: 13, fontWeight: "800", color: Colors.textPrimary, marginTop: 4 },
  pileCount: { fontSize: 11, color: Colors.textSecondary },
  floatCard: { position: "absolute", top: -8, left: "50%", marginLeft: -43 },

  log: { fontSize: 12.5, color: Colors.textSecondary, marginTop: 14, textAlign: "center", lineHeight: 18, minHeight: 36, paddingHorizontal: 8 },
});
