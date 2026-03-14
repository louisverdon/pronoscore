import { useEffect } from "react";
import { Redirect } from "expo-router";

import { useAuth } from "@pronoscore/shared";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Redirect href="/(tabs)/matchs" />;
  return <Redirect href="/login" />;
}
