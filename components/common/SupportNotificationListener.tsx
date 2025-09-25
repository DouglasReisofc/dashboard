"use client";

import { useEffect, useRef } from "react";

import { getAssetPath } from "../../helper/assetPath";

type SupportMessagePayload = {
  whatsappId: string;
  message: {
    id: number;
    direction: "inbound" | "outbound";
    messageType: string;
    text: string | null;
    timestamp: string;
  };
};

type PurchaseCreatedEvent = {
  categoryName: string;
  categoryPrice: number;
  customerName: string | null;
  customerWhatsapp: string | null;
  purchasedAt: string;
  productDetails?: string | null;
};

type NotificationCreatedEvent = {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
};

const RECONNECT_DELAY = 5000;
const RAW_BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || "").trim();
const BASE_PREFIX = RAW_BASE_PATH && RAW_BASE_PATH !== "/"
  ? (RAW_BASE_PATH.startsWith("/") ? RAW_BASE_PATH : `/${RAW_BASE_PATH}`)
  : "";
const SSE_PATH = `${BASE_PREFIX}/api/support/stream`;

const TTS_BASE_URL = (process.env.NEXT_PUBLIC_TTS_BASE_URL || "https://botadmin.shop/api/geraraudio").trim();
const TTS_VOICE = (process.env.NEXT_PUBLIC_TTS_VOICE || "ludmilla").trim();
const TTS_API_KEY = (process.env.NEXT_PUBLIC_TTS_API_KEY || "equipevipadm").trim();

const SupportNotificationListener = () => {
  const sseRef = useRef<EventSource | null>(null);
  const supportAudioRef = useRef<HTMLAudioElement | null>(null);
  const purchaseAudioRef = useRef<HTMLAudioElement | null>(null);
  const balanceAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentSpeechUrlRef = useRef<string | null>(null);
  const speechQueueRef = useRef<string[]>([]);
  const isProcessingSpeechRef = useRef(false);
  const lastCoinPlaybackRef = useRef(0);
  const recentCoinKeysRef = useRef<Record<string, number>>({});
  const recentSpeechKeysRef = useRef<Record<string, number>>({});
  const reconnectRef = useRef<number | null>(null);

  useEffect(() => {
    const createAudioWithFallback = (candidates: Array<{ path: string; mime?: string }>) => {
      const probe = document.createElement("audio");

      for (const candidate of candidates) {
        if (!candidate?.path) {
          continue;
        }

        if (!candidate.mime || !probe.canPlayType || probe.canPlayType(candidate.mime)) {
          const audio = new Audio(getAssetPath(candidate.path));
          audio.preload = "auto";
          return audio;
        }
      }

      const fallback = new Audio(getAssetPath(candidates[0]?.path ?? ""));
      fallback.preload = "auto";
      return fallback;
    };

    const supportAudio = createAudioWithFallback([
      { path: "/sounds/notificacao.mp3", mime: "audio/mpeg" },
    ]);
    supportAudioRef.current = supportAudio;

    const purchaseAudio = createAudioWithFallback([
      { path: "/sounds/jh1.ogg", mime: "audio/ogg" },
      { path: "/sounds/coin.mp3", mime: "audio/mpeg" },
    ]);
    purchaseAudioRef.current = purchaseAudio;

    const balanceAudio = createAudioWithFallback([
      { path: "/sounds/coin.mp3", mime: "audio/mpeg" },
      { path: "/sounds/jh1.ogg", mime: "audio/ogg" },
    ]);
    balanceAudioRef.current = balanceAudio;

    const MIN_COIN_INTERVAL_MS = 120;
    const COIN_DEDUP_WINDOW_MS = 5000;
    const SPEECH_DEDUP_WINDOW_MS = 4000;

    const processSpeechQueue = () => {
      if (isProcessingSpeechRef.current) {
        return;
      }

      const nextText = speechQueueRef.current.shift();
      if (!nextText) {
        return;
      }

      isProcessingSpeechRef.current = true;

      const handleFailure = (error?: unknown) => {
        if (error) {
          console.error("Falha ao preparar áudio de TTS", error);
        }
        if (speechAudioRef.current) {
          speechAudioRef.current.pause();
          speechAudioRef.current = null;
        }
        isProcessingSpeechRef.current = false;
        processSpeechQueue();
      };

      try {
        const ttsUrl = buildTtsUrl(nextText);
        if (!ttsUrl) {
          handleFailure();
          return;
        }

        const audioElement = new Audio(ttsUrl.toString());
        audioElement.preload = "auto";

        const handleCleanup = () => {
          audioElement.removeEventListener("ended", handleCleanup);
          audioElement.removeEventListener("error", handleError);
          if (speechAudioRef.current === audioElement) {
            speechAudioRef.current.pause();
            speechAudioRef.current = null;
          }
          isProcessingSpeechRef.current = false;
          processSpeechQueue();
        };

        const handleError = () => {
          console.error("Falha ao carregar áudio da fila de TTS");
          handleCleanup();
        };

        audioElement.addEventListener("ended", handleCleanup);
        audioElement.addEventListener("error", handleError);

        speechAudioRef.current = audioElement;
        audioElement.currentTime = 0;
        void audioElement.play().catch((playError) => {
          console.error("Falha ao reproduzir áudio da fila de TTS", playError);
          handleCleanup();
        });
      } catch (error) {
        handleFailure(error);
      }
    };

    const enqueueSpeech = (text: string, dedupeKey?: string, delayMs?: number) => {
      const trimmedText = text.trim();
      if (!trimmedText) {
        return;
      }

      const now = Date.now();

      if (dedupeKey) {
        const lastTime = recentSpeechKeysRef.current[dedupeKey];
        if (typeof lastTime === "number" && now - lastTime < SPEECH_DEDUP_WINDOW_MS) {
          return;
        }
        recentSpeechKeysRef.current[dedupeKey] = now;

        for (const [key, timestamp] of Object.entries(recentSpeechKeysRef.current)) {
          if (now - timestamp > SPEECH_DEDUP_WINDOW_MS) {
            delete recentSpeechKeysRef.current[key];
          }
        }
      }

      const append = () => {
        speechQueueRef.current.push(trimmedText);
        processSpeechQueue();
      };

      if (typeof delayMs === "number" && delayMs > 0) {
        window.setTimeout(append, delayMs);
      } else {
        append();
      }
    };

    const playCoin = (audioInstance: HTMLAudioElement | null, dedupeKey?: string) => {
      if (!audioInstance) {
        return;
      }

      const now = Date.now();
      if (dedupeKey) {
        const lastTime = recentCoinKeysRef.current[dedupeKey];
        if (typeof lastTime === "number" && now - lastTime < COIN_DEDUP_WINDOW_MS) {
          return;
        }
        recentCoinKeysRef.current[dedupeKey] = now;

        for (const [key, timestamp] of Object.entries(recentCoinKeysRef.current)) {
          if (now - timestamp > COIN_DEDUP_WINDOW_MS) {
            delete recentCoinKeysRef.current[key];
          }
        }
      }

      if (now - lastCoinPlaybackRef.current < MIN_COIN_INTERVAL_MS) {
        return;
      }

      lastCoinPlaybackRef.current = now;
      audioInstance.currentTime = 0;
      void audioInstance.play().catch(() => {
        // Ignora restrições de autoplay silenciosamente
      });
    };

    const readCounts = (): Record<string, number> => {
      try {
        const raw = sessionStorage.getItem("support-unread-counts");
        if (!raw) {
          return {};
        }
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        return {};
      }
    };

    const writeCounts = (counts: Record<string, number>) => {
      try {
        sessionStorage.setItem("support-unread-counts", JSON.stringify(counts));
      } catch {
        // storage might be full or unavailable
      }

      window.dispatchEvent(
        new CustomEvent("support:unread-counts", { detail: { counts } }),
      );
    };

    const incrementCount = (whatsappId: string) => {
      const counts = readCounts();
      counts[whatsappId] = (counts[whatsappId] ?? 0) + 1;
      writeCounts(counts);
    };

    const clearCount = (whatsappId: string) => {
      const counts = readCounts();
      if (!counts[whatsappId]) {
        return;
      }
      delete counts[whatsappId];
      writeCounts(counts);
    };

    const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 2,
    }).format(value);

    const buildTtsUrl = (text: string) => {
      if (!TTS_BASE_URL) {
        return null;
      }

      try {
        const url = TTS_BASE_URL.startsWith("http")
          ? new URL(TTS_BASE_URL)
          : new URL(TTS_BASE_URL, window.location.origin);

        url.searchParams.set("texto", text);

        if (TTS_VOICE) {
          url.searchParams.set("voz", TTS_VOICE);
        }

        if (TTS_API_KEY) {
          url.searchParams.set("apikey", TTS_API_KEY);
        }

        return url;
      } catch (error) {
        console.warn("Não foi possível construir a URL da API de TTS", error);
        return null;
      }
    };

    const extractString = (value: unknown) => {
      if (typeof value !== "string") {
        return null;
      }
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    };

    const normalizeIdentifier = (value: string | null | undefined) => {
      if (typeof value !== "string") {
        return "";
      }
      return value.trim().toLowerCase();
    };

    const playBalanceSpeech = (payload: NotificationCreatedEvent) => {
      if (!payload?.metadata || typeof (payload.metadata as Record<string, unknown>).amount === "undefined") {
        return;
      }

      const rawMetadata = payload.metadata as Record<string, unknown>;
      const amountValue = Number(rawMetadata.amount);
      if (!Number.isFinite(amountValue)) {
        return;
      }

      const customerName = extractString(rawMetadata.customerName);
      const customerWhatsapp = extractString(rawMetadata.customerWhatsapp);

      const speakerLabel = customerName || customerWhatsapp || "Seu cliente";
      const formattedAmount = formatCurrency(amountValue);
      const text = `${speakerLabel} adicionou ${formattedAmount} no robô.`;

      try {
        const dedupeKey = `balance:${payload.id}`;
        enqueueSpeech(text, dedupeKey, 120);
      } catch (error) {
        console.error("Falha ao enfileirar áudio de crédito", error);
      }
    };

    const buildPurchaseAnnouncement = (data: {
      customerName: string | null;
      customerWhatsapp: string | null;
      categoryName: string | null;
      productDetails: string | null;
    }) => {
      const normalizedCustomerWhatsapp = extractString(data.customerWhatsapp);
      const normalizedCustomerName = extractString(data.customerName);
      const customerLabel = normalizedCustomerName
        || normalizedCustomerWhatsapp
        || "Seu cliente";

      const productLabel = extractString(data.categoryName)
        || extractString(data.productDetails);

      const message = productLabel
        ? `${customerLabel} comprou ${productLabel}.`
        : `${customerLabel} realizou uma compra.`;

      const key = [
        normalizeIdentifier(normalizedCustomerWhatsapp || normalizedCustomerName || customerLabel),
        normalizeIdentifier(productLabel),
        "",
      ].join("|");

      return { message, key };
    };

    const announcePurchase = (data: {
      customerName: string | null;
      customerWhatsapp: string | null;
      categoryName: string | null;
      productDetails: string | null;
      coinAudio?: HTMLAudioElement | null;
    }) => {
      const { message, key } = buildPurchaseAnnouncement(data);

      playCoin(data.coinAudio ?? purchaseAudioRef.current, key);
      enqueueSpeech(message, key, 120);
    };

    const connect = () => {
      if (sseRef.current) {
        return;
      }

      const es = new EventSource(SSE_PATH, { withCredentials: true });
      sseRef.current = es;

      es.addEventListener("support:message-created", (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data) as SupportMessagePayload;

          window.dispatchEvent(
            new CustomEvent("support:message-created", { detail: payload }),
          );

          if (payload?.message?.direction === "inbound") {
            const audioInstance = supportAudioRef.current;
            if (audioInstance) {
              audioInstance.currentTime = 0;
              void audioInstance.play().catch(() => {
                // Ignora restrições de autoplay silenciosamente
              });
            }

            incrementCount(payload.whatsappId);

            window.dispatchEvent(
              new CustomEvent("support:new-inbound", {
                detail: {
                  whatsappId: payload.whatsappId,
                  messageId: payload.message.id,
                },
              }),
            );
          }
        } catch (error) {
          console.error("Falha ao processar evento de suporte", error);
        }
      });

      es.addEventListener("support:thread-updated", (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data) as {
            whatsappId: string;
            customerName: string | null;
            profileName: string | null;
            lastMessagePreview: string | null;
            lastMessageAt: string | null;
            status: "open" | "closed";
            within24h?: boolean;
            minutesLeft24h?: number;
          };

          window.dispatchEvent(
            new CustomEvent("support:thread-updated", { detail: payload }),
          );
        } catch (error) {
          console.error("Falha ao processar atualização de thread", error);
        }
      });

      es.addEventListener("purchase:created", (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data) as PurchaseCreatedEvent;

          announcePurchase({
            customerName: payload.customerName,
            customerWhatsapp: payload.customerWhatsapp,
            categoryName: payload.categoryName,
            productDetails: payload.productDetails ?? null,
            coinAudio: purchaseAudioRef.current,
          });

          window.dispatchEvent(
            new CustomEvent("purchase:created", { detail: payload }),
          );
        } catch (error) {
          console.error("Falha ao processar evento de compra", error);
        }
      });

      es.addEventListener("notification:created", (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data) as NotificationCreatedEvent;

          if (payload.type === "customer_balance_credit") {
            const coinKey = `balance:${payload.id}`;
            playCoin(balanceAudioRef.current ?? purchaseAudioRef.current, coinKey);
            playBalanceSpeech(payload);
          }

          window.dispatchEvent(
            new CustomEvent("notification:created", { detail: payload }),
          );
        } catch (error) {
          console.error("Falha ao processar notificação", error);
        }
      });

      es.addEventListener("open", () => {
        if (reconnectRef.current) {
          clearTimeout(reconnectRef.current);
          reconnectRef.current = null;
        }
      });

      es.onerror = () => {
        es.close();
        sseRef.current = null;
        if (!reconnectRef.current) {
          reconnectRef.current = window.setTimeout(connect, RECONNECT_DELAY);
        }
      };
    };

    connect();
    writeCounts(readCounts());

    const handleThreadOpened = (event: Event) => {
      const detail = (event as CustomEvent<{ whatsappId?: string }>).detail;
      if (!detail?.whatsappId) {
        return;
      }
      clearCount(detail.whatsappId);
    };

    window.addEventListener("support:thread-opened", handleThreadOpened as EventListener);

    return () => {
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
      sseRef.current?.close();
      sseRef.current = null;
      supportAudioRef.current?.pause();
      supportAudioRef.current = null;
      purchaseAudioRef.current?.pause();
      purchaseAudioRef.current = null;
      balanceAudioRef.current?.pause();
      balanceAudioRef.current = null;
      if (speechAudioRef.current) {
        speechAudioRef.current.pause();
        speechAudioRef.current = null;
      }
      if (currentSpeechUrlRef.current) {
        URL.revokeObjectURL(currentSpeechUrlRef.current);
        currentSpeechUrlRef.current = null;
      }
      speechQueueRef.current = [];
      isProcessingSpeechRef.current = false;
      recentCoinKeysRef.current = {};
      recentSpeechKeysRef.current = {};
      window.removeEventListener("support:thread-opened", handleThreadOpened as EventListener);
    };
  }, []);

  return null;
};

export default SupportNotificationListener;
