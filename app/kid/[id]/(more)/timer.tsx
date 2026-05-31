import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function TimerRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/kid/${id}/(more)/alarms` as any);
  }, [id, router]);
  return null;
}
