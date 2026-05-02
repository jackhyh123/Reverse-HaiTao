"use client";

import { loadFromStorage, saveToStorage } from "./persistence";

export interface ResourceViewRecord {
  url: string;
  title: string;
  viewedAt: number;
}

const MAX_RECORDS = 50;

function storageKey(nodeId: string): string {
  return `learn_viewed_resources_${nodeId}`;
}

export function recordResourceView(
  nodeId: string,
  url: string,
  title: string,
): void {
  const records = loadFromStorage<ResourceViewRecord[]>(storageKey(nodeId), []);
  // Remove duplicate URL if exists, then push new record
  const filtered = records.filter((r) => r.url !== url);
  filtered.push({ url, title, viewedAt: Date.now() });
  // Keep only the most recent MAX_RECORDS
  saveToStorage(storageKey(nodeId), filtered.slice(-MAX_RECORDS));
}

export function getViewedResources(nodeId: string): ResourceViewRecord[] {
  return loadFromStorage<ResourceViewRecord[]>(storageKey(nodeId), []);
}
