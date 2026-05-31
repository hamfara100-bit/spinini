import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Image, Alert, Modal, FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import { useData, useKid } from "../../../../lib/data/store";
import { ScreenContainer } from "../../../../components/screen-container";
import { Colors, FontSize, Radius, Shadow, Spacing } from "../../../../lib/theme";
import { uid, nowIso } from "../../../../lib/utils";
import type { FavoriteItem, FavoriteCategory } from "../../../../lib/data/types";

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORIES: { id: FavoriteCategory; label: string; emoji: string; color: string; placeholder: string }[] = [
  { id: "food",       label: "Favorite Foods",     emoji: "🍕", color: "#FF6B6B", placeholder: "e.g. Pizza, Sushi, Ice Cream…" },
  { id: "places",     label: "Favorite Places",    emoji: "🗺️", color: "#4ECDC4", placeholder: "e.g. Beach, Grandma's, Park…" },
  { id: "activities", label: "Things I Love to Do",emoji: "🎯", color: "#A78BFA", placeholder: "e.g. Swimming, Drawing, Gaming…" },
  { id: "recipes",    label: "My Recipes",         emoji: "👨‍🍳", color: "#FB923C", placeholder: "e.g. Chocolate Cake, Pancakes…" },
];

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function FavoritesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dispatch } = useData();
  const kid = useKid(id);
  const [activeTab, setActiveTab] = useState<FavoriteCategory>("food");
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<FavoriteItem | null>(null);

  const favorites = kid?.favorites ?? [];
  const tabItems = favorites.filter(f => f.category === activeTab);
  const cat = CATEGORIES.find(c => c.id === activeTab)!;

  function openAdd() { setEditItem(null); setShowForm(true); }
  function openEdit(item: FavoriteItem) { setEditItem(item); setShowForm(true); }

  function handleSave(data: Omit<FavoriteItem, "id" | "kidId" | "createdAt">) {
    if (editItem) {
      dispatch({ type: "FAVORITE_UPDATE", kidId: id, itemId: editItem.id, payload: data });
    } else {
      dispatch({ type: "FAVORITE_ADD", kidId: id, item: { id: uid(), kidId: id, createdAt: nowIso(), ...data } });
    }
    setShowForm(false);
  }

  function handleDelete(itemId: string) {
    Alert.alert("Remove", "Remove this from your favorites?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => dispatch({ type: "FAVORITE_REMOVE", kidId: id, itemId }) },
    ]);
  }

  return (
    <>
      <ScreenContainer>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>⭐ My Favorites</Text>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: cat.color }]} onPress={openAdd}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Category tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={{ gap: 8, paddingRight: 16 }}>
          {CATEGORIES.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[styles.tab, activeTab === c.id && { backgroundColor: c.color }]}
              onPress={() => setActiveTab(c.id)}
            >
              <Text style={styles.tabEmoji}>{c.emoji}</Text>
              <Text style={[styles.tabLabel, activeTab === c.id && styles.tabLabelActive]}>
                {c.label.split(" ")[0]}
              </Text>
              {favorites.filter(f => f.category === c.id).length > 0 && (
                <View style={[styles.tabBadge, activeTab === c.id ? { backgroundColor: "#fff3" } : { backgroundColor: c.color + "30" }]}>
                  <Text style={[styles.tabBadgeText, activeTab === c.id && { color: "#fff" }]}>
                    {favorites.filter(f => f.category === c.id).length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Section title */}
        <Text style={[styles.sectionTitle, { color: cat.color }]}>{cat.emoji} {cat.label}</Text>

        {/* Items */}
        {tabItems.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ fontSize: 52 }}>{cat.emoji}</Text>
            <Text style={styles.emptyText}>No {cat.label.toLowerCase()} yet!</Text>
            <TouchableOpacity style={[styles.emptyAddBtn, { backgroundColor: cat.color }]} onPress={openAdd}>
              <Text style={styles.emptyAddText}>+ Add your first one</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={tabItems}
            keyExtractor={i => i.id}
            numColumns={activeTab === "recipes" ? 1 : 2}
            key={activeTab === "recipes" ? "single" : "double"}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: 12, paddingBottom: 40 }}
            columnWrapperStyle={activeTab !== "recipes" ? { gap: 12 } : undefined}
            renderItem={({ item }) =>
              activeTab === "recipes"
                ? <RecipeCard item={item} color={cat.color} onEdit={() => openEdit(item)} onDelete={() => handleDelete(item.id)} />
                : <FaveCard item={item} color={cat.color} onEdit={() => openEdit(item)} onDelete={() => handleDelete(item.id)} />
            }
          />
        )}
      </ScreenContainer>

      {/* Add/Edit form */}
      <Modal visible={showForm} animationType="slide" onRequestClose={() => setShowForm(false)}>
        <FavoriteForm
          category={activeTab}
          initial={editItem ?? undefined}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      </Modal>
    </>
  );
}

// ─── Favorite Card (food / places / activities) ───────────────────────────────

function FaveCard({ item, color, onEdit, onDelete }: { item: FavoriteItem; color: string; onEdit: () => void; onDelete: () => void }) {
  const allPhotos = item.photos?.length ? item.photos : item.photoUri ? [item.photoUri] : [];
  const coverPhoto = allPhotos[0];
  const extraCount = allPhotos.length - 1;

  return (
    <TouchableOpacity style={styles.faveCard} onPress={onEdit} onLongPress={onDelete} activeOpacity={0.85}>
      {coverPhoto ? (
        <View style={{ position: "relative" }}>
          <Image source={{ uri: coverPhoto }} style={styles.favePhoto} />
          {extraCount > 0 && (
            <View style={[styles.photoCountBadge, { backgroundColor: color }]}>
              <Text style={styles.photoCountText}>+{extraCount}</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.favePhotoPlaceholder, { backgroundColor: color + "20" }]}>
          <Text style={{ fontSize: 36 }}>{CATEGORIES.find(c => c.id === item.category)?.emoji}</Text>
          <Text style={[styles.addPhotoHint, { color }]}>📷 Add photo</Text>
        </View>
      )}
      <View style={[styles.faveFooter, { borderTopColor: color + "30" }]}>
        <Text style={styles.faveName} numberOfLines={1}>{item.name}</Text>
        {item.description ? <Text style={styles.faveDesc} numberOfLines={2}>{item.description}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Recipe Card ──────────────────────────────────────────────────────────────

function RecipeCard({ item, color, onEdit, onDelete }: { item: FavoriteItem; color: string; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableOpacity style={styles.recipeCard} onPress={() => setExpanded(e => !e)} onLongPress={onDelete} activeOpacity={0.9}>
      <View style={styles.recipeTop}>
        {item.photoUri
          ? <Image source={{ uri: item.photoUri }} style={styles.recipePhoto} />
          : <View style={[styles.recipePhotoPlaceholder, { backgroundColor: color + "20" }]}><Text style={{ fontSize: 32 }}>👨‍🍳</Text></View>
        }
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.recipeName}>{item.name}</Text>
          {item.cookTime ? <Text style={styles.recipeMeta}>⏱ {item.cookTime}</Text> : null}
          {item.description ? <Text style={styles.recipeDesc} numberOfLines={2}>{item.description}</Text> : null}
        </View>
        <TouchableOpacity onPress={onEdit} style={styles.editIcon}><Text>✏️</Text></TouchableOpacity>
      </View>

      {expanded && (
        <View style={styles.recipeBody}>
          {(item.ingredients?.length ?? 0) > 0 && (
            <>
              <Text style={[styles.recipeSection, { color }]}>🛒 Ingredients</Text>
              {item.ingredients!.map((ing, i) => (
                <Text key={i} style={styles.recipeItem}>• {ing}</Text>
              ))}
            </>
          )}
          {(item.steps?.length ?? 0) > 0 && (
            <>
              <Text style={[styles.recipeSection, { color }]}>📋 Steps</Text>
              {item.steps!.map((step, i) => (
                <Text key={i} style={styles.recipeItem}>{i + 1}. {step}</Text>
              ))}
            </>
          )}
        </View>
      )}

      <Text style={[styles.expandHint, { color }]}>{expanded ? "▲ Collapse" : "▼ Show recipe"}</Text>
    </TouchableOpacity>
  );
}

// ─── Add / Edit Form ──────────────────────────────────────────────────────────

interface FormProps {
  category: FavoriteCategory;
  initial?: FavoriteItem;
  onSave: (data: Omit<FavoriteItem, "id" | "kidId" | "createdAt">) => void;
  onClose: () => void;
}

function FavoriteForm({ category, initial, onSave, onClose }: FormProps) {
  const cat = CATEGORIES.find(c => c.id === category)!;
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  // Merge legacy single photoUri + new photos array
  const initPhotos = (() => {
    const all: string[] = [...(initial?.photos ?? [])];
    if (initial?.photoUri && !all.includes(initial.photoUri)) all.unshift(initial.photoUri);
    return all;
  })();
  const [photos, setPhotos] = useState<string[]>(initPhotos);
  const [cookTime, setCookTime] = useState(initial?.cookTime ?? "");
  const [ingredients, setIngredients] = useState<string[]>(initial?.ingredients ?? [""]);
  const [steps, setSteps] = useState<string[]>(initial?.steps ?? [""]);

  const isRecipe = category === "recipes";

  async function pickFromLibrary() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled) setPhotos(p => [...p, result.assets[0].uri]);
  }

  async function pickFromCamera() {
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled) setPhotos(p => [...p, result.assets[0].uri]);
  }

  function removePhoto(uri: string) {
    Alert.alert("Remove photo?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => setPhotos(p => p.filter(u => u !== uri)) },
    ]);
  }

  function showPhotoPicker() {
    Alert.alert("Add Photo", "Choose source", [
      { text: "📷 Camera", onPress: pickFromCamera },
      { text: "🖼️ Library", onPress: pickFromLibrary },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function updateIngredient(i: number, val: string) {
    setIngredients(prev => prev.map((v, idx) => idx === i ? val : v));
  }
  function addIngredient() { setIngredients(prev => [...prev, ""]); }
  function removeIngredient(i: number) { setIngredients(prev => prev.filter((_, idx) => idx !== i)); }

  function updateStep(i: number, val: string) {
    setSteps(prev => prev.map((v, idx) => idx === i ? val : v));
  }
  function addStep() { setSteps(prev => [...prev, ""]); }
  function removeStep(i: number) { setSteps(prev => prev.filter((_, idx) => idx !== i)); }

  function handleSave() {
    if (!name.trim()) { Alert.alert("Name required", "Please enter a name."); return; }
    onSave({
      category,
      name: name.trim(),
      description: description.trim() || undefined,
      photoUri: photos[0],    // keep first as cover for backward compat
      photos,
      cookTime: isRecipe ? cookTime.trim() || undefined : undefined,
      ingredients: isRecipe ? ingredients.filter(s => s.trim()) : undefined,
      steps: isRecipe ? steps.filter(s => s.trim()) : undefined,
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Colors.bgLight }}>
      {/* Header */}
      <View style={[styles.formHeader, { borderBottomColor: cat.color + "40" }]}>
        <TouchableOpacity onPress={onClose} style={styles.formClose}>
          <Text style={styles.formCloseText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.formTitle}>{initial ? "Edit" : "Add"} {cat.emoji} {cat.label.split(" ")[0]}</Text>
        <TouchableOpacity onPress={handleSave} style={[styles.formSaveBtn, { backgroundColor: cat.color }]}>
          <Text style={styles.formSaveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.formBody} keyboardShouldPersistTaps="handled">

        {/* Photos Gallery */}
        <View style={styles.gallerySection}>
          <View style={styles.galleryHeader}>
            <Text style={[styles.fieldLabel, { marginTop: 0, marginBottom: 0 }]}>📸 Photos</Text>
            <TouchableOpacity style={[styles.addPhotoBtn, { backgroundColor: cat.color }]} onPress={showPhotoPicker}>
              <Text style={styles.addPhotoBtnText}>＋ Add Photo</Text>
            </TouchableOpacity>
          </View>
          {photos.length === 0 ? (
            <TouchableOpacity style={[styles.photoPlaceholder, { borderColor: cat.color }]} onPress={showPhotoPicker}>
              <Text style={{ fontSize: 36 }}>{cat.emoji}</Text>
              <Text style={[styles.photoHint, { color: cat.color }]}>Tap to add a photo</Text>
            </TouchableOpacity>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
              {photos.map((uri, idx) => (
                <View key={uri} style={styles.photoThumbWrap}>
                  <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                  {idx === 0 && (
                    <View style={[styles.coverBadge, { backgroundColor: cat.color }]}>
                      <Text style={styles.coverBadgeText}>Cover</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => removePhoto(uri)}>
                    <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity style={[styles.addMoreThumb, { borderColor: cat.color }]} onPress={showPhotoPicker}>
                <Text style={{ fontSize: 28 }}>📷</Text>
                <Text style={[styles.addMoreText, { color: cat.color }]}>Add</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>

        {/* Name */}
        <Text style={styles.fieldLabel}>Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={cat.placeholder}
          autoFocus
        />

        {/* Description */}
        <Text style={styles.fieldLabel}>{isRecipe ? "About this recipe" : "Why do you love it?"}</Text>
        <TextInput
          style={[styles.input, styles.inputMulti]}
          value={description}
          onChangeText={setDescription}
          placeholder="Write something…"
          multiline
        />

        {/* Recipe-specific fields */}
        {isRecipe && (
          <>
            <Text style={styles.fieldLabel}>⏱ Cook / Prep Time</Text>
            <TextInput
              style={styles.input}
              value={cookTime}
              onChangeText={setCookTime}
              placeholder="e.g. 30 minutes"
            />

            {/* Ingredients */}
            <Text style={styles.fieldLabel}>🛒 Ingredients</Text>
            {ingredients.map((ing, i) => (
              <View key={i} style={styles.listRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={ing}
                  onChangeText={v => updateIngredient(i, v)}
                  placeholder={`Ingredient ${i + 1}`}
                />
                {ingredients.length > 1 && (
                  <TouchableOpacity onPress={() => removeIngredient(i)} style={styles.removeBtn}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity style={[styles.addLineBtn, { borderColor: cat.color }]} onPress={addIngredient}>
              <Text style={[styles.addLineBtnText, { color: cat.color }]}>+ Add ingredient</Text>
            </TouchableOpacity>

            {/* Steps */}
            <Text style={styles.fieldLabel}>📋 Steps</Text>
            {steps.map((step, i) => (
              <View key={i} style={styles.listRow}>
                <View style={[styles.stepNum, { backgroundColor: cat.color }]}>
                  <Text style={styles.stepNumText}>{i + 1}</Text>
                </View>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  value={step}
                  onChangeText={v => updateStep(i, v)}
                  placeholder={`Step ${i + 1}`}
                  multiline
                />
                {steps.length > 1 && (
                  <TouchableOpacity onPress={() => removeStep(i)} style={styles.removeBtn}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            <TouchableOpacity style={[styles.addLineBtn, { borderColor: cat.color }]} onPress={addStep}>
              <Text style={[styles.addLineBtnText, { color: cat.color }]}>+ Add step</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm },
  title: { fontSize: FontSize.xl, fontWeight: "800", color: Colors.primary },
  addBtn: { borderRadius: Radius.full, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },
  tabBar: { flexGrow: 0, marginBottom: Spacing.md },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.cardLight },
  tabEmoji: { fontSize: 16 },
  tabLabel: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary },
  tabLabelActive: { color: "#fff" },
  tabBadge: { borderRadius: Radius.full, paddingHorizontal: 6, paddingVertical: 1 },
  tabBadgeText: { fontSize: 11, fontWeight: "800", color: Colors.textSecondary },
  sectionTitle: { fontSize: FontSize.md, fontWeight: "800", marginBottom: Spacing.md },
  // Fave card (2-col grid)
  faveCard: { flex: 1, backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, overflow: "hidden", ...Shadow.md },
  favePhoto: { width: "100%", height: 110 },
  favePhotoPlaceholder: { width: "100%", height: 110, alignItems: "center", justifyContent: "center" },
  faveFooter: { padding: 10, borderTopWidth: 1 },
  faveName: { fontSize: FontSize.base, fontWeight: "700", color: Colors.textPrimary },
  faveDesc: { fontSize: 11, color: Colors.textSecondary, marginTop: 2, lineHeight: 15 },
  // Recipe card
  recipeCard: { backgroundColor: Colors.surfaceLight, borderRadius: Radius.xl, padding: Spacing.md, ...Shadow.md },
  recipeTop: { flexDirection: "row", alignItems: "flex-start" },
  recipePhoto: { width: 80, height: 80, borderRadius: Radius.lg },
  recipePhotoPlaceholder: { width: 80, height: 80, borderRadius: Radius.lg, alignItems: "center", justifyContent: "center" },
  recipeName: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary },
  recipeMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  recipeDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
  editIcon: { padding: 4 },
  recipeBody: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  recipeSection: { fontSize: FontSize.sm, fontWeight: "800", marginBottom: 6, marginTop: 8 },
  recipeItem: { fontSize: FontSize.sm, color: Colors.textPrimary, lineHeight: 22 },
  expandHint: { fontSize: 11, fontWeight: "700", textAlign: "center", marginTop: 8 },
  // Empty
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 60 },
  emptyText: { fontSize: FontSize.md, fontWeight: "700", color: Colors.textSecondary },
  emptyAddBtn: { borderRadius: Radius.full, paddingHorizontal: 20, paddingVertical: 10 },
  emptyAddText: { color: "#fff", fontWeight: "800" },
  // Form
  formHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: Spacing.md, borderBottomWidth: 2, backgroundColor: Colors.surfaceLight },
  formClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.cardLight, alignItems: "center", justifyContent: "center" },
  formCloseText: { fontWeight: "700", color: Colors.textPrimary },
  formTitle: { fontSize: FontSize.md, fontWeight: "800", color: Colors.textPrimary },
  formSaveBtn: { borderRadius: Radius.full, paddingHorizontal: 18, paddingVertical: 8 },
  formSaveBtnText: { color: "#fff", fontWeight: "800" },
  formBody: { padding: Spacing.md },
  // Photo gallery
  gallerySection: { marginTop: Spacing.md, marginBottom: Spacing.sm },
  galleryHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  addPhotoBtn: { borderRadius: Radius.full, paddingHorizontal: 14, paddingVertical: 6 },
  addPhotoBtnText: { color: "#fff", fontWeight: "800", fontSize: FontSize.sm },
  photoPlaceholder: { height: 130, borderRadius: Radius.xl, borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.cardLight },
  photoHint: { fontSize: FontSize.sm, fontWeight: "700" },
  photoStrip: { flexGrow: 0 },
  photoThumbWrap: { position: "relative", marginRight: 8 },
  photoThumb: { width: 110, height: 110, borderRadius: Radius.lg },
  coverBadge: { position: "absolute", bottom: 6, left: 6, borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  coverBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  photoRemoveBtn: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
  addMoreThumb: { width: 110, height: 110, borderRadius: Radius.lg, borderWidth: 2, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 4, backgroundColor: Colors.cardLight },
  addMoreText: { fontSize: FontSize.xs, fontWeight: "700" },
  // Card extras
  photoCountBadge: { position: "absolute", top: 6, right: 6, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  photoCountText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  addPhotoHint: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  fieldLabel: { fontSize: FontSize.sm, fontWeight: "700", color: Colors.textSecondary, marginBottom: 6, marginTop: Spacing.md },
  input: { borderWidth: 2, borderColor: Colors.border, borderRadius: Radius.md, padding: Spacing.sm, fontSize: FontSize.base, color: Colors.textPrimary, backgroundColor: Colors.surfaceLight, marginBottom: 0 },
  inputMulti: { minHeight: 80, textAlignVertical: "top" },
  listRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  removeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.error + "20", alignItems: "center", justifyContent: "center" },
  removeBtnText: { color: Colors.error, fontWeight: "800", fontSize: 12 },
  addLineBtn: { borderWidth: 1.5, borderStyle: "dashed", borderRadius: Radius.md, padding: 10, alignItems: "center", marginTop: 4 },
  addLineBtnText: { fontWeight: "700", fontSize: FontSize.sm },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stepNumText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
