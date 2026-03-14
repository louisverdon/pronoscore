import React, { useEffect } from "react";
import { SymbolView } from "expo-symbols";
import { Tabs, useRouter } from "expo-router";
import { Pressable, View, Text } from "react-native";

import { useAuth } from "@pronoscore/shared";
import Colors from "@/constants/Colors";
import { useColorScheme } from "@/components/useColorScheme";

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (!user) return null;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        headerShown: true,
        headerRight: () => (
          <Pressable
            onPress={signOut}
            style={({ pressed }) => ({ marginRight: 16, opacity: pressed ? 0.6 : 1 })}
          >
            <Text style={{ color: Colors[colorScheme].tint, fontSize: 14 }}>
              Déconnexion
            </Text>
          </Pressable>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="matchs"
        options={{
          title: "Matchs",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "sportscourt", android: "soccer", web: "sportscourt" }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="pronostics"
        options={{
          title: "Pronostics",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "list.bullet", android: "list", web: "list" }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="classement"
        options={{
          title: "Classement",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "trophy", android: "trophy", web: "trophy" }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="ligues"
        options={{
          title: "Ligues",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "person.3", android: "people", web: "people" }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
    </Tabs>
  );
}
