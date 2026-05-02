"use client";

import { loadFromStorage, saveToStorage } from "./persistence";

export interface ResourceReadStatus {
  url: string;
  readAt: number;
}

function storageKey(nodeId: string): string {
  return `learn_resource_reading_progress_${nodeId}`;
}

export function markResourceRead(nodeId: string, url: string): void {
  const statuses = loadFromStorage<ResourceReadStatus[]>(storageKey(nodeId), []);
  const existing = statuses.find((s) => s.url === url);
  if (existing) {
    existing.readAt = Date.now();
  } else {
    statuses.push({ url, readAt: Date.now() });
  }
  saveToStorage(storageKey(nodeId), statuses);
}

export function getReadingProgressForNode(nodeId: string): ResourceReadStatus[] {
  return loadFromStorage<ResourceReadStatus[]>(storageKey(nodeId), []);
}

export function isResourceRead(nodeId: string, url: string): boolean {
  return loadFromStorage<ResourceReadStatus[]>(storageKey(nodeId), []).some(
    (s) => s.url === url,
  );
}
