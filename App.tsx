import React, { useEffect, useMemo, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Session } from "@supabase/supabase-js";

import { supabase } from "./src/services/supabase";
import { Colors } from "./src/config/theme";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import EnergyScreen from "./src/screens/EnergyScreen";
import HelpScreen from "./src/screens/HelpScreen";
import ReferralsScreen from "./src/screens/ReferralsScreen";
import AccountScreen from "./src/screens/AccountScreen";

const Tab = createBottomTabNavigator();

type WebTabConfig = {
  key: string;
  label: string;
  icon: string;
  component: React.ComponentType<any>;
};

const WEB_TABS = [
  { key: "home", label: "Home", icon: "Home", component: HomeScreen },
  {
    key: "energy",
    label: "Energy Overview",
    icon: "Energy",
    component: EnergyScreen,
  },
  {
    key: "referrals",
    label: "Referrals",
    icon: "Referrals",
    component: ReferralsScreen,
  },
  { key: "help", label: "Help", icon: "Support", component: HelpScreen },
  { key: "account", label: "My Account", icon: "Account", component: AccountScreen },
] as const satisfies readonly WebTabConfig[];

type WebTabKey = (typeof WEB_TABS)[number]["key"];

function TabIcon({ icon, focused }: { icon: string; focused: boolean }) {
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconFocused]}>
      <Text style={styles.tabIconText}>{icon}</Text>
    </View>
  );
}

function WebAppShell() {
  const [activeTab, setActiveTab] = useState<WebTabKey>("home");

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    const syncFromHash = () => {
      const nextTab = window.location.hash.replace("#", "") as WebTabKey;
      const matchedTab = WEB_TABS.find((tab) => tab.key === nextTab);
      if (matchedTab) {
        setActiveTab(matchedTab.key);
      }
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  const activeConfig =
    WEB_TABS.find((tab) => tab.key === activeTab) ?? WEB_TABS[0];
  const ActiveScreen = activeConfig.component;

  const webNavigation = useMemo(
    () => ({
      navigate: (target: string) => {
        const matched = WEB_TABS.find(
          (tab) =>
            tab.label === target ||
            tab.key === target.toLowerCase().replace(/\s+/g, ""),
        );

        if (matched) {
          setActiveTab(matched.key);
          if (typeof window !== "undefined") {
            window.location.hash = matched.key;
          }
        }
      },
    }),
    [],
  );

  return (
    <View style={styles.webAppShell}>
      <StatusBar style="dark" />
      <View style={styles.webSidebar}>
        <Text style={styles.webBrand}>Solviva</Text>
        <Text style={styles.webTagline}>Home and energy dashboard</Text>

        <View style={styles.webNav}>
          {WEB_TABS.map((tab) => {
            const focused = tab.key === activeTab;
            return (
              <Pressable
                key={tab.key}
                onPress={() => {
                  setActiveTab(tab.key);
                  if (typeof window !== "undefined") {
                    window.location.hash = tab.key;
                  }
                }}
                style={[styles.webNavItem, focused && styles.webNavItemActive]}
              >
                <Text
                  style={[
                    styles.webNavItemLabel,
                    focused && styles.webNavItemLabelActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.webSidebarFooter}>
          <Text style={styles.webSidebarFooterTitle}>Browser Version</Text>
          <Text style={styles.webSidebarFooterText}>
            Same data and auth flow, redesigned for larger screens.
          </Text>
        </View>
      </View>

      <View style={styles.webContent}>
        <View style={styles.webTopBar}>
          <View>
            <Text style={styles.webTopBarTitle}>{activeConfig.label}</Text>
            <Text style={styles.webTopBarSubtitle}>
              Solar production, support, and account tools in one place.
            </Text>
          </View>
        </View>
        <View style={styles.webScreenSurface}>
          <ActiveScreen navigation={webNavigation} />
        </View>
      </View>
    </View>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!session) {
    return (
      <>
        <StatusBar style={Platform.OS === "web" ? "dark" : "light"} />
        <LoginScreen />
      </>
    );
  }

  if (Platform.OS === "web") {
    return <WebAppShell />;
  }

  return (
    <>
      <StatusBar style="light" />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={{
            headerShown: false,
            tabBarStyle: {
              backgroundColor: "#FFFFFF",
              borderTopWidth: 1,
              borderTopColor: "#E0E0E0",
              height: 80,
              paddingBottom: 16,
              paddingTop: 8,
              elevation: 10,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
            },
            tabBarActiveTintColor: "#1B5E20",
            tabBarInactiveTintColor: "#757575",
            tabBarLabelStyle: {
              fontSize: 11,
              fontWeight: "600",
            },
          }}
        >
          <Tab.Screen
            name="Home"
            component={HomeScreen}
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon icon="Home" focused={focused} />
              ),
            }}
          />
          <Tab.Screen
            name="Energy"
            component={EnergyScreen}
            options={{
              tabBarLabel: "Energy Overview",
              tabBarIcon: ({ focused }) => (
                <TabIcon icon="Energy" focused={focused} />
              ),
            }}
          />
          <Tab.Screen
            name="Referrals"
            component={ReferralsScreen}
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon icon="Referrals" focused={focused} />
              ),
            }}
          />
          <Tab.Screen
            name="Help"
            component={HelpScreen}
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon icon="Help" focused={focused} />
              ),
            }}
          />
          <Tab.Screen
            name="My Account"
            component={AccountScreen}
            options={{
              tabBarIcon: ({ focused }) => (
                <TabIcon icon="Account" focused={focused} />
              ),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
  },
  tabIcon: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  tabIconFocused: {
    backgroundColor: "rgba(27, 94, 32, 0.1)",
  },
  tabIconText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
  },
  webAppShell: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#EDF3E4",
  },
  webSidebar: {
    width: 260,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    backgroundColor: "#13361A",
  },
  webBrand: {
    fontSize: 30,
    fontWeight: "800",
    color: "#D2FF1E",
  },
  webTagline: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.72)",
  },
  webNav: {
    marginTop: 32,
    gap: 10,
  },
  webNavItem: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  webNavItemActive: {
    backgroundColor: "#D2FF1E",
  },
  webNavItemLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#F2F5EF",
  },
  webNavItemLabelActive: {
    color: "#1B5E20",
  },
  webSidebarFooter: {
    marginTop: "auto",
    padding: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  webSidebarFooterTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  webSidebarFooterText: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.72)",
  },
  webContent: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 24,
  },
  webTopBar: {
    marginBottom: 20,
    paddingHorizontal: 6,
  },
  webTopBarTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#13361A",
  },
  webTopBarSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "#4E6B55",
  },
  webScreenSurface: {
    flex: 1,
    overflow: "hidden",
    borderRadius: 32,
    backgroundColor: "#F7F8F2",
    borderWidth: 1,
    borderColor: "rgba(19,54,26,0.08)",
  },
});
