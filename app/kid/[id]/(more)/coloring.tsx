import { Redirect, useLocalSearchParams } from "expo-router";

export default function ColoringRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={`/kid/${id}/(more)/create`} />;
}
