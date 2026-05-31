import { useLocalSearchParams } from "expo-router";
import { FamilySocialFeed } from "../../../../components/family-social-feed";
import { useData } from "../../../../lib/data/store";

export default function KidSocialScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useData();
  return (
    <FamilySocialFeed
      viewerId={id}
      viewerIsParent={false}
      parentName={state.parentSettings.name || "Parent"}
    />
  );
}
