// app/(tabs)/social.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import { router } from "expo-router";
import { getProfile, Profile } from "../profileStore";

const CYAN = "#128EA5";
const DARK = "#08263D";
const BG = "#F7FAFC";
const CARD = "#FFFFFF";
const TEXT = "#73879B";

type RankItem = {
  user_id: string;
  name: string;
  ml: number;
  percent: number;
};

export default function SocialScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ranking, setRanking] = useState<RankItem[]>([]);
  const [goal, setGoal] = useState(1600);

  useEffect(() => {
    loadRanking();
  }, []);

  async function loadRanking() {
    try {
      const p = await getProfile();
      setProfile(p);
      setGoal(p.goal || 1600);

      // 注意：这里不要传 user_id，否则只能查当前用户
     
      const apiUrl =  "https://hyqzf7hmafho4wxvf2pyx7w5cq0zgjcs.lambda-url.ap-southeast-2.on.aws/?social=true";

      const response = await fetch(apiUrl);
      const raw = await response.json();
      const data = raw.body ? JSON.parse(raw.body) : raw;

     const allRecords = [
       ...(Array.isArray(data?.records) ? data.records : []),
       ...(Array.isArray(data?.drink_records) ? data.drink_records : []),
      ];

     const uniqueRecords = allRecords.filter(
       (item: any, index: number, self: any[]) =>
         item &&
         index ===
           self.findIndex(
             (x) =>
               x.timestamp === item.timestamp &&
               x.cup_ID === item.cup_ID &&
               x.event_type === item.event_type &&
               Number(x.delta_ml || 0) === Number(item.delta_ml || 0)
            )
      );

      const todayDrinks = uniqueRecords.filter(
        (item: any) =>
          item &&
          (item.event_type === "drink_event" || item.event_type === "drink") &&
          Number(item.delta_ml || 0) > 0 &&
          isToday(item.timestamp)
      );
      
      console.log("Social todayDrinks =", todayDrinks);

    console.log(
      "Social total =",
      todayDrinks.reduce(
        (sum: number, item: any) =>
          sum + Number(item.delta_ml || 0),
        0
      )
    );

      const grouped: Record<string, RankItem> = {};

      todayDrinks.forEach((item: any) => {
        const cupId = item.cup_ID || item.cup_id || "unknown";
        const userId = cupId;
        const name = item.user_name || "unknown";
        const amount = Number(item.delta_ml || 0);

        if (!grouped[userId]) {
          grouped[userId] = {
            user_id: userId,
            name,
            ml: 0,
            percent: 0,
          };
        }

        grouped[userId].ml += amount;
      });

      const result = Object.values(grouped)
        .map((item) => ({
          ...item,
          ml: Math.round(item.ml),
          percent: Math.round((item.ml / (p.goal || 1600)) * 100),
        }))
        .sort((a, b) => b.ml - a.ml)
        .slice(0, 3);

      setRanking(result);
    } catch (error) {
      console.log("Social ranking error:", error);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Social</Text>
        <Text style={styles.subtitle}>
          Compare daily hydration progress with friends.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today&apos;s Hydration Ranking</Text>

          {ranking.length === 0 ? (
            <Text style={styles.emptyText}>No ranking data today.</Text>
          ) : (
            ranking.map((item, index) => (
              <View
                key={item.user_id}
                style={[
                  styles.rankRow,
                  profile?.userId === item.user_id && styles.myRankRow,
                ]}
              >
                <View style={styles.rankBadge}>
                  <Text style={styles.rankNumber}>{index + 1}</Text>
                </View>

                <View style={styles.userInfo}>
                  <Text style={styles.userName}>
                    {profile?.userId === item.user_id ? "You" : item.name}
                  </Text>
                  <Text style={styles.userMl}>{item.ml} ml</Text>
                </View>

                <Text style={styles.percent}>{item.percent}%</Text>
              </View>
            ))
          )}
        </View>
      </View>

      <BottomNav active="Social" />
    </SafeAreaView>
  );
}

function parseDateTime(timestamp?: string) {
  if (!timestamp) return null;

  if (timestamp.includes("-")) {
    return new Date(timestamp.replace(" ", "T"));
  }

  const [datePart, timePart = "0:0"] = timestamp.split(" ");
  const [dd, mm, yyyy] = datePart.split("/").map(Number);
  const [hh, min] = timePart.split(":").map(Number);

  if (!dd || !mm || !yyyy) return null;

  return new Date(yyyy, mm - 1, dd, hh || 0, min || 0);
}

function isToday(timestamp?: string) {
  const d = parseDateTime(timestamp);
  if (!d) return false;

  const today = new Date();

  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function BottomNav({ active }: { active: string }) {
  return (
    <View style={styles.nav}>
      <NavItem
        icon="⌂"
        label="Home"
        active={active === "Home"}
        onPress={() => router.push("/")}
      />

      <NavItem
        icon="◷"
        label="History"
        active={active === "History"}
        onPress={() => router.push("/logs")}
      />

      <TouchableOpacity style={styles.plusBtn}>
        <Text style={styles.plusIcon}>+</Text>
      </TouchableOpacity>

      <NavItem
        icon="◍"
        label="Social"
        active={active === "Social"}
        onPress={() => router.push("/social")}
      />

      <NavItem
        icon="◎"
        label="Profile"
        active={active === "Profile"}
        onPress={() => router.push("/settings")}
      />
    </View>
  );
}

function NavItem({ icon, label, active, onPress }: any) {
  return (
    <TouchableOpacity style={styles.navItem} onPress={onPress}>
      <Text style={[styles.navIcon, active && styles.navActive]}>{icon}</Text>
      <Text style={[styles.navLabel, active && styles.navActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BG,
  },

  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 70,
  },

  title: {
    fontSize: 36,
    fontWeight: "900",
    color: "#0A2033",
  },

  subtitle: {
    marginTop: 10,
    fontSize: 17,
    color: TEXT,
    fontWeight: "600",
    lineHeight: 24,
  },

  card: {
    marginTop: 34,
    backgroundColor: CARD,
    borderRadius: 28,
    padding: 24,
  },

  cardTitle: {
    fontSize: 23,
    fontWeight: "900",
    color: "#0A2033",
    marginBottom: 22,
  },

  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F7FA",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 14,
  },

  myRankRow: {
    backgroundColor: "#E7F7FA",
    borderWidth: 1.5,
    borderColor: CYAN,
  },

  rankBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: CYAN,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },

  rankNumber: {
    color: "white",
    fontSize: 20,
    fontWeight: "900",
  },

  userInfo: {
    flex: 1,
  },

  userName: {
    color: "#0A2033",
    fontSize: 20,
    fontWeight: "900",
  },

  userMl: {
    marginTop: 4,
    color: TEXT,
    fontSize: 14,
    fontWeight: "700",
  },

  percent: {
    color: CYAN,
    fontSize: 18,
    fontWeight: "900",
  },

  emptyText: {
    color: TEXT,
    fontSize: 15,
    fontWeight: "700",
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

  navItem: {
    alignItems: "center",
    width: 55,
  },

  navIcon: {
    fontSize: 25,
    color: "#7890A5",
  },

  navLabel: {
    marginTop: 4,
    fontSize: 12,
    color: "#7890A5",
    fontWeight: "700",
  },

  navActive: {
    color: CYAN,
  },

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