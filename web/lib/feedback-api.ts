import { apiUrl } from "@/lib/api";

export interface FeedbackPayload {
  rating?: string;
  role?: string;
  message: string;
  contact?: string;
  page_url?: string;
  user_agent?: string;
}

export async function submitFeedback(payload: FeedbackPayload): Promise<void> {
  const response = await fetch(apiUrl("/api/v1/feedback"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { detail?: string };
    throw new Error(err.detail || `feedback_failed:${response.status}`);
  }
}
