"use client";

import { loadFromStorage, saveToStorage } from "./persistence";

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  lastActiveDate: string; // YYYY-MM-DD
}

const STREAK_KEY = "learn_streak_data";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function initialStreakData(): StreakData {
  return {
    currentStreak: 0,
    longestStreak: 0,
    totalActiveDays: 0,
    lastActiveDate: "",
  };
}

export function updateStreak(): StreakData {
  const data = loadFromStorage<StreakData>(STREAK_KEY, initialStreakData());
  const today = todayStr();
  const yesterday = yesterdayStr();

  if (data.lastActiveDate === today) {
    // Already updated today
    return data;
  }

  const wasYesterday = data.lastActiveDate === yesterday;

  if (wasYesterday) {
    data.currentStreak += 1;
  } else if (!data.lastActiveDate) {
    // First ever activity
    data.currentStreak = 1;
  } else {
    // Gap in activity — reset current streak
    data.currentStreak = 1;
  }

  data.lastActiveDate = today;
  data.totalActiveDays += 1;

  if (data.currentStreak > data.longestStreak) {
    data.longestStreak = data.currentStreak;
  }

  saveToStorage(STREAK_KEY, data);
  return data;
}

export function getStreak(): StreakData {
  return loadFromStorage<StreakData>(STREAK_KEY, initialStreakData());
}
