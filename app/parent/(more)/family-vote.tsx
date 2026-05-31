import React, { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, Modal, Image, Linking,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useData } from "../../../lib/data/store";
import { ScreenContainer } from "../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../lib/theme";
import { uid, nowIso } from "../../../lib/utils";
import type {
  FamilyVoteTopic, VoteOption, VoteTopicType,
  FamilyDiscussionLink, FamilyVoteComment,
} from "../../../lib/data/types";
import { VOTE_TOPIC_META } from "../../../lib/data/types";

const TOPIC_TYPES: VoteTopicType[] = ["movie","vacation","food","weekend","holiday","discussion","custom"];

// ─── helpers ─────────────────────────────────────────────────────────────────
function getYtId(url: string) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function VoteBar({ count, total, color }: { count: number; total: number; color: string }) {
  const pct = total === 0 ? 0 : (count / total) * 100;
  return (
    <View style={{ height: 6, backgroundColor: color + "25", borderRadius: 3, marginTop: 4 }}>
      <View style={{ height: 6, width: `${pct}%`, backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

// ─── Topic Card ───────────────────────────────────────────────────────────────
function TopicCard({ topic, onOpen, onDelete, onClose }: {
  topic: FamilyVoteTopic;
  onOpen: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const meta = VOTE_TOPIC_META[topic.type];
  const totalVotes = topic.options.reduce((s, o) => s + o.votes.length, 0);
  const winner = topic.status === "closed" && topic.winnerId
    ? topic.options.find(o => o.id === topic.winnerId) : null;

  return (
    <TouchableOpacity style={tc.card} onPress={onOpen} activeOpacity={0.85}>
      <View style={tc.header}>
        <View style={[tc.typeChip, { backgroundColor: topic.status === "closed" ? "#F0FDF4" : "#EFF6FF" }]}>
          <Text style={{ fontSize: 16 }}>{meta.emoji}</Text>
          <Text style={[tc.typeLabel, { color: topic.status === "closed" ? Colors.success : Colors.primary }]}>
            {meta.label} {topic.status === "closed" ? "· Closed" : "· Open"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {topic.status === "open" && (
            <TouchableOpacity style={tc.closeBtn} onPress={onClose}>
              <Text style={tc.closeBtnText}>🏆 Close</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onDelete}><Text style={{ color: Colors.error, fontSize: 18 }}>✕</Text></TouchableOpacity>
        </View>
      </View>
      <Text style={tc.title}>{topic.title}</Text>
      {topic.description ? <Text style={tc.desc} numberOfLines={2}>{topic.description}</Text> : null}
      {winner && (
        <View style={tc.winnerBanner}>
          <Text style={tc.winnerText}>🏆 Winner: {winner.label} ({winner.votes.length} votes)</Text>
        </View>
      )}
      <View style={tc.meta}>
        <Text style={tc.metaText}>{topic.options.length} options · {totalVotes} votes · {topic.comments?.length ?? 0} comments</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Option Editor row ────────────────────────────────────────────────────────
function OptionEditorRow({ option, onRemove }: {
  option: { label: string; description?: string; imageUri?: string };
  onRemove: () => void;
}) {
  return (
    <View style={oe.row}>
      {option.imageUri && <Image source={{ uri: option.imageUri }} style={oe.thumb} />}
      <View style={{ flex: 1 }}>
        <Text style={oe.label}>{option.label}</Text>
        {option.description ? <Text style={oe.desc} numberOfLines={1}>{option.description}</Text> : null}
      </View>
      <TouchableOpacity onPress={onRemove}><Text style={{ color: Colors.error }}>✕</Text></TouchableOpacity>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ParentFamilyVoteScreen() {
  const { state, dispatch } = useData();
  const router = useRouter();

  const [selectedTopic, setSelectedTopic] = useState<FamilyVoteTopic | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create modal state
  const [step, setStep] = useState<"type" | "info" | "options">("type");
  const [newType, setNewType] = useState<VoteTopicType>("movie");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newMaxPerPerson, setNewMaxPerPerson] = useState("3");
  const [newOptions, setNewOptions] = useState<Array<{ label: string; description: string; imageUri?: string }>>([]);
  const [optLabel, setOptLabel] = useState("");
  const [optDesc, setOptDesc] = useState("");
  const [optImg, setOptImg] = useState<string | undefined>(undefined);

  // Detail view state
  const [detailTab, setDetailTab] = useState<"vote" | "discuss" | "comments">("vote");
  const [newLink, setNewLink] = useState("");
  const [newComment, setNewComment] = useState("");

  const topics = state.familyVoteTopics ?? [];

  function openTopic(t: FamilyVoteTopic) {
    setSelectedTopic(state.familyVoteTopics.find(x => x.id === t.id) ?? t);
    setDetailTab("vote");
  }

  function refreshSelected(id: string) {
    setSelectedTopic(state.familyVoteTopics.find(x => x.id === id) ?? null);
  }

  function deleteTopic(id: string) {
    Alert.alert("Delete Poll", "Remove this vote?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        dispatch({ type: "VOTE_TOPIC_DELETE", topicId: id });
        if (selectedTopic?.id === id) setSelectedTopic(null);
      }},
    ]);
  }

  function closeTopic(id: string) {
    Alert.alert("Close Poll", "This will announce the winner. Continue?", [
      { text: "Cancel", style: "cancel" },
      { text: "Close", onPress: () => {
        dispatch({ type: "VOTE_CLOSE", topicId: id });
        refreshSelected(id);
      }},
    ]);
  }

  function castVote(topicId: string, optionId: string) {
    const topic = state.familyVoteTopics.find(t => t.id === topicId);
    if (!topic || topic.status === "closed") return;
    const hasVoted = topic.options.some(o => o.votes.includes("parent"));
    if (hasVoted) {
      // retract from old, cast on new
      const oldOpt = topic.options.find(o => o.votes.includes("parent"));
      if (oldOpt) dispatch({ type: "VOTE_RETRACT", topicId, optionId: oldOpt.id, voterId: "parent" });
    }
    dispatch({ type: "VOTE_CAST", topicId, optionId, voterId: "parent" });
    refreshSelected(topicId);
  }

  async function pickOptionImage() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!r.canceled) setOptImg(r.assets[0].uri);
  }

  function addOption() {
    if (!optLabel.trim()) return;
    setNewOptions(p => [...p, { label: optLabel.trim(), description: optDesc.trim(), imageUri: optImg }]);
    setOptLabel(""); setOptDesc(""); setOptImg(undefined);
  }

  function createTopic() {
    if (!newTitle.trim() || newOptions.length < 2) {
      Alert.alert("Oops", "Add a title and at least 2 options.");
      return;
    }
    const allVoterIds = ["parent", ...state.kids.map(k => k.profile.id)];
    const topic: FamilyVoteTopic = {
      id: uid(),
      type: newType,
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      emoji: VOTE_TOPIC_META[newType].emoji,
      createdBy: "parent",
      allowedVoters: allVoterIds,
      maxOptionsPerPerson: parseInt(newMaxPerPerson) || 3,
      options: newOptions.map(o => ({
        id: uid(), label: o.label, description: o.description || undefined,
        imageUri: o.imageUri, votes: [], addedBy: "parent",
      })),
      links: [],
      comments: [],
      status: "open",
      createdAt: nowIso(),
    };
    dispatch({ type: "VOTE_TOPIC_ADD", topic });
    // Notify kids
    state.kids.forEach(k => {
      dispatch({
        type: "NOTIFICATION_ADD", kidId: k.profile.id,
        notification: {
          id: uid(), kidId: k.profile.id, kind: "ping",
          title: `${VOTE_TOPIC_META[newType].emoji} New Family Vote!`,
          body: newTitle.trim(), emoji: VOTE_TOPIC_META[newType].emoji,
          read: false, createdAt: nowIso(),
        },
      });
    });
    setShowCreate(false); resetCreate();
  }

  function resetCreate() {
    setStep("type"); setNewTitle(""); setNewDesc(""); setNewMaxPerPerson("3");
    setNewOptions([]); setOptLabel(""); setOptDesc(""); setOptImg(undefined);
  }

  function addLink() {
    if (!selectedTopic || !newLink.trim().startsWith("http")) return;
    const link: FamilyDiscussionLink = {
      id: uid(), url: newLink.trim(), addedBy: "parent", createdAt: nowIso(),
    };
    dispatch({ type: "VOTE_ADD_LINK", topicId: selectedTopic.id, link });
    setNewLink("");
    refreshSelected(selectedTopic.id);
  }

  function addComment() {
    if (!selectedTopic || !newComment.trim()) return;
    const comment: FamilyVoteComment = {
      id: uid(), authorId: "parent", text: newComment.trim(), createdAt: nowIso(),
    };
    dispatch({ type: "VOTE_ADD_COMMENT", topicId: selectedTopic.id, comment });
    setNewComment("");
    refreshSelected(selectedTopic.id);
  }

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (selectedTopic) {
    const topic = state.familyVoteTopics.find(t => t.id === selectedTopic.id) ?? selectedTopic;
    const totalVotes = topic.options.reduce((s, o) => s + o.votes.length, 0);
    const myVotedOptionId = topic.options.find(o => o.votes.includes("parent"))?.id;
    const winner = topic.status === "closed" && topic.winnerId
      ? topic.options.find(o => o.id === topic.winnerId) : null;
    const meta = VOTE_TOPIC_META[topic.type];

    return (
      <ScreenContainer scroll showBack={false}>
        <TouchableOpacity onPress={() => setSelectedTopic(null)} style={{ marginBottom: 12 }}>
          <Text style={{ color: Colors.primary, fontWeight: "700", fontSize: 14 }}>← Back to Polls</Text>
        </TouchableOpacity>
        <View style={dv.header}>
          <Text style={{ fontSize: 32 }}>{meta.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={dv.title}>{topic.title}</Text>
            <Text style={dv.sub}>{meta.label} · {topic.status === "open" ? "🟢 Open" : "🔴 Closed"}</Text>
          </View>
          {topic.status === "open" && (
            <TouchableOpacity style={dv.closeBtn} onPress={() => closeTopic(topic.id)}>
              <Text style={dv.closeBtnText}>🏆 Close</Text>
            </TouchableOpacity>
          )}
        </View>
        {topic.description ? <Text style={dv.desc}>{topic.description}</Text> : null}

        {winner && (
          <View style={dv.winner}>
            <Text style={dv.winnerText}>🏆 Winner: {winner.label} — {winner.votes.length} votes!</Text>
          </View>
        )}

        {/* Tabs */}
        <View style={dv.tabs}>
          {(["vote","discuss","comments"] as const).map(tab => (
            <TouchableOpacity key={tab} style={[dv.tab, detailTab === tab && dv.tabActive]} onPress={() => setDetailTab(tab)}>
              <Text style={[dv.tabText, detailTab === tab && dv.tabTextActive]}>
                {tab === "vote" ? `🗳️ Vote (${totalVotes})` : tab === "discuss" ? `🔗 Links (${topic.links?.length ?? 0})` : `💬 Chat (${topic.comments?.length ?? 0})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Vote tab */}
        {detailTab === "vote" && (
          <View style={{ gap: 10 }}>
            {topic.options.map(opt => {
              const isWinner = topic.winnerId === opt.id;
              const isMine = myVotedOptionId === opt.id;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[dv.optCard, isMine && { borderColor: Colors.primary, borderWidth: 2 }, isWinner && { borderColor: Colors.success, borderWidth: 2 }]}
                  onPress={() => castVote(topic.id, opt.id)}
                  disabled={topic.status === "closed"}
                  activeOpacity={0.85}
                >
                  {opt.imageUri && <Image source={{ uri: opt.imageUri }} style={dv.optImg} />}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={dv.optLabel}>{opt.label}</Text>
                      {isMine && <Text style={{ fontSize: 11, color: Colors.primary, fontWeight: "700" }}>✓ You voted</Text>}
                      {isWinner && <Text style={{ fontSize: 11, color: Colors.success, fontWeight: "700" }}>🏆 Winner</Text>}
                    </View>
                    {opt.description ? <Text style={dv.optDesc}>{opt.description}</Text> : null}
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                      <Text style={dv.voteCount}>{opt.votes.length} vote{opt.votes.length !== 1 ? "s" : ""}</Text>
                    </View>
                    <VoteBar count={opt.votes.length} total={totalVotes} color={isWinner ? Colors.success : Colors.primary} />
                  </View>
                </TouchableOpacity>
              );
            })}
            {topic.status === "open" && (
              <Text style={dv.tapHint}>Tap an option to cast your vote · Kids can vote in their app</Text>
            )}
          </View>
        )}

        {/* Discussion / Links tab */}
        {detailTab === "discuss" && (
          <View style={{ gap: 10 }}>
            <View style={dv.linkInput}>
              <TextInput
                style={{ flex: 1, fontSize: 13, color: Colors.textPrimary }}
                value={newLink} onChangeText={setNewLink}
                placeholder="Paste a YouTube, TikTok or news link…"
                autoCapitalize="none"
              />
              <TouchableOpacity style={dv.addLinkBtn} onPress={addLink}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Add</Text>
              </TouchableOpacity>
            </View>
            {(topic.links ?? []).length === 0 ? (
              <View style={dv.empty}>
                <Text style={{ fontSize: 40 }}>🔗</Text>
                <Text style={dv.emptyText}>No links yet — share a video or article to discuss!</Text>
              </View>
            ) : (
              (topic.links ?? []).map(link => {
                const ytId = getYtId(link.url);
                return (
                  <TouchableOpacity key={link.id} style={dv.linkCard}
                    onPress={() => Linking.openURL(link.url).catch(() => {})}>
                    {ytId
                      ? <Image source={{ uri: `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` }} style={dv.linkThumb} />
                      : <View style={[dv.linkThumb, { backgroundColor: Colors.primary + "20", alignItems: "center", justifyContent: "center" }]}><Text style={{ fontSize: 26 }}>🔗</Text></View>
                    }
                    <View style={{ flex: 1 }}>
                      <Text style={dv.linkUrl} numberOfLines={2}>{link.url}</Text>
                      <Text style={dv.linkBy}>Added by {link.addedBy === "parent" ? "You" : state.kids.find(k => k.profile.id === link.addedBy)?.profile.name ?? link.addedBy}</Text>
                    </View>
                    <TouchableOpacity onPress={() => dispatch({ type: "VOTE_REMOVE_LINK", topicId: topic.id, linkId: link.id })}>
                      <Text style={{ color: Colors.error }}>✕</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* Comments tab */}
        {detailTab === "comments" && (
          <View style={{ gap: 10 }}>
            <View style={dv.linkInput}>
              <TextInput
                style={{ flex: 1, fontSize: 13, color: Colors.textPrimary }}
                value={newComment} onChangeText={setNewComment}
                placeholder="Add your thoughts…"
                multiline
              />
              <TouchableOpacity style={dv.addLinkBtn} onPress={addComment}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Post</Text>
              </TouchableOpacity>
            </View>
            {(topic.comments ?? []).length === 0 ? (
              <View style={dv.empty}>
                <Text style={{ fontSize: 40 }}>💬</Text>
                <Text style={dv.emptyText}>No comments yet — start the conversation!</Text>
              </View>
            ) : (
              [...(topic.comments ?? [])].reverse().map(c => {
                const kidName = c.authorId === "parent" ? null : state.kids.find(k => k.profile.id === c.authorId)?.profile.name;
                return (
                  <View key={c.id} style={[dv.commentCard, c.authorId === "parent" && { backgroundColor: Colors.primary + "10" }]}>
                    <Text style={dv.commentAuthor}>{c.authorId === "parent" ? "👤 You (Parent)" : `👦 ${kidName ?? c.authorId}`}</Text>
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
    <ScreenContainer scroll showBack={false}>
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Text style={s.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={s.title}>🎬 Family Vote</Text>
        <TouchableOpacity style={s.createBtn} onPress={() => { resetCreate(); setShowCreate(true); }}>
          <Text style={s.createBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      {topics.length === 0 ? (
        <View style={s.empty}>
          <Text style={{ fontSize: 64 }}>🗳️</Text>
          <Text style={s.emptyTitle}>Start Your First Family Vote!</Text>
          <View style={s.hintGrid}>
            {TOPIC_TYPES.map(t => {
              const m = VOTE_TOPIC_META[t];
              return (
                <View key={t} style={s.hintCard}>
                  <Text style={{ fontSize: 28 }}>{m.emoji}</Text>
                  <Text style={s.hintLabel}>{m.label}</Text>
                  <Text style={s.hintDesc}>{m.hint}</Text>
                </View>
              );
            })}
          </View>
          <TouchableOpacity style={s.bigCreateBtn} onPress={() => { resetCreate(); setShowCreate(true); }}>
            <Text style={s.bigCreateText}>🎬 Create a Vote</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          {topics.map(t => (
            <TopicCard
              key={t.id}
              topic={t}
              onOpen={() => openTopic(t)}
              onDelete={() => deleteTopic(t.id)}
              onClose={() => closeTopic(t.id)}
            />
          ))}
        </View>
      )}

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: Colors.background ?? "#FAF7FF" }}>
          <View style={cm.topBar}>
            <TouchableOpacity onPress={() => { setShowCreate(false); resetCreate(); }}>
              <Text style={{ color: Colors.error, fontWeight: "700" }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={cm.modalTitle}>
              {step === "type" ? "Pick Topic Type" : step === "info" ? "Poll Details" : "Add Options"}
            </Text>
            {step !== "type" ? (
              <TouchableOpacity onPress={() => setStep(step === "info" ? "type" : "info")}>
                <Text style={{ color: Colors.textSecondary, fontWeight: "600" }}>← Back</Text>
              </TouchableOpacity>
            ) : <View style={{ width: 60 }} />}
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: Spacing.md, gap: 14 }}>
            {step === "type" && (
              <>
                <Text style={cm.sectionLabel}>What kind of vote is this?</Text>
                {TOPIC_TYPES.map(t => {
                  const m = VOTE_TOPIC_META[t];
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[cm.typeRow, newType === t && cm.typeRowActive]}
                      onPress={() => { setNewType(t); setStep("info"); }}
                    >
                      <Text style={{ fontSize: 28 }}>{m.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={cm.typeName}>{m.label}</Text>
                        <Text style={cm.typeHint}>{m.hint}</Text>
                      </View>
                      <Text style={{ color: Colors.primary, fontSize: 18 }}>→</Text>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {step === "info" && (
              <>
                <Text style={cm.sectionLabel}>{VOTE_TOPIC_META[newType].emoji} {VOTE_TOPIC_META[newType].label}</Text>
                <Text style={cm.label}>Poll Title *</Text>
                <TextInput style={cm.input} value={newTitle} onChangeText={setNewTitle} placeholder="e.g. Movie Night Pick — This Friday!" />
                <Text style={cm.label}>Description (optional)</Text>
                <TextInput style={[cm.input, { height: 80 }]} value={newDesc} onChangeText={setNewDesc} placeholder="Add some context or rules…" multiline />
                <Text style={cm.label}>Max options each person can add</Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {["1","2","3","5","unlimited"].map(v => (
                    <TouchableOpacity key={v} style={[cm.pill, newMaxPerPerson === v && cm.pillActive]} onPress={() => setNewMaxPerPerson(v)}>
                      <Text style={[cm.pillText, newMaxPerPerson === v && cm.pillTextActive]}>{v}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity style={cm.nextBtn} onPress={() => newTitle.trim() ? setStep("options") : Alert.alert("Add a title first")}>
                  <Text style={cm.nextBtnText}>Next: Add Options →</Text>
                </TouchableOpacity>
              </>
            )}

            {step === "options" && (
              <>
                <Text style={cm.sectionLabel}>Add at least 2 options to vote on</Text>
                {newOptions.map((o, i) => (
                  <OptionEditorRow key={i} option={o} onRemove={() => setNewOptions(p => p.filter((_, j) => j !== i))} />
                ))}
                <View style={cm.optForm}>
                  <Text style={cm.label}>Option Name *</Text>
                  <TextInput style={cm.input} value={optLabel} onChangeText={setOptLabel} placeholder={newType === "movie" ? "e.g. The Lion King" : "e.g. Beach Camping"} />
                  <Text style={cm.label}>Details (optional)</Text>
                  <TextInput style={cm.input} value={optDesc} onChangeText={setOptDesc} placeholder="Extra info…" />
                  {optImg ? (
                    <View style={{ position: "relative" }}>
                      <Image source={{ uri: optImg }} style={cm.previewImg} />
                      <TouchableOpacity style={cm.removeImg} onPress={() => setOptImg(undefined)}>
                        <Text style={{ color: "#fff", fontWeight: "700" }}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={cm.imgBtn} onPress={pickOptionImage}>
                      <Text style={cm.imgBtnText}>📷 Add Image</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[cm.addOptBtn, !optLabel.trim() && { opacity: 0.4 }]} onPress={addOption} disabled={!optLabel.trim()}>
                    <Text style={cm.addOptBtnText}>+ Add Option</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[cm.nextBtn, newOptions.length < 2 && { opacity: 0.4 }]}
                  onPress={createTopic}
                  disabled={newOptions.length < 2}
                >
                  <Text style={cm.nextBtnText}>🗳️ Create Vote!</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.md },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary + "15", alignItems: "center", justifyContent: "center" },
  backIcon: { fontSize: 28, fontWeight: "300", color: Colors.primary, marginTop: -2 },
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary },
  createBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8 },
  createBtnText: { color: "#fff", fontWeight: "700", fontSize: FontSize.sm },
  empty: { alignItems: "center", paddingTop: 20, gap: 14 },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: Colors.textPrimary, textAlign: "center" },
  hintGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center", width: "100%", marginTop: 4 },
  hintCard: { width: "44%", backgroundColor: Colors.surfaceLight, borderRadius: 16, padding: 14, alignItems: "center", gap: 4, ...Shadow.sm },
  hintLabel: { fontSize: 13, fontWeight: "800", color: Colors.textPrimary, textAlign: "center" },
  hintDesc: { fontSize: 11, color: Colors.textSecondary, textAlign: "center", lineHeight: 16 },
  bigCreateBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingHorizontal: 32, paddingVertical: 14, marginTop: 8 },
  bigCreateText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
});

const tc = StyleSheet.create({
  card: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.lg, padding: Spacing.md, ...Shadow.sm, gap: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  typeChip: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  typeLabel: { fontSize: 12, fontWeight: "700" },
  closeBtn: { backgroundColor: Colors.success + "20", borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 5 },
  closeBtnText: { fontSize: 12, fontWeight: "700", color: Colors.success },
  title: { fontSize: 16, fontWeight: "800", color: Colors.textPrimary },
  desc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  winnerBanner: { backgroundColor: Colors.success + "15", borderRadius: 10, padding: 8 },
  winnerText: { fontSize: 13, fontWeight: "700", color: Colors.success, textAlign: "center" },
  meta: { flexDirection: "row" },
  metaText: { fontSize: 11, color: Colors.textMuted },
});

const dv = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: "800", color: Colors.textPrimary },
  sub: { fontSize: 12, color: Colors.textSecondary },
  closeBtn: { backgroundColor: Colors.success + "20", borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  closeBtnText: { fontSize: 12, fontWeight: "700", color: Colors.success },
  desc: { fontSize: 14, color: Colors.textSecondary, lineHeight: 20, marginBottom: 12 },
  winner: { backgroundColor: Colors.success + "15", borderRadius: 12, padding: 10, marginBottom: 12 },
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
  tapHint: { fontSize: 11, color: Colors.textMuted, textAlign: "center", marginTop: 4 },
  linkInput: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.surfaceLight, borderRadius: 12, padding: 10, borderWidth: 1.5, borderColor: Colors.border },
  addLinkBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  linkCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.surfaceLight, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: Colors.border },
  linkThumb: { width: 90, height: 64 },
  linkUrl: { fontSize: 12, color: Colors.primary, fontWeight: "600" },
  linkBy: { fontSize: 11, color: Colors.textMuted },
  commentCard: { backgroundColor: Colors.surfaceLight, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: Colors.border },
  commentAuthor: { fontSize: 12, fontWeight: "800", color: Colors.textPrimary, marginBottom: 4 },
  commentText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20 },
  commentTime: { fontSize: 11, color: Colors.textMuted, marginTop: 6 },
  empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: "center" },
});

const cm = StyleSheet.create({
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: Spacing.md, borderBottomWidth: 1, borderColor: Colors.border },
  modalTitle: { fontSize: 16, fontWeight: "800", color: Colors.textPrimary },
  sectionLabel: { fontSize: 15, fontWeight: "700", color: Colors.textSecondary, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary, marginBottom: 2 },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surfaceLight },
  typeRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: Colors.surfaceLight, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: Colors.border },
  typeRowActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + "08" },
  typeName: { fontSize: 15, fontWeight: "800", color: Colors.textPrimary },
  typeHint: { fontSize: 12, color: Colors.textSecondary },
  pill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radius.full, backgroundColor: Colors.cardLight, borderWidth: 1.5, borderColor: Colors.border },
  pillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  pillText: { fontSize: 13, fontWeight: "700", color: Colors.textSecondary },
  pillTextActive: { color: "#fff" },
  nextBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, alignItems: "center", padding: 14 },
  nextBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.base },
  optForm: { backgroundColor: Colors.surfaceLight, borderRadius: 14, padding: 12, gap: 8, borderWidth: 1.5, borderColor: Colors.border },
  addOptBtn: { backgroundColor: Colors.secondary + "DD", borderRadius: Radius.full, alignItems: "center", padding: 10 },
  addOptBtnText: { color: Colors.textPrimary, fontWeight: "700" },
  imgBtn: { backgroundColor: Colors.primary + "12", borderRadius: 10, padding: 10, alignItems: "center", borderWidth: 1, borderColor: Colors.primary + "30" },
  imgBtnText: { fontSize: 13, color: Colors.primary, fontWeight: "600" },
  previewImg: { width: "100%", height: 130, borderRadius: 10 },
  removeImg: { position: "absolute", top: 6, right: 6, backgroundColor: Colors.error, borderRadius: 12, width: 24, height: 24, alignItems: "center", justifyContent: "center" },
});

const oe = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.cardLight, borderRadius: 10, padding: 10 },
  thumb: { width: 50, height: 36, borderRadius: 6 },
  label: { fontSize: 14, fontWeight: "700", color: Colors.textPrimary },
  desc: { fontSize: 12, color: Colors.textSecondary },
});
