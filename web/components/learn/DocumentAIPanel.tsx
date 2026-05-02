"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { explainDocument, type ExplainResult } from "@/lib/knowledge-graph";
import { loadFromStorage, saveToStorage } from "@/lib/persistence";

type LocaleKey = "zh" | "en";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface DocumentAIPanelProps {
  nodeId: string;
  documentUrl: string;
  documentTitle: string;
  documentContent: string;
  locale: LocaleKey;
  isMobile: boolean;
  selectedText?: string;
  onClearSelection?: () => void;
}

function contentHash(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const ch = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return `dc_${Math.abs(hash).toString(36)}`;
}

const STORAGE_PREFIX = "learn_doc_chat_";

export default function DocumentAIPanel({
  nodeId,
  documentUrl,
  documentTitle,
  documentContent,
  locale,
  isMobile,
  selectedText,
  onClearSelection,
}: DocumentAIPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const storageKey = `${STORAGE_PREFIX}${contentHash(documentUrl)}`;

  // Load conversation history on mount
  useEffect(() => {
    const cached = loadFromStorage<{ messages: ChatMessage[] }>(storageKey, null as any);
    if (cached?.messages?.length) {
      setMessages(cached.messages);
    }
  }, [storageKey]);

  // Save on every message change
  useEffect(() => {
    if (messages.length > 0) {
      saveToStorage(storageKey, { messages });
    }
  }, [messages, storageKey]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSend = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;

    // Include selected text as quoted context
    const question = selectedText
      ? `关于文档中的这段内容：\n> ${selectedText}\n\n${q}`
      : q;

    const userMsg: ChatMessage = { role: "user", content: question };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    onClearSelection?.();

    try {
      const result: ExplainResult = await explainDocument({
        node_id: nodeId,
        document_url: documentUrl,
        document_title: documentTitle,
        document_content: documentContent,
        question,
        conversation_history: messages.slice(-10), // last 10 for context
      });
      setMessages([...newMessages, { role: "assistant", content: result.reply }]);
    } catch (e) {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content:
            locale === "zh"
              ? "抱歉，请求出错了，请稍后重试。"
              : "Sorry, something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, nodeId, documentUrl, documentTitle, documentContent, locale]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClear = () => {
    setMessages([]);
    saveToStorage(storageKey, { messages: [] });
  };

  // Only show last 3 messages when collapsed
  const visibleMessages = historyExpanded ? messages : messages.slice(-3);
  const hasMoreHistory = !historyExpanded && messages.length > 3;

  // ─── Chat content ──────────────────────────────────────────────────

  const chatContent = (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)]/30 px-4 py-2.5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <MessageCircle className="h-4 w-4 text-[var(--primary)]" />
          {locale === "zh" ? "文档助手" : "Doc AI"}
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={handleClear}
              className="rounded px-2 py-0.5 text-[11px] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/40 hover:text-[var(--foreground)]"
            >
              {locale === "zh" ? "清空" : "Clear"}
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1 text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/40 hover:text-[var(--foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--muted-foreground)]">
            <p className="mb-1">
              {locale === "zh" ? "对文档内容有疑问？" : "Questions about this document?"}
            </p>
            <p>
              {locale === "zh"
                ? "直接提问，我会结合文档内容帮你理解。"
                : "Ask me anything — I'll explain using the document content."}
            </p>
          </div>
        ) : (
          <>
            {hasMoreHistory && (
              <button
                onClick={() => setHistoryExpanded(true)}
                className="mb-3 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-xs text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/30"
              >
                <ChevronDown className="h-3 w-3" />
                {locale === "zh"
                  ? `查看更早的对话 (${messages.length - 3} 条)`
                  : `Show earlier messages (${messages.length - 3})`}
              </button>
            )}
            {visibleMessages.map((msg, i) => (
              <div
                key={i}
                className={`mb-3 ${
                  msg.role === "user" ? "flex justify-end" : "flex justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                      : "bg-[var(--secondary)]/50 text-[var(--foreground)]/90"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="mb-3 flex justify-start">
                <div className="rounded-xl bg-[var(--secondary)]/50 px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--muted-foreground)]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Selected text chip */}
      {selectedText && (
        <div className="shrink-0 border-t border-[var(--border)]/30 px-3 pt-2">
          <div className="flex items-start gap-2 rounded-lg bg-[var(--primary)]/8 border border-[var(--primary)]/20 px-3 py-2 text-xs">
            <span className="shrink-0 mt-0.5 text-[11px] font-semibold text-[var(--primary)]">
              {locale === "zh" ? "划词：" : "Selection:"}
            </span>
            <span className="flex-1 line-clamp-2 text-[var(--foreground)]/80 leading-relaxed">
              &ldquo;{selectedText}&rdquo;
            </span>
            <button
              onClick={onClearSelection}
              className="shrink-0 rounded p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 border-t border-[var(--border)]/30 px-3 py-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              locale === "zh" ? "输入你的问题…" : "Ask a question…"
            }
            disabled={loading}
            className="flex-1 rounded-lg border border-[var(--border)]/40 bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)]/40 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]/20 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="shrink-0 rounded-lg bg-[var(--primary)] p-2 text-[var(--primary-foreground)] transition hover:opacity-80 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  // ─── Trigger button (closed state) ──────────────────────────────────

  if (!isOpen) {
    if (isMobile) {
      // Mobile: floating button at bottom-right
      return (
        <>
          <button
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-[65] flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-[var(--primary-foreground)] shadow-lg transition hover:opacity-90 active:scale-95"
          >
            <MessageCircle className="h-4 w-4" />
            {locale === "zh" ? "问 AI" : "Ask AI"}
          </button>
          {/* Mobile bottom sheet overlay */}
          <div
            className={`fixed inset-0 z-[70] transition-opacity duration-300 ${
              isOpen ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            {/* Never rendered in closed state, placeholder for transition */}
          </div>
        </>
      );
    }
    // Desktop: inline toggle button
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex shrink-0 items-center gap-2 rounded-lg border border-[var(--border)]/60 px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] transition hover:bg-[var(--secondary)]/40 hover:text-[var(--foreground)]"
      >
        <MessageCircle className="h-4 w-4" />
        <span className="hidden xl:inline">
          {locale === "zh" ? "问 AI" : "Ask AI"}
        </span>
      </button>
    );
  }

  // ─── Open state ─────────────────────────────────────────────────────

  // Desktop: side panel
  if (!isMobile) {
    return (
      <div className="flex w-[340px] shrink-0 flex-col overflow-hidden border-l border-[var(--border)]/30 bg-[var(--background)]/50">
        {chatContent}
      </div>
    );
  }

  // Mobile: bottom sheet
  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={() => setIsOpen(false)}
      />
      {/* Sheet */}
      <div className="relative flex max-h-[65vh] animate-slide-up flex-col overflow-hidden rounded-t-2xl border-t border-[var(--border)]/40 bg-[var(--background)] shadow-2xl">
        {/* Drag handle */}
        <div className="flex shrink-0 justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-[var(--border)]" />
        </div>
        {chatContent}
      </div>
    </div>
  );
}
