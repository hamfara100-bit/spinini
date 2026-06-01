/**
 * Parent-side Game Night route.
 *
 * Game Night lives under the kid tab layout (app/kid/[id]/(more)/game-night).
 * Routing the parent straight there mounted the KID tab bar and effectively
 * dropped the parent into kid mode. This thin wrapper renders the same Game
 * Night screen INSIDE the parent layout (parent tab bar stays), so the parent
 * never leaves parent mode.
 */
import React from "react";
import { useLocalSearchParams } from "expo-router";
import { useData } from "../../../lib/data/store";
import GameNightScreen from "../../kid/[id]/(more)/game-night";

export default function ParentGameNight() {
  const { state } = useData();
  const { kidId } = useLocalSearchParams<{ kidId?: string }>();
  // Pick the requested kid, or fall back to the first kid for roster context.
  const id = kidId ?? state.kids[0]?.profile.id ?? "";
  return <GameNightScreen id={id} />;
}
