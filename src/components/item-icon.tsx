"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { itemIconUrl, schematicIconUrl, gameData } from "@/lib/game-data";

type CommonProps = {
  size?: number;
  className?: string;
  /** Tooltip / a11y label. Defaults to the resolved item/schematic name. */
  title?: string;
};

const FallbackBox = ({
  size,
  initials,
  className,
  title,
}: {
  size: number;
  initials: string;
  className?: string;
  title?: string;
}) => (
  <span
    role="img"
    aria-label={title ?? initials}
    title={title}
    style={{ width: size, height: size }}
    className={cn(
      "inline-flex items-center justify-center rounded bg-muted text-muted-foreground text-[0.6em] font-mono shrink-0",
      className
    )}
  >
    {initials}
  </span>
);

const initialsFor = (s: string): string => {
  // "Iron Plate" → "IP", "Silica" → "Si", "AI Limiter" → "AI"
  const words = s.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2);
  return (words[0][0] + words[1][0]).toUpperCase();
};

function CdnImage({
  src,
  size,
  alt,
  className,
  title,
  fallbackInitials,
}: {
  src: string;
  size: number;
  alt: string;
  className?: string;
  title?: string;
  fallbackInitials: string;
}) {
  const [errored, setErrored] = React.useState(false);
  if (errored) {
    return (
      <FallbackBox
        size={size}
        initials={fallbackInitials}
        className={className}
        title={title ?? alt}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      title={title ?? alt}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setErrored(true)}
      className={cn("inline-block shrink-0", className)}
      style={{ width: size, height: size }}
    />
  );
}

export function ItemIcon({
  item: itemClass,
  size = 24,
  className,
  title,
}: CommonProps & { item: string }) {
  const url = itemIconUrl(itemClass);
  const data = gameData.items[itemClass];
  const label = title ?? data?.name ?? itemClass;
  if (!url) {
    return (
      <FallbackBox
        size={size}
        initials={initialsFor(data?.name ?? itemClass)}
        className={className}
        title={label}
      />
    );
  }
  return (
    <CdnImage
      src={url}
      size={size}
      alt={label}
      title={label}
      className={className}
      fallbackInitials={initialsFor(data?.name ?? itemClass)}
    />
  );
}

export function SchematicIcon({
  schematic: schematicClass,
  size = 24,
  className,
  title,
}: CommonProps & { schematic: string }) {
  const url = schematicIconUrl(schematicClass);
  const data = gameData.schematics[schematicClass];
  const label = title ?? data?.name ?? schematicClass;
  if (!url) {
    return (
      <FallbackBox
        size={size}
        initials={initialsFor(data?.name ?? schematicClass)}
        className={className}
        title={label}
      />
    );
  }
  return (
    <CdnImage
      src={url}
      size={size}
      alt={label}
      title={label}
      className={className}
      fallbackInitials={initialsFor(data?.name ?? schematicClass)}
    />
  );
}
