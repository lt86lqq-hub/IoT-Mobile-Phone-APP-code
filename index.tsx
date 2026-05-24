import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getProfile, Profile } from "../profileStore";
import Svg, { Circle, Path, Line, Text as SvgText,} from "react-native-svg";
import * as Notifications from "expo-notifications";

const BLUE = "#19B5C9";
const CYAN = "#128EA5";
const DARK = "#08263D";
const TEXT = "#73879B";
const BG = "#F7FAFC";
const CARD = "#FFFFFF";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function HomeScreen() {
  const [range, setRange] = useState<"Day" | "Week" | "Month">("Day");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [goal, setGoal] = useState(1600);
  const [intake, setIntake] = useState(0);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [lastReminderId, setLastReminderId] = useState("");  
  const progress = intake / goal;
  const percent = Math.round(progress * 100);
  const remaining = Math.max(goal - intake, 0);
  const chartData = buildChartData(records, range);

  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderTime, setReminderTime] = useState("");

  useFocusEffect(
    useCallback(() => {
      loadProfileAndData();
    }, [])
  );  
  
  async function loadProfileAndData() {
   await requestNotificationPermission();

   const p = await getProfile();
   setProfile(p);
   await fetchHydrationData(p);
 }

  async function requestNotificationPermission() {
   const { status } = await Notifications.getPermissionsAsync();

   if (status !== "granted") {
    const result = await Notifications.requestPermissionsAsync();

    if (result.status !== "granted") {
      console.log("Notification permission not granted");
      return;
    }
   }

   console.log("Notification permission granted");
  }

  async function fetchHydrationData(p: Profile) {
  try {
    setLoading(true);

    
    const apiUrl = `https://hyqzf7hmafho4wxvf2pyx7w5cq0zgjcs.lambda-url.ap-southeast-2.on.aws/?cup_ID=${p.cupId}&user_id=${p.userId}`;
    const response = await fetch(apiUrl);

    console.log("API URL =", apiUrl);
    console.log("HTTP status =", response.status);

    const raw = await response.json();
    const data = raw.body ? JSON.parse(raw.body) : raw;

    console.log("API result =", data);

    const records = data.records || [];
    const reminderRecords = data.reminder_records || [];
    const drinkRecords = data.drink_records || [];
    const systemRecords = data.system_records || [];

    const allRecords = [
      ...records,
      ...drinkRecords,
      ...reminderRecords,
      ...systemRecords,
    ];

    const uniqueRecords = allRecords.filter(
      (item: any, index: number, self: any[]) =>
        index ===
        self.findIndex(
          (x) =>
            x.timestamp === item.timestamp &&
            x.event_type === item.event_type &&
            x.user_id === item.user_id &&
            x.cup_ID === item.cup_ID
        )
    );

    setRecords(uniqueRecords);

    const todayDrinkRecords = uniqueRecords.filter((item: any) => {
      return (
         (item.event_type === "drink" || item.event_type === "drink_event") &&
         isToday(item.timestamp)
      );
    });

    const todayTotal = todayDrinkRecords.reduce(
      (sum: number, item: any) => sum + Number(item.delta_ml || 0),
      0
    );

    setGoal(p.goal);
    setIntake(Math.round(todayTotal));

    updateHomeReminder(uniqueRecords);
  } catch (error) {
    console.log("Fetch error:", error);
  } finally {
    setLoading(false);
  }
}

async function checkReminderEvent(records: any[]) {
  console.log("all records =", records);

  const reminderEvents = records
    .filter((item: any) => item.event_type === "reminder")
    .sort((a: any, b: any) => {
      return (
        parseTimestamp(b.timestamp).getTime() -
        parseTimestamp(a.timestamp).getTime()
      );
    });

  console.log("reminderEvents =", reminderEvents);

  if (reminderEvents.length === 0) return;

  const latest = reminderEvents[0];
  const reminderId = `${latest.cup_ID}-${latest.timestamp}`;

  if (reminderId === lastReminderId) return;

  setLastReminderId(reminderId);

  await Notifications.scheduleNotificationAsync({
    content: {
     title: "Time to hydrate 💧",
      body:
        latest.reminder_reason ||
       `No drinking has been detected for ${profile?.reminderMinutes || 60} minutes.`,
      sound: "default",
    },
    trigger: null,
  });
}

function updateHomeReminder(records: any[]) {
  const reminders = records
    .filter((item: any) => item.event_type === "reminder")
    .sort((a: any, b: any) => {
      return (
        parseTimestamp(b.timestamp).getTime() -
        parseTimestamp(a.timestamp).getTime()
      );
    });

  if (reminders.length === 0) {
    setReminderMessage("");
    return;
  }

  const latest = reminders[0];

  setReminderTime(formatReminderTime(latest.timestamp));

  function formatReminderTime(ts: string) {
     const d = parseTimestamp(ts);

     return d.toLocaleString("en-NZ", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        month: "short",
        day: "numeric",
    });
  }

  if (latest.reminder_reason) {
    setReminderMessage(latest.reminder_reason);
  } else if (latest.no_drink_reminder) {
    setReminderMessage(
      "You haven't had water for a while. Time to hydrate."
    );
  } else if (latest.low_intake_reminder) {
    setReminderMessage(
      "Your water intake is below target. Please drink some water."
    );
  } else {
    setReminderMessage("Time to drink water.");
  }
}


function getCoachMessage(intake: number, goal: number) {
  const remaining = Math.max(goal - intake, 0);
  const percent = goal > 0 ? Math.round((intake / goal) * 100) : 0;

  if (percent >= 100) {
    return "Excellent work! You reached today’s hydration goal 🎉";
  }

  if (percent >= 80) {
    return `You are almost there — only ${remaining} ml to go.`;
  }

  if (percent >= 50) {
    return `Good progress. Drink another ${remaining} ml to reach your goal.`;
  }

  if (percent > 0) {
    return `You have started today. Keep sipping — ${remaining} ml remaining.`;
  }

  return "No drinking recorded yet today. Start with a small glass of water 💧";
}

async function testNotification() {
  await Notifications.scheduleNotificationAsync({
        content: {
         title: "Test Reminder 💧",
         body: "This is a test hydration notification.",
         sound: "default",
    },
    trigger: null,
  });
}
  
React.useEffect(() => {
  const sub =
    Notifications.addNotificationResponseReceivedListener(() => {
      loadProfileAndData();
      router.replace("/(tabs)");
    });

  return () => sub.remove();
}, []);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hello, {profile?.name || "User"} 👋</Text>
            <Text style={styles.title}>Smart Hydration</Text>
            <Text style={styles.subtitle}>Track your daily drinking progress.</Text>
          </View>          
        </View>

        <View style={styles.goalCard}>
          <View style={styles.goalTopRow}>
            <View style={styles.goalLeft}>
              <Text style={styles.cardLabel}>Today's Goal</Text>
              <Text style={styles.goalText}>{goal} ml</Text>

              <Text style={styles.status}>
                {loading
                  ? "● Loading..."
                  : intake >= goal * 0.7
                  ? "● On Track"
                  : "● Need More Water"}
              </Text>
            </View>

            <View style={styles.progressWrap}>
              <ProgressRing progress={progress} />
              <View style={styles.progressCenter}>
                <Text style={styles.percent}>{percent}%</Text>
                <Text style={styles.progressSub}>
                  {intake} / {goal} ml
                </Text>
              </View>
            </View>
          </View>

          <WaveBackground />
        </View>

        <View style={styles.trendCard}>
          <View style={styles.trendHeader}>
            <Text style={styles.sectionTitle}>Hydration Trend</Text>

            <View style={styles.tabs}>
              {(["Day", "Week", "Month"] as const).map((item) => (
                <TouchableOpacity
                  key={item}
                  style={[styles.tab, range === item && styles.tabActive]}
                  onPress={() => setRange(item)}
                >
                  <Text style={[styles.tabText, range === item && styles.tabTextActive]}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
          <TrendChart data={chartData} range={range} />          
          
        </View>
        
        {reminderMessage ? (
          <View style={styles.homeReminderCard}>
             <View style={styles.reminderLeft}>
              <Text style={styles.reminderEmoji}>🔔</Text>
             </View>

           <View style={{ flex: 1 }}>
             <Text style={styles.homeReminderTitle}>Hydration Alert</Text>
             <Text style={styles.homeReminderText}>{reminderMessage}</Text>

             <Text style={styles.reminderTime}>
              Last reminder · {reminderTime}
            </Text>
           </View>
          </View>
        ) : null}

        <View style={styles.coachCard}>
            <View style={styles.reminderLeft}>
               <Text style={styles.reminderEmoji}>💧</Text>
            </View>

            <View style={{ flex: 1 }}>
               <Text style={styles.homeReminderTitle}>Hydration Coach</Text>

               <Text style={styles.homeReminderText}>
                  {loading
                    ? "Loading hydration data..."
                    : getCoachMessage(intake, goal)}
               </Text>

                <Text style={styles.reminderTime}>
                  Daily guidance
                 </Text>
            </View>
        </View>
         
     
        <View style={styles.bottomCards}>
          
        </View>

        <View style={{ height: 170 }} />
      </ScrollView>

      <BottomNav active="Home" />
    </SafeAreaView>
  );
}

function TrendChart(
  { data, range }: {
    data: number[];
    range: "Day" | "Week" | "Month";
  }
) {
  const max = Math.max(...data, 1);

  // 向上取整到漂亮刻度
  const roundedMax = Math.ceil(max / 200) * 200 || 200;

  const width = 360;
  const height = 170;

  const left = 42;     // 给Y轴留空间
  const right = 330;
  const top = 24;
  const bottom = 145;
  const xLabels =
   range === "Day"
    ? [
        { x: left, label: "00:00" },
        { x: left + (right - left) * 0.33, label: "06:00" },
        { x: left + (right - left) * 0.66, label: "12:00" },
        { x: right, label: "24:00" },
      ]
    : range === "Week"
    ? [
        { x: left, label: "Mon" },
        { x: left + (right - left) * 0.16, label: "Tue" },
        { x: left + (right - left) * 0.33, label: "Wed" },
        { x: left + (right - left) * 0.5, label: "Thu" },
        { x: left + (right - left) * 0.66, label: "Fri" },
        { x: left + (right - left) * 0.83, label: "Sat" },
        { x: right, label: "Sun" },
      ]
    : [
        { x: left, label: "Week 1" },
        { x: left + (right - left) * 0.33, label: "Week 2" },
        { x: left + (right - left) * 0.66, label: "Week 3" },
        { x: right, label: "Week 4" },
      ];

  const points = data.map((value, index) => {
    const x =
      left +
      (index / Math.max(data.length - 1, 1)) *
        (right - left);

    const y =
      bottom -
      (value / roundedMax) *
        (bottom - top);

    return { x, y };
  });

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const areaPath =
    `${path} L${right} ${bottom} L${left} ${bottom} Z`;

  const ticks = [
    roundedMax,
    roundedMax * 0.75,
    roundedMax * 0.5,
    roundedMax * 0.25,
    0,
  ];

  return (
    
    <Svg width="100%" height="170" viewBox={`0 0 ${width} ${height}`}>

      {/* unit */}
      <SvgText
        x="4"
        y="4"
        fontSize="10"
        fontWeight="700"
        fill="#7A8D9E"
      >
        ml
      </SvgText>



      {/* Y axis labels */}
      {ticks.map((t, i) => {
        const y =
          top +
          (i / (ticks.length - 1)) *
            (bottom - top);

        return (
          <React.Fragment key={i}>
            <SvgText
              x="4"
              y={y + 4}
              fontSize="11"
              fill="#7A8D9E"
            >
              {Math.round(t)}
            </SvgText>

            <Line
              x1={left}
              y1={y}
              x2={right}
              y2={y}
              stroke="#E6EDF2"
            />
          </React.Fragment>
        );
      })}

      {/* vertical lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((v, i) => {
        const x = left + v * (right - left);

        return (
          <Line
            key={i}
            x1={x}
            y1={top}
            x2={x}
            y2={bottom}
            stroke="#E6EDF2"
            strokeDasharray="4 5"
          />
        );
      })}

      {/* area */}
      <Path
        d={areaPath}
        fill="#19B5C9"
        opacity="0.12"
      />

      {/* line */}
      <Path
        d={path}
        fill="none"
        stroke={CYAN}
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* points */}
      {points.map((p, i) => (
       <Circle
         key={i}
         cx={p.x}
         cy={p.y}
         r={i === points.length - 1 ? 5 : 3}
         fill="white"
         stroke={CYAN}
         strokeWidth={i === points.length - 1 ? 2.5 : 2}
        />
      ))}

      {/* X axis ticks + labels */}
      {xLabels.map((item, i) => (
        <React.Fragment key={i}>
          <Line
           x1={item.x}
           y1={bottom}
           x2={item.x}
           y2={bottom + 6}
           stroke="#B7C7D3"
           strokeWidth="1.5"
          />

          <SvgText
             x={item.x}
             y={bottom + 22}
             fontSize="10"
             fill="#7A8D9E"
             textAnchor="middle"
          >
             {item.label}
          </SvgText>
        </React.Fragment>
      ))}     


    </Svg>
  );
}
function parseTimestamp(timestamp: string) {
  if (!timestamp) return new Date(0);

  try {
    // 格式 1:
    // 2026-05-02 20:05:45
    if (timestamp.includes("-")) {
      return new Date(timestamp.replace(" ", "T"));
    }

    // 格式 2:
    // 18/05/26 13:03:16
    // 格式 3:
    // 18/05/2026 10:36

    const [datePart, timePart = "0:0:0"] = timestamp.split(" ");

    const [dd, mm, rawYear] = datePart.split("/").map(Number);

    const [hh = 0, min = 0, sec = 0] =
      timePart.split(":").map(Number);

    // 自动兼容 26 和 2026
    const yyyy =
      rawYear < 100 ? 2000 + rawYear : rawYear;

    return new Date(
      yyyy,
      mm - 1,
      dd,
      hh,
      min,
      sec
    );
  } catch (e) {
    console.log("parseTimestamp error:", e);
    return new Date(0);
  }
}
function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function isToday(timestamp: string) {
  if (!timestamp) return false;

  const d = parseTimestamp(timestamp);
  const today = new Date();

  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function ProgressRing({ progress }: { progress: number }) {
  const ringProgress = Math.min(progress, 1);

  const radius = 68;
  const strokeWidth = 13;

  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset =
    circumference * (1 - ringProgress);

  return (
    <Svg width={190} height={190} viewBox="0 0 190 190">
      <Circle
        cx="95"
        cy="95"
        r={radius}
        stroke="#1B4A68"
        strokeWidth={strokeWidth}
        fill="none"
      />

      <Circle
        cx="95"
        cy="95"
        r={radius}
        stroke={BLUE}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={strokeDashoffset}
        rotation="-90"
        origin="95,95"
      />
    </Svg>
  );
}

function buildChartData(records: any[], range: "Day" | "Week" | "Month") {
  const validDrinks = records.filter((item: any) => {
    return item.event_type === "drink" || item.event_type === "drink_event";
  });

  if (range === "Day") {
    const hourly = Array(24).fill(0);

    validDrinks.forEach((item: any) => {
      const d = parseTimestamp(item.timestamp);
      if (!isSameDay(d, new Date())) return;

      const hour = d.getHours();
      hourly[hour] += Number(item.delta_ml || 0);
    });

    return cumulative(hourly);
  }

  if (range === "Week") {
    const daily = Array(7).fill(0);

    const now = new Date();

    const monday = new Date(now);
    const day = monday.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(monday.getDate() + diff);
    monday.setHours(0, 0, 0, 0);

    const nextMonday = new Date(monday);
    nextMonday.setDate(nextMonday.getDate() + 7);

    validDrinks.forEach((item: any) => {
      const d = parseTimestamp(item.timestamp);
      if (d < monday || d >= nextMonday) return;

      const index = Math.floor(
        (d.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (index >= 0 && index < 7) {
        daily[index] += Number(item.delta_ml || 0);
      }
    });

    return daily;
  }

  const daysInMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0
  ).getDate();

  const dailyOfMonth = Array(daysInMonth).fill(0);

  validDrinks.forEach((item: any) => {
    const d = parseTimestamp(item.timestamp);
    const now = new Date();

    if (d.getFullYear() !== now.getFullYear()) return;
    if (d.getMonth() !== now.getMonth()) return;

    const dayIndex = d.getDate() - 1;
    dailyOfMonth[dayIndex] += Number(item.delta_ml || 0);
  });

  return dailyOfMonth;
}

function cumulative(values: number[]) {
  let sum = 0;
  return values.map((v) => {
    sum += v;
    return sum;
  });
}

function extractHour(timestamp: string) {
  if (!timestamp) return null;

  const d = parseTimestamp(timestamp);
  const hour = d.getHours();

  return Number.isNaN(hour) ? null : hour;
}

function WaveBackground() {
  return (
    <Svg width="100%" height="100" viewBox="0 0 350 100" style={styles.wave}>
      <Path d="M0 62 C55 12 120 92 180 46 C240 0 300 80 350 34" stroke="#19B5C9" strokeWidth="2.4" fill="none" opacity="0.9" />
      <Path d="M0 76 C70 22 130 88 200 56 C260 24 300 72 350 46" stroke="#38C5D7" strokeWidth="1.8" fill="none" opacity="0.8" />
      <Path d="M0 68 C80 42 140 96 220 52 C280 22 320 82 350 62" stroke="#7DDDEA" strokeWidth="1.2" fill="none" opacity="0.7" />
      <Path d="M0 82 C70 52 120 78 180 65 C240 50 290 86 350 70" stroke="#128EA5" strokeWidth="1" fill="none" opacity="0.55" />
    </Svg>
  );
}

function BottomNav({ active }: { active: string }) {
  return (
    <View style={styles.nav}>
      <NavItem icon="⌂" label="Home" active={active === "Home"} onPress={() => router.push("/")} />
      <NavItem icon="◷" label="History" active={active === "History"} onPress={() => router.push("/logs")} />
      
      <TouchableOpacity
        style={styles.plusBtn}
        onPress={() => router.push("/add-drink")}
      >
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
  container: { padding: 20, paddingBottom: 30 },

  header: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  greeting: { fontSize: 15, color: "#45627D", fontWeight: "600" },
  title: { marginTop: 8, fontSize: 31, fontWeight: "900", color: "#0A2033" },
  subtitle: { marginTop: 8, color: TEXT, fontSize: 16 },
  bell: { fontSize: 24, marginTop: 35 },

  goalCard: {
    marginTop: 24,
    backgroundColor: DARK,
    borderRadius: 28,
    padding: 22,
    minHeight: 250,
    overflow: "hidden",
    shadowColor: "#AFC8D8",
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 8,
  },
  goalTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    zIndex: 2,
  },
  goalLeft: { width: 145, zIndex: 2 },
  cardLabel: { fontSize: 17, color: "#D4E7F2", fontWeight: "700" },
  goalText: { marginTop: 12, fontSize: 30, fontWeight: "900", color: "white" },
  status: { marginTop: 18, color: "#55E9FF", fontSize: 16, fontWeight: "800" },

  progressWrap: {
   width: 185,
   height: 185,
   alignItems: "center",
   justifyContent: "center",
   zIndex: 2,
  },
  progressCenter: { position: "absolute", alignItems: "center" },
  percent: { fontSize: 36, fontWeight: "900", color: "white",},
  progressSub: {
    marginTop: 6,
    color: "#BFD3DF",
    fontSize: 15,
    fontWeight: "600",
  },
  
 
  wave: { position: "absolute", bottom: -10, left: 0,  opacity: 0.9,},

  trendCard: {
    marginTop: 18,
    backgroundColor: CARD,
    borderRadius: 28,
    padding: 20,
    shadowColor: "#AFC8D8",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  trendHeader: { gap: 14 },
  sectionTitle: { fontSize: 22, fontWeight: "900", color: "#0A2033" },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#F1F5F8",
    borderRadius: 22,
    padding: 4,
    width: "100%",
  },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 18, alignItems: "center" },
  tabActive: { backgroundColor: CYAN },
  tabText: { color: "#50677D", fontWeight: "800" },
  tabTextActive: { color: "white" },
  timeRow: { marginTop: 6, flexDirection: "row", justifyContent: "space-between" },
  time: { color: "#415B75", fontSize: 13 },
  
 homeReminderCard: {
  marginTop: 18,
  backgroundColor: "#EAF4F8",
  borderRadius: 26,
  padding: 18,
  flexDirection: "row",
  alignItems: "center",
 },

 reminderLeft: {
  width: 54,
  height: 54,
  borderRadius: 27,
  backgroundColor: DARK,
  alignItems: "center",
  justifyContent: "center",
  marginRight: 16,
 },

 reminderEmoji: {
  fontSize: 26,
 },

 homeReminderTitle: {
  fontSize: 18,
  fontWeight: "900",
  color: "#0A2033",
 },

 homeReminderText: {
  marginTop: 5,
  color: "#5C7186",
  fontSize: 14,
  lineHeight: 20,
  fontWeight: "600",
 },

 reminderTime: {
  marginTop: 6,
  color: CYAN,
  fontSize: 13,
  fontWeight: "800",
 },

 coachCard: {
  marginTop: 14,
  backgroundColor: "#FFFFFF",
  borderRadius: 26,
  padding: 18,
  flexDirection: "row",
  alignItems: "center",
 },

  bottomCards: { marginTop: 18, flexDirection: "column", gap: 14 },
  smallCard: {
    width: "100%",
    backgroundColor: CARD,
    borderRadius: 28,
    padding: 18,
    minHeight: 230,
    shadowColor: "#AFC8D8",
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },
  smallHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: { fontSize: 20, fontWeight: "900", color: "#0A2033" },
  moreText: { color: "#73879B", fontWeight: "700" },
  reminderRow: {
    marginTop: 18,
    backgroundColor: "#F5F8FA",
    borderRadius: 20,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  darkIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: DARK,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  iconText: { color: CYAN, fontSize: 22 },
  smallLabel: { color: TEXT, fontSize: 13, fontWeight: "700" },
  bigTime: { color: "#0A2033", fontSize: 24, fontWeight: "900" },
  cardMetric: { color: "#0A2033", fontSize: 20, fontWeight: "900" },

  
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
    shadowColor: "#AFC8D8",
    shadowOpacity: 0.2,
    shadowRadius: 25,
    elevation: 12,
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
    shadowColor: CYAN,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 12,
  },
  plusIcon: {
     color: "white",
      fontSize: 34,
      fontWeight: "300",
  },
});