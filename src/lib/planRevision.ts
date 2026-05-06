// Shared submitter for the App Plan Revision flow (n8n webhook).
// Used by PlanChatSection (chat box) and the timeline tap-to-edit start-time picker.
import type { PlanItem } from '@/hooks/useDailyPlan';

const REVISION_WEBHOOK = 'https://bottlesandprint.app.n8n.cloud/webhook/life-hq-revision';

export interface PlanRevisionParams {
  message: string;
  planId: string | null;
  planItems: PlanItem[];
  viewTomorrow?: boolean;
}

export interface PlanRevisionResult {
  action?: 'revision' | 'answer' | string;
  message: string;
  raw: any;
}

/**
 * Submits a plan revision message to the n8n webhook using the EXACT same payload
 * shape that PlanChatSection uses for user-typed chat commands. Returns parsed
 * response data. Does NOT toast or invalidate queries — caller decides.
 */
export async function submitPlanRevision({
  message,
  planId,
  planItems,
  viewTomorrow = false,
}: PlanRevisionParams): Promise<PlanRevisionResult> {
  const messageToSend = viewTomorrow ? `tomorrow: ${message}` : message;
  const targetDate = viewTomorrow ? 'tomorrow' : 'today';

  const res = await fetch(REVISION_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: messageToSend,
      target_date: targetDate,
      planId,
      currentItems: (planItems ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        start_time: item.start_time,
        end_time: item.end_time,
        category: item.category,
        status: item.status,
        est_minutes: item.est_minutes,
        actual_minutes: item.actual_minutes,
        is_calendar_event: item.is_calendar_event,
        task_id: item.task_id,
      })),
    }),
  });

  const rawText = await res.text();
  let data: any;
  try {
    data = JSON.parse(rawText);
  } catch {
    const jsonStart = rawText.search(/[\{\[]/);
    const jsonEnd = rawText.lastIndexOf(jsonStart !== -1 && rawText[jsonStart] === '[' ? ']' : '}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      data = JSON.parse(rawText.substring(jsonStart, jsonEnd + 1));
    } else {
      throw new Error('Could not parse response');
    }
  }

  return {
    action: data?.action,
    message: data?.message || 'Done.',
    raw: data,
  };
}
