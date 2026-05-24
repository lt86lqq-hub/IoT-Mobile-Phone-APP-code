
import React, { useCallback, useState } from "react";
import Svg, {
  Path,
  Circle,
  Line,
  Rect,
  Text as SvgText,
} from "react-native-svg";

import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getProfile, Profile } from "../profileStore";


const CYAN = "#128EA5";
const DARK = "#08263D";
const TEXT_COLOR = "#73879B";
const BG = "#F7FAFC";
const CARD = "#FFFFFF";

type RangeType = "Day" | "Week" | "Month";

export default function HistoryScreen() {
  const [range, setRange] = useState<RangeType>("Day");
  const [records, setRecords] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [goal, setGoal] = useState(1600);
  const [selectedDrink, setSelectedDrink] = useState<any>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadProfileAndHistory();
    }, [])
  );

  async function loadProfileAndHistory() {
    const p = await getProfile();
    setProfile(p);
    setGoal(p.goal);
    await fetchHistoryData(p);
  }

  async function fetchHistoryData(p: Profile) {
  try {
    const apiUrl = `https://hyqzf7hmafho4wxvf2pyx7w5cq0zgjcs.lambda-url.ap-southeast-2.on.aws/?cup_ID=${p.cupId}&user_id=${p.userId}`;
    
    const response = await fetch(apiUrl);
    const raw = await response.json();
    const data = raw.body ? JSON.parse(raw.body) : raw;

    
    const records = Array.isArray(data?.records) ? data.records : [];
    const drinkRecords = Array.isArray(data?.drink_records) ? data.drink_records : [];
    const reminderRecords = Array.isArray(data?.reminder_records) ? data.reminder_records : [];
    const systemRecords = Array.isArray(data?.system_records) ? data.system_records : [];
    console.log("records count =", records.length);
    console.log("drinkRecords count =", drinkRecords.length);
    console.log("reminderRecords count =", reminderRecords.length);
    console.log("systemRecords count =", systemRecords.length);
    console.log("total_ml =", data.total_ml);
    console.log("first records =", records[0]);
    console.log("first drinkRecords =", drinkRecords[0]);

    const allItems = [
      ...records,
      ...drinkRecords,
      ...reminderRecords,
      ...systemRecords,
    ];

const profileItems = allItems.filter((item: any) => {
  return (
    item &&
    String(item.user_id || "").trim() === String(p.userId || "").trim() &&
    String(item.cup_ID || "").trim() === String(p.cupId || "").trim()
  );
});

    const uniqueItems = profileItems.filter(
     (item: any, index: number, self: any[]) =>
       item &&
       index ===
          self.findIndex(
            (x: any) =>
              x.timestamp === item.timestamp &&
              x.event_type === item.event_type &&
              x.user_id === item.user_id &&
              String(x.cup_ID || x.cup_id) ===
                 String(item.cup_ID || item.cup_id) &&
              Number(x.delta_ml || 0) ===
                Number(item.delta_ml || 0)
          )
    );

    console.log("History allItems =", allItems.length);
    console.log("History uniqueItems =", uniqueItems.length);

    setRecords(uniqueItems);

    const todayDrinkItems = uniqueItems.filter(
     (item: any) =>
       item &&
        (item.event_type === "drink" || item.event_type === "drink_event") &&
        isToday(item.timestamp)
    );

    const todayTotal = todayDrinkItems.reduce(
      (sum: number, item: any) => sum + Number(item.delta_ml || 0),
      0
    );

    setTotal(Math.round(todayTotal));
  } catch (error) {
    console.log("History fetch error:", error);
  }
}

  const chartData = buildChartData(records || [], range) || [];
  const dailyStats = getDailyStats(records || [], goal);
  const monthStats = getMonthStats(records || [], goal);
  const weekTotal = Math.round(chartData.reduce((sum, v) => sum + v, 0));
  
  const activeDays = chartData.filter((v) => Number(v) > 0).length;

   const weekAvg =
     activeDays > 0
       ? Math.round(weekTotal / activeDays)
       : 0;

  const weekLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const bestDayIndex = chartData.indexOf(Math.max(...chartData));
  const bestDay = weekTotal > 0 ? weekLabels[bestDayIndex] : "-";

  const goalDays = chartData.filter((v) => v >= goal).length;

  const recentRecords = records
  .filter((item: any) => isValidDrink(item) && Number(item.delta_ml || 0) > 0)
  .filter(
    (item: any, index: number, self: any[]) =>
      index ===
      self.findIndex(
        (x: any) =>
          x.timestamp === item.timestamp &&
          String(x.cup_ID || x.cup_id) === String(item.cup_ID || item.cup_id) &&
          String(x.event_type) === String(item.event_type) &&
          Number(x.delta_ml || 0) === Number(item.delta_ml || 0)
      )
  )
  .sort((a, b) => {
    const dateA = parseDateTime(a.timestamp);
    const dateB = parseDateTime(b.timestamp);
    return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
  })
  .slice(0, 50);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Hydration History</Text>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.label}>Total Intake</Text>
          <Text style={styles.bigValue}>{total} ml</Text>
          <Text style={styles.subText}>Cup ID: {profile?.cupId || "-"}</Text>
          <Text style={styles.subText2}>
            Goal Completion: {Math.round((total / goal) * 100)}%
          </Text>
        </View>

        <View style={styles.trendCard}>
          <Text style={styles.sectionTitle}>Hydration Analysis</Text>

          <View style={styles.tabs}>
            {(["Day", "Week", "Month"] as const).map((item) => (
              <TouchableOpacity
                key={item}
                style={[styles.tab, range === item && styles.tabActive]}
                onPress={() => setRange(item)}
              >
                <Text
                  style={[
                    styles.tabText,
                    range === item && styles.tabTextActive,
                  ]}
                >
                  {item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          {range === "Day" ? (
            <>
  <DayHeatMap
    records={records}
    onSelect={(item) => setSelectedDrink(item)}
  />
  {range === "Day" && selectedDrink ? (
  <View style={styles.drinkDetailCard}>
    <View style={styles.detailHeader}>
      <View style={styles.detailIcon}>
        <Text style={styles.detailEmoji}>💧</Text>
      </View>

      <View>
        <Text style={styles.detailTitle}>Drink Event</Text>
        <Text style={styles.detailTime}>
          {selectedDrink.timestamp || "-"}
        </Text>
      </View>
    </View>

    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>Amount</Text>
      <Text style={styles.detailValue}>
        {Math.round(Number(selectedDrink.delta_ml || 0))} ml
      </Text>
    </View>
    
    <TouchableOpacity
      style={styles.closeDetailButton}
      onPress={() => setSelectedDrink(null)}
    >
      <Text style={styles.closeDetailText}>Close</Text>
    </TouchableOpacity>
  </View>
) : null} 

  <View style={styles.weekSummaryCard}>
    <Text style={styles.weekSummaryTitle}>Daily Summary</Text>

    <View style={styles.summaryGrid}>
      
      <View style={styles.summaryRow}>
        <Text style={styles.summaryIcon}>🥤</Text>
        <Text style={styles.summaryItem}>
          Drink Events: {dailyStats.count}
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryIcon}>🔔</Text>
        <Text style={styles.summaryItem}>
        Reminders: {dailyStats.reminderCount}
        </Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryIcon}>🕒</Text>
        <Text style={styles.summaryItem}>
         Avg Intake per Active Hour: {dailyStats.avgHourly} ml
        </Text>
      </View>

      <View style={styles.summaryRow}>
         <Text style={styles.summaryIcon}>⏱</Text>
         <Text style={styles.summaryItem}>
         Longest Interval: {dailyStats.gapText}
        </Text>
      </View>
    </View>
  </View>
</>
          ) : range === "Week" ? (
             <WeekBarChart data={chartData} />
          ) : (
             <>
  <MonthCalendar records={records} goal={goal} />

  <View style={styles.weekSummaryCard}>
    <Text style={styles.weekSummaryTitle}>Monthly Summary</Text>

    <View style={styles.summaryGrid}>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryIcon}>💧</Text>
        <Text style={styles.summaryItem}>
          Total Intake: {monthStats.total} ml
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryIcon}>📊</Text>
        <Text style={styles.summaryItem}>
          Daily Avg: {monthStats.avg} ml
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryIcon}>🎯</Text>
        <Text style={styles.summaryItem}>
          Goal Days: {monthStats.goalDays} / {monthStats.daysInMonth}
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <Text style={styles.summaryIcon}>🔥</Text>
        <Text style={styles.summaryItem}>
          Longest Streak: {monthStats.longestStreak} days
        </Text>
      </View>
    </View>
  </View>
</>
          )}

          {range === "Week" ? (
            <View style={styles.weekSummaryCard}>
               <Text style={styles.weekSummaryTitle}>Weekly Summary</Text>

              <View style={styles.summaryGrid}>
                <View style={styles.summaryGrid}>
  <View style={styles.summaryRow}>
    <Text style={styles.summaryIcon}>💧</Text>
    <Text style={styles.summaryItem}>
      Total Intake: {weekTotal} ml
    </Text>
  </View>

  <View style={styles.summaryRow}>
    <Text style={styles.summaryIcon}>📊</Text>
    <Text style={styles.summaryItem}>
      Daily Avg: {weekAvg} ml
    </Text>
  </View>

  <View style={styles.summaryRow}>
    <Text style={styles.summaryIcon}>🏆</Text>
    <Text style={styles.summaryItem}>
      Best Day: {bestDay}
    </Text>
  </View>

  <View style={styles.summaryRow}>
    <Text style={styles.summaryIcon}>🎯</Text>
    <Text style={styles.summaryItem}>
      Goal Days: {goalDays} / 7
    </Text>
  </View>
</View>
              </View>
             </View>
          ) : null}

                 
</View>         

        <Text style={styles.recordsTitle}>Recent Records</Text>
        {recentRecords.map((item, index) => (
         <Record
           key={index}
           time={item.timestamp || "-"}
           amount={`${Math.round(Number(item.delta_ml || 0))} ml`}
           source="Drink Logged"
          />
        ))}

        
        <View style={{ height: 130 }} />
      </ScrollView>

      <BottomNav active="History" />
    </SafeAreaView>
  );
}

function isValidDrink(item: any) {
  return (
    item &&
    (item.event_type === "drink" || item.event_type === "drink_event") &&
    (item.event_valid === true ||
      item.event_valid === "true" ||
      item.event_valid === undefined ||
      item.event_valid === null)
  );
}
function buildChartData(records: any[], range: RangeType) {
 if (range === "Day") {
  const hourly = Array(24).fill(0);

  records
    .filter((item: any) => isValidDrink(item) && isToday(item.timestamp))
    .forEach((item: any) => {
      const hour = extractHour(item.timestamp);
      if (hour !== null) {
        hourly[hour] += Number(item.delta_ml || 0);
      }
    });

  return cumulative(hourly);
}

  if (range === "Week") {
    const daily = Array(7).fill(0);

    const validDrinks = records
      .filter(
        (item: any) =>
           isValidDrink(item) &&
          Number(item.delta_ml || 0) > 0
      )
      .filter(
        (item: any, index: number, self: any[]) =>
           index ===
           self.findIndex(
             (x: any) =>
               x.timestamp === item.timestamp &&
               String(x.cup_ID || x.cup_id) === String(item.cup_ID || item.cup_id) &&
               String(x.event_type) === String(item.event_type) &&
               Number(x.delta_ml || 0) === Number(item.delta_ml || 0)
        )
      );

    console.log("Week validDrinks =", validDrinks.map((x:any) => ({
       timestamp: x.timestamp,
       delta_ml: x.delta_ml,
       cup_ID: x.cup_ID,
       user_id: x.user_id,
    })));  

    const today = new Date();
    const monday = new Date(today);
    const day = monday.getDay();
    const diff = day === 0 ? -6 : 1 - day;

    monday.setDate(monday.getDate() + diff);
    monday.setHours(0, 0, 0, 0);

    validDrinks.forEach((item: any) => {
      const d = parseDateTime(item.timestamp);
      if (!d) return;

      const dateOnly = new Date(d);
      dateOnly.setHours(0, 0, 0, 0);

      const diffDays = Math.floor(
        (dateOnly.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (diffDays < 0 || diffDays > 6) return;

      daily[diffDays] += Number(item.delta_ml || 0);
    });

    console.log(
     "Tuesday records =",
     validDrinks
       .filter((x: any) => isToday(x.timestamp))
       .map((x: any) => ({
         timestamp: x.timestamp,
         delta_ml: x.delta_ml,
         event_type: x.event_type,
         event_valid: x.event_valid,
         cup_ID: x.cup_ID,
         user_id: x.user_id,
      }))
    );
    console.log("Week daily =", daily);

    return daily;
  }
 
  
}

function cumulative(values: number[]) {
  let sum = 0;
  return values.map((v) => {
    sum += v;
    return sum;
  });
}

function extractHour(timestamp: string) {
  const date = parseDate(timestamp);
  if (!date) return null;
  return date.getHours();
}

function parseDate(timestamp: string) {
  if (!timestamp) return null;

  // 支持 "18/05/26 12:46:21"
  const match = timestamp.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/
  );

  if (match) {
    const [, day, month, year, hour, minute, second] = match;

    const fullYear =
      year.length === 2 ? Number("20" + year) : Number(year);

    const date = new Date(
      fullYear,
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second)
    );

    return isNaN(date.getTime()) ? null : date;
  }

  // 支持 ISO 格式
  const date = new Date(timestamp);
  return isNaN(date.getTime()) ? null : date;
}

function parseDateTime(timestamp: string) {
  return parseDate(timestamp);
}

function formatRecordTime(timestamp?: string) {
  if (!timestamp) return "-";

  const d = parseDateTime(timestamp);
  if (!d) return "-";

  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");

  return `${hh}:${mm}`;
}

function isToday(timestamp: string) {
  const d = parseDateTime(timestamp);
  if (!d) return false;

  const today = new Date();

  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}
function DayHeatMap({
  records = [],
  onSelect,
}: {
  records?: any[];
  onSelect: (item: any) => void;
}) {
  const safeRecords = Array.isArray(records) ? records : [];

  const dayRecords = safeRecords
  .filter((item: any) => isValidDrink(item) && isToday(item.timestamp))
    .sort((a: any, b: any) => {
      const da = parseDateTime(a.timestamp);
      const db = parseDateTime(b.timestamp);
      return (da?.getTime() || 0) - (db?.getTime() || 0);
    });

  const width = 330;
  const height = 180;
  const left = 45;
  const right = 315;
  const top = 25;
  const bottom = 135;

  let maxMl = 100;
  dayRecords.forEach((item: any) => {
    maxMl = Math.max(maxMl, Number(item.delta_ml || 0));
  });

  const yTicks = [100, 75, 50, 25, 0];
  const xTicks = [0, 6, 12, 18, 24];
  const xLabels = [
    { x: left, label: "00:00" },
    { x: left + (right - left) * 0.33, label: "06:00" },
    { x: left + (right - left) * 0.66, label: "12:00" },
    { x: right, label: "24:00" },
  ];

  return (
    <Svg width="100%" height="180" viewBox={`0 0 ${width} ${height}`}>
      <SvgText x="0" y="10" fill="#73879B" fontSize="11" fontWeight="700">
        ml
      </SvgText>

      {yTicks.map((v, i) => {
        const y = top + (i / 4) * (bottom - top);
        return (
          <React.Fragment key={`y-${i}`}>
            <SvgText x="0" y={y + 4} fill="#73879B" fontSize="10">
              {Math.round((maxMl * v) / 100)}
            </SvgText>
            <Line x1={left} y1={y} x2={right} y2={y} stroke="#E8EEF3" />
          </React.Fragment>
        );
      })}

      {xTicks.map((hour, i) => {
        const x = left + (hour / 24) * (right - left);
        return (
          <Line
            key={`x-${i}`}
            x1={x}
            y1={top}
            x2={x}
            y2={bottom}
            stroke="#E3EDF3"
            strokeDasharray="5 6"
          />
        );
      })}

      {dayRecords.map((item: any, index: number) => {
        const d = parseDateTime(item.timestamp);
        if (!d) return null;

        const hour = d.getHours() + d.getMinutes() / 60;
        const amount = Number(item.delta_ml || 0);

        const x = left + (hour / 24) * (right - left);
        const y = bottom - (amount / maxMl) * (bottom - top);

        return (
        <React.Fragment key={`drink-${index}`}>
          <Circle
            cx={x}
            cy={y}
            r={12}
            fill="transparent"
          onPress={() => onSelect(item)}
          />

           <Circle
            cx={x}
            cy={y}
            r={4}
            fill={CYAN}
            opacity="0.9"
            onPress={() => onSelect(item)}
           />
        </React.Fragment>

        );
      })}

      {xLabels.map((item, i) => (
        <SvgText
          key={`label-${i}`}
          x={item.x}
          y={bottom + 25}
          fontSize="10"
          fill="#73879B"
          textAnchor="middle"
        >
          {item.label}
        </SvgText>
      ))}
    </Svg>
  );
}

function WeekBarChart({ data }: { data: number[] }) {
  const max = Math.max(...data, 100);
  const width = 330;
  const height = 180;
  const left = 45;
  const right = 315;
  const top = 25;
  const bottom = 135;
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <Svg width="100%" height="180" viewBox={`0 0 ${width} ${height}`}>
      <SvgText x="0" y="10" fill="#73879B" fontSize="11" fontWeight="700">
        ml
      </SvgText>

      {[100, 75, 50, 25, 0].map((v, i) => {
        const y = top + (i / 4) * (bottom - top);
        return (
          <React.Fragment key={i}>
            <SvgText x="0" y={y + 4} fill="#73879B" fontSize="10">
              {Math.round((max * v) / 100)}
            </SvgText>
            <Line x1={left} y1={y} x2={right} y2={y} stroke="#E8EEF3" />
          </React.Fragment>
        );
      })}

      {data.map((value, index) => {
        const gap = 10;
        const barWidth = (right - left) / 7 - gap;
        const x = left + index * ((right - left) / 7) + gap / 2;
        const barHeight = (value / max) * (bottom - top);
        const y = bottom - barHeight;

        return (
          <React.Fragment key={index}>
            {/* 柱子顶部数值 */}
            <SvgText
              x={x + barWidth / 2}
              y={Math.max(y - 8, 14)}
              fontSize="10"
              fill="#0A2033"
              fontWeight="700"
              textAnchor="middle"
            >
              {Math.round(value)}
             </SvgText>

            {/* 柱子 */}
            <Rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={6}
              fill={CYAN}
              opacity="0.9"
            />

            {/* 横坐标 */}
            <SvgText
              x={x + barWidth / 2}
              y={bottom + 24}
              fontSize="10"
              fill="#73879B"
              textAnchor="middle"
            >
               {labels[index]}
             </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}
function MonthCalendar({
  records,
  goal,
}: {
  records: any[];
  goal: number;
}) {
  
  const drinkRecords = records.filter((item: any) => isValidDrink(item));

  const dateCount: Record<string, number> = {};

  drinkRecords.forEach((x: any) => {
    const key = String(x.timestamp || "").split(" ")[0];
    dateCount[key] = (dateCount[key] || 0) + 1;
  });

  console.log("Month drinkRecords dateCount =", dateCount);

  const now =
    drinkRecords.length > 0
      ? parseDateTime(drinkRecords[0].timestamp) || new Date()
      : new Date();

  const year = now.getFullYear();
  const month = now.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const dailyTotals = Array(daysInMonth).fill(0);

  const debugByDate: Record<string, number> = {};

  drinkRecords.forEach((item: any) => {
     const d = parseDateTime(item.timestamp);
     if (!d) return;

     if (d.getFullYear() !== year || d.getMonth() !== month) return;

     const dayIndex = d.getDate() - 1;
     const amount = Number(item.delta_ml || 0);

     dailyTotals[dayIndex] += amount;

     const key =
       String(d.getDate()).padStart(2, "0") +
       "/" +
       String(d.getMonth() + 1).padStart(2, "0") +
       "/" +
       d.getFullYear();

     debugByDate[key] = (debugByDate[key] || 0) + amount;
  });

    
     console.log("MonthCalendar records =", records.length);
     console.log("MonthCalendar dailyTotals =", dailyTotals);
     console.log("debugByDate =", debugByDate);

  return (
    <View style={styles.monthCalendar}>
      <View style={styles.weekHeader}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => {
          return (
           <Text key={d} style={styles.weekDayText}>
             {d}
           </Text>
          );
        })}
      </View>

      <View style={styles.calendarGrid}>
        {Array.from({ length: startOffset }).map((_, index) => (
           <View key={`empty-${index}`} style={styles.calendarDay} />
        ))}
        {dailyTotals.map((total, index) => {
          const day = index + 1;
          const achieved = total >= goal;
          const hasDrink = total > 0;

          return (
            <View
              key={day}
              style={[
                styles.calendarDay,
                achieved && styles.calendarDayAchieved,
              ]}
            >
              <Text
                 style={[
                   styles.calendarDayText,
                   hasDrink && styles.calendarDayHasDrink,
                   achieved && styles.calendarDayTextAchieved,
                 ]}
                >
                 {day}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
function getMonthStats(records: any[] = [], goal: number) {
  const safeRecords = Array.isArray(records) ? records : [];

  const latestDrink = safeRecords.find((item: any) => isValidDrink(item));
  const now = latestDrink
    ? parseDateTime(latestDrink.timestamp) || new Date()
    : new Date();

  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dailyTotals = Array(daysInMonth).fill(0);

  safeRecords
    .filter((item: any) => isValidDrink(item))
    .forEach((item: any) => {
      const d = parseDateTime(item.timestamp);
      if (!d) return;

      if (d.getFullYear() !== year || d.getMonth() !== month) return;

      dailyTotals[d.getDate() - 1] += Number(item.delta_ml || 0);
    });

  const total = Math.round(dailyTotals.reduce((sum, value) => sum + value, 0));
  const activeDays = dailyTotals.filter((v) => Number(v) > 0).length;
  const avg = activeDays > 0 ? Math.round(total / activeDays) : 0;
  const goalDays = dailyTotals.filter((v) => v >= goal).length;

  let longestStreak = 0;
  let currentStreak = 0;

  dailyTotals.forEach((value) => {
    if (value >= goal) {
      currentStreak += 1;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  });

  return {
    total,
    avg,
    goalDays,
    longestStreak,
    daysInMonth,
  };
}
function getDailyStats(records: any[], goal: number) {
  const todayRecords = records.filter(
    (item: any) => item && isToday(item.timestamp)
  );

  const drinks = todayRecords
    .filter((item: any) => item.event_type === "drink")
    .sort((a: any, b: any) => {
      const da = parseDateTime(a.timestamp);
      const db = parseDateTime(b.timestamp);
      return (da?.getTime() || 0) - (db?.getTime() || 0);
    });

  const reminders = todayRecords.filter(
    (item: any) => item && item.event_type === "reminder"
  );

  const total = Math.round(
    drinks.reduce(
      (sum: number, item: any) => sum + Number(item.delta_ml || 0),
      0
    )
  );

  const count = drinks.length;
  const reminderCount = reminders.length;

  // longest interval
  let longestGap = 0;

  for (let i = 1; i < drinks.length; i++) {
    const prev = parseDateTime(drinks[i - 1].timestamp);
    const curr = parseDateTime(drinks[i].timestamp);

    if (!prev || !curr) continue;

    const gap = (curr.getTime() - prev.getTime()) / 1000 / 60;
    longestGap = Math.max(longestGap, gap);
  }

  const gapText =
    longestGap < 60
      ? `${Math.round(longestGap)} min`
      : `${(longestGap / 60).toFixed(1)} h`;

  // Avg Hourly Intake（按8小时）
  const avgHourly = Math.round(total / 8);

  return {
    count,
    reminderCount,
    gapText,
    avgHourly,
  };
}

function TrendChart({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const width = 330;
  const height = 180;
  const chartLeft = 52;
  const chartRight = 315;

  const points = data.map((value, index) => {
    const x =
      chartLeft +
      (index / Math.max(data.length - 1, 1)) * (chartRight - chartLeft);

    const y = 135 - (value / max) * 100;

    return { x, y };
  });

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const ticks = [max, max * 0.75, max * 0.5, max * 0.25, 0];
  const tickY = [35, 60, 85, 110, 135];

  return (
    <Svg width="100%" height="180" viewBox={`0 0 ${width} ${height}`}>
      <SvgText
        x="0"
        y="10"
        fill="#73879B"
        fontSize="11"
        fontWeight="700"
      >
        ml
      </SvgText>

      {ticks.map((v, i) => (
        <SvgText
          key={`tick-${i}`}
          x="0"
          y={tickY[i] + 4}
          fill="#73879B"
          fontSize="11"
          fontWeight="600"
        >
          {Math.round(v)}
        </SvgText>
      ))}

      {tickY.map((y) => (
        <Line
          key={`h-${y}`}
          x1={chartLeft}
          y1={y}
          x2={chartRight}
          y2={y}
          stroke="#E8EEF3"
        />
      ))}

      {[95, 150, 205, 260, 315].map((x) => (
        <Line
          key={`v-${x}`}
          x1={x}
          y1="35"
          x2={x}
          y2="135"
          stroke="#E3EDF3"
          strokeDasharray="5 6"
        />
      ))}

      <Path
        d={path}
        fill="none"
        stroke={CYAN}
        strokeWidth="5"
        strokeLinecap="round"
      />

      {points.map((p, index) => (
        <Circle
          key={`p-${index}`}
          cx={p.x}
          cy={p.y}
          r={index === points.length - 1 ? 7 : 4}
          fill="white"
          stroke={CYAN}
          strokeWidth="3"
        />
      ))}
    </Svg>
  );
}

function Record({ time, amount, source }: any) {
  return (
    <View style={styles.record}>
      <View style={styles.recordIcon}>
        <Text style={styles.recordIconText}>🥤</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.recordAmount}>{amount}</Text>
        <Text style={styles.recordSource}>{source}</Text>
      </View>

      <Text style={styles.recordTime}>{time}</Text>
    </View>
  );
}

function BottomNav({ active }: { active: string }) {
  return (
    <View style={styles.nav}>
      <NavItem icon="⌂" label="Home" active={false} onPress={() => router.push("/")} />
      <NavItem icon="◷" label="History" active={true} onPress={() => router.push("/logs")} />
      <TouchableOpacity style={styles.plusBtn}>
        <Text style={styles.plusIcon}>+</Text>
      </TouchableOpacity>
      <NavItem icon="◍" label="Social" active={false} onPress={() => router.push("/social")} />
      <NavItem icon="◎" label="Profile" active={false} onPress={() => router.push("/settings")} />
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
  safe:{flex:1,backgroundColor:BG},
  container:{padding:20,paddingBottom:30},
  header:{marginTop:20},
  title:{fontSize:30,fontWeight:"900",color:"#0A2033"},
  summaryCard:{marginTop:24,backgroundColor:DARK,borderRadius:28,padding:24},
  label:{color:"#D4E7F2",fontSize:16,fontWeight:"700"},
  bigValue:{marginTop:10,fontSize:42,fontWeight:"900",color:"white"},
  subText:{marginTop:8,color:CYAN,fontWeight:"800"},
  subText2:{marginTop:6,color:"#D4E7F2",fontSize:14,fontWeight:"700"},
  trendCard:{marginTop:18,backgroundColor:CARD,borderRadius:28,padding:20},
  sectionTitle:{fontSize:22,fontWeight:"900",color:"#0A2033"},
  tabs:{marginTop:14,flexDirection:"row",backgroundColor:"#F1F5F8",borderRadius:22,padding:4},
  tab:{flex:1,paddingVertical:8,borderRadius:18,alignItems:"center"},
  tabActive:{backgroundColor:CYAN},
  tabText:{color:"#50677D",fontWeight:"800"},
  tabTextActive:{color:"white"},

  recordsTitle:{marginTop:22,marginBottom:12,fontSize:22,fontWeight:"900",color:"#0A2033"},
  record:{backgroundColor:CARD,borderRadius:22,padding:16,marginBottom:12,flexDirection:"row",alignItems:"center"},
  recordIcon:{width:44,height:44,borderRadius:16,backgroundColor:"#F0F7FA",alignItems:"center",justifyContent:"center",marginRight:14},
  recordIconText:{fontSize:20},
  recordAmount:{fontSize:18,fontWeight:"900",color:"#0A2033"},
  recordSource:{marginTop:4,color:TEXT_COLOR},
  recordTime:{color:CYAN,fontWeight:"900",width:135,textAlign:"right",fontSize:15},
  nav:{position:"absolute",left:20,right:20,bottom:12,height:72,backgroundColor:"rgba(255,255,255,0.97)",borderRadius:30,flexDirection:"row",alignItems:"center",justifyContent:"space-around"},
  navItem:{alignItems:"center",width:55},
  navIcon:{fontSize:25,color:"#7890A5"},
  navLabel:{marginTop:4,fontSize:12,color:"#7890A5",fontWeight:"700"},
  navActive:{color:CYAN},
  plusBtn:{width:58,height:58,borderRadius:29,backgroundColor:CYAN,alignItems:"center",justifyContent:"center",marginTop:-12},
  plusIcon:{color:"white",fontSize:34,fontWeight:"300"},
  drinkDetailCard: {
  marginTop: 16,
  backgroundColor: "#EAF4F8",
  borderRadius: 24,
  padding: 18,
},

detailHeader: {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 16,
},

detailIcon: {
  width: 52,
  height: 52,
  borderRadius: 26,
  backgroundColor: DARK,
  alignItems: "center",
  justifyContent: "center",
  marginRight: 14,
},

detailEmoji: {
  fontSize: 26,
},

detailTitle: {
  fontSize: 20,
  fontWeight: "900",
  color: "#0A2033",
},

detailTime: {
  marginTop: 4,
  color: TEXT_COLOR,
  fontSize: 13,
  fontWeight: "700",
},

detailRow: {
  marginTop: 10,
  flexDirection: "row",
  justifyContent: "space-between",
},

detailLabel: {
  color: TEXT_COLOR,
  fontSize: 14,
  fontWeight: "700",
},

detailValue: {
  color: "#0A2033",
  fontSize: 15,
  fontWeight: "900",
},

closeDetailButton: {
  marginTop: 18,
  backgroundColor: CYAN,
  borderRadius: 18,
  paddingVertical: 12,
  alignItems: "center",
},

closeDetailText: {
  color: "white",
  fontSize: 15,
  fontWeight: "900",
},
weekSummaryCard: {
  marginTop: 14,
  backgroundColor: "#EAF4F8",
  borderRadius: 22,
  padding: 16,
},

weekSummaryTitle: {
  fontSize: 18,
  fontWeight: "900",
  color: "#0A2033",
  marginBottom: 10,
},

summaryGrid: {
  gap: 8,
},

summaryItem: {
  color: "#5C7186",
  fontSize: 14,
  fontWeight: "700",
},
summaryGrid: {
  marginTop: 6,
},

summaryRow: {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: 12,
},

summaryIcon: {
  width: 30,
  fontSize: 18,
  textAlign: "center",
  marginRight: 10,
},

summaryItem: {
  flex: 1,
  color: "#5C7186",
  fontSize: 14,
  fontWeight: "700",
  lineHeight: 20,
},
monthCalendar: {
  marginTop: 14,
  backgroundColor: "#F7FAFC",
  borderRadius: 22,
  padding: 14,
},

weekHeader: {
  flexDirection: "row",
  justifyContent: "space-between",
  marginBottom: 10,
},

weekDayText: {
  width: 38,
  textAlign: "center",
  color: "#73879B",
  fontSize: 11,
  fontWeight: "800",
},

calendarGrid: {
  flexDirection: "row",
  flexWrap: "wrap",
  rowGap: 10,
},

calendarDay: {
  width: "14.28%",
  alignItems: "center",
},

calendarDayText: {
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: "#E8EEF3",
  textAlign: "center",
  lineHeight: 32,
  color: "#73879B",
  fontSize: 13,
  fontWeight: "800",
},

calendarDayAchieved: {},

calendarDayHasDrink: {
  backgroundColor: "#BFEFF5",
  color: "#0A2033",
},

calendarDayTextAchieved: {
  backgroundColor: CYAN,
  color: "white",
},
});