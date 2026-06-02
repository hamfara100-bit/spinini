import React from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { OnlineGame } from "../components/online-game";

/**
 * Top-level (outside the tab navigators) so the online match is TRULY
 * full-screen — no parent/kid tab bar. `me`/`name` identify this device's
 * player and are passed in by whoever opened it.
 */
export default function OnlineGameRoute() {
  const { me, name } = useLocalSearchParams<{ me?: string; name?: string }>();
  const router = useRouter();
  return <OnlineGame me={me ?? ""} meName={name ?? "Me"} onExit={() => router.back()} />;
}
