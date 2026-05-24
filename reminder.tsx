import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as Notifications from "expo-notifications";
import { getProfile, Profile } from "../profileStore";

const CYAN = "#128EA5";
const BLUE = "#19B5C9";
const DARK = "#08263D";
const TEXT = "#73879B";
const BG = "#F7FAFC";
const CARD = "#FFFFFF";

export default function ReminderScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [intake, setIntake] = useState(0);
  const [lastDrinkTime, setLastDrinkTime] = useState("-");
  const [lastReminderReason, setLastReminderReason] = useState(
    "No active reminder at the moment."
  );

  useFocusEffect(
    useCallback(() => {
      loadReminderData();
    }, [])
  );

  async function loadReminderData() {
    try {
      const p = await getProfile();
      setProfile(p);

      const apiUrl = `https://hyqzf7hmafho4wxvf2pyx7w5cq0zgjcs.lambda-url.ap-southeast-2.on.aws/?cup_ID=${p.cupId}&user_id=${p.userId}`;

      const response = await fetch(apiUrl);
      const raw = await response.json();
      const data = raw.body ? JSON.parse(raw.body) : raw;

      const records = data.records || [];
      setIntake(Math.round(Number(data.total_ml || 0)));

      const drinks = records
        .filter((item: any) => item.event_type === "drink_event")
        .sort((a: any, b: any) => parseTime(b.timestamp) - parseTime(a.timestamp));

      if (drinks.length > 0) {
        setLastDrinkTime(formatTime(drinks[0].timestamp));
      }

      const reminders = records
        .filter((item: any) => item.event_type === "reminder")
        .sort((a: any, b: any) => parseTime(b.timestamp) - parseTime(a.timestamp));

      if (reminders.length > 0) {
        const latest = reminders[0];

        if (latest.reminder_reason) {
          setLastReminderReason(latest.reminder_reason);
        } else if (latest.no_drink_reminder) {
          setLastReminderReason("You have not had water for a while.");
        } else if (latest.low_intake_reminder) {
          setLastReminderReason("Your water intake is below target.");
        } else {
          setLastReminderReason("Time to drink water.");
        }
      }
    } catch (error) {
      console.log("Reminder data error:", error);
    }
  }

  async function testNotification() {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Smart Cup Reminder 💧",
        body: "You have not had water for a while. Time to hydrate.",
        sound: "default",
        data: { screen: "Reminder" },
      },
      trigger: null,
    });
  }

  const goal = profile?.goal || 1600;
  const progress = goal > 0 ? Math.min(intake / goal, 1) : 0;
  const percent = Math.round(progress * 100);
  const remaining = Math.max(goal - intake, 0);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Hydration Assistant</Text>
        <Text style={styles.subtitle}>Personal reminders to keep you on track.</Text>

        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroLabel}>Today's Progress</Text>
              <Text style={styles.heroValue}>{percent}%</Text>
              <Text style={styles.heroSub}>
                {intake} / {goal} ml
              </Text>
            </View>

            <View style={styles.dropCircle}>
              <Text style={styles.drop}>💧</Text>
            </View>
          </View>

          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${percent}%` }]} />
          </View>

          <Text style={styles.heroHint}>
            {remaining === 0
              ? "Great job! You reached today's hydration goal."
              : `${remaining} ml remaining to reach today's goal.`}
          </Text>
        </View>

        <View style={styles.alertCard}>
          <View style={styles.alertIcon}>
            <Text style={styles.alertIconText}>🔔</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Smart Alert</Text>
            <Text style={styles.alertText}>{lastReminderReason}</Text>
          </View>
        </View>

        <View style={styles.statusGrid}>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Last Drink</Text>
            <Text style={styles.statusValue}>{lastDrinkTime}</Text>
          </View>

          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Interval</Text>
            <Text style={styles.statusValue}>
              {profile?.reminderMinutes || 60} min
            </Text>
          </View>
        </View>

        <View style={styles.actionsCard}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <TouchableOpacity style={styles.primaryButton} onPress={testNotification}>
            <Text style={styles.primaryText}>Test Reminder</Text>
          </TouchableOpacity>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Snooze 15 min</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Pause Today</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.sectionTitle}>Hydration Tip</Text>
          <Text style={styles.tipText}>
            Drinking 200–250 ml now can help you recover your daily hydration pace.
          </Text>
        </View>

        <View style={{ height: 130 }} />
      </ScrollView>

      <BottomNav active="Reminder" />
    </SafeAreaView>
  );
}

function parseTime(timestamp: string) {
  if (!timestamp) return 0;

  if (timestamp.includes("-")) {
    return new Date(timestamp).getTime();
  }

  const [datePart, timePart] = timestamp.split(" ");
  const [dd, mm, yyyy] = datePart.split("/").map(Number);
  const [hh, min] = (timePart || "0:0").split(":").map(Number);

  return new Date(yyyy, mm - 1, dd, hh || 0, min || 0).getTime();
}

function formatTime(timestamp: string) {
  if (!timestamp) return "-";

  if (timestamp.includes("-")) {
    const d = new Date(timestamp);
    return `${String(d.getHours()).padStart(2, "0")}:${String(
      d.getMinutes()
    ).padStart(2, "0")}`;
  }

  const timePart = timestamp.split(" ")[1];
  return timePart || "-";
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

  title: {
    marginTop: 20,
    fontSize: 31,
    fontWeight: "900",
    color: "#0A2033",
  },
  subtitle: {
    marginTop: 8,
    color: TEXT,
    fontSize: 16,
  },

  heroCard: {
    marginTop: 24,
    backgroundColor: DARK,
    borderRadius: 30,
    padding: 24,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroLabel: {
    color: "#C9DCE8",
    fontSize: 15,
    fontWeight: "700",
  },
  heroValue: {
    marginTop: 8,
    color: "white",
    fontSize: 52,
    fontWeight: "900",
  },
  heroSub: {
    color: "#C9DCE8",
    fontSize: 16,
    fontWeight: "700",
  },
  dropCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#123A55",
    alignItems: "center",
    justifyContent: "center",
  },
  drop: { fontSize: 48 },

  progressBar: {
    marginTop: 22,
    height: 12,
    borderRadius: 8,
    backgroundColor: "#1B4A68",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: BLUE,
    borderRadius: 8,
  },
  heroHint: {
    marginTop: 16,
    color: "#D4E7F2",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
  },

  alertCard: {
    marginTop: 18,
    backgroundColor: CARD,
    borderRadius: 28,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
  },
  alertIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: DARK,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  alertIconText: { fontSize: 28 },
  cardTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0A2033",
  },
  alertText: {
    marginTop: 6,
    color: TEXT,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "600",
  },

  statusGrid: {
    marginTop: 18,
    flexDirection: "row",
    gap: 14,
  },
  statusCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 24,
    padding: 18,
  },
  statusLabel: {
    color: TEXT,
    fontWeight: "700",
  },
  statusValue: {
    marginTop: 8,
    color: CYAN,
    fontSize: 22,
    fontWeight: "900",
  },

  actionsCard: {
    marginTop: 18,
    backgroundColor: CARD,
    borderRadius: 28,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: "900",
    color: "#0A2033",
  },
  primaryButton: {
    marginTop: 18,
    backgroundColor: CYAN,
    borderRadius: 22,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryText: {
    color: "white",
    fontSize: 16,
    fontWeight: "900",
  },
  actionRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#F0F7FA",
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryText: {
    color: "#0A2033",
    fontWeight: "800",
  },

  tipCard: {
    marginTop: 18,
    backgroundColor: "#EAF4F8",
    borderRadius: 24,
    padding: 20,
  },
  tipText: {
    marginTop: 10,
    color: "#415B75",
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
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
  navLabel: {
    marginTop: 4,
    fontSize: 12,
    color: "#7890A5",
    fontWeight: "700",
  },
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
  plusIcon: {
    color: "white",
    fontSize: 34,
    fontWeight: "300",
  },
});