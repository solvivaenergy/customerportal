import { supabase } from "./supabase";

const GMT8_OFFSET_MINUTES = 8 * 60;
const MINUTE_MS = 60 * 1000;

type FiveMinuteReading = Record<string, any>;

export type LiveData = {
  current_power_w: number;
  today_production_kwh: number;
  today_consumption_kwh: number;
  today_grid_import_kwh: number;
  today_grid_export_kwh: number;
  battery_level: number | null;
  battery_status: string | null;
  capacity_kwp: number;
  station_name: string;
  alltime_production_kwh: number;
  lifetime_savings_php?: number;
  month_production_kwh: number;
  today_hourly?: { hour: number; production_kwh: number; consumption_kwh: number }[];
  today_readings?: {
    timestamp: string;
    production: number;
    production_unit: "kW" | "kWh";
    consumption: number;
    consumption_unit: "kW" | "kWh";
    battery_level: number | null;
  }[];
};

export type HomeLiveData = Pick<
  LiveData,
  "battery_level" | "battery_status" | "alltime_production_kwh" | "lifetime_savings_php"
>;

const getTodayStartIsoInGmt8 = () => {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * MINUTE_MS;
  const gmt8 = new Date(utcMs + GMT8_OFFSET_MINUTES * MINUTE_MS);
  const startUtc = new Date(
    Date.UTC(gmt8.getUTCFullYear(), gmt8.getUTCMonth(), gmt8.getUTCDate()) -
      GMT8_OFFSET_MINUTES * MINUTE_MS,
  );
  return startUtc.toISOString();
};

const toNumber = (...values: unknown[]): number => {
  for (const value of values) {
    if (value == null || value === "") continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const firstString = (...values: unknown[]): string | null => {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
};

const getProductionValue = (reading: FiveMinuteReading) =>
  toNumber(
    reading.production_kw,
    reading.power_kw,
    reading.production_kwh,
    reading.energy_kwh,
  );

const getConsumptionValue = (reading: FiveMinuteReading) =>
  toNumber(
    reading.consumption_kw,
    reading.load_kw,
    reading.consumption_kwh,
    reading.load_kwh,
  );

const getProductionUnit = (reading: FiveMinuteReading): "kW" | "kWh" =>
  reading.production_kw != null || reading.power_kw != null ? "kW" : "kWh";

const getConsumptionUnit = (reading: FiveMinuteReading): "kW" | "kWh" =>
  reading.consumption_kw != null || reading.load_kw != null ? "kW" : "kWh";

const getReadingHourInGmt8 = (timestamp: string) => {
  const date = new Date(timestamp);
  const gmt8 = new Date(date.getTime() + GMT8_OFFSET_MINUTES * MINUTE_MS);
  return gmt8.getUTCHours();
};

const getLifetimeProductionFromLatest = (reading: FiveMinuteReading) =>
  toNumber(
    reading.alltime_production_kwh,
    reading.lifetime_production_kwh,
    reading.total_production_kwh,
    reading.total_yield_kwh,
  );

const getLifetimeSavingsFromLatest = (reading: FiveMinuteReading) =>
  toNumber(
    reading.lifetime_earnings_php,
    reading.lifetime_earning_php,
    reading.lifetime_earnings,
    reading.lifetime_earning,
    reading.lifetime_savings_php,
    reading.total_savings_php,
  );

const getCurrentUser = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
};

export const fetchHomeLiveData = async (): Promise<HomeLiveData | null> => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.log("fetchHomeLiveData: no active user");
      return null;
    }

    const [latestResult, lifetimeResult] = await Promise.all([
      supabase
        .from("energy_readings_five_minutes")
        .select("battery_level,battery_status,alltime_production_kwh,lifetime_production_kwh,total_production_kwh,total_yield_kwh,lifetime_earning,lifetime_savings_php,lifetime_earning_php,lifetime_earnings_php,lifetime_earnings,total_savings_php,capacity_kwp,station_name,plant_name,timestamp")
        .eq("user_id", user.id)
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("energy_readings_five_minutes")
        .select("lifetime_earning,lifetime_earnings,lifetime_earnings_php,lifetime_earning_php,lifetime_savings_php,total_savings_php")
        .eq("user_id", user.id)
        .order("lifetime_earning", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (latestResult.error) {
      console.log("fetchHomeLiveData latest error:", latestResult.error.message);
      return null;
    }
    if (lifetimeResult.error) {
      console.log("fetchHomeLiveData lifetime error:", lifetimeResult.error.message);
      return null;
    }

    const latestRow = latestResult.data;
    const lifetimeRow = lifetimeResult.data;

    return {
      battery_level:
        latestRow?.battery_level != null ? Number(latestRow.battery_level) : null,
      battery_status: firstString(latestRow?.battery_status, latestRow?.battery_mode),
      alltime_production_kwh: latestRow
        ? getLifetimeProductionFromLatest(latestRow)
        : 0,
      lifetime_savings_php: lifetimeRow
        ? getLifetimeSavingsFromLatest(lifetimeRow)
        : latestRow
          ? getLifetimeSavingsFromLatest(latestRow)
          : 0,
    };
  } catch (error) {
    console.log("fetchHomeLiveData error:", error);
    return null;
  }
};

export const fetchTodayLiveData = async (): Promise<LiveData | null> => {
  try {
    const user = await getCurrentUser();
    if (!user) {
      console.log("fetchTodayLiveData: no active user");
      return null;
    }

    const todayStartIso = getTodayStartIsoInGmt8();

    const [todayResult, latestResult] = await Promise.all([
      supabase
        .from("energy_readings_five_minutes")
        .select("timestamp,production_kwh,consumption_kwh,production_kw,power_kw,energy_kwh,consumption_kw,load_kw,load_kwh,battery_level,grid_import_kwh,grid_export_kwh")
        .eq("user_id", user.id)
        .gte("timestamp", todayStartIso)
        .order("timestamp", { ascending: true }),
      supabase
        .from("energy_readings_five_minutes")
        .select("timestamp,production_kwh,production_kw,power_kw,battery_level,battery_status,battery_mode,capacity_kwp,station_name,plant_name")
        .eq("user_id", user.id)
        .order("timestamp", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (todayResult.error) {
      console.log("fetchTodayLiveData today error:", todayResult.error.message);
      return null;
    }
    if (latestResult.error) {
      console.log("fetchTodayLiveData latest error:", latestResult.error.message);
      return null;
    }

    const todayRows = todayResult.data ?? [];
    const latestRow = latestResult.data;

    const todayProduction = todayRows.reduce(
      (sum, row) => sum + toNumber(row.production_kwh, row.energy_kwh),
      0,
    );
    const todayConsumption = todayRows.reduce(
      (sum, row) => sum + toNumber(row.consumption_kwh, row.load_kwh),
      0,
    );
    const todayGridImport = todayRows.reduce(
      (sum, row) => sum + toNumber(row.grid_import_kwh),
      0,
    );
    const todayGridExport = todayRows.reduce(
      (sum, row) => sum + toNumber(row.grid_export_kwh),
      0,
    );

    const hourlyBuckets = new Map<number, { production_kwh: number; consumption_kwh: number }>();
    todayRows.forEach((row) => {
      const hour = getReadingHourInGmt8(row.timestamp);
      const existing = hourlyBuckets.get(hour) ?? {
        production_kwh: 0,
        consumption_kwh: 0,
      };
      existing.production_kwh += toNumber(row.production_kwh, row.energy_kwh);
      existing.consumption_kwh += toNumber(row.consumption_kwh, row.load_kwh);
      hourlyBuckets.set(hour, existing);
    });

    const todayReadings = todayRows.map((row) => ({
      timestamp: row.timestamp,
      production: getProductionValue(row),
      production_unit: getProductionUnit(row),
      consumption: getConsumptionValue(row),
      consumption_unit: getConsumptionUnit(row),
      battery_level:
        row.battery_level != null ? Number(row.battery_level) : null,
    }));

    return {
      current_power_w: 0,
      today_production_kwh: todayProduction,
      today_consumption_kwh: todayConsumption,
      today_grid_import_kwh: todayGridImport,
      today_grid_export_kwh: todayGridExport,
      battery_level:
        latestRow?.battery_level != null ? Number(latestRow.battery_level) : null,
      battery_status: firstString(latestRow?.battery_status, latestRow?.battery_mode),
      capacity_kwp: toNumber(latestRow?.capacity_kwp),
      station_name: firstString(latestRow?.station_name, latestRow?.plant_name) ?? "",
      alltime_production_kwh: 0,
      lifetime_savings_php: undefined,
      month_production_kwh: 0,
      today_hourly: Array.from(hourlyBuckets.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([hour, values]) => ({
          hour,
          production_kwh: values.production_kwh,
          consumption_kwh: values.consumption_kwh,
        })),
      today_readings: todayReadings,
    };
  } catch (error) {
    console.log("fetchTodayLiveData error:", error);
    return null;
  }
};

export const fetchLiveData = async (): Promise<LiveData | null> => {
  try {
    const [todayData, homeData] = await Promise.all([
      fetchTodayLiveData(),
      fetchHomeLiveData(),
    ]);

    if (!todayData) {
      return null;
    }

    return {
      ...todayData,
      battery_level: homeData?.battery_level ?? todayData.battery_level,
      battery_status: homeData?.battery_status ?? todayData.battery_status,
      alltime_production_kwh:
        homeData?.alltime_production_kwh ?? todayData.alltime_production_kwh,
      lifetime_savings_php: homeData?.lifetime_savings_php,
      month_production_kwh: 0,
    };
  } catch (error) {
    console.log("fetchLiveData error:", error);
    return null;
  }
};

export const fetchLifetimeSavingsPhp = async (): Promise<number> => {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return 0;

    const { data, error } = await supabase
      .from("energy_readings_five_minutes")
      .select("lifetime_earning,lifetime_earnings,lifetime_earnings_php,lifetime_earning_php,lifetime_savings_php,total_savings_php")
      .eq("user_id", user.id)
      .order("lifetime_earning", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.log("fetchLifetimeSavingsPhp error:", error.message);
      return 0;
    }

    return data ? getLifetimeSavingsFromLatest(data) : 0;
  } catch (error) {
    console.log("fetchLifetimeSavingsPhp error:", error);
    return 0;
  }
};
