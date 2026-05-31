import { FamilySocialFeed } from "../../../components/family-social-feed";
import { useData } from "../../../lib/data/store";

export default function ParentSocialScreen() {
  const { state } = useData();
  return (
    <FamilySocialFeed
      viewerId="parent"
      viewerIsParent={true}
      parentName={state.parentSettings.name || "Parent"}
    />
  );
}
