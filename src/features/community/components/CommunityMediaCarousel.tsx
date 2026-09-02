import { useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  type Variants,
} from "framer-motion";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import type { CommunityPost } from "@/features/community/types";
import { cn } from "@/lib/utils";

type CommunityMedia = CommunityPost["media"][number];

type CommunityMediaCarouselProps = {
  media: CommunityMedia[];
  postTitle?: string | null;
  autoplayVideos?: boolean;
  viewerProgress?: number;
  onVideoPlay?: () => void;
  onVideoPause?: (currentTime: number, duration: number) => void;
  onVideoEnded?: (duration: number) => void;
};

const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 14 : -14,
    y: -10,
    rotate: direction > 0 ? 2 : -2,
    scale: 0.965,
    opacity: 0.9,
    filter: "blur(10px) saturate(0.72) brightness(0.92)",
  }),
  center: {
    x: 0,
    y: 0,
    rotate: 0,
    scale: 1,
    opacity: 1,
    filter: "blur(0px) saturate(1) brightness(1)",
  },
  exit: (direction: number) => ({
    x: direction > 0 ? "-108%" : "108%",
    y: 12,
    rotate: direction > 0 ? -6 : 6,
    scale: 0.94,
    opacity: 0.15,
    filter: "blur(7px) saturate(0.78) brightness(0.94)",
  }),
};

function DeckPreview({ item, depth }: { item: CommunityMedia; depth: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl bg-transparent"
      style={{
        zIndex: 10 - depth,
        transform:
          depth === 1
            ? "translate(18px, -13px) rotate(2.4deg) scale(0.955)"
            : "translate(32px, -22px) rotate(4.2deg) scale(0.905)",
        transformOrigin: "bottom center",
        boxShadow:
          depth === 1
            ? "0 14px 30px -18px rgb(15 23 42 / 0.42)"
            : "0 18px 36px -20px rgb(15 23 42 / 0.34)",
      }}
      aria-hidden="true"
    >
      {item.media_type === "image" ? (
        <img
          src={item.public_url}
          alt=""
          className="size-full scale-110 object-cover"
          style={{
            filter:
              depth === 1
                ? "blur(10px) saturate(0.72) brightness(0.92)"
                : "blur(16px) saturate(0.6) brightness(0.88)",
          }}
        />
      ) : (
        <div className="relative size-full overflow-hidden bg-slate-950">
          <video
            src={item.public_url}
            muted
            playsInline
            preload="metadata"
            className="size-full scale-110 object-cover"
            style={{
              filter:
                depth === 1
                  ? "blur(10px) saturate(0.72) brightness(0.78)"
                  : "blur(16px) saturate(0.6) brightness(0.7)",
            }}
          />
          <div className="absolute inset-0 grid place-items-center text-white/70">
            <Play className="size-9 fill-current" />
          </div>
        </div>
      )}
    </div>
  );
}

export function CommunityMediaCarousel({
  media,
  postTitle,
  autoplayVideos = false,
  viewerProgress,
  onVideoPlay,
  onVideoPause,
  onVideoEnded,
}: CommunityMediaCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const count = media.length;
  const active = media[activeIndex];

  useEffect(() => {
    if (activeIndex >= count) setActiveIndex(0);
  }, [activeIndex, count]);

  if (!active) return null;

  const move = (step: number) => {
    if (count < 2) return;
    setDirection(step > 0 ? 1 : -1);
    setActiveIndex((current) => (current + step + count) % count);
  };

  const select = (index: number) => {
    if (index === activeIndex) return;
    setDirection(index > activeIndex ? 1 : -1);
    setActiveIndex(index);
  };

  const previews = count > 1
    ? [1, 2]
        .filter((depth) => depth < count)
        .map((depth) => ({
          depth,
          item: media[(activeIndex + depth) % count],
        }))
        .reverse()
    : [];

  return (
    <section
      className="-mx-4 mt-5"
      aria-label={`Post media, item ${activeIndex + 1} of ${count}`}
    >
      <div className={cn("relative mx-2", count > 1 && "pb-3 pr-8 pt-6")}>
        <div
          className="relative aspect-[4/3] w-full overflow-visible rounded-xl bg-transparent outline-none sm:aspect-[16/10]"
          style={{ maxHeight: "min(68vh, 620px)" }}
          tabIndex={count > 1 ? 0 : undefined}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft") {
              event.preventDefault();
              move(-1);
            }
            if (event.key === "ArrowRight") {
              event.preventDefault();
              move(1);
            }
          }}
        >
          {previews.map(({ item, depth }) => (
            <DeckPreview key={`${item.id}-${depth}`} item={item} depth={depth} />
          ))}

          <AnimatePresence initial={false} custom={direction} mode="sync">
            <motion.div
              key={active.id}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
              drag={active.media_type === "image" && count > 1 ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.16}
              onDragEnd={(_, info) => {
                if (info.offset.x < -55 || info.velocity.x < -450) move(1);
                else if (info.offset.x > 55 || info.velocity.x > 450) move(-1);
              }}
              className={cn(
                "absolute inset-0 z-20 overflow-hidden rounded-xl bg-transparent shadow-sm",
                active.media_type === "image" && count > 1 && "cursor-grab active:cursor-grabbing",
              )}
            >
              {active.media_type === "video" ? (
                <video
                  src={active.public_url}
                  controls
                  autoPlay={autoplayVideos}
                  muted={autoplayVideos}
                  playsInline
                  preload="metadata"
                  className="size-full bg-black object-contain"
                  onLoadedMetadata={(event) => {
                    if (viewerProgress && viewerProgress > 0.02 && viewerProgress < 0.9) {
                      event.currentTarget.currentTime = event.currentTarget.duration * viewerProgress;
                    }
                  }}
                  onPlay={onVideoPlay}
                  onPause={(event) => onVideoPause?.(event.currentTarget.currentTime, event.currentTarget.duration)}
                  onEnded={(event) => onVideoEnded?.(event.currentTarget.duration)}
                />
              ) : (
                <img
                  src={active.public_url}
                  alt={active.alt_text || postTitle || `Community post image ${activeIndex + 1}`}
                  className="size-full select-none object-contain"
                  draggable={false}
                />
              )}
            </motion.div>
          </AnimatePresence>

          {count > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous media"
                onClick={() => move(-1)}
                className="absolute left-2 top-1/2 z-30 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-white/30 bg-slate-950/20 text-white/90 opacity-55 shadow-[0_6px_22px_-8px_rgba(15,23,42,0.8)] backdrop-blur-md transition-[opacity,background-color,transform,box-shadow] duration-200 hover:bg-slate-950/35 hover:opacity-100 hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.9)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95"
              >
                <ChevronLeft className="size-[18px] drop-shadow-sm" strokeWidth={2.2} />
              </button>
              <button
                type="button"
                aria-label="Next media"
                onClick={() => move(1)}
                className="absolute right-2 top-1/2 z-30 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-white/30 bg-slate-950/20 text-white/90 opacity-55 shadow-[0_6px_22px_-8px_rgba(15,23,42,0.8)] backdrop-blur-md transition-[opacity,background-color,transform,box-shadow] duration-200 hover:bg-slate-950/35 hover:opacity-100 hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.9)] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95"
              >
                <ChevronRight className="size-[18px] drop-shadow-sm" strokeWidth={2.2} />
              </button>
              <span className="absolute right-3 top-3 z-30 rounded-full bg-slate-950/70 px-2.5 py-1 text-xs font-semibold tabular-nums text-white">
                {activeIndex + 1}/{count}
              </span>
            </>
          )}
        </div>
      </div>

      {count > 1 && (
        <div className="mt-2 flex justify-center gap-1.5" aria-label="Choose media item">
          {media.map((item, index) => (
            <button
              key={item.id}
              type="button"
              aria-label={`Show media ${index + 1}`}
              aria-current={index === activeIndex ? "true" : undefined}
              onClick={() => select(index)}
              className={cn(
                "size-2.5 cursor-pointer rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                index === activeIndex ? "w-5 bg-primary" : "bg-border hover:bg-muted-foreground/60",
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}
