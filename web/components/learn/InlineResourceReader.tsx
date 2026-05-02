"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Loader2, X, AlertCircle } from "lucide-react";
import {
  fetchResourceContent,
  type FeishuBlock,
  type FeishuElement,
  type FetchResourceResult,
  type RelatedLink,
} from "@/lib/knowledge-graph";
import { loadFromStorage, saveToStorage } from "@/lib/persistence";
import DocumentAIPanel from "@/components/learn/DocumentAIPanel";

type LocaleKey = "zh" | "en";

interface BreadcrumbEntry {
  url: string;
  title: string;
  nodeId: string;
}

interface InlineResourceReaderProps {
  nodeId: string;
  url: string;
  title: string;
  locale: LocaleKey;
  onClose: () => void;
  onNavigate?: (url: string, title: string, nodeId: string) => void;
  breadcrumbStack?: BreadcrumbEntry[];
  onBreadcrumbClick?: (index: number) => void;
}

function contentHash(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const ch = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + ch;
    hash |= 0;
  }
  return `rc_${Math.abs(hash).toString(36)}`;
}

// ─── Structured content renderer (Feishu Docx blocks) ─────────────────

/**
 * Group consecutive list items into a single <ol>/<ul> block.
 * Returns an array of renderable blocks where adjacent same-type list items
 * are merged into a "list_group".
 */
type RenderBlock =
  | { type: "block"; block: FeishuBlock }
  | { type: "list_group"; ordered: boolean; items: FeishuBlock[] };

function groupListItems(blocks: FeishuBlock[]): RenderBlock[] {
  const result: RenderBlock[] = [];
  let listBuf: FeishuBlock[] = [];

  const flush = () => {
    if (listBuf.length > 0) {
      result.push({
        type: "list_group",
        ordered: listBuf[0].type === "list" ? listBuf[0].ordered : false,
        items: listBuf,
      });
      listBuf = [];
    }
  };

  for (const block of blocks) {
    if (block.type === "list") {
      if (listBuf.length > 0 && listBuf[0].type === "list" && listBuf[0].ordered !== block.ordered) {
        flush();
      }
      listBuf.push(block);
    } else {
      flush();
      result.push({ type: "block", block });
    }
  }
  flush();
  return result;
}

/** Render inline elements with bold/italic/code/link styling. */
function ElementsRenderer({ elements }: { elements: FeishuElement[] }) {
  if (!elements || elements.length === 0) return null;
  return (
    <>
      {elements.map((el, i) => {
        let node: React.ReactNode = el.text;
        if (el.bold) node = <strong key={i} className="font-bold text-[var(--foreground)]">{node}</strong>;
        if (el.italic) node = <em key={i} className="italic text-[var(--muted-foreground)]">{node}</em>;
        if (el.code) node = <code key={i} className="rounded bg-[var(--secondary)]/60 px-1 py-0.5 text-[0.85em] font-mono text-rose-600 dark:text-rose-400">{node}</code>;
        if (el.link) {
          node = (
            <a key={i} href={el.link} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] underline decoration-[var(--primary)]/30 underline-offset-2 hover:decoration-[var(--primary)]">
              {node}
            </a>
          );
        }
        if (typeof node === "string") return <React.Fragment key={i}>{node}</React.Fragment>;
        return <React.Fragment key={i}>{node}</React.Fragment>;
      })}
    </>
  );
}

const HEADING_CLASSES: Record<number, string> = {
  1: "text-2xl font-extrabold tracking-tight mt-8 mb-3 pb-2 border-b border-[var(--border)]/30",
  2: "text-xl font-bold tracking-tight mt-7 mb-2.5 pb-1.5 border-b border-[var(--border)]/20",
  3: "text-lg font-semibold mt-6 mb-2",
  4: "text-base font-semibold mt-5 mb-1.5",
  5: "text-sm font-semibold mt-4 mb-1 text-[var(--muted-foreground)]",
  6: "text-xs font-bold uppercase tracking-wider mt-4 mb-1 text-[var(--muted-foreground)]",
};

/** Extract plain text from a Feishu block for matching against related links. */
function getBlockText(block: FeishuBlock): string {
  if (block.type === "code") return (block as any).text || "";
  if (block.type === "divider") return "";
  if ("elements" in block) return (block.elements || []).map((e: FeishuElement) => e.text).join("");
  return "";
}

/** Find which related links match the given block text. */
function findBlockLinks(blockText: string, relatedLinks: RelatedLink[]): RelatedLink[] {
  if (!blockText || relatedLinks.length === 0) return [];
  const textLower = blockText.toLowerCase();
  return relatedLinks.filter(link => {
    const conceptLower = link.concept.toLowerCase();
    return textLower.includes(conceptLower) || conceptLower.includes(textLower.slice(0, 10));
  });
}

function ContentBlock({
  renderBlock,
  relatedLinks,
  onNavigate,
}: {
  renderBlock: RenderBlock;
  relatedLinks?: RelatedLink[];
  onNavigate?: (url: string, title: string, nodeId: string) => void;
}) {
  // Shared inline link marker for blocks that match related links
  const renderBlockLinkMarker = (text: string) => {
    if (!relatedLinks || relatedLinks.length === 0 || !onNavigate) return null;
    const matched = findBlockLinks(text, relatedLinks);
    if (matched.length === 0) return null;
    // Show up to 2 matched concepts as small clickable chips
    return (
      <span className="inline-flex items-center gap-1 ml-1.5">
        {matched.slice(0, 2).map((link, i) => (
          <button
            key={i}
            onClick={(e) => { e.stopPropagation(); onNavigate(link.doc_url, link.doc_title, link.node_id); }}
            title={`${link.concept} → ${link.doc_title}`}
            className="inline-flex items-center gap-0.5 rounded-full bg-[var(--primary)]/10 border border-[var(--primary)]/20 px-1.5 py-px text-[10px] font-medium text-[var(--primary)] hover:bg-[var(--primary)]/20 transition cursor-pointer align-middle"
          >
            <span className="text-[9px]">📎</span> {link.concept.length > 10 ? link.concept.slice(0, 10) + "…" : link.concept}
          </button>
        ))}
      </span>
    );
  };

  // List group
  if (renderBlock.type === "list_group") {
    const Tag = renderBlock.ordered ? "ol" : "ul";
    return (
      <Tag className={`my-3 space-y-1.5 pl-5 ${renderBlock.ordered ? "list-decimal" : "list-disc"}`}>
        {renderBlock.items.map((item, i) => {
          const itemText = "elements" in item ? (item.elements || []).map((e: FeishuElement) => e.text).join("") : "";
          const marker = renderBlockLinkMarker(itemText);
          return (
            <li key={i} className="text-sm leading-7 text-[var(--foreground)]/90 marker:text-[var(--muted-foreground)]">
              <ElementsRenderer elements={"elements" in item ? (item as any).elements : []} />
              {marker}
            </li>
          );
        })}
      </Tag>
    );
  }

  const block = renderBlock.block;
  const blockText = getBlockText(block);

  // Divider
  if (block.type === "divider") {
    return <div className="my-4 h-px bg-[var(--border)]/30" />;
  }

  // Heading
  if (block.type === "heading") {
    const cls = HEADING_CLASSES[block.level] || HEADING_CLASSES[3];
    const content = <ElementsRenderer elements={block.elements} />;
    const marker = renderBlockLinkMarker(blockText);
    switch (block.level) {
      case 1: return <h1 className={cls}>{content}{marker}</h1>;
      case 2: return <h2 className={cls}>{content}{marker}</h2>;
      case 3: return <h3 className={cls}>{content}{marker}</h3>;
      case 4: return <h4 className={cls}>{content}{marker}</h4>;
      case 5: return <h5 className={cls}>{content}{marker}</h5>;
      default: return <h6 className={cls}>{content}{marker}</h6>;
    }
  }

  // Paragraph
  if (block.type === "paragraph") {
    const marker = renderBlockLinkMarker(blockText);
    return (
      <p className="my-2 text-sm leading-7 text-[var(--foreground)]/90">
        <ElementsRenderer elements={block.elements} />
        {marker}
      </p>
    );
  }

  // Single list item (shouldn't happen after grouping, but handle gracefully)
  if (block.type === "list") {
    const marker = renderBlockLinkMarker(blockText);
    return (
      <p className="my-1 text-sm leading-7 text-[var(--foreground)]/90">
        <span className="mr-2 text-[var(--muted-foreground)]">{block.ordered ? "1." : "•"}</span>
        <ElementsRenderer elements={block.elements} />
        {marker}
      </p>
    );
  }

  // Blockquote
  if (block.type === "blockquote") {
    const marker = renderBlockLinkMarker(blockText);
    return (
      <blockquote className="my-3 border-l-3 border-[var(--primary)]/40 pl-4 text-sm leading-7 text-[var(--muted-foreground)] italic bg-[var(--secondary)]/20 rounded-r-lg py-2 pr-3">
        <ElementsRenderer elements={block.elements} />
        {marker}
      </blockquote>
    );
  }

  // Code
  if (block.type === "code") {
    const marker = renderBlockLinkMarker(blockText);
    return (
      <pre className="my-3 overflow-x-auto rounded-xl border border-[var(--border)]/40 bg-[var(--secondary)]/30 p-4 text-xs leading-6 font-mono text-[var(--foreground)]/80">
        <code>{block.text}</code>
        {marker}
      </pre>
    );
  }

  // Callout (info / tip / warning box)
  if (block.type === "callout") {
    const marker = renderBlockLinkMarker(blockText);
    return (
      <div className="my-3 rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 p-4 text-sm leading-7 text-[var(--foreground)]/90">
        <ElementsRenderer elements={block.elements} />
        {marker}
      </div>
    );
  }

  return null;
}

// ─── Main component ──────────────────────────────────────────────────

export default function InlineResourceReader({
  nodeId,
  url,
  title,
  locale,
  onClose,
  onNavigate,
  breadcrumbStack,
  onBreadcrumbClick,
}: InlineResourceReaderProps) {
  const [feishuBlocks, setFeishuBlocks] = useState<FeishuBlock[]>([]);
  const [pageTitle, setPageTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [documentContent, setDocumentContent] = useState("");
  const [relatedLinks, setRelatedLinks] = useState<RelatedLink[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  // Scroll content to top when URL changes (new resource opened)
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [url]);

  // Capture text selection in the document area
  const handleTextSelection = useCallback(() => {
    // Small delay so the selection is finalized
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (text && text.length > 0) {
        setSelectedText(text);
      }
    }, 10);
  }, []);

  // Detect mobile viewport
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Group consecutive list items for rendering
  const renderBlocks = useMemo(
    () => groupListItems(feishuBlocks),
    [feishuBlocks],
  );

  useEffect(() => {
    const key = `learn_resource_content_${contentHash(url)}`;
    // Try cache first
    const cached = loadFromStorage<{
      title: string;
      content: string;
      blocks: FeishuBlock[];
      related_links: RelatedLink[];
    }>(key, null as any);
    if (cached && (cached.blocks?.length || cached.content)) {
      setPageTitle(cached.title);
      setFeishuBlocks(cached.blocks || []);
      setDocumentContent(cached.content || "");
      setRelatedLinks(cached.related_links || []);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result: FetchResourceResult = await fetchResourceContent(url);
        if (cancelled) return;
        if (result.error) {
          setError(result.error);
        } else {
          setPageTitle(result.title || title);
          setFeishuBlocks(result.blocks || []);
          setDocumentContent(result.content || "");
          setRelatedLinks(result.related_links || []);
          saveToStorage(key, {
            title: result.title || title,
            content: result.content,
            blocks: result.blocks,
            related_links: result.related_links,
          });
        }
      } catch (e) {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [url, title]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex h-[85vh] w-full max-w-5xl flex-row overflow-hidden rounded-2xl border border-[var(--border)]/60 bg-[var(--background)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Document section */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)]/40 px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">
              {pageTitle || (locale === "zh" ? "文档阅读" : "Document Reader")}
            </div>
            {/* Breadcrumb or plain subtitle */}
            {breadcrumbStack && breadcrumbStack.length > 0 ? (
              <nav className="flex items-center gap-1 text-[11px] text-[var(--muted-foreground)] mt-0.5 overflow-x-auto hide-scrollbar">
                {breadcrumbStack.map((entry, i) => (
                  <span key={i} className="flex items-center gap-1 shrink-0">
                    {i > 0 && <span className="text-[var(--border)]">›</span>}
                    <button
                      onClick={() => onBreadcrumbClick?.(i)}
                      className="truncate max-w-[120px] hover:text-[var(--primary)] hover:underline transition"
                    >
                      {entry.title || entry.url}
                    </button>
                  </span>
                ))}
                <span className="text-[var(--border)] shrink-0">›</span>
                <span className="truncate max-w-[120px] font-semibold text-[var(--foreground)] shrink-0">
                  {pageTitle || title}
                </span>
              </nav>
            ) : (
              <div className="truncate text-[11px] text-[var(--muted-foreground)]">{title}</div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)]/60 px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/40 hover:text-[var(--foreground)]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {locale === "zh" ? "在飞书中打开" : "Open in Feishu"}
            </a>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--secondary)]/40 hover:text-[var(--foreground)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div ref={contentRef} className="flex-1 overflow-y-auto px-6 py-5" onMouseUp={handleTextSelection}>
          {loading ? (
            <div className="flex items-center justify-center py-20 text-sm text-[var(--muted-foreground)]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {locale === "zh" ? "正在加载文档内容…" : "Loading document content…"}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <AlertCircle className="h-8 w-8 text-red-400" />
              <p className="text-sm text-[var(--muted-foreground)]">
                {locale === "zh"
                  ? "无法加载文档内容，请直接打开链接查看"
                  : "Unable to load content. Please open the link directly."}
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)]"
              >
                <ExternalLink className="h-4 w-4" />
                {locale === "zh" ? "在飞书中打开" : "Open in Feishu"}
              </a>
            </div>
          ) : renderBlocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <AlertCircle className="h-8 w-8 text-amber-400" />
              <p className="text-sm text-[var(--muted-foreground)]">
                {locale === "zh"
                  ? "无法在应用内展示此文档内容（飞书页面需要浏览器渲染）"
                  : "This document content cannot be displayed in-app (Feishu pages require browser rendering)"}
              </p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-foreground)]"
              >
                <ExternalLink className="h-4 w-4" />
                {locale === "zh" ? "在飞书中打开" : "Open in Feishu"}
              </a>
            </div>
          ) : (
            <article className="pb-8">
              {renderBlocks.map((rb, i) => (
                <ContentBlock
                  key={i}
                  renderBlock={rb}
                  relatedLinks={relatedLinks}
                  onNavigate={onNavigate}
                />
              ))}
              {/* ─── Related Documents (internal links) ─── */}
              {relatedLinks.length > 0 && (
                <div className="mt-10 pt-6 border-t border-[var(--border)]/30">
                  <h3 className="text-sm font-semibold text-[var(--muted-foreground)] mb-4">
                    📚 {locale === "zh" ? "相关文档" : "Related Documents"}
                  </h3>
                  <div className="space-y-2">
                    {relatedLinks.map((link, i) => (
                      <button
                        key={i}
                        onClick={() => onNavigate?.(link.doc_url, link.doc_title, link.node_id)}
                        className="flex w-full items-center gap-3 rounded-lg border border-[var(--border)]/30 bg-[var(--card)] px-4 py-3 text-left transition hover:border-[var(--primary)]/30 hover:bg-[var(--primary)]/5"
                      >
                        <span className="shrink-0 text-[11px]">📎</span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-[var(--foreground)]">
                            {link.concept}
                          </div>
                          <div className="truncate text-xs text-[var(--muted-foreground)] mt-0.5">
                            → {link.doc_title}
                          </div>
                        </div>
                        <span className="shrink-0 text-xs text-[var(--muted-foreground)]">
                          {locale === "zh" ? "打开" : "Open"} →
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </article>
          )}
        </div>
        </div>{/* End document section */}

        {/* AI assistant panel */}
        <DocumentAIPanel
          nodeId={nodeId}
          documentUrl={url}
          documentTitle={pageTitle || title}
          documentContent={documentContent}
          locale={locale}
          isMobile={isMobile}
          selectedText={selectedText}
          onClearSelection={() => setSelectedText("")}
        />
      </div>
    </div>
  );
}
