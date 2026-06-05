/**
 * OnlineGame — TRUE cross-device Game Night.
 *
 * Two people on DIFFERENT phones play the same board. The match lives in the
 * synced `state.onlineGame` so every move is relayed (Supabase realtime + P2P)
 * and both devices converge through the same reducer. Full-screen, big graphics.
 *
 * `me` is this device's player id ("parent" or a kid profile id).
 *
 * Supports all 7 Game Night games: Tic-Tac-Toe, Connect 4, Hangman, Memory,
 * Checkers, Chess, and Trash. Move shapes are per-game (see ogApply in store).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, StatusBar, Animated, ScrollView, useWindowDimensions } from "react-native";
import { useData } from "../lib/data/store";
import { Colors } from "../lib/theme";
import { uid, nowIso } from "../lib/utils";
import {
  C4_COLS, C4_ROWS,
  HANGMAN_ALPHABET, HANGMAN_MAX_WRONG, hangmanMask,
  checkersMoves, type CkMove,
  chessLegalMoves, chessStatus, type ChessState, type ChessMove, type PieceType,
  trashRankLabel, type TrashState,
} from "../lib/games/engine";
import type { OnlineGameId } from "../lib/data/types";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const SEAT_COLOR = ["#FF6B6B", "#4ECDC4"];   // seat 0 red, seat 1 teal
const SEAT_MARK  = ["✕", "◯"];

const GAMES: { id: OnlineGameId; emoji: string; name: string; sub: string }[] = [
  { id: "ttt",      emoji: "⭕",  name: "Tic-Tac-Toe", sub: "Get 3 in a row" },
  { id: "connect4", emoji: "🔴",  name: "Connect 4",   sub: "Drop 4 to win" },
  { id: "hangman",  emoji: "🔤",  name: "Hangman",     sub: "Guess the secret word" },
  { id: "memory",   emoji: "🧠",  name: "Memory Match", sub: "Find the matching pairs" },
  { id: "checkers", emoji: "🔵",  name: "Checkers",    sub: "Jump & capture" },
  { id: "chess",    emoji: "♟️",  name: "Chess",       sub: "Checkmate the king" },
  { id: "trash",    emoji: "🃏",  name: "Trash",       sub: "Fill your row 1–10 first" },
];
const gameMeta = (id: OnlineGameId) => GAMES.find(g => g.id === id)!;

function initBoard(gameId: OnlineGameId): any {
  // Mirror of ogInitBoard in the store so the host can seed the first board.
  // The engine builds these; we lazily require to avoid a heavy import cycle.
  const e = require("../lib/games/engine");
  switch (gameId) {
    case "ttt":      return e.tttEmpty();
    case "connect4": return e.c4Empty();
    case "hangman":  return { word: e.pickHangmanWord(), guessed: [], wrong: 0 };
    case "memory":   return { deck: e.memoryDeck(6), flipped: [], scores: [0, 0] };
    case "checkers": return e.checkersInit();
    case "chess":    return e.chessInit();
    case "trash":    return e.trashInit();
    default:         return e.tttEmpty();
  }
}

export function OnlineGame({ me, meName, onExit }: { me: string; meName: string; onExit: () => void }) {
  const { state, dispatch } = useData();
  const g = state.onlineGame ?? null;
  const awardedRef = useRef(false);

  const mySeat = g?.players.find(p => p.id === me)?.seat ?? null;
  const amHost = g?.hostId === me;
  const turnPlayer = g?.players.find(p => p.seat === g.turn);

  // Blink the turn banner while THIS device can act (your turn, or any turn when
  // playing solo). Declared at top level so hooks run unconditionally.
  const blink = useRef(new Animated.Value(1)).current;
  const canActNow =
    g?.status === "playing" &&
    (g.players.length === 1 ? g.hostId === me : (mySeat != null && g.turn === mySeat));
  useEffect(() => {
    if (canActNow) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(blink, { toValue: 0.25, duration: 500, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]));
      loop.start();
      return () => { loop.stop(); blink.setValue(1); };
    }
    blink.setValue(1);
  }, [canActNow]);

  // Memory: after a mismatched pair is revealed, the ACTING device clears it and
  // passes the turn (a reducer can't run timers, so we drive the delay here).
  const memFlipKey = g?.gameId === "memory" && g.status === "playing"
    ? (g.board.flipped as number[]).join(",") : "";
  useEffect(() => {
    if (!g || g.gameId !== "memory" || g.status !== "playing" || !canActNow) return;
    const fl = g.board.flipped as number[];
    if (fl.length !== 2) return;
    const [a, b] = fl;
    const match = g.board.deck[a].emoji === g.board.deck[b].emoji;
    if (match) return; // matches clear instantly in the reducer
    const t = setTimeout(() => dispatch({ type: "OGAME_MOVE", seat: g.turn, move: { clear: true } }), 1000);
    return () => clearTimeout(t);
  }, [memFlipKey, canActNow]);

  // Host awards ⭐ to the winning kid once, when a match finishes.
  useEffect(() => {
    if (!g || g.status !== "finished" || !amHost || awardedRef.current) return;
    awardedRef.current = true;
    if (g.winner === 0 || g.winner === 1) {
      const winnerPlayer = g.players.find(p => p.seat === g.winner);
      if (winnerPlayer && winnerPlayer.id !== "parent" && g.reward > 0) {
        dispatch({
          type: "BEHAVIOR_ADD_EVENT",
          kidId: winnerPlayer.id,
          event: { id: uid(), points: g.reward, reason: `🎮 Won online ${gameMeta(g.gameId).name}`, date: new Date().toISOString().slice(0, 10) },
        });
      }
    }
  }, [g?.status]);
  useEffect(() => { if (g?.status === "playing") awardedRef.current = false; }, [g?.status, g?.id]);

  function createGame(gameId: OnlineGameId) {
    const session = {
      id: uid(),
      gameId,
      status: "waiting" as const,
      hostId: me,
      players: [{ id: me, name: meName, seat: 0 as const }],
      board: initBoard(gameId),
      turn: 0 as const,
      winner: null,
      reward: 5,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    dispatch({ type: "OGAME_CREATE", session });
    // Invitations are now explicit — the host picks who to ring from the lobby
    // (each sends a loud "join the game" alarm to that family member's device).
  }

  function endGame() {
    Alert.alert("End this game?", "This ends the match and returns to the game list.", [
      { text: "Cancel", style: "cancel" },
      { text: "End game", style: "destructive", onPress: () => dispatch({ type: "OGAME_END" }) },
    ]);
  }

  // ── No active session → pick a game to host ─────────────────────────────────
  if (!g) {
    return (
      <View style={s.root}>
        <StatusBar hidden />
        <Text style={s.bigTitle}>🌐 Play Online</Text>
        <Text style={s.subtitle}>Start a match — someone on another phone can join from their Game Night.</Text>
        <ScrollView style={{ width: "100%", maxWidth: 460, marginTop: 16 }} contentContainerStyle={{ gap: 12, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
          {GAMES.map(game => (
            <TouchableOpacity key={game.id} style={s.gameCard} onPress={() => createGame(game.id)} activeOpacity={0.85}>
              <Text style={s.gameEmoji}>{game.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.gameName}>{game.name}</Text>
                <Text style={s.gameSub}>{game.sub}</Text>
              </View>
              <Text style={s.gameArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={s.exitBtn} onPress={onExit}><Text style={s.exitText}>← Back</Text></TouchableOpacity>
      </View>
    );
  }

  const meta = gameMeta(g.gameId);

  // ── Lobby (waiting) ─────────────────────────────────────────────────────────
  if (g.status === "waiting") {
    const iAmIn = mySeat != null;
    return (
      <View style={s.root}>
        <StatusBar hidden />
        <Text style={s.bigTitle}>{meta.emoji} {meta.name}</Text>

        <View style={s.lobbyCard}>
          {g.players.map(p => (
            <View key={p.id} style={s.playerRow}>
              <View style={[s.seatDot, { backgroundColor: SEAT_COLOR[p.seat] }]} />
              <Text style={s.playerName}>{p.name}{p.id === me ? " (you)" : ""}</Text>
              <Text style={s.playerSeat}>{p.seat === 0 ? "Host" : "Joined ✅"}</Text>
            </View>
          ))}
          {g.players.length < 2 && (
            <View style={s.playerRow}>
              <View style={[s.seatDot, { backgroundColor: "#3a3a55" }]} />
              <Text style={[s.playerName, { color: "#8b8ba8" }]}>Waiting for a player…</Text>
            </View>
          )}
        </View>

        {/* Actions depend on who I am */}
        {!iAmIn && g.players.length < 2 ? (
          <TouchableOpacity style={s.primaryBtn} onPress={() => dispatch({ type: "OGAME_JOIN", playerId: me, playerName: meName })}>
            <Text style={s.primaryBtnText}>Join {g.players[0]?.name}'s game ✋</Text>
          </TouchableOpacity>
        ) : amHost ? (
          <TouchableOpacity style={s.primaryBtn} onPress={() => dispatch({ type: "OGAME_START" })}>
            <Text style={s.primaryBtnText}>{g.players.length >= 2 ? "▶ Start Game" : "▶ Start (play solo)"}</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.waitPill}><Text style={s.waitText}>
            {`Waiting for ${g.players[0]?.name} to start…`}
          </Text></View>
        )}
        {/* Ring a specific family member to join — loud alarm on their device. */}
        {amHost && g.players.length < 2 && (() => {
          const members = [
            { id: "parent", name: state.parentSettings.name || state.parent.name || "Parent" },
            ...state.kids.map(k => ({ id: k.profile.id, name: k.profile.name })),
          ].filter(m => m.id !== me && !g.players.some(p => p.id === m.id));
          if (members.length === 0) return null;
          return (
            <View style={s.inviteBox}>
              <Text style={s.inviteTitle}>🔔 Send a join alarm to:</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {members.map(m => {
                  const pending = (state.gameInvites ?? []).some(i => i.toId === m.id);
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[s.inviteChip, pending && s.inviteChipSent]}
                      onPress={() => dispatch({
                        type: "OGAME_INVITE",
                        invite: { id: uid(), toId: m.id, toName: m.name, fromId: me, fromName: meName, gameId: g.gameId, gameName: meta.name, createdAt: nowIso() },
                      })}
                    >
                      <Text style={[s.inviteChipText, pending && { color: "#fff" }]}>
                        {pending ? `🔔 ${m.name} — ring again` : `${m.id === "parent" ? "👤" : "🧒"} Invite ${m.name}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={s.hintLine}>They'll get a loud alarm to join — or just press Start to play solo.</Text>
            </View>
          );
        })()}

        <TouchableOpacity style={s.exitBtn} onPress={endGame}><Text style={s.exitText}>✕ Cancel match</Text></TouchableOpacity>
      </View>
    );
  }

  // ── Playing / finished ──────────────────────────────────────────────────────
  const isSolo = g.players.length === 1;
  const myTurn = g.status === "playing" && mySeat != null && g.turn === mySeat;
  const canPlay = g.status === "playing" && (isSolo ? amHost : myTurn);

  // Every move is made for the seat whose turn it is (solo plays both sides).
  function play(move: any) {
    if (!canPlay || !g) return;
    dispatch({ type: "OGAME_MOVE", seat: g.turn, move });
  }

  const banner = g.status === "finished"
    ? (g.winner === "draw" ? "🤝 It's a draw!"
        : isSolo ? `${g.players.find(p => p.seat === g.winner)?.name ?? SEAT_MARK[g.winner as 0 | 1]} wins!`
        : g.winner === mySeat ? "🎉 You win!"
        : `${g.players.find(p => p.seat === g.winner)?.name ?? "Opponent"} wins!`)
    : isSolo ? `${turnPlayer?.name ?? SEAT_MARK[g.turn]}'s turn`
    : (myTurn ? "▶ YOUR TURN" : `⏳ Waiting for ${turnPlayer?.name ?? "opponent"}…`);

  return (
    <View style={s.root}>
      <StatusBar hidden />
      {/* Scoreboard header */}
      <View style={s.header}>
        {g.players.map(p => (
          <View key={p.id} style={[s.scorePlayer, g.turn === p.seat && g.status === "playing" && { borderColor: SEAT_COLOR[p.seat], borderWidth: 2 }]}>
            <View style={[s.seatDot, { backgroundColor: SEAT_COLOR[p.seat] }]} />
            <Text style={s.scoreName} numberOfLines={1}>{p.name}{p.id === me ? " (you)" : ""}</Text>
            {g.gameId === "memory"
              ? <Text style={[s.scoreMark, { color: SEAT_COLOR[p.seat] }]}>{(g.board.scores as number[])[p.seat]}</Text>
              : <Text style={[s.scoreMark, { color: SEAT_COLOR[p.seat] }]}>{g.gameId === "ttt" ? SEAT_MARK[p.seat] : "●"}</Text>}
          </View>
        ))}
      </View>

      <Animated.Text
        style={[
          s.banner,
          g.status === "finished" && { color: Colors.warning },
          canActNow && { color: Colors.success, opacity: blink },
        ]}
      >
        {banner}
      </Animated.Text>

      {/* Board */}
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", width: "100%" }}>
        {g.gameId === "ttt"      && <TTTBoard board={g.board} canPlay={canPlay} onMove={play} />}
        {g.gameId === "connect4" && <C4Board board={g.board} canPlay={canPlay} onMove={play} />}
        {g.gameId === "hangman"  && <HangmanBoard board={g.board} canPlay={canPlay} onMove={play} />}
        {g.gameId === "memory"   && <MemoryBoard board={g.board} canPlay={canPlay} onMove={play} />}
        {g.gameId === "checkers" && <CheckersBoard board={g.board} turn={g.turn} canPlay={canPlay} onMove={play} />}
        {g.gameId === "chess"    && <ChessBoard state={g.board} turn={g.turn} canPlay={canPlay} onMove={play} />}
        {g.gameId === "trash"    && <TrashBoard state={g.board} seat={g.turn} canPlay={canPlay} onMove={play} />}
      </View>

      {/* Footer actions */}
      <View style={s.footer}>
        {g.status === "finished" && (
          <TouchableOpacity style={[s.primaryBtn, { flex: 1 }]} onPress={() => { awardedRef.current = false; dispatch({ type: "OGAME_RESET" }); }}>
            <Text style={s.primaryBtnText}>🔁 Rematch</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[s.exitBtn, { marginTop: 0 }]} onPress={endGame}><Text style={s.exitText}>✕ Leave</Text></TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Tic-Tac-Toe board ────────────────────────────────────────────────────────
function TTTBoard({ board, canPlay, onMove }: { board: (string | null)[]; canPlay: boolean; onMove: (m: any) => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const SIZE = Math.min(W - 32, H - 230);
  const cell = (SIZE - 16) / 3;
  return (
    <View style={[tt.grid, { width: SIZE, height: SIZE }]}>
      {board.map((c, i) => (
        <TouchableOpacity
          key={i}
          style={[tt.cell, { width: cell, height: cell }]}
          activeOpacity={canPlay && !c ? 0.6 : 1}
          onPress={() => !c && onMove(i)}
          disabled={!canPlay || !!c}
        >
          <Text style={[tt.mark, { color: c === "X" ? SEAT_COLOR[0] : SEAT_COLOR[1] }]}>
            {c === "X" ? "✕" : c === "O" ? "◯" : ""}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Connect 4 board ──────────────────────────────────────────────────────────
function C4Board({ board, canPlay, onMove }: { board: (number | null)[][]; canPlay: boolean; onMove: (m: any) => void }) {
  const { width: W, height: H } = useWindowDimensions();
  const cell = Math.floor(Math.min((W - 24) / C4_COLS, (H - 260) / C4_ROWS));
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "center", marginBottom: 6 }}>
        {Array.from({ length: C4_COLS }).map((_, col) => (
          <TouchableOpacity
            key={col}
            style={{ width: cell, height: 28, alignItems: "center", justifyContent: "center" }}
            onPress={() => onMove(col)}
            disabled={!canPlay || board[0][col] != null}
          >
            <Text style={{ fontSize: 18, color: canPlay && board[0][col] == null ? Colors.warning : "#3a3a55" }}>▼</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={c4.board}>
        {board.map((row, r) => (
          <View key={r} style={{ flexDirection: "row" }}>
            {row.map((seat, c) => (
              <View key={c} style={[c4.cell, { width: cell, height: cell }]}>
                <View style={[c4.disc, { width: cell * 0.78, height: cell * 0.78, backgroundColor: seat == null ? "#1a1633" : SEAT_COLOR[seat] }]} />
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Hangman board ────────────────────────────────────────────────────────────
const HANGMAN_STAGES = ["😀", "🙂", "😐", "😟", "😣", "😨", "💀"];
function HangmanBoard({ board, canPlay, onMove }: { board: { word: string; guessed: string[]; wrong: number }; canPlay: boolean; onMove: (m: any) => void }) {
  const gset = new Set(board.guessed);
  const mask = hangmanMask(board.word, gset);
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={{ fontSize: 64 }}>{HANGMAN_STAGES[Math.min(board.wrong, HANGMAN_STAGES.length - 1)]}</Text>
      <Text style={{ color: "#b9b3d6", marginTop: 4 }}>Wrong: {board.wrong} / {HANGMAN_MAX_WRONG}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginVertical: 16, gap: 6 }}>
        {mask.map((ch, i) => (
          <Text key={i} style={hm.char}>{ch}</Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", maxWidth: 360, gap: 6 }}>
        {HANGMAN_ALPHABET.map(letter => {
          const used = gset.has(letter);
          const hit = used && board.word.includes(letter);
          return (
            <TouchableOpacity
              key={letter}
              style={[hm.key, used && { backgroundColor: hit ? Colors.success : Colors.error }]}
              onPress={() => onMove(letter)}
              disabled={used || !canPlay}
            >
              <Text style={[hm.keyText, used && { color: "#fff" }]}>{letter}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Memory board ─────────────────────────────────────────────────────────────
function MemoryBoard({ board, canPlay, onMove }: { board: { deck: any[]; flipped: number[]; scores: number[] }; canPlay: boolean; onMove: (m: any) => void }) {
  const busy = board.flipped.length >= 2;
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", maxWidth: 360, gap: 8 }}>
        {board.deck.map((card, idx) => {
          const show = card.matched || board.flipped.includes(idx);
          return (
            <TouchableOpacity
              key={card.id}
              style={[mm.card, card.matched && { opacity: 0.4 }]}
              onPress={() => onMove(idx)}
              disabled={!canPlay || busy || show}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 30 }}>{show ? card.emoji : "❓"}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Checkers board ───────────────────────────────────────────────────────────
const CK_PIECE_COLOR = ["#DC2626", "#1F2937"];
function CheckersBoard({ board, turn, canPlay, onMove }: { board: any[][]; turn: 0 | 1; canPlay: boolean; onMove: (m: any) => void }) {
  const [sel, setSel] = useState<[number, number] | null>(null);
  useEffect(() => { setSel(null); }, [JSON.stringify(board)]);
  const legal: CkMove[] = useMemo(() => (canPlay ? checkersMoves(board as any, turn) : []), [board, turn, canPlay]);
  const movable = useMemo(() => new Set(legal.map(m => `${m.from[0]},${m.from[1]}`)), [legal]);
  const dests = useMemo(() => sel ? legal.filter(m => m.from[0] === sel[0] && m.from[1] === sel[1]) : [], [legal, sel]);
  const destSet = useMemo(() => new Set(dests.map(m => `${m.to[0]},${m.to[1]}`)), [dests]);
  const { width: W, height: H } = useWindowDimensions();
  const cell = Math.floor(Math.min(W - 16, H - 230) / 8); // fill the screen; scales up on tablets

  function tap(r: number, c: number) {
    if (!canPlay || (r + c) % 2 === 0) return;
    if (sel && destSet.has(`${r},${c}`)) { onMove({ from: sel, to: [r, c] }); setSel(null); return; }
    if (movable.has(`${r},${c}`)) setSel(prev => prev && prev[0] === r && prev[1] === c ? null : [r, c]);
    else setSel(null);
  }

  return (
    <View style={{ alignItems: "center" }}>
      <View style={ck.board}>
        {board.map((row, r) => (
          <View key={r} style={{ flexDirection: "row" }}>
            {row.map((piece, c) => {
              const dark = (r + c) % 2 === 1;
              const isSel = sel?.[0] === r && sel?.[1] === c;
              const isDest = destSet.has(`${r},${c}`);
              return (
                <TouchableOpacity
                  key={c}
                  style={[{ width: cell, height: cell, alignItems: "center", justifyContent: "center", backgroundColor: dark ? "#7C5C3E" : "#E8D3B0" }, isSel && { backgroundColor: "#B8860B" }]}
                  onPress={() => tap(r, c)}
                  activeOpacity={dark ? 0.7 : 1}
                >
                  {isDest && <View style={{ position: "absolute", width: cell * 0.3, height: cell * 0.3, borderRadius: 999, backgroundColor: "rgba(80,200,120,0.7)" }} />}
                  {piece && (
                    <View style={{ width: cell * 0.72, height: cell * 0.72, borderRadius: 999, backgroundColor: CK_PIECE_COLOR[piece.seat], alignItems: "center", justifyContent: "center", borderWidth: movable.has(`${r},${c}`) ? 2 : 0, borderColor: "#FFD700" }}>
                      {piece.king && <Text style={{ color: "#FFD700", fontSize: cell * 0.4 }}>♛</Text>}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
      <Text style={s.hintLine}>{sel ? "Tap a glowing square to move" : canPlay ? "Tap one of your pieces" : ""}</Text>
    </View>
  );
}

// ─── Chess board ──────────────────────────────────────────────────────────────
const CHESS_GLYPH: Record<PieceType, string> = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" };
const CHESS_PIECE_COLOR = ["#F8FAFC", "#111827"];
function ChessBoard({ state, turn, canPlay, onMove }: { state: ChessState; turn: 0 | 1; canPlay: boolean; onMove: (m: any) => void }) {
  const [sel, setSel] = useState<[number, number] | null>(null);
  useEffect(() => { setSel(null); }, [JSON.stringify(state.board)]);
  const status = useMemo(() => chessStatus(state), [state]);
  const legal: ChessMove[] = useMemo(() => (canPlay ? chessLegalMoves(state, turn) : []), [state, turn, canPlay]);
  const movable = useMemo(() => new Set(legal.map(m => `${m.from[0]},${m.from[1]}`)), [legal]);
  const dests = useMemo(() => sel ? legal.filter(m => m.from[0] === sel[0] && m.from[1] === sel[1]) : [], [legal, sel]);
  const destSet = useMemo(() => new Set(dests.map(m => `${m.to[0]},${m.to[1]}`)), [dests]);
  const { width: W, height: H } = useWindowDimensions();
  const cell = Math.floor(Math.min(W - 16, H - 230) / 8); // fill the screen; scales up on tablets

  function tap(r: number, c: number) {
    if (!canPlay) return;
    if (sel && destSet.has(`${r},${c}`)) { onMove({ from: sel, to: [r, c] }); setSel(null); return; }
    if (movable.has(`${r},${c}`)) setSel(prev => prev && prev[0] === r && prev[1] === c ? null : [r, c]);
    else setSel(null);
  }

  return (
    <View style={{ alignItems: "center" }}>
      {status === "check" && <Text style={{ color: Colors.error, fontWeight: "800", marginBottom: 4 }}>⚠️ Check!</Text>}
      <View style={ch.board}>
        {state.board.map((row, r) => (
          <View key={r} style={{ flexDirection: "row" }}>
            {row.map((piece, c) => {
              const light = (r + c) % 2 === 0;
              const isSel = sel?.[0] === r && sel?.[1] === c;
              const isDest = destSet.has(`${r},${c}`);
              return (
                <TouchableOpacity
                  key={c}
                  style={[{ width: cell, height: cell, alignItems: "center", justifyContent: "center", backgroundColor: light ? "#EBECD0" : "#779556" }, isSel && { backgroundColor: "#BBCB2B" }]}
                  onPress={() => tap(r, c)}
                  activeOpacity={0.7}
                >
                  {isDest && <View style={{ position: "absolute", width: piece ? cell : cell * 0.3, height: piece ? cell : cell * 0.3, borderRadius: 999, borderWidth: piece ? 3 : 0, borderColor: "rgba(200,40,40,0.6)", backgroundColor: piece ? "transparent" : "rgba(40,40,40,0.35)" }} />}
                  {piece && (
                    <Text style={{ fontSize: cell * 0.7, color: CHESS_PIECE_COLOR[piece.seat], textShadowColor: piece.seat === 0 ? "#000" : "transparent", textShadowRadius: 1 }}>
                      {CHESS_GLYPH[piece.type as PieceType]}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
      <Text style={s.hintLine}>{sel ? "Tap a highlighted square to move" : canPlay ? "Tap one of your pieces" : ""}</Text>
    </View>
  );
}

// ─── Trash board ──────────────────────────────────────────────────────────────
function TrashBoard({ state, seat, canPlay, onMove }: { state: TrashState; seat: 0 | 1; canPlay: boolean; onMove: (m: any) => void }) {
  const top = state.discard[state.discard.length - 1];
  return (
    <View style={{ alignItems: "center", width: "100%" }}>
      {/* Both players' rows */}
      {([0, 1] as const).map(pi => (
        <View key={pi} style={{ marginVertical: 8, alignItems: "center" }}>
          <Text style={{ color: SEAT_COLOR[pi], fontWeight: "700", marginBottom: 4 }}>{pi === seat ? "▶ " : ""}Player {pi + 1}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 4, maxWidth: 360 }}>
            {state.players[pi].slots.map((card, i) => (
              <View key={i} style={[tr.slot, card && { backgroundColor: "#fff", borderColor: "#fff" }]}>
                <Text style={[tr.slotText, card && { color: card.suit === "♥" || card.suit === "♦" ? "#DC2626" : "#1A1033" }]}>
                  {card ? `${trashRankLabel(card.rank)}${card.suit}` : i + 1}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      {/* Piles */}
      <View style={{ flexDirection: "row", gap: 20, marginTop: 14 }}>
        <TouchableOpacity style={tr.pile} onPress={() => onMove({ source: "stock" })} disabled={!canPlay}>
          <Text style={tr.pileGlyph}>🂠</Text>
          <Text style={tr.pileLabel}>Draw ({state.stock.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[tr.pile, !top && { opacity: 0.4 }]} onPress={() => top && onMove({ source: "discard" })} disabled={!canPlay || !top}>
          <Text style={[tr.pileGlyph, top ? { color: top.suit === "♥" || top.suit === "♦" ? "#DC2626" : "#1A1033" } : null]}>{top ? `${trashRankLabel(top.rank)}${top.suit}` : "—"}</Text>
          <Text style={tr.pileLabel}>Discard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgDark, alignItems: "center", justifyContent: "center", padding: 18 },
  bigTitle: { fontSize: 30, fontWeight: "900", color: "#fff", textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#b9b3d6", textAlign: "center", lineHeight: 20, paddingHorizontal: 10 },
  gameCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#1c1838", borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: "#2e2a52" },
  gameEmoji: { fontSize: 34 },
  gameName: { fontSize: 17, fontWeight: "800", color: "#fff" },
  gameSub: { fontSize: 12, color: "#9b95c0", marginTop: 2 },
  gameArrow: { fontSize: 28, color: "#6b659a" },
  lobbyCard: { width: "100%", maxWidth: 420, backgroundColor: "#1c1838", borderRadius: 18, padding: 16, gap: 12, marginVertical: 18 },
  playerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  seatDot: { width: 16, height: 16, borderRadius: 8 },
  playerName: { flex: 1, fontSize: 16, fontWeight: "700", color: "#fff" },
  playerSeat: { fontSize: 12, fontWeight: "700", color: "#9b95c0" },
  primaryBtn: { backgroundColor: Colors.primary, borderRadius: 50, paddingVertical: 16, paddingHorizontal: 30, alignItems: "center", width: "100%", maxWidth: 420 },
  primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: 17 },
  waitPill: { backgroundColor: "#1c1838", borderRadius: 50, paddingVertical: 14, paddingHorizontal: 24, borderWidth: 1, borderColor: "#2e2a52" },
  waitText: { color: "#b9b3d6", fontWeight: "700", fontSize: 15 },
  hintLine: { color: "#8b85b0", fontSize: 12, textAlign: "center", marginTop: 10, maxWidth: 380, lineHeight: 17 },
  exitBtn: { marginTop: 16, padding: 12 },
  exitText: { color: "#8b85b0", fontWeight: "700", fontSize: 15 },
  inviteBox: { width: "100%", maxWidth: 460, marginTop: 18, alignItems: "center", gap: 10 },
  inviteTitle: { color: "#d7d2f0", fontWeight: "800", fontSize: 15 },
  inviteChip: { backgroundColor: "#1c1838", borderRadius: 50, paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1.5, borderColor: "#3531a8" },
  inviteChipSent: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  inviteChipText: { color: "#d7d2f0", fontWeight: "800", fontSize: 14 },
  header: { flexDirection: "row", gap: 10, width: "100%", maxWidth: 460, marginTop: 8 },
  scorePlayer: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#1c1838", borderRadius: 14, padding: 10, borderWidth: 2, borderColor: "transparent" },
  scoreName: { flex: 1, color: "#fff", fontWeight: "700", fontSize: 13 },
  scoreMark: { fontSize: 18, fontWeight: "900" },
  banner: { fontSize: 22, fontWeight: "900", color: "#fff", textAlign: "center", marginVertical: 10 },
  footer: { flexDirection: "row", alignItems: "center", gap: 12, width: "100%", maxWidth: 460, paddingBottom: 8 },
});

const tt = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", backgroundColor: "#2e2a52", borderRadius: 16, padding: 6, gap: 4, justifyContent: "center" },
  cell: { backgroundColor: "#15122b", borderRadius: 12, alignItems: "center", justifyContent: "center", margin: 2 },
  mark: { fontSize: 56, fontWeight: "900" },
});

const c4 = StyleSheet.create({
  board: { backgroundColor: "#3531a8", borderRadius: 16, padding: 6 },
  cell: { alignItems: "center", justifyContent: "center" },
  disc: { borderRadius: 999 },
});

const hm = StyleSheet.create({
  char: { fontSize: 28, fontWeight: "900", color: "#fff", width: 26, textAlign: "center", borderBottomWidth: 2, borderColor: "#6b659a" },
  key: { width: 34, height: 40, borderRadius: 8, backgroundColor: "#2e2a52", alignItems: "center", justifyContent: "center" },
  keyText: { color: "#d7d2f0", fontWeight: "800", fontSize: 16 },
});

const mm = StyleSheet.create({
  card: { width: 52, height: 64, borderRadius: 10, backgroundColor: "#2e2a52", alignItems: "center", justifyContent: "center" },
});

const ck = StyleSheet.create({
  board: { borderWidth: 4, borderColor: "#4a3420", borderRadius: 6, overflow: "hidden" },
});

const ch = StyleSheet.create({
  board: { borderWidth: 4, borderColor: "#3a3a2a", borderRadius: 6, overflow: "hidden" },
});

const tr = StyleSheet.create({
  slot: { width: 30, height: 40, borderRadius: 5, borderWidth: 1.5, borderColor: "#3a3a55", alignItems: "center", justifyContent: "center", backgroundColor: "#1c1838" },
  slotText: { fontSize: 12, fontWeight: "800", color: "#8b85b0" },
  pile: { width: 90, height: 110, borderRadius: 12, backgroundColor: "#1c1838", borderWidth: 2, borderColor: "#3531a8", alignItems: "center", justifyContent: "center", gap: 8 },
  pileGlyph: { fontSize: 34, color: "#fff", fontWeight: "800" },
  pileLabel: { fontSize: 12, color: "#b9b3d6", fontWeight: "700" },
});
