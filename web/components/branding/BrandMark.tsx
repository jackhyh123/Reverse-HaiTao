"use client";

type BrandMarkSize = "sm" | "md" | "lg";

const BRAND_MONOGRAM = "AT";

const SIZE_CLASS_MAP: Record<BrandMarkSize, string> = {
  sm: "h-9 w-9 rounded-xl text-[11px]",
  md: "h-11 w-11 rounded-2xl text-[13px]",
  lg: "h-14 w-14 rounded-[18px] text-[15px]",
};

export function BrandMark({
  size = "md",
  className = "",
}: {
  size?: BrandMarkSize;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex items-center justify-center bg-[linear-gradient(135deg,#f59e0b_0%,#f97316_40%,#0f766e_100%)] font-semibold uppercase tracking-[0.24em] text-white shadow-[0_16px_40px_rgba(15,118,110,0.28)] ${SIZE_CLASS_MAP[size]} ${className}`.trim()}
    >
      {BRAND_MONOGRAM}
    </div>
  );
}
