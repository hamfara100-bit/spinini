import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Image, Linking, Alert,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useData } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";
import type { FamilyVoteTopic, FamilyDiscussionLink, FamilyVoteComment, VoteOption } from "../../../../lib/data/types";
import { VOTE_TOPIC_META } from "../../../../lib/data/types";

function getYtId(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function VoteBar({ count, total, color }: { count: number; total: number; color: string }) {
  const pct = total === 0 ? 0 : Math.round((count / total) * 100);
  return (
    <View style={{ height: 6, backgroundColor: color + "25", borderRadius: 3, marginTop: 4 }}>
      <View style={{ height: 6, width: `${pct}%`, backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

export default function KidFamilyVoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, dispatch } = useData();

  const kid = state.kids.find(k => k.profile.id === id);
  const topics = (state.familyVoteTopics ?? []).filter(t => t.allowedVoters.includes(id) || t.allowedVoters.length === 0);

  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<"vote" | "discuss" | "comments">("vote");
  const [newLink, setNewLink] = useState("");
  const [newComment, setNewComment] = useState("");
  const [showAddOption, setShowAddOption] = useState(false);
  const [optLabel, setOptLabel] = useState("");
  const [optDesc, setOptDesc] = useState("");
  const [optImg, setOptImg] = useState<string | undefined>(undefined);

  const selectedTopic = selectedTopicId ? state.familyVoteTopics.find(t => t.id === selectedTopicId) : null;

  function castVote(topic: FamilyVoteTopic, optionId: string) {
    if (topic.status === "closed") return;
    const hasVoted = topic.options.some(o => o.votes.includes(id));
    if (hasVoted) {
      const oldOpt = topic.options.find(o => o.votes.includes(id));
      if (oldOpt) dispatch({ type: "VOTE_RETRACT", topicId: topic.id, optionId: oldOpt.id, voterId: id });
    }
    dispatch({ type: "VOTE_CAST", topicId: topic.id, optionId, voterId: id });
  }

  function addLink() {
    if (!selectedTopic || !newLink.trim().startsWith("http")) {
      Alert.alert("Invalid link", "Please paste a valid https:// link.");
      return;
    }
    const link: FamilyDiscussionLink = { id: uid(), url: newLink.trim(), addedBy: id, createdAt: nowIso() };
    dispatch({ type: "VOTE_ADD_LINK", topicId: selectedTopic.id, link });
    setNewLink("");
  }

  function addComment() {
    if (!selectedTopic || !newComment.trim()) return;
    const comment: FamilyVoteComment = { id: uid(), authorId: id, text: newComment.trim(), createdAt: nowIso() };
    dispatch({ type: "VOTE_ADD_COMMENT", topicId: selectedTopic.id, comment });
    setNewComment("");
  }

  async function addOption() {
    if (!selectedTopic || !optLabel.trim()) return;
    // check max per person
    const myExisting = selectedTopic.options.filter(o => o.addedBy === id).length;
    if (myExisting >= selectedTopic.maxOptionsPerPerson) {
      Alert.alert("Limit reached", `You can only add ${selectedTopic.maxOptionsPerPerson} option${selectedTopic.maxOptionsPerPerson !== 1 ? "s" : ""}.`);
      return;
    }
    const option: VoteOption = {
      id: uid(), label: optLabel.trim(), description: optDesc.trim() || undefined,
      imageUri: optImg, addedBy: id, votes: [],
    };
    dispatch({ type: "VOTE_ADD_OPTION", topicId: selectedTopic.id, option });
    setOptLabel(""); setOptDesc(""); setOptImg(undefined); setShowAddOption(false);
  }

  async function pickImg() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!r.canceled) setOptImg(r.assets[0].uri);
  }

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (selectedTopic) {
    const topic = selectedTopic;
    const meta = VOTE_TOPIC_META[topic.type];
    const totalVotes = topic.options.reduce((s, o) => s + o.votes.length, 0);
    const myVotedId = topic.options.find(o => o.votes.includes(id))?.id;
    const winner = topic.status === "closed" && topic.winnerId
      ? topic.options.find(o => o.id === topic.winnerId) : null;
    const myOptCount = topic.options.filter(o => o.addedBy === id).length;
    const canAddOption = topic.status === "open" && myOptCount < topic.maxOptionsPerPerson;

    return (
      <ScreenContainer scroll bg="#FAFBFF" showBack={false}>
        <TouchableOpacity onPress={() => { setSelectedTopicId(null); setShowAddOption(false); }} style={{ marginBottom: 12 }}>
          <Text style={{ color: Colors.primary, fontWeight: "700", fontSize: 14 }}>← All Votes</Text>
        </TouchableOpacity>

        <View style={dv.topRow}>
          <Text style={{ fontSize: 32 }}>{meta.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={dv.title}>{topic.title}</Text>
            <Text style={dv.sub}>{meta.label} · {topic.status === "open" ? "🟢 Open" : "🔴 Closed"}</Text>
          </View>
        </View>
        {topic.description ? <Text style={dv.desc}>{topic.description}</Text> : null}

        {winner && (
          <View style={dv.winnerBox}>
            <Text style={dv.winnerText}>🏆 Winner: {winner.label} — {winner.votes.length} votes!</Text>
          </View>
        )}

        {/* Tabs */}
        <View style={dv.tabs}>
          {(["vote","discuss","comments"] as const).map(tab => (
            <TouchableOpacity key={tab} style={[dv.tab, detailTab === tab && dv.tabActive]} onPress={() => setDetailTab(tab)}>
              <Text style={[dv.tabText, detailTab === tab && dv.tabTextActive]}>
                {tab === "vote" ? `🗳️ Vote` : tab === "discuss" ? `🔗 Links` : `💬 Chat`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Vote tab */}
        {detailTab === "vote" && (
          <View style={{ gap: 10 }}>
            {topic.options.map(opt => {
              const isWinner = topic.winnerId === opt.id;
              const isMine = myVotedId === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[dv.optCard, isMine && { borderColor: Colors.primary, borderWidth: 2 }, isWinner && { borderColor: Colors.success, borderWidth: 2 }]}
                  onPress={() => castVote(topic, opt.id)}
                  disabled={topic.status === "closed"}
                  activeOpacity={0.85}
                >
                  {opt.imageUri && <Image source={{ uri: opt.imageUri }} style={dv.optImg} />}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={dv.optLabel}>{opt.label}</Text>
                      {isMine && <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: "700" }}>✓ Your vote</Text>}
                      {isWinner && <Text style={{ fontSize: 11, color: Colors.success, fontWeight: "700" }}>🏆</Text>}
                    </View>
                    {opt.description ? <Text style={dv.optDesc}>{opt.description}</Text> : null}
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                      <Text style={dv.voteCount}>{opt.votes.length} vote{opt.votes.length !== 1 ? "s" : ""}</Text>
                    </View>
                    <VoteBar count={opt.votes.length} total={totalVotes} color={isWinner ? Colors.success : Colors.primary} />
                  </View>
                </TouchableOpacity>
              );
            })}

            {canAddOption && (
              <>
                {showAddOption ? (
                  <View style={dv.addOptForm}>
                    <Text style={dv.addOptTitle}>Add your option ({myOptCount}/{topic.maxOptionsPerPerson})</Text>
                    <TextInput style={dv.input} value={optLabel} onChangeText={setOptLabel} placeholder="Option name…" />
                    <TextInput style={dv.input} value={optDesc} onChangeText={setOptDesc} placeholder="Description (optional)…" />
                    {optImg
                      ? <Image source={{ uri: optImg }} style={{ width: "100%", height: 120, borderRadius: 10 }} />
                      : <TouchableOpacity style={dv.imgBtn} onPress={pickImg}><Text style={dv.imgBtnText}>📷 Add Image</Text></TouchableOpacity>
                    }
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TouchableOpacity style={[dv.addBtn, { flex: 1, backgroundColor: Colors.cardLight }]} onPress={() => setShowAddOption(false)}>
                        <Text style={{ fontWeight: "700", color: Colors.textSecondary }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[dv.addBtn, { flex: 2, opacity: optLabel.trim() ? 1 : 0.4 }]} onPress={addOption} disabled={!optLabel.trim()}>
                        <Text style={{ color: "#fff", fontWeight: "700" }}>+ Add</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={dv.addOptBtn} onPress={() => setShowAddOption(true)}>
                    <Text style={dv.addOptBtnText}>+ Add Your Option ({myOptCount}/{topic.maxOptionsPerPerson})</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
            {topic.status === "open" && <Text style={dv.hint}>Tap any option to cast your vote!</Text>}
          </View>
        )}

        {/* Links tab */}
        {detailTab === "discuss" && (
          <View style={{ gap: 10 }}>
            <View style={dv.linkRow}>
              <TextInput
                style={{ flex: 1, fontSize: 13, color: Colors.textPrimary }}
                value={newLink} onChangeText={setNewLink}
                placeholder="Paste a link to share…"
                autoCapitalize="none"
              />
              <TouchableOpacity style={dv.linkBtn} onPress={addLink}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Share</Text>
              </TouchableOpacity>
            </View>
            {(topic.links ?? []).length === 0 ? (
              <View style={dv.empty}><Text style={{ fontSize: 40 }}>🔗</Text><Text style={dv.emptyText}>Be first to share a link!</Text></View>
            ) : (
              (topic.links ?? []).map(link => {
                const ytId = getYtId(link.url);
                const author = link.addedBy === "parent" ? "Parent" : state.kids.find(k => k.profile.id === link.addedBy)?.profile.name ?? link.addedBy;
                return (
                  <TouchableOpacity key={link.id} style={dv.linkCard}
                    onPress={() => Linking.openURL(link.url).catch(() => {})}>
                    {ytId
                      ? <Image source={{ uri: `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` }} style={dv.linkThumb} />
                      : <View style={[dv.linkThumb, { backgroundColor: Colors.primary + "20", alignItems: "center", justifyContent: "center" }]}><Text style={{ fontSize: 24 }}>🔗</Text></View>
                    }
                    <View style={{ flex: 1, padding: 8 }}>
                      <Text style={dv.linkUrl} numberOfLines={2}>{link.url}</Text>
                      <Text style={dv.linkBy}>Shared by {author}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* Comments tab */}
        {detailTab === "comments" && (
          <View style={{ gap: 10 }}>
            <View style={dv.linkRow}>
              <TextInput
                style={{ flex: 1, fontSize: 13, color: Colors.textPrimary }}
                value={newComment} onChangeText={setNewComment}
                placeholder="Say something…"
                multiline
              />
              <TouchableOpacity style={dv.linkBtn} onPress={addComment}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Post</Text>
              </TouchableOpacity>
            </View>
            {(topic.comments ?? []).length === 0 ? (
              <View style={dv.empty}><Text style={{ fontSize: 40 }}>💬</Text><Text style={dv.emptyText}>Start the conversation!</Text></View>
            ) : (
              [...(topic.comments ?? [])].reverse().map(c => {
                const isMe = c.authorId === id;
                const authorName = c.authorId === "parent" ? "Parent" : state.kids.find(k => k.profile.id === c.authorId)?.profile.name ?? c.authorId;
                return (
                  <View key={c.id} style={[dv.commentCard, isMe && { backgroundColor: Colors.primary + "10" }]}>
                    <Text style={dv.commentAuthor}>{isMe ? "💬 You" : `💬 ${authorName}`}</Text>
                    <Text style={dv.commentText}>{c.text}</Text>
                    <Text style={dv.commentTime}>{new Date(c.createdAt).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</Text>
                  </View>
                );
              })
            )}
          </View>
        )}
      </ScreenContainer>
    );
  }

  // ── List view ───────────────────────────────────────────────────────────────
  return (
    <ScreenContainer scroll>
      <Text style={s.title}>🎬 Family Vote</Text>
      <Text style={s.sub}>Vote on movies, food, trips and more!</Text>

      {topics.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 64 }}>🗳️</Text>
          <Text style={s.emptyTitle}>No votes yet!</Text>
          <Text style={s.emptySub}>Your parent will create a vote here. You can vote on:</Text>
          <View style={s.hintGrid}>
            {(["movie","food","vacation","weekend"] as const).map(t => {
              const m = VOTE_TOPIC_META[t];
              return (
                <View key={t} style={s.hintCard}>
                  <Text style={{ fontSize: 30 }}>{m.emoji}</Text>
                  <Text style={s.hintLabel}>{m.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {topics.map(topic => {
            const meta = VOTE_TOPIC_META[topic.type];
            const totalVotes = topic.options.reduce((s, o) => s + o.votes.length, 0);
            const hasVoted = topic.options.some(o => o.votes.includes(id));
            const winner = topic.status === "closed" && topic.winnerId ? topic.options.find(o => o.id === topic.winnerId) : null;
            return (
              <TouchableOpacity key={topic.id} style={s.card} onPress={() => { setSelectedTopicId(topic.id); setDetailTab("vote"); }} activeOpacity={0.85}>
                <View style={s.cardHeader}>
                  <View style={[s.typeChip, { backgroundColor: topic.status === "closed" ? "#F0FDF4" : "#EFF6FF" }]}>
                    <Text style={{ fontSize: 16 }}>{meta.emoji}</Text>
                    <Text style={[s.chipText, { color: topic.status === "closed" ? Colors.success : Colors.primary }]}>
                      {meta.label} {topic.status === "closed" ? "· Closed" : "· Open"}
                    </Text>
                  </View>
                  {topic.status === "open" && !hasVoted && (
                    <View style={s.badge}><Text style={s.badgeText}>Vote now!</Text></View>
                  )}
                  {hasVoted && <View style={s.votedBadge}><Text style={s.votedText}>✓ Voted</Text></View>}
                </View>
                <Text style={s.cardTitle}>{topic.title}</Text>
                {winner && <Text style={s.winnerText}>🏆 {winner.label} won!</Text>}
                <Text style={s.cardMeta}>{topic.options.length} options · {totalVotes} votes</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScreenContainer>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "800", color: Colors.primary, marginBottom: 4 },
  sub: { fontSize: 13, color: Colors.textSecondary, marginBottom: 16 },
  empty: { alignItems: "center", paddingTop: 30, gap: 12 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: Colors.textPrimary },
  emptySub: { fontSize: 13, color: Colors.textSecondary, textAlign: "center" },
  hintGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  hintCard: { width: "44%", backgroundColor: Colors.surfaceLight, borderRadius: 16, padding: 14, alignItems: "center", gap: 4, ...Shadow.sm },
  hintLabel: { fontSize: 13, fontWeight: "700", color: Colors.textPrimary, textAlign: "center" },
  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm, gap: 6 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  typeChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, fontWeight: "700" },
  badge: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  votedBadge: { backgroundColor: Colors.success + "20", borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  votedText: { color: Colors.success, fontSize: 11, fontWeight: "700" },
  cardTitle: { fontSize: 16, fontWeight: "800", color: Colors.textPrimary },
  winnerText: { fontSize: 13, fontWeight: "700", color: Colors.success },
  cardMeta: { fontSize: 11, color: Colors.textMuted },
});

const dv = StyleSheet.create({
  topRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: "800", color: Colors.textPrimary },
  sub: { fontSize: 12, color: Colors.textSecondary },
  desc: { fontSize: 14, color: Colors.textSecondary, marginBottom: 12 },
  winnerBox: { backgroundColor: Colors.success + "15", borderRadius: 12, padding: 10, marginBottom: 12 },
  winnerText: { fontSize: 14, fontWeight: "700", color: Colors.success, textAlign: "center" },
  tabs: { flexDirection: "row", gap: 6, marginBottom: 12 },
  tab: { flex: 1, paddingVertical: 8, backgroundColor: Colors.cardLight, borderRadius: Radius.full, alignItems: "center" },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { fontSize: 11, fontWeight: "700", color: Colors.textSecondary },
  tabTextActive: { color: "#fff" },
  optCard: { backgroundColor: Colors.surfaceLight, borderRadius: 14, padding: 12, flexDirection: "row", gap: 10, alignItems: "center", borderWidth: 1.5, borderColor: Colors.border, ...Shadow.sm },
  optImg: { width: 70, height: 52, borderRadius: 10 },
  optLabel: { fontSize: 15, fontWeight: "800", color: Colors.textPrimary },
  optDesc: { fontSize: 12, color: Colors.textSecondary },
  voteCount: { fontSize: 12, fontWeight: "700", color: Colors.primary },
  hint: { fontSize: 11, color: Colors.textMuted, textAlign: "center" },
  addOptBtn: { backgroundColor: Colors.secondary + "AA", borderRadius: Radius.full, alignItems: "center", padding: 12 },
  addOptBtnText: { fontWeight: "700", color: Colors.textPrimary, fontSize: 13 },
  addOptForm: { backgroundColor: Colors.surfaceLight, borderRadius: 14, padding: 12, gap: 8, borderWidth: 1.5, borderColor: Colors.border },
  addOptTitle: { fontSize: 14, fontWeight: "700", color: Colors.textPrimary },
  input: { borderWidth: 1.5, borderColor: Colors.border, borderRadius: Radius.md, padding: 10, fontSize: 14, color: Colors.textPrimary },
  imgBtn: { backgroundColor: Colors.primary + "12", borderRadius: 10, padding: 10, alignItems: "center" },
  imgBtnText: { fontSize: 13, color: Colors.primary, fontWeight: "600" },
  addBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", padding: 10 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.surfaceLight, borderRadius: 12, padding: 10, borderWidth: 1.5, borderColor: Colors.border },
  linkBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  linkCard: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.surfaceLight, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: Colors.border },
  linkThumb: { width: 80, height: 60 },
  linkUrl: { fontSize: 12, color: Colors.primary, fontWeight: "600" },
  linkBy: { fontSize: 11, color: Colors.textMuted },
  commentCard: { backgroundColor: Colors.surfaceLight, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border },
  commentAuthor: { fontSize: 12, fontWeight: "800", color: Colors.textPrimary, marginBottom: 4 },
  commentText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  commentTime: { fontSize: 11, color: Colors.textMuted, marginTop: 4 },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: "center" },
});
