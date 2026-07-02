import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Task = Tables<"tasks">;

export function useTasks(filters?: { category?: string; quadrant?: string; status?: string; search?: string }) {
  return useQuery({
    queryKey: ["tasks", filters],
    queryFn: async () => {
      let query = supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (filters?.category && filters.category !== "All") {
        query = query.eq("category", filters.category);
      }
      if (filters?.quadrant && filters.quadrant !== "All") {
        query = query.eq("quadrant", filters.quadrant);
      }
      if (filters?.status === "Active") {
        query = query.eq("status", "active");
      } else if (filters?.status === "Completed") {
        query = query.eq("status", "completed");
      } else if (filters?.status === "Archived") {
        query = query.eq("status", "archived");
      } else if (!filters?.status || filters.status === "All") {
        query = query.in("status", ["active", "completed", "archived"]);
      }
      if (filters?.search) {
        query = query.ilike("name", `%${filters.search}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Task[];
    },
  });
}

export function useActiveTasks() {
  return useQuery({
    queryKey: ["tasks", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Task[];
    },
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: TablesInsert<"tasks">) => {
      const { data, error } = await supabase.from("tasks").insert(task).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"tasks"> & { id: string }) => {
      const { data, error } = await supabase.from("tasks").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["triage"] });
      qc.invalidateQueries({ queryKey: ["daily-plan"] });
    },
  });
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["daily-plan"] });
    },
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["triage"] });
      qc.invalidateQueries({ queryKey: ["daily-plan"] });
    },
  });
}

// Pacific "today" as YYYY-MM-DD (mirrors todayStr() in useDailyPlan.ts).
function pacificTodayStr() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function usePurgeArchivedTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // 1. Capture the IDs of the archived tasks BEFORE deleting them.
      const { data: archived, error: selErr } = await supabase.from("tasks").select("id").eq("status", "archived");
      if (selErr) throw selErr;
      const archivedIds = (archived ?? []).map((t) => t.id);

      // 2. BEFORE deleting the tasks, find TODAY's plan_items that point to
      //    those tasks and capture the PLAN_ITEM ids. This is the fix for the
      //    v1 bug: the tasks FK is ON DELETE SET NULL, so the moment we delete
      //    a task its plan_item.task_id becomes NULL -- matching leftovers by
      //    task_id AFTER the delete finds nothing. A plan_item's OWN id never
      //    changes, so we grab that now while the task_id link is still intact.
      let leftoverPlanItemIds: string[] = [];
      if (archivedIds.length) {
        const { data: plan, error: planErr } = await supabase
          .from("daily_plans")
          .select("id")
          .eq("plan_date", pacificTodayStr())
          .maybeSingle();
        if (planErr) throw planErr;

        if (plan) {
          const { data: leftovers, error: findErr } = await supabase
            .from("plan_items")
            .select("id")
            .eq("plan_id", plan.id)
            .in("task_id", archivedIds);
          if (findErr) throw findErr;
          leftoverPlanItemIds = (leftovers ?? []).map((pi) => pi.id);
        }
      }

      // 3. Delete the archived tasks (original behavior).
      const { error: delErr } = await supabase.from("tasks").delete().eq("status", "archived");
      if (delErr) throw delErr;

      // 4. Sweep the leftovers by their own plan_item ids (unaffected by the
      //    delete) and mark them carried_over -- the same status the in-app
      //    Delete button uses. This clears them off today's home screen.
      if (leftoverPlanItemIds.length) {
        const { error: sweepErr } = await supabase
          .from("plan_items")
          .update({ status: "carried_over" })
          .in("id", leftoverPlanItemIds);
        if (sweepErr) throw sweepErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["triage"] });
      qc.invalidateQueries({ queryKey: ["daily-plan"] });
    },
  });
}

export function useArchiveTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return;
      const { error } = await supabase.from("tasks").update({ status: "archived" }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["triage"] });
      qc.invalidateQueries({ queryKey: ["daily-plan"] });
    },
  });
}
