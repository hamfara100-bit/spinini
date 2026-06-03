/**
 * OnlineGame — TRUE cross-device Game Night.
 *
 * Two people on DIFFERENT phones play the same board. The match lives in the
 * synced `state.onlineGame` so every move is relayed (Supabase realtime + P2P)
 * and both devices converge through the same reducer. Full-screen, big graphics.
 *
 * `me` is this device's player id ("parent" or a kid profile id).
 */
import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert, StatusBar, Animated } from "react-native";
import { useData } from "../lib/data/store";
import { Colors } from "../lib/theme";
import { uid, nowIso } from "../lib/utils";
import { C4_COLS, C4_ROWS } from "../lib/games/engine";
import type { OnlineGameId } from "../lib/data/types";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const SEAT_COLOR = ["#FF6B6B", "#4ECDC4"];   // seat 0 red, seat 1 teal
const SEAT_MARK  = ["✕", "◯"];

const GAMES: { id: OnlineGameId; emoji: string; name: string; sub: string }[] = [
  { id: "ttt",      emoji: "⭕", name: "Tic-Tac-Toe", sub: "Get 3 in a row" },
  { id: "connect4", emoji: "🔴", name: "Connect 4",   sub: "Drop 4 to win" },
];

export function OnlineGame({ me, meName, onExit }: { me: string; meName: string; onExit: () => void }) {
  const { state, dispatch } = useData();
  const g = state.onlineGame ?? null;
  const awardedRef = useRef(false);

  const mySeat = g?.players.find(p => p.id === me)?.seat ?? null;
  const amHost = g?.hostId === me;
  const opponent = g?.players.find(p => p.id !== me);

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
          event: { id: uid(), points: g.reward, reason: `🎮 Won online ${g.gameId === "ttt" ? "Tic-Tac-Toe" : "Connect 4"}`, date: new Date().toISOString().slice(0, 10) },
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
      board: gameId === "ttt" ? Array(9).fill(null) : Array.from({ length: C4_ROWS }, () => Array(C4_COLS).fill(null)),
      turn: 0 as const,
      winner: null,
      reward: 5,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    dispatch({ type: "OGAME_CREATE", session });
    // Invite the other family kids with a tappable notification.
    state.kids.filter(k => k.profile.id !== me).forEach(k => {
      dispatch({
        type: "NOTIFICATION_ADD",
        kidId: k.profile.id,
        notification: {
          id: uid(), kidId: k.profile.id, kind: "ping",
          title: "🎮 Game Night invite!",
          body: `${meName} wants to play ${gameId === "ttt" ? "Tic-Tac-Toe" : "Connect 4"} with you!`,
          emoji: "🎮", read: false, createdAt: nowIso(), route: "online-game",
        },
      });
    });
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
        <View style={{ gap: 14, width: "100%", maxWidth: 420, marginTop: 20 }}>
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
        </View>
        <TouchableOpacity style={s.exitBtn} onPress={onExit}><Text style={s.exitText}>← Back</Text></TouchableOpacity>
      </View>
    );
  }

  const gameName = g.gameId === "ttt" ? "Tic-Tac-Toe" : "Connect 4";

  // ── Lobby (waiting) ─────────────────────────────────────────────────────────
  if (g.status === "waiting") {
    const iAmIn = mySeat != null;
    return (
      <View style={s.root}>
        <StatusBar hidden />
        <Text style={s.bigTitle}>{g.gameId === "ttt" ? "⭕" : "🔴"} {gameName}</Text>

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
          // Host can Start anytime — solo (play both sides yourself) or wait for
          // a join to become two-player.
          <TouchableOpacity style={s.primaryBtn} onPress={() => dispatch({ type: "OGAME_START" })}>
            <Text style={s.primaryBtnText}>{g.players.length >= 2 ? "▶ Start Game" : "▶ Start (play solo)"}</Text>
          </TouchableOpacity>
        ) : (
          <View style={s.waitPill}><Text style={s.waitText}>
            {`Waiting for ${g.players[0]?.name} to start…`}
          </Text></View>
        )}
        {amHost && g.players.length < 2 && (
          <Text style={s.hintLine}>Invite sent to the family — someone can join from their Game Night, or just play solo.</Text>
        )}

        <TouchableOpacity style={s.exitBtn} onPress={endGame}><Text style={s.exitText}>✕ Cancel match</Text></TouchableOpacity>
      </View>
    );
  }

  // ── Playing / finished ──────────────────────────────────────────────────────
  // Solo = only the host is in the match → that one device plays BOTH sides.
  const isSolo = g.players.length === 1;
  const myTurn = g.status === "playing" && mySeat != null && g.turn === mySeat;
  const turnPlayer = g.players.find(p => p.seat === g.turn);
  // I can act if it's my turn (multiplayer) or always, on the host device (solo).
  const canPlay = g.status === "playing" && (isSolo ? amHost : myTurn);
  // In solo we move for whichever seat's turn it is.
  const moveSeat: 0 | 1 = isSolo ? g.turn : (mySeat ?? 0);

  function play(index: number) {
    if (!canPlay) return;
    dispatch({ type: "OGAME_MOVE", seat: moveSeat, index });
  }

  const banner = g.status === "finished"
    ? (g.winner === "draw" ? "🤝 It's a draw!"
        : isSolo ? `${SEAT_MARK[g.winner as 0 | 1]} wins!`
        : g.winner === mySeat ? "🎉 You win!"
        : `${g.players.find(p => p.seat === g.winner)?.name ?? "Opponent"} wins!`)
    : isSolo ? `${SEAT_MARK[g.turn]}'s turn — your move`
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
            <Text style={[s.scoreMark, { color: SEAT_COLOR[p.seat] }]}>{g.gameId === "ttt" ? SEAT_MARK[p.seat] : "●"}</Text>
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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {g.gameId === "ttt" ? <TTTBoard board={g.board} canPlay={canPlay} onPlay={play} /> : <C4Board board={g.board} canPlay={canPlay} onPlay={play} />}
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
function TTTBoard({ board, canPlay, onPlay }: { board: (string | null)[]; canPlay: boolean; onPlay: (i: number) => void }) {
  const SIZE = Math.min(SCREEN_W - 40, SCREEN_H * 0.5, 420);
  const cell = (SIZE - 16) / 3;
  return (
    <View style={[tt.grid, { width: SIZE, height: SIZE }]}>
      {board.map((c, i) => (
        <TouchableOpacity
          key={i}
          style={[tt.cell, { width: cell, height: cell }]}
          activeOpacity={canPlay && !c ? 0.6 : 1}
          onPress={() => !c && onPlay(i)}
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
function C4Board({ board, canPlay, onPlay }: { board: (number | null)[][]; canPlay: boolean; onPlay: (col: number) => void }) {
  const cell = Math.min((SCREEN_W - 36) / C4_COLS, (SCREEN_H * 0.52) / C4_ROWS, 52);
  return (
    <View>
      {/* Drop buttons */}
      <View style={{ flexDirection: "row", justifyContent: "center", marginBottom: 6 }}>
        {Array.from({ length: C4_COLS }).map((_, col) => (
          <TouchableOpacity
            key={col}
            style={{ width: cell, height: 28, alignItems: "center", justifyContent: "center" }}
            onPress={() => onPlay(col)}
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bgDark, alignItems: "center", justifyContent: "center", padding: 18 },
  bigTitle: { fontSize: 30, fontWeight: "900", color: "#fff", textAlign: "center", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#b9b3d6", textAlign: "center", lineHeight: 20, paddingHorizontal: 10 },
  gameCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#1c1838", borderRadius: 18, padding: 18, borderWidth: 1.5, borderColor: "#2e2a52" },
  gameEmoji: { fontSize: 38 },
  gameName: { fontSize: 18, fontWeight: "800", color: "#fff" },
  gameSub: { fontSize: 13, color: "#9b95c0", marginTop: 2 },
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
  hintLine: { color: "#8b85b0", fontSize: 12, textAlign: "center", marginTop: 12, maxWidth: 380, lineHeight: 17 },
  exitBtn: { marginTop: 20, padding: 12 },
  exitText: { color: "#8b85b0", fontWeight: "700", fontSize: 15 },
  header: { flexDirection: "row", gap: 10, width: "100%", maxWidth: 460, marginTop: 8 },
  scorePlayer: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#1c1838", borderRadius: 14, padding: 10, borderWidth: 2, borderColor: "transparent" },
  scoreName: { flex: 1, color: "#fff", fontWeight: "700", fontSize: 13 },
  scoreMark: { fontSize: 18, fontWeight: "900" },
  banner: { fontSize: 22, fontWeight: "900", color: "#fff", textAlign: "center", marginVertical: 12 },
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
