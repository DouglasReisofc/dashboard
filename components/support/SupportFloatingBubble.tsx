"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

interface SupportThreadUpdateDetail {
  whatsappId: string;
  customerName: string | null;
  profileName: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  status: "open" | "closed";
  within24h?: boolean;
  minutesLeft24h?: number;
}

interface SupportMessageDetail {
  whatsappId: string;
  message: {
    id: number;
    direction: "inbound" | "outbound";
    messageType: string;
    text: string | null;
    timestamp: string;
    media?: {
      mediaType: string;
      caption?: string | null;
      filename?: string | null;
    } | null;
  };
}

const BUBBLE_HIDE_DELAY = 7_000;
const MIN_MARGIN = 16;
const DRAG_THRESHOLD = 6;

type BubblePreview = {
  id: string;
  whatsappId: string;
  customerLabel: string;
  message: string;
  timestamp: string;
};

type Position = {
  top: number;
  left: number;
};

const getMessagePreview = (detail: SupportMessageDetail["message"]): string => {
  if (detail.text && detail.text.trim()) {
    return detail.text.trim();
  }

  switch (detail.messageType) {
    case "image":
      return "📷 Imagem recebida";
    case "video":
      return "🎞️ Vídeo recebido";
    case "audio":
      return "🎧 Áudio recebido";
    case "document":
      return detail.media?.filename
        ? `📄 Documento: ${detail.media.filename}`
        : "📄 Documento recebido";
    case "sticker":
      return "😊 Sticker recebido";
    default:
      return "Nova mensagem recebida";
  }
};

const clamp = (value: number, min: number, max: number) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const SupportFloatingBubble = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [currentPreview, setCurrentPreview] = useState<BubblePreview | null>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const queueRef = useRef<BubblePreview[]>([]);
  const currentRef = useRef<BubblePreview | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const seenMessagesRef = useRef<Set<string>>(new Set());
  const threadsRef = useRef<Record<string, SupportThreadUpdateDetail>>({});
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const pointerMovedRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const isSupportPage = pathname?.startsWith("/dashboard/user/conversas");

  const ensurePosition = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    setPosition((prev) => {
      if (prev) {
        const bubbleWidth = bubbleRef.current?.offsetWidth ?? 180;
        const bubbleHeight = bubbleRef.current?.offsetHeight ?? 80;
        return {
          top: clamp(prev.top, MIN_MARGIN, window.innerHeight - bubbleHeight - MIN_MARGIN),
          left: clamp(prev.left, MIN_MARGIN, window.innerWidth - bubbleWidth - MIN_MARGIN),
        };
      }
      const initialTop = window.innerHeight - 180;
      const initialLeft = window.innerWidth - 220;
      return {
        top: clamp(initialTop, MIN_MARGIN, window.innerHeight - 140),
        left: clamp(initialLeft, MIN_MARGIN, window.innerWidth - 200),
      };
    });
  }, []);

  const clearHideTimeout = () => {
    if (hideTimeoutRef.current) {
      window.clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  };

  const scheduleHide = useCallback(() => {
    clearHideTimeout();
    hideTimeoutRef.current = window.setTimeout(() => {
      setCurrentPreview(null);
      currentRef.current = null;
    }, BUBBLE_HIDE_DELAY);
  }, []);

  const showNextPreview = useCallback(() => {
    if (queueRef.current.length === 0) {
      setCurrentPreview(null);
      currentRef.current = null;
      clearHideTimeout();
      return;
    }

    const next = queueRef.current.shift();
    if (!next) {
      return;
    }

    currentRef.current = next;
    setCurrentPreview(next);
    scheduleHide();
  }, [scheduleHide]);

  const enqueuePreview = useCallback(
    (preview: BubblePreview) => {
      queueRef.current.push(preview);
      if (!currentRef.current) {
        showNextPreview();
      }
    },
    [showNextPreview],
  );

  const handleMessageEvent = useCallback(
    (detail: SupportMessageDetail | null | undefined) => {
      if (!detail || detail.message.direction !== "inbound") {
        return;
      }

      const messageKey = `${detail.whatsappId}:${detail.message.id}`;
      if (seenMessagesRef.current.has(messageKey)) {
        return;
      }
      seenMessagesRef.current.add(messageKey);

      const existing = threadsRef.current[detail.whatsappId];
      threadsRef.current[detail.whatsappId] = {
        whatsappId: detail.whatsappId,
        customerName: existing?.customerName ?? null,
        profileName: existing?.profileName ?? null,
        lastMessagePreview: detail.message.text ?? existing?.lastMessagePreview ?? null,
        lastMessageAt: detail.message.timestamp,
        status: "open",
        within24h: existing?.within24h,
        minutesLeft24h: existing?.minutesLeft24h,
      };

      const threadInfo = threadsRef.current[detail.whatsappId];
      const label = threadInfo?.customerName
        || threadInfo?.profileName
        || detail.whatsappId;

      enqueuePreview({
        id: messageKey,
        whatsappId: detail.whatsappId,
        customerLabel: label,
        message: getMessagePreview(detail.message),
        timestamp: detail.message.timestamp,
      });
    },
    [enqueuePreview],
  );

  const handleThreadUpdate = useCallback((detail: SupportThreadUpdateDetail | null | undefined) => {
    if (!detail || !detail.whatsappId) {
      return;
    }

    threadsRef.current[detail.whatsappId] = detail;
  }, []);

  const dismissCurrent = useCallback(() => {
    clearHideTimeout();
    setCurrentPreview(null);
    currentRef.current = null;
  }, []);

  const handleBubblePointerDown: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (!bubbleRef.current) {
      return;
    }

    pointerMovedRef.current = false;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    isDraggingRef.current = true;
    const rect = bubbleRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    bubbleRef.current.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const handleBubblePointerMove: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (!isDraggingRef.current) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }

    const start = pointerStartRef.current;
    if (start) {
      const deltaX = Math.abs(event.clientX - start.x);
      const deltaY = Math.abs(event.clientY - start.y);
      if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
        pointerMovedRef.current = true;
      }
    }

    const bubbleWidth = bubbleRef.current?.offsetWidth ?? 180;
    const bubbleHeight = bubbleRef.current?.offsetHeight ?? 80;
    const nextLeft = clamp(
      event.clientX - dragOffsetRef.current.x,
      MIN_MARGIN,
      window.innerWidth - bubbleWidth - MIN_MARGIN,
    );
    const nextTop = clamp(
      event.clientY - dragOffsetRef.current.y,
      MIN_MARGIN,
      window.innerHeight - bubbleHeight - MIN_MARGIN,
    );
    setPosition({ top: nextTop, left: nextLeft });
    event.preventDefault();
  };

  const handleBubblePointerUp: React.PointerEventHandler<HTMLDivElement> = (event) => {
    if (!isDraggingRef.current) {
      return;
    }

    isDraggingRef.current = false;
    bubbleRef.current?.releasePointerCapture(event.pointerId);

    const wasClick = !pointerMovedRef.current;
    pointerMovedRef.current = false;
    pointerStartRef.current = null;

    if (wasClick && currentRef.current) {
      if (pathname?.includes("/dashboard/user/conversas")) {
        window.dispatchEvent(
          new CustomEvent("support:open-thread", {
            detail: { whatsappId: currentRef.current.whatsappId },
          }),
        );
      } else {
        try {
          sessionStorage.setItem("support:target-thread", currentRef.current.whatsappId);
        } catch {
          // ignore storage errors
        }
        router.push("/dashboard/user/conversas");
      }
      dismissCurrent();
      return;
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    ensurePosition();
    const handleResize = () => ensurePosition();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [ensurePosition]);

  useEffect(() => () => clearHideTimeout(), []);

  useEffect(() => {
    if (!isSupportPage) {
      return;
    }
    clearHideTimeout();
    queueRef.current = [];
    currentRef.current = null;
    setCurrentPreview(null);
  }, [isSupportPage]);

  useEffect(() => {
    const handleMessage = (event: Event) => {
      const detail = (event as CustomEvent<SupportMessageDetail>).detail;
      handleMessageEvent(detail);
    };

    const handleThread = (event: Event) => {
      const detail = (event as CustomEvent<SupportThreadUpdateDetail>).detail;
      handleThreadUpdate(detail);
    };

    window.addEventListener("support:message-created", handleMessage as EventListener);
    window.addEventListener("support:thread-updated", handleThread as EventListener);

    return () => {
      window.removeEventListener("support:message-created", handleMessage as EventListener);
      window.removeEventListener("support:thread-updated", handleThread as EventListener);
    };
  }, [handleMessageEvent, handleThreadUpdate]);

  useEffect(() => {
    if (!currentPreview && queueRef.current.length > 0) {
      showNextPreview();
    }
  }, [currentPreview, showNextPreview]);

  if (isSupportPage || !position || !currentPreview) {
    return null;
  }

  return (
    <div
      ref={bubbleRef}
      role="button"
      tabIndex={0}
      onPointerDown={handleBubblePointerDown}
      onPointerMove={handleBubblePointerMove}
      onPointerUp={handleBubblePointerUp}
      onPointerCancel={handleBubblePointerUp}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (currentRef.current) {
            if (pathname?.includes("/dashboard/user/conversas")) {
              window.dispatchEvent(
                new CustomEvent("support:open-thread", {
                  detail: { whatsappId: currentRef.current.whatsappId },
                }),
              );
            } else {
              try {
                sessionStorage.setItem("support:target-thread", currentRef.current.whatsappId);
              } catch {
                // ignore storage errors
              }
              router.push("/dashboard/user/conversas");
            }
            dismissCurrent();
          }
        } else if (event.key === "Escape") {
          dismissCurrent();
        }
      }}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        zIndex: 1080,
        cursor: "grab",
        userSelect: "none",
        touchAction: "none",
        boxShadow: "0 12px 32px rgba(30, 41, 59, 0.35)",
        borderRadius: "999px",
        background: "#1f2937",
        color: "#fff",
        padding: "12px 18px",
        maxWidth: 280,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: "50%",
          background: "#3b82f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 600,
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {(currentPreview.customerLabel?.trim()?.[0] ?? "?").toUpperCase()}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>
          {currentPreview.customerLabel}
        </span>
        <span
          style={{
            fontSize: 13,
            lineHeight: 1.2,
            color: "#e2e8f0",
            maxWidth: 200,
            wordBreak: "break-word",
          }}
        >
          {currentPreview.message}
        </span>
      </div>
      <button
        type="button"
        aria-label="Fechar notificação de suporte"
        onClick={(event) => {
          event.stopPropagation();
          dismissCurrent();
        }}
        style={{
          background: "transparent",
          border: "none",
          color: "#cbd5f5",
          fontSize: 18,
          lineHeight: 1,
          padding: 0,
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>
  );
};

export default SupportFloatingBubble;
