import React from "react";
import { View, TouchableOpacity, Text, StyleSheet } from "react-native";
import { Tabs, useRouter, usePathname } from "expo-router";
import { BlurView } from "expo-blur";
import { SafeAreaView } from "react-native-safe-area-context";
import { Home, TrendingUp, Settings } from "lucide-react-native";
import { COLORS } from "@/constants/TradnexColors";

const TABS = [
  { name: "(home)", route: "/(tabs)/(home)" as const, label: "Home", icon: Home },
  { name: "(history)", route: "/(tabs)/(history)" as const, label: "History", icon: TrendingUp },
  { name: "(settings)", route: "/(tabs)/(settings)" as const, label: "Settings", icon: Settings },
];

function FloatingTabBar() {
  const router = useRouter();
  const pathname = usePathname();

  // Derive active tab from pathname segments.
  // expo-router pathnames inside (tabs) look like:
  //   "/"  or  "/index"           → home (initial route)
  //   "/history"  or  "/(history)" → history
  //   "/settings" or  "/(settings)" → settings
  // We split on "/" and look for a segment that matches each tab's bare name.
  const pathSegments = pathname.split("/").filter(Boolean);
  const activeIndex = (() => {
    for (let i = 0; i < TABS.length; i++) {
      const bare = TABS[i].name.replace(/[()]/g, ""); // "home" | "history" | "settings"
      if (pathSegments.some((s) => s.replace(/[()]/g, "") === bare)) {
        return i;
      }
    }
    // "/" with no segments → home tab
    return 0;
  })();
  const currentIndex = activeIndex;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safeArea}>
      <View style={styles.container}>
        <BlurView intensity={80} style={styles.blur}>
          <View style={styles.inner}>
            {TABS.map((tab, i) => {
              const isActive = currentIndex === i;
              const IconComp = tab.icon;
              return (
                <TouchableOpacity
                  key={tab.name}
                  style={styles.tab}
                  onPress={() => {
                    console.log(`[TabBar] Tab pressed: ${tab.label}`);
                    router.push(tab.route);
                  }}
                  activeOpacity={0.7}
                >
                  <IconComp
                    size={22}
                    color={isActive ? COLORS.primary : COLORS.textTertiary}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <Text
                    style={[
                      styles.label,
                      { color: isActive ? COLORS.primary : COLORS.textTertiary },
                      isActive && styles.labelActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </BlurView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1000,
    pointerEvents: "box-none",
  },
  container: {
    width: 260,
    marginBottom: 16,
    borderRadius: 32,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  blur: {
    backgroundColor: "rgba(15,20,25,0.85)",
  },
  inner: {
    flexDirection: "row",
    height: 60,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 8,
  },
  label: {
    fontSize: 9,
    fontWeight: "500",
    fontFamily: "SpaceGrotesk-Medium",
  },
  labelActive: {
    fontWeight: "700",
  },
});

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={() => null}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="(home)" />
        <Tabs.Screen name="(history)" />
        <Tabs.Screen name="(settings)" />
      </Tabs>
      <FloatingTabBar />
    </View>
  );
}
