import "server-only";
import { createClient } from "@supabase/supabase-js";
import type {
  AvailabilityPeriod,
  AvailabilityResponse,
  AvailabilityDateEntry,
} from "@/lib/types/database";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─────────────────────────────────────────────
// Period management (coordinator)
// ─────────────────────────────────────────────

export interface CreatePeriodPayload {
  label: string;
  starts_on: string; // YYYY-MM-DD
  ends_on: string;   // YYYY-MM-DD
  deadline?: string | null;
  created_by?: string | null;
}

export async function createPeriod(
  payload: CreatePeriodPayload
): Promise<AvailabilityPeriod> {
  const { data, error } = await supabase
    .from("availability_periods")
    .insert({
      label: payload.label,
      starts_on: payload.starts_on,
      ends_on: payload.ends_on,
      deadline: payload.deadline ?? null,
      created_by: payload.created_by ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as AvailabilityPeriod;
}

export async function getPeriod(id: string): Promise<AvailabilityPeriod | null> {
  const { data, error } = await supabase
    .from("availability_periods")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as AvailabilityPeriod;
}

export async function listPeriods(): Promise<AvailabilityPeriod[]> {
  const { data, error } = await supabase
    .from("availability_periods")
    .select("*")
    .order("starts_on", { ascending: false });

  if (error) throw error;
  return (data ?? []) as AvailabilityPeriod[];
}

export async function listPeriodsWithCounts(): Promise<
  (AvailabilityPeriod & { response_count: number; total_musicians: number })[]
> {
  const { data: periods, error: periodsError } = await supabase
    .from("availability_periods")
    .select("*")
    .order("starts_on", { ascending: false });

  if (periodsError) throw periodsError;
  if (!periods?.length) return [];

  // Count responses per period in one query
  const { data: responseCounts, error: countError } = await supabase
    .from("availability_responses")
    .select("period_id")
    .in("period_id", periods.map((p) => p.id));

  if (countError) throw countError;

  const countMap = new Map<string, number>();
  for (const row of responseCounts ?? []) {
    countMap.set(row.period_id, (countMap.get(row.period_id) ?? 0) + 1);
  }

  // Count total active non-admin musicians once
  const { count: totalMusicians } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .not("app_role", "in", '("Admin")');

  return periods.map((p) => ({
    ...(p as AvailabilityPeriod),
    response_count: countMap.get(p.id) ?? 0,
    total_musicians: totalMusicians ?? 0,
  }));
}

export async function closePeriod(id: string): Promise<void> {
  const { error } = await supabase
    .from("availability_periods")
    .update({ closed_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export interface UpdatePeriodPayload {
  label: string;
  starts_on?: string; // omit to leave unchanged (dates are locked once responses exist)
  ends_on?: string;
  deadline?: string | null;
}

export async function updatePeriod(id: string, payload: UpdatePeriodPayload): Promise<void> {
  const update: Record<string, unknown> = { label: payload.label };
  if (payload.starts_on !== undefined) update.starts_on = payload.starts_on;
  if (payload.ends_on !== undefined) update.ends_on = payload.ends_on;
  if ("deadline" in payload) update.deadline = payload.deadline ?? null;

  const { error } = await supabase
    .from("availability_periods")
    .update(update)
    .eq("id", id);

  if (error) throw error;
}

/** Returns the number of responses for a period. Used to gate delete/date-edit. */
export async function countResponsesForPeriod(id: string): Promise<number> {
  const { count } = await supabase
    .from("availability_responses")
    .select("id", { count: "exact", head: true })
    .eq("period_id", id);
  return count ?? 0;
}

/**
 * Deletes a period only if it has zero responses.
 * Returns "deleted" on success or "has_responses" if blocked.
 */
export async function deletePeriodIfEmpty(
  id: string
): Promise<"deleted" | "has_responses"> {
  const responseCount = await countResponsesForPeriod(id);
  if (responseCount > 0) return "has_responses";

  const { error } = await supabase
    .from("availability_periods")
    .delete()
    .eq("id", id);

  if (error) throw error;
  return "deleted";
}

// ─────────────────────────────────────────────
// Responses (musician)
// ─────────────────────────────────────────────

export interface PeriodResponsePayload {
  periodId: string;
  memberId: string;
  /** Map of YYYY-MM-DD → available boolean */
  dates: Record<string, boolean>;
  notes?: string | null;
}

/**
 * Upsert a musician's response for a given period.
 * Creates the availability_responses row if it doesn't exist,
 * then replaces all availability_dates rows for that response.
 */
export async function upsertPeriodResponse(
  payload: PeriodResponsePayload
): Promise<AvailabilityResponse> {
  // Upsert the response header row
  const { data: responseData, error: responseError } = await supabase
    .from("availability_responses")
    .upsert(
      {
        period_id: payload.periodId,
        member_id: payload.memberId,
        notes: payload.notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "period_id,member_id" }
    )
    .select()
    .single();

  if (responseError) throw responseError;
  const response = responseData as AvailabilityResponse;

  // Delete existing date rows then re-insert (clean slate per submission)
  const { error: deleteError } = await supabase
    .from("availability_dates")
    .delete()
    .eq("response_id", response.id);

  if (deleteError) throw deleteError;

  const dateRows = Object.entries(payload.dates).map(([date, available]) => ({
    response_id: response.id,
    date,
    available,
  }));

  if (dateRows.length > 0) {
    const { error: insertError } = await supabase
      .from("availability_dates")
      .insert(dateRows);

    if (insertError) throw insertError;
  }

  return response;
}

/**
 * Get a musician's existing response for a period (null if not yet submitted).
 */
export async function getPeriodResponse(
  periodId: string,
  memberId: string
): Promise<{ response: AvailabilityResponse; dates: AvailabilityDateEntry[] } | null> {
  const { data: responseData, error: responseError } = await supabase
    .from("availability_responses")
    .select("*")
    .eq("period_id", periodId)
    .eq("member_id", memberId)
    .single();

  if (responseError || !responseData) return null;

  const response = responseData as AvailabilityResponse;

  const { data: dateData, error: dateError } = await supabase
    .from("availability_dates")
    .select("*")
    .eq("response_id", response.id)
    .order("date", { ascending: true });

  if (dateError) throw dateError;

  return {
    response,
    dates: (dateData ?? []) as AvailabilityDateEntry[],
  };
}

/**
 * Get all responses for a period (coordinator view).
 */
export interface MemberResponseSummary {
  member_id: string;
  member_name: string;
  member_magic_token: string;
  response: AvailabilityResponse | null;
  dates: AvailabilityDateEntry[];
}

export async function getPeriodResponseSummary(
  periodId: string
): Promise<{ period: AvailabilityPeriod; responses: MemberResponseSummary[] } | null> {
  const period = await getPeriod(periodId);
  if (!period) return null;

  const { data: responseRows, error: respError } = await supabase
    .from("availability_responses")
    .select("*, members(name, magic_token)")
    .eq("period_id", periodId);

  if (respError) throw respError;

  const responses: MemberResponseSummary[] = await Promise.all(
    (responseRows ?? []).map(async (row) => {
      const { data: dateRows } = await supabase
        .from("availability_dates")
        .select("*")
        .eq("response_id", row.id)
        .order("date", { ascending: true });

      const memberInfo = row.members as { name: string; magic_token: string } | null;
      return {
        member_id: row.member_id,
        member_name: memberInfo?.name ?? "Unknown",
        member_magic_token: memberInfo?.magic_token ?? "",
        response: row as AvailabilityResponse,
        dates: (dateRows ?? []) as AvailabilityDateEntry[],
      };
    })
  );

  return { period, responses };
}

/**
 * Get period detail with ALL active (non-admin) musicians merged in —
 * including those who haven't responded yet.
 */
export interface MemberPeriodDetail {
  member_id: string;
  member_name: string;
  member_magic_token: string;
  responded: boolean;
  response: AvailabilityResponse | null;
  dates: AvailabilityDateEntry[];
}

export async function getPeriodDetailWithAllMembers(
  periodId: string
): Promise<{ period: AvailabilityPeriod; members: MemberPeriodDetail[] } | null> {
  const period = await getPeriod(periodId);
  if (!period) return null;

  // Fetch all active non-admin members
  const { data: memberRows, error: memberError } = await supabase
    .from("members")
    .select("id, name, magic_token")
    .eq("is_active", true)
    .not("app_role", "in", '("Admin")')
    .order("name", { ascending: true });

  if (memberError) throw memberError;

  // Fetch all responses for this period
  const { data: responseRows, error: respError } = await supabase
    .from("availability_responses")
    .select("*")
    .eq("period_id", periodId);

  if (respError) throw respError;

  // Fetch all date rows for those responses in a single query
  const responseIds = (responseRows ?? []).map((r) => r.id);
  let allDateRows: AvailabilityDateEntry[] = [];
  if (responseIds.length > 0) {
    const { data: dateData, error: dateError } = await supabase
      .from("availability_dates")
      .select("*")
      .in("response_id", responseIds);
    if (dateError) throw dateError;
    allDateRows = (dateData ?? []) as AvailabilityDateEntry[];
  }

  // Group dates by response_id
  const datesByResponseId = new Map<string, AvailabilityDateEntry[]>();
  for (const d of allDateRows) {
    const arr = datesByResponseId.get(d.response_id) ?? [];
    arr.push(d);
    datesByResponseId.set(d.response_id, arr);
  }

  // Build a map of member_id → response+dates
  const responseMap = new Map<string, { response: AvailabilityResponse; dates: AvailabilityDateEntry[] }>();
  for (const row of responseRows ?? []) {
    const dates = (datesByResponseId.get(row.id) ?? [])
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
    responseMap.set(row.member_id, {
      response: row as AvailabilityResponse,
      dates,
    });
  }

  const members: MemberPeriodDetail[] = (memberRows ?? []).map((m) => {
    const entry = responseMap.get(m.id) ?? null;
    return {
      member_id: m.id,
      member_name: m.name,
      member_magic_token: m.magic_token,
      responded: entry !== null,
      response: entry?.response ?? null,
      dates: entry?.dates ?? [],
    };
  });

  return { period, members };
}
