import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getProfile, saveProfile, Profile } from "../profileStore";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";

const CYAN = "#128EA5";
const DARK = "#08263D";
const TEXT = "#73879B";
const BG = "#F7FAFC";
const CARD = "#FFFFFF";

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile>({
    name: "",
    userId: "",
    cupId: "",
    goal: 1600,
    reminderMinutes: 60,
    deviceId: "",
  });

  const [pushToken, setPushToken] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  useEffect(() => {
    registerForPush();
  }, []);

  async function loadProfile() {
    const data = await getProfile();
    setProfile(data);
  }

  async function registerForPush() {
    try {
      if (!Device.isDevice) {
        setPushToken("Must use physical phone");
        return;
      }

      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();

      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        setPushToken("Notification permission denied");
        return;
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.easConfig?.projectId;

      if (!projectId) {
        setPushToken("No projectId yet. Run EAS init later.");
        return;
      }

      const token = (
        await Notifications.getExpoPushTokenAsync({ projectId: "945f5849-7e6b-4b76-b9f9-7ece04ab9bde", })
      ).data;

      console.log("Expo Push Token =", token);
      setPushToken(token);
    } catch (error) {
      console.log("Push token error:", error);
      setPushToken("Push token error");
    }
  }

  async function handleSave() {
    await saveProfile(profile);
    Alert.alert("Saved", "Profile settings have been updated.");
  }

  function updateField(key: keyof Profile, value: string) {
    setProfile((prev) => ({
      ...prev,
      [key]:
        key === "goal" || key === "reminderMinutes"
          ? Number(value) || 0
          : value,
    }));
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Manage user and smart cup settings.</Text>

          <View style={styles.profileCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>◎</Text>
            </View>
            <Text style={styles.name}>{profile.name || "User"}</Text>
            <Text style={styles.userId}>{profile.userId || "user_id"}</Text>
          </View>

          <Text style={styles.sectionTitle}>User Information</Text>

          <Field label="User Name" value={profile.name} onChange={(v: string) => updateField("name", v)} />
          <Field label="User ID" value={profile.userId} onChange={(v: string) => updateField("userId", v)} />
          <Field label="Daily Goal" value={String(profile.goal)} onChange={(v: string) => updateField("goal", v)} suffix="ml" keyboardType="numeric" />

          <Text style={styles.sectionTitle}>Smart Cup</Text>

          <Field label="Cup ID" value={profile.cupId} onChange={(v: string) => updateField("cupId", v)} />
          <Field label="Device ID" value={profile.deviceId} onChange={(v: string) => updateField("deviceId", v)} />

          <Text style={styles.sectionTitle}>Reminder</Text>

          <Field label="Reminder Interval" value={String(profile.reminderMinutes)} onChange={(v: string) => updateField("reminderMinutes", v)} suffix="min" keyboardType="numeric" />

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveText}>Save Profile</Text>
          </TouchableOpacity>

          
          <View style={styles.tokenCard}>
            <Text style={styles.tokenLabel}>Expo Push Token</Text>
            <Text selectable style={styles.tokenText}>
              {pushToken || "Loading token..."}
            </Text>
          </View>
          

          <View style={{ height: 140 }} />
        </ScrollView>

        <BottomNav active="Profile" />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, suffix, keyboardType = "default" }: any) {
  return (
    <View style={styles.fieldCard}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          keyboardType={keyboardType}
          placeholder={label}
          placeholderTextColor="#9AAABC"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {suffix && <Text style={styles.suffix}>{suffix}</Text>}
      </View>
    </View>
  );
}

function BottomNav({ active }: { active: string }) {
  return (
    <View style={styles.nav}>
      <NavItem icon="⌂" label="Home" active={active === "Home"} onPress={() => router.push("/")} />
      <NavItem icon="◷" label="History" active={active === "History"} onPress={() => router.push("/logs")} />
      <TouchableOpacity style={styles.plusBtn}>
        <Text style={styles.plusIcon}>+</Text>
      </TouchableOpacity>
      <NavItem icon="◍" label="Social" active={active === "Social"} onPress={() => router.push("/social")} />
      <NavItem icon="◎" label="Profile" active={active === "Profile"} onPress={() => router.push("/settings")} />
    </View>
  );
}

function NavItem({ icon, label, active, onPress }: any) {
  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress}>
      <Text style={[styles.navIcon, active && styles.navActive]}>{icon}</Text>
      <Text style={[styles.navLabel, active && styles.navActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  container: { padding: 20 },

  title: { marginTop: 20, fontSize: 32, fontWeight: "900", color: "#0A2033" },
  subtitle: { marginTop: 8, color: TEXT, fontSize: 16 },

  profileCard: {
    marginTop: 24,
    backgroundColor: DARK,
    borderRadius: 28,
    padding: 26,
    alignItems: "center",
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: CYAN,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "white", fontSize: 40, fontWeight: "900" },
  name: { marginTop: 14, fontSize: 26, fontWeight: "900", color: "white" },
  userId: { marginTop: 6, color: "#D4E7F2", fontWeight: "800" },

  sectionTitle: {
    marginTop: 24,
    marginBottom: 10,
    fontSize: 20,
    fontWeight: "900",
    color: "#0A2033",
  },

  fieldCard: {
    marginTop: 12,
    backgroundColor: CARD,
    borderRadius: 22,
    padding: 16,
  },
  fieldLabel: { color: TEXT, fontWeight: "700", marginBottom: 8 },
  inputRow: { flexDirection: "row", alignItems: "center" },
  input: {
    flex: 1,
    fontSize: 18,
    color: "#0A2033",
    fontWeight: "900",
    paddingVertical: 8,
  },
  suffix: { color: CYAN, fontWeight: "900", fontSize: 16, marginLeft: 8 },

  saveButton: {
    marginTop: 26,
    backgroundColor: CYAN,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveText: { color: "white", fontWeight: "900", fontSize: 16 },

  tokenCard: {
    marginTop: 18,
    backgroundColor: CARD,
    borderRadius: 22,
    padding: 16,
  },
  tokenLabel: {
    color: TEXT,
    fontWeight: "800",
    marginBottom: 8,
  },
  tokenText: {
    color: "#0A2033",
    fontSize: 13,
    lineHeight: 18,
  },

  nav: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 12,
    height: 72,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  navItem: { alignItems: "center", width: 55 },
  navIcon: { fontSize: 25, color: "#7890A5" },
  navLabel: { marginTop: 4, fontSize: 12, color: "#7890A5", fontWeight: "700" },
  navActive: { color: CYAN },

  plusBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: CYAN,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -12,
  },
  plusIcon: { color: "white", fontSize: 34, fontWeight: "300" },
});