import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Colors, Spacing, FontSizes } from "../config/theme";
import {
  fetchUserProfile,
  fetchWeeklyReadings,
  fetchUpcomingPayment,
  fetchBillingRecords,
  fetchReferrals,
  fetchEnergyTips,
  formatPeso,
  formatDate,
  isPastDateInGmt8,
} from "../services/dataService";
import { fetchHomeLiveData } from "../services/apiService";

export default function HomeScreen({ navigation }: any) {
  const { width } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState("");
  const [batteryLevel, setBatteryLevel] = useState(0);
  const [batteryStatus, setBatteryStatus] = useState("idle");
  const [weekProduction, setWeekProduction] = useState(0);
  const [weekConsumption, setWeekConsumption] = useState(0);
  const [weekSavings, setWeekSavings] = useState(0);
  const [upcomingPayment, setUpcomingPayment] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [referralEarnings, setReferralEarnings] = useState(0);
  const [solarEarnings, setSolarEarnings] = useState(0);
  const [energyTip, setEnergyTip] = useState<any>(null);

  const PESO_PER_KWH = 11.5;

  const loadData = useCallback(async () => {
    try {
      const [profile, weeklyData, payment, billing, referrals, tips] =
        await Promise.all([
          fetchUserProfile(),
          fetchWeeklyReadings(),
          fetchUpcomingPayment(),
          fetchBillingRecords(),
          fetchReferrals(),
          fetchEnergyTips(),
        ]);

      if (profile) setUserName(profile.full_name);

      if (weeklyData.length > 0) {
        const prod = weeklyData.reduce(
          (sum: number, r: any) => sum + Number(r.production_kwh),
          0,
        );
        const cons = weeklyData.reduce(
          (sum: number, r: any) => sum + Number(r.consumption_kwh),
          0,
        );
        setWeekProduction(Math.round(prod * 10) / 10);
        setWeekConsumption(Math.round(cons * 10) / 10);
        setWeekSavings(Math.round(prod * PESO_PER_KWH * 100) / 100);
      }

      if (payment) {
        setUpcomingPayment({
          type: payment.payment_type === "rto" ? "Rent-to-Own" : "Maintenance",
          amount: Number(payment.amount_php),
          dueDate: payment.due_date,
          status: isPastDateInGmt8(payment.due_date) ? "Overdue" : "Due Soon",
        });
      }

      if (billing) {
        const txs = billing.slice(0, 5).map((b: any) => ({
          id: b.id,
          date: b.paid_at || b.due_date,
          description: b.payment_type === "rto" ? "RTO Payment" : "Maintenance",
          amount: Number(b.amount_php),
          type: "debit" as const,
        }));
        setTransactions(txs);
      }

      if (referrals) {
        const earned = referrals
          .filter((r: any) => r.status === "installed" || r.status === "paid")
          .reduce(
            (sum: number, r: any) =>
              sum + Number(r.actual_earnings || r.estimated_earnings),
            0,
          );
        setReferralEarnings(earned);
      }

      if (tips && tips.length > 0) {
        const unread = tips.find((t: any) => !t.is_read);
        setEnergyTip(unread || tips[0]);
      }

      setLoading(false);
      setRefreshing(false);

      const liveData = await fetchHomeLiveData();
      if (liveData) {
        setBatteryLevel(liveData.battery_level ?? 0);
        setBatteryStatus(liveData.battery_status || "idle");
        setSolarEarnings(
          liveData.lifetime_savings_php ??
            Math.round((liveData.alltime_production_kwh ?? 0) * PESO_PER_KWH * 100) /
              100,
        );
      }
    } catch (err) {
      console.log("HomeScreen loadData error:", err);
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const totalEarnings = solarEarnings + referralEarnings;
  const isWeb = Platform.OS === "web";
  const isWide = width >= 1024;

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: Colors.background,
        }}
      >
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={isWeb ? styles.webContentContainer : undefined}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={[Colors.primary]}
        />
      }
    >
      <View style={[styles.header, isWeb && styles.webHeader]}>
        <View>
          <Text style={styles.greeting}>
            Hey, {userName.split(" ")[0] || "there"}!
          </Text>
          <Text style={styles.subtitle}>Welcome back</Text>
        </View>
        <TouchableOpacity
          style={styles.avatarCircle}
          onPress={() => navigation.navigate("My Account")}
        >
          <Text style={styles.avatarText}>
            {userName
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.earningsCard, isWeb && styles.webHeroCard]}>
        <Text style={styles.earningsLabel}>Your Total Earnings</Text>
        <Text style={styles.earningsAmount}>{formatPeso(totalEarnings)}</Text>
        <View style={[styles.earningsRow, isWide && styles.earningsRowWide]}>
          <View style={styles.earningsItem}>
            <Text style={styles.earningsItemLabel}>Solar Earnings</Text>
            <Text style={styles.earningsItemValue}>
              {formatPeso(solarEarnings)}
            </Text>
          </View>
          <View style={styles.earningsItem}>
            <Text style={styles.earningsItemLabel}>Referral Earnings</Text>
            <Text style={styles.earningsItemValue}>
              {formatPeso(referralEarnings)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>This Week</Text>
        <View style={[styles.weekCards, isWide && styles.weekCardsWide]}>
          <View style={[styles.statCard, { backgroundColor: "#E8F5E9" }]}>
            <Text style={styles.statIcon}>â˜€ï¸</Text>
            <Text style={styles.statValue}>{weekProduction} kWh</Text>
            <Text style={styles.statLabel}>Production</Text>
          </View>
          {weekConsumption > 0 && (
            <View style={[styles.statCard, { backgroundColor: "#FFF3E0" }]}>
              <Text style={styles.statIcon}>âš¡</Text>
              <Text style={styles.statValue}>{weekConsumption} kWh</Text>
              <Text style={styles.statLabel}>Consumption</Text>
            </View>
          )}
          <View style={[styles.statCard, { backgroundColor: "#E3F2FD" }]}>
            <Text style={styles.statIcon}>ðŸ’°</Text>
            <Text style={styles.statValue}>{formatPeso(weekSavings)}</Text>
            <Text style={styles.statLabel}>Savings</Text>
          </View>
        </View>
      </View>

      {batteryLevel > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Battery Status</Text>
          <View style={styles.batteryCard}>
            <View style={styles.batteryInfo}>
              <Text style={styles.batteryIcon}>ðŸ”‹</Text>
              <View>
                <Text style={styles.batteryLevel}>{batteryLevel}%</Text>
                <Text style={styles.batteryStatus}>
                  {batteryStatus === "charging"
                    ? "âš¡ Charging"
                    : batteryStatus === "full"
                      ? "âœ… Full"
                      : "ðŸ”Œ Discharging"}
                </Text>
              </View>
            </View>
            <View style={styles.batteryBarContainer}>
              <View
                style={[styles.batteryBar, { width: `${batteryLevel}%` }]}
              />
            </View>
          </View>
        </View>
      )}

      {upcomingPayment && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Payment</Text>
          <View style={styles.paymentCard}>
            <View style={styles.paymentRow}>
              <Text style={styles.paymentType}>{upcomingPayment.type}</Text>
              <View style={styles.dueBadge}>
                <Text style={styles.dueBadgeText}>
                  {upcomingPayment.status}
                </Text>
              </View>
            </View>
            <Text style={styles.paymentAmount}>
              Total amort to pay {formatPeso(upcomingPayment.amount)}
            </Text>
            <Text style={styles.paymentDue}>
              Your bill is due on {formatDate(upcomingPayment.dueDate)}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          <TouchableOpacity>
            <Text style={styles.seeAll}>See all</Text>
          </TouchableOpacity>
        </View>
        {transactions.slice(0, 3).map((tx) => (
          <View key={tx.id} style={styles.transactionRow}>
            <View>
              <Text style={styles.txDescription}>{tx.description}</Text>
              <Text style={styles.txDate}>{formatDate(tx.date)}</Text>
            </View>
            <Text
              style={[
                styles.txAmount,
                { color: tx.type === "credit" ? Colors.success : Colors.error },
              ]}
            >
              {tx.type === "credit" ? "+" : "-"}
              {formatPeso(tx.amount)}
            </Text>
          </View>
        ))}
      </View>

      {energyTip && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ðŸ’¡ Energy Tip</Text>
          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>{energyTip.title}</Text>
            <Text style={styles.tipDescription}>{energyTip.content}</Text>
            {energyTip.potential_savings_php && (
              <Text style={styles.tipSavings}>
                Potential savings:{" "}
                {formatPeso(Number(energyTip.potential_savings_php))}/month
              </Text>
            )}
          </View>
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  webContentContainer: {
    width: "100%",
    maxWidth: 1180,
    alignSelf: "center",
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.md,
    backgroundColor: "#d2ff1e",
  },
  webHeader: {
    paddingTop: Spacing.xl,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  greeting: {
    fontSize: FontSizes.xxl,
    fontWeight: "bold",
    color: "#1B5E20",
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: "#2E7D32",
    marginTop: 2,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1B5E20",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: FontSizes.lg,
    fontWeight: "bold",
    color: "#d2ff1e",
  },
  earningsCard: {
    backgroundColor: "#d2ff1e",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  webHeroCard: {
    paddingTop: Spacing.sm,
  },
  earningsLabel: {
    fontSize: FontSizes.md,
    color: "#2E7D32",
  },
  earningsAmount: {
    fontSize: FontSizes.hero,
    fontWeight: "bold",
    color: "#1B5E20",
    marginVertical: Spacing.xs,
  },
  earningsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
    gap: 16,
  },
  earningsRowWide: {
    maxWidth: 520,
  },
  earningsItem: {
    flex: 1,
  },
  earningsItemLabel: {
    fontSize: FontSizes.sm,
    color: "#388E3C",
  },
  earningsItemValue: {
    fontSize: FontSizes.lg,
    fontWeight: "600",
    color: "#1B5E20",
    marginTop: 2,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSizes.xl,
    fontWeight: "700",
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  seeAll: {
    fontSize: FontSizes.md,
    color: Colors.primaryLight,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  weekCards: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weekCardsWide: {
    gap: 16,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: 16,
    marginHorizontal: 4,
    alignItems: "center",
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  statValue: {
    fontSize: FontSizes.md,
    fontWeight: "700",
    color: Colors.text,
    textAlign: "center",
  },
  statLabel: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  batteryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  batteryInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  batteryIcon: {
    fontSize: 36,
    marginRight: Spacing.md,
  },
  batteryLevel: {
    fontSize: FontSizes.xxl,
    fontWeight: "bold",
    color: Colors.text,
  },
  batteryStatus: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
  batteryBarContainer: {
    height: 10,
    backgroundColor: "#E0E0E0",
    borderRadius: 5,
    overflow: "hidden",
  },
  batteryBar: {
    height: "100%",
    backgroundColor: Colors.success,
    borderRadius: 5,
  },
  paymentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  paymentType: {
    fontSize: FontSizes.lg,
    fontWeight: "600",
    color: Colors.text,
  },
  dueBadge: {
    backgroundColor: "#FFF3E0",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dueBadgeText: {
    fontSize: FontSizes.sm,
    color: Colors.warning,
    fontWeight: "600",
  },
  paymentAmount: {
    fontSize: FontSizes.md,
    color: Colors.text,
    marginTop: 4,
  },
  paymentDue: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  transactionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.sm,
  },
  txDescription: {
    fontSize: FontSizes.md,
    fontWeight: "500",
    color: Colors.text,
  },
  txDate: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  txAmount: {
    fontSize: FontSizes.lg,
    fontWeight: "700",
  },
  tipCard: {
    backgroundColor: "#E8F5E9",
    borderRadius: 16,
    padding: Spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primaryLight,
  },
  tipTitle: {
    fontSize: FontSizes.lg,
    fontWeight: "700",
    color: Colors.primary,
    marginBottom: Spacing.xs,
  },
  tipDescription: {
    fontSize: FontSizes.md,
    color: Colors.text,
    lineHeight: 20,
  },
  tipSavings: {
    fontSize: FontSizes.sm,
    color: Colors.primaryLight,
    fontWeight: "600",
    marginTop: Spacing.sm,
  },
});
