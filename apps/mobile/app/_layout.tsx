import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { Platform } from "react-native";
import "react-native-reanimated";

import { AuthProvider } from "@pronoscore/shared";
import { configureGoogleSignIn, signInWithGoogleNative, signOutGoogle } from "@/lib/google-signin";
import { useColorScheme } from "@/components/useColorScheme";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "index",
};

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    if (Platform.OS !== "web") {
      configureGoogleSignIn();
    }
  }, []);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AuthProvider
        signInWithGoogleOverride={Platform.OS !== "web" ? signInWithGoogleNative : undefined}
        signOutOverride={Platform.OS !== "web" ? signOutGoogle : undefined}
      >
        <Stack>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="login"
            options={{ headerShown: false, animation: "fade" }}
          />
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) return null;

  return <RootLayoutNav />;
}
