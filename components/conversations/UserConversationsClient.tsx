"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Image,
  ListGroup,
  Modal,
  Row,
  Spinner,
} from "react-bootstrap";

type ThreadSummary = {
  whatsappId: string;
  customerName: string | null;
  profileName: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  status: "open" | "closed";
  within24h: boolean;
  minutesLeft24h: number;
};

type SupportMessage = {
  id: number;
  direction: "inbound" | "outbound";
  messageType: string;
  text: string | null;
  timestamp: string;
  media?: {
    mediaId?: string | null;
    mediaUrl?: string | null;
    mediaType: string;
    mimeType: string | null;
    filename?: string | null;
    caption?: string | null;
  } | null;
};

type ConversationPayload = {
  thread: {
    whatsappId: string;
    customerName: string | null;
    profileName: string | null;
    status: "open" | "closed";
    lastMessageAt: string | null;
    lastMessagePreview?: string | null;
  };
  messages: SupportMessage[];
  within24h: boolean;
  minutesLeft24h: number;
};

type PendingMedia = {
  file: File;
  previewUrl: string;
  mediaType: "image" | "video" | "audio" | "document" | "sticker";
};

type InteractiveButtonState = {
  id: string;
  title: string;
};

type SocketMessageEvent = {
  whatsappId: string;
  message: SupportMessage;
};

const RAW_BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || "").trim();
const BASE_PREFIX = RAW_BASE_PATH && RAW_BASE_PATH !== "/"
  ? (RAW_BASE_PATH.startsWith("/") ? RAW_BASE_PATH : `/${RAW_BASE_PATH}`)
  : "";
const SOCKET_PATH = `${BASE_PREFIX}/api/socket/io`;
const SSE_PATH = `${BASE_PREFIX}/api/support/stream`;

const inferMediaTypeFromFile = (file: File): PendingMedia["mediaType"] => {
  const type = file.type.toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "audio";
  if (type === "image/webp") return "sticker";
  return "document";
};

const mediaUrlFromId = (mediaId: string) => `/api/support/media/${encodeURIComponent(mediaId)}`;

const MediaPreview = ({
  media,
  direction,
}: {
  media: NonNullable<SupportMessage["media"]>;
  direction: "inbound" | "outbound";
}) => {
  const caption = media.caption ?? media.filename ?? null;
  const resolvedUrl = media.mediaUrl || (media.mediaId ? mediaUrlFromId(media.mediaId) : null);

  if (!resolvedUrl) {
    return (
      <span className="text-secondary">
        Arquivo enviado. Atualize a página para visualizar.
      </span>
    );
  }

  switch (media.mediaType) {
    case "image":
      return (
        <div className="d-flex flex-column gap-2">
          <img
            src={resolvedUrl}
            alt={caption ?? "Imagem recebida"}
            className="img-fluid rounded"
            style={{ maxHeight: 260 }}
          />
          {caption && <span>{caption}</span>}
        </div>
      );
    case "document":
      return (
        <div className="d-flex flex-column gap-2">
          <Button
            as="a"
            href={resolvedUrl}
            target="_blank"
            rel="noopener noreferrer"
            variant={direction === "outbound" ? "outline-light" : "outline-secondary"}
            size="sm"
            className="text-start"
          >
            Baixar {media.filename ?? "documento"}
          </Button>
          {caption && <span>{caption}</span>}
        </div>
      );
    case "audio":
      return (
        <audio controls src={resolvedUrl}>
          Seu navegador não suporta áudio incorporado.
        </audio>
      );
    case "video":
      return (
        <div className="d-flex flex-column gap-2">
          <video controls className="w-100" style={{ maxHeight: 260 }}>
            <source src={resolvedUrl} type={media.mimeType ?? undefined} />
            Seu navegador não suporta vídeo.
          </video>
          {caption && <span>{caption}</span>}
        </div>
      );
    case "sticker":
      return (
        <img
          src={resolvedUrl}
          alt="Sticker"
          className="img-fluid"
          style={{ maxHeight: 180 }}
        />
      );
    default:
      return (
        <Button
          as="a"
          href={resolvedUrl}
          target="_blank"
          rel="noopener noreferrer"
          variant={direction === "outbound" ? "outline-light" : "outline-secondary"}
          size="sm"
          className="text-start"
        >
          Abrir arquivo ({media.mediaType})
        </Button>
      );
  }
};

const formatDateTime = (iso: string | null) => {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  } catch (error) {
    console.error("Failed to format date", error);
    return date.toISOString().replace("T", " ").slice(0, 19);
  }
};

const sortThreads = (threads: ThreadSummary[]) => {
  return [...threads].sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === "open" ? -1 : 1;
    }
    const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return timeB - timeA;
  });
};

const UserConversationsClient = () => {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [threadsError, setThreadsError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [conversation, setConversation] = useState<ConversationPayload | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [conversationError, setConversationError] = useState<string | null>(null);

  const [messageDraft, setMessageDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "danger"; message: string } | null>(null);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingMediaRef = useRef<PendingMedia[]>([]);
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const activeThreadRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const autoScrollRef = useRef(true);
  const sseRef = useRef<EventSource | null>(null);

  const [showInteractiveModal, setShowInteractiveModal] = useState(false);
  const [interactiveType, setInteractiveType] = useState<"buttons" | "cta_url">("buttons");
  const [interactiveButtons, setInteractiveButtons] = useState<Array<InteractiveButtonState>>([
    { id: "btn_1", title: "Sim" },
    { id: "btn_2", title: "Não" },
  ]);
const [interactiveBody, setInteractiveBody] = useState("Posso ajudar com algo?");
const [interactiveFooter, setInteractiveFooter] = useState("");
  const [interactiveHeader, setInteractiveHeader] = useState("");
  const [interactiveUrl, setInteractiveUrl] = useState("https://");
  const [interactiveButtonText, setInteractiveButtonText] = useState("Abrir link");
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const loadThreads = useCallback(async () => {
    try {
      setThreadsError(null);
      const res = await fetch("/api/support/threads");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message ?? "Não foi possível carregar as conversas.");
      }
      const list: ThreadSummary[] = Array.isArray(data?.threads) ? data.threads : [];
      setThreads(sortThreads(list));
    } catch (error) {
      console.error(error);
      setThreadsError(error instanceof Error ? error.message : "Erro ao carregar conversas.");
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  const loadConversation = useCallback(async (whatsappId: string) => {
    try {
      setConversationError(null);
      setLoadingConversation(true);
      const res = await fetch(`/api/support/threads/${encodeURIComponent(whatsappId)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message ?? "Não foi possível carregar a conversa.");
      }
      setConversation(data as ConversationPayload);
    } catch (error) {
      console.error(error);
      setConversation(null);
      setConversationError(error instanceof Error ? error.message : "Erro ao carregar a conversa.");
    } finally {
      setLoadingConversation(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (loadingThreads) {
      return;
    }

    try {
      const target = sessionStorage.getItem("support:target-thread");
      if (target) {
        sessionStorage.removeItem("support:target-thread");
        setSelectedId(target);
      }
    } catch {
      // ignore storage errors
    }
  }, [loadingThreads, threads]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    if (!selectedId) {
      setConversation(null);
      setConversationError(null);
      setLoadingConversation(false);
      return;
    }
    setConversationError(null);
    loadConversation(selectedId);
  }, [selectedId, loadConversation]);

  useEffect(() => {
    if (!selectedId) {
      return;
    }
    setUnreadCounts((prev) => {
      if (!prev[selectedId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[selectedId];
      return next;
    });
    window.dispatchEvent(
      new CustomEvent("support:thread-opened", { detail: { whatsappId: selectedId } }),
    );
  }, [selectedId]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("support-unread-counts");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          setUnreadCounts(parsed as Record<string, number>);
        }
      }
    } catch {
      // ignore storage errors
    }

    const handleCounts = (event: Event) => {
      const detail = (event as CustomEvent<{ counts?: Record<string, number> }>).detail;
      if (detail?.counts) {
        setUnreadCounts(detail.counts);
      }
    };

    window.addEventListener("support:unread-counts", handleCounts as EventListener);
    return () => {
      window.removeEventListener("support:unread-counts", handleCounts as EventListener);
    };
  }, []);

  useEffect(() => {
    const handleInbound = (event: Event) => {
      const detail = (event as CustomEvent<{ whatsappId?: string }>).detail;
      const whatsappId = detail?.whatsappId;
      if (!whatsappId || selectedIdRef.current !== whatsappId) {
        return;
      }

      window.dispatchEvent(
        new CustomEvent("support:thread-opened", { detail: { whatsappId } }),
      );

      setUnreadCounts((prev) => {
        if (!prev[whatsappId]) {
          return prev;
        }
        const next = { ...prev };
        delete next[whatsappId];
        return next;
      });
    };

    window.addEventListener("support:new-inbound", handleInbound as EventListener);
    return () => {
      window.removeEventListener("support:new-inbound", handleInbound as EventListener);
    };
  }, []);

  useEffect(() => {
    const handleOpenRequest = (event: Event) => {
      const detail = (event as CustomEvent<{ whatsappId?: string }>).detail;
      if (!detail?.whatsappId) {
        return;
      }
      setSelectedId(detail.whatsappId);
    };

    window.addEventListener("support:open-thread", handleOpenRequest as EventListener);
    return () => {
      window.removeEventListener("support:open-thread", handleOpenRequest as EventListener);
    };
  }, []);

  useEffect(() => {
    const socket = io({
      path: SOCKET_PATH,
      transports: ["websocket", "polling"],
      withCredentials: true,
    });

    socketRef.current = socket;

    socket.on("support:thread-updated", (thread: ThreadSummary) => {
      setThreads((prev) => {
        const index = prev.findIndex((item) => item.whatsappId === thread.whatsappId);
        if (index === -1) {
          return sortThreads([...prev, thread]);
        }
        const next = [...prev];
        next[index] = { ...next[index], ...thread };
        return sortThreads(next);
      });

      setConversation((prev) => {
        if (!prev || prev.thread.whatsappId !== thread.whatsappId) {
          return prev;
        }
        return {
          ...prev,
          thread: {
            ...prev.thread,
            customerName: thread.customerName,
            profileName: thread.profileName,
            status: thread.status,
            lastMessageAt: thread.lastMessageAt,
          },
          within24h: thread.within24h,
          minutesLeft24h: thread.minutesLeft24h,
        };
      });
    });

    socket.on("support:message-created", (payload: SocketMessageEvent) => {
      setConversation((prev) => {
        if (!prev || prev.thread.whatsappId !== payload.whatsappId) {
          return prev;
        }
        if (prev.messages.some((msg) => msg.id === payload.message.id)) {
          return prev;
        }
        const nextMessages = [...prev.messages, payload.message].sort((a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );
        return {
          ...prev,
          messages: nextMessages,
          thread: {
            ...prev.thread,
            lastMessageAt: payload.message.timestamp,
          },
        };
      });

      if (!autoScrollRef.current) {
        setShowScrollToBottom(true);
      }
    });

    socket.on("support:thread-not-found", ({ whatsappId }: { whatsappId: string }) => {
      if (selectedIdRef.current === whatsappId) {
        setFeedback({
          type: "danger",
          message: "Conversa não encontrada. Atualize a lista de atendimentos.",
        });
        setSelectedId(null);
        setConversation(null);
      }
      loadThreads();
    });

    const ensureSse = () => {
      if (sseRef.current) return;
      const es = new EventSource(SSE_PATH, { withCredentials: true });
      sseRef.current = es;

      es.addEventListener("support:thread-updated", (ev: MessageEvent) => {
        try {
          const thread = JSON.parse(ev.data) as ThreadSummary;
          setThreads((prev) => {
            const index = prev.findIndex((item) => item.whatsappId === thread.whatsappId);
            if (index === -1) return sortThreads([...prev, thread]);
            const next = [...prev];
            next[index] = { ...next[index], ...thread };
            return sortThreads(next);
          });
          setConversation((prev) => {
            if (!prev || prev.thread.whatsappId !== thread.whatsappId) return prev;
            return {
              ...prev,
              thread: {
                ...prev.thread,
                customerName: thread.customerName,
                profileName: thread.profileName,
                status: thread.status,
                lastMessageAt: thread.lastMessageAt,
              },
              within24h: thread.within24h,
              minutesLeft24h: thread.minutesLeft24h,
            };
          });
        } catch {}
      });

      es.addEventListener("support:message-created", (ev: MessageEvent) => {
        try {
          const payload = JSON.parse(ev.data) as SocketMessageEvent;
          setConversation((prev) => {
            if (!prev || prev.thread.whatsappId !== payload.whatsappId) return prev;
            if (prev.messages.some((m) => m.id === payload.message.id)) return prev;
            const nextMessages = [...prev.messages, payload.message].sort((a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
            );
            return {
              ...prev,
              messages: nextMessages,
              thread: { ...prev.thread, lastMessageAt: payload.message.timestamp },
            };
          });
          if (!autoScrollRef.current) setShowScrollToBottom(true);
        } catch {}
      });

      es.onerror = () => {
        // browser will retry automatically
      };
    };

    // Start SSE proactively as a fallback/secondary stream
    ensureSse();

    socket.on("connect_error", (error) => {
      console.error("Falha na conexão em tempo real", error);
      ensureSse();
    });

    socket.on("disconnect", () => {
      ensureSse();
    });

    return () => {
      activeThreadRef.current = null;
      socketRef.current = null;
      socket.removeAllListeners();
      socket.disconnect();
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };
  }, [loadThreads]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) {
      return;
    }

    const previous = activeThreadRef.current;
    if (previous && previous !== selectedId) {
      socket.emit("support:leave-thread", { whatsappId: previous });
      activeThreadRef.current = null;
    }

    if (selectedId && activeThreadRef.current !== selectedId) {
      socket.emit("support:join-thread", { whatsappId: selectedId });
      activeThreadRef.current = selectedId;
    }
  }, [selectedId]);

  useEffect(() => {
    if (conversation && autoScroll && conversationRef.current) {
      const el = conversationRef.current;
      el.scrollTop = el.scrollHeight;
      setShowScrollToBottom(false);
    }
  }, [conversation, autoScroll]);

  useEffect(() => {
    autoScrollRef.current = autoScroll;
  }, [autoScroll]);

  useEffect(() => {
    pendingMediaRef.current = pendingMedia;
  }, [pendingMedia]);

  useEffect(() => () => {
    pendingMediaRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }, []);

  const selectedThread = useMemo(() => {
    if (!selectedId) return null;
    return threads.find((thread) => thread.whatsappId === selectedId) ?? null;
  }, [threads, selectedId]);

  const handleSelect = (thread: ThreadSummary) => {
    setSelectedId(thread.whatsappId);
    setFeedback(null);
    setMessageDraft("");
    setPendingMedia([]);
    setAutoScroll(true);
    setConversation(null);
    setUnreadCounts((prev) => {
      if (!prev[thread.whatsappId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[thread.whatsappId];
      return next;
    });
    window.dispatchEvent(
      new CustomEvent("support:thread-opened", { detail: { whatsappId: thread.whatsappId } }),
    );
  };

  const handleSend = async () => {
    if (!selectedId || isSending) return;
    if (!messageDraft.trim() && pendingMedia.length === 0) return;
    setIsSending(true);
    setFeedback(null);
    try {
      const usedDraftAsCaption = pendingMedia.length === 1 && messageDraft.trim().length > 0;

      for (const item of pendingMedia) {
        const formData = new FormData();
        formData.append("to", selectedId);
        formData.append("mode", "media");
        formData.append("mediaType", item.mediaType);
        formData.append("file", item.file);
        if (usedDraftAsCaption && messageDraft.trim()) {
          formData.append("caption", messageDraft.trim());
        }

        const res = await fetch("/api/support/messages", {
          method: "POST",
          body: formData,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.message ?? "Não foi possível enviar a mídia.");
        }
      }

      if (messageDraft.trim() && (!pendingMedia.length || pendingMedia.length > 1)) {
        const formData = new FormData();
        formData.append("to", selectedId);
        formData.append("mode", "text");
        formData.append("text", messageDraft.trim());
        const res = await fetch("/api/support/messages", {
          method: "POST",
          body: formData,
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.message ?? "Não foi possível enviar a mensagem.");
        }
      }

      setMessageDraft("");
      setPendingMedia((prev) => {
        prev.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        return [];
      });
      setFeedback({ type: "success", message: "Mensagem enviada." });
      setAutoScroll(true);
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "danger",
        message: error instanceof Error ? error.message : "Falha ao enviar mensagem.",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleCloseThread = async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/support/threads/${encodeURIComponent(selectedId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message ?? "Não foi possível encerrar a conversa.");
      }
      setFeedback({ type: "success", message: "Conversa encerrada." });
      await Promise.all([loadConversation(selectedId), loadThreads()]);
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "danger",
        message: error instanceof Error ? error.message : "Falha ao encerrar conversa.",
      });
    }
  };

  const canSend = Boolean(
    conversation?.within24h &&
      (!isSending && (messageDraft.trim().length > 0 || pendingMedia.length > 0)),
  );

  const handleAttachClick = () => {
    if (!conversation?.within24h) {
      setFeedback({
        type: "danger",
        message: "Fora da janela de 24h. Peça ao cliente que envie uma nova mensagem.",
      });
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const files = event.target.files;
    if (!files) return;
    const next: PendingMedia[] = [];
    Array.from(files).forEach((file) => {
      next.push({
        file,
        previewUrl: URL.createObjectURL(file),
        mediaType: inferMediaTypeFromFile(file),
      });
    });
    setPendingMedia((prev) => [...prev, ...next]);
    event.target.value = "";
  };

  const removePendingMedia = (url: string) => {
    setPendingMedia((prev) => {
      const filtered = prev.filter((item) => item.previewUrl !== url);
      prev
        .filter((item) => item.previewUrl === url)
        .forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return filtered;
    });
  };

  const handleConversationScroll: React.UIEventHandler<HTMLDivElement> = (event) => {
    const el = event.currentTarget;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    setAutoScroll(nearBottom);
    setShowScrollToBottom(!nearBottom);
  };

  const handleInteractiveSubmit = async () => {
    if (!conversation?.within24h) {
      setFeedback({
        type: "danger",
        message: "A janela de 24 horas expirou. Peça ao cliente que envie uma nova mensagem.",
      });
      setShowInteractiveModal(false);
      return;
    }
    if (!selectedId) return;
    try {
      const formData = new FormData();
      formData.append("to", selectedId);
      formData.append("mode", "interactive");
      formData.append("interactiveType", interactiveType);

      if (interactiveType === "buttons") {
        formData.append("bodyText", interactiveBody);
        formData.append("footerText", interactiveFooter);
        formData.append("headerText", interactiveHeader);
        const cleaned = interactiveButtons
          .filter((btn) => btn.id.trim() && btn.title.trim())
          .map((btn, index) => ({
            id: btn.id.trim() || `btn_${index + 1}`,
            title: btn.title.trim(),
          }));

        if (!cleaned.length) {
          setFeedback({ type: "danger", message: "Informe ao menos um botão." });
          return;
        }

        formData.append("buttons", JSON.stringify(cleaned));
      } else if (interactiveType === "cta_url") {
        formData.append("bodyText", interactiveBody);
        formData.append("footerText", interactiveFooter);
        formData.append("headerText", interactiveHeader);
        formData.append("buttonText", interactiveButtonText);
        formData.append("buttonUrl", interactiveUrl);
      }

      const res = await fetch("/api/support/messages", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message ?? "Não foi possível enviar a mensagem interativa.");
      }

      setFeedback({ type: "success", message: "Mensagem interativa enviada." });
      setAutoScroll(true);
      setShowInteractiveModal(false);
      await Promise.all([loadConversation(selectedId), loadThreads()]);
    } catch (error) {
      console.error(error);
      setFeedback({
        type: "danger",
        message: error instanceof Error ? error.message : "Falha ao enviar mensagem interativa.",
      });
    }
  };

  return (
    <>
      {!selectedThread ? (
        <Row className="g-4 align-items-stretch">
          <Col xs={12}>
            <Card className="h-100 w-100 shadow-sm d-flex flex-column support-contacts-card">
              <Card.Header className="bg-white border-0 pb-0">
                <Card.Title as="h2" className="h5 mb-2">Contatos em suporte</Card.Title>
                <p className="text-secondary mb-0">Escolha um atendimento para visualizar as mensagens.</p>
              </Card.Header>
              <Card.Body
                className="p-3"
                style={{ height: "calc(100vh - 260px)", overflowY: "auto" }}
              >
                {loadingThreads ? (
                  <div className="d-flex align-items-center justify-content-center py-4">
                    <Spinner animation="border" size="sm" />
                  </div>
                ) : threadsError ? (
                  <Alert variant="danger" className="m-3 mb-0">{threadsError}</Alert>
                ) : threads.length === 0 ? (
                  <div className="text-secondary text-center py-4">Nenhum atendimento em andamento.</div>
                ) : (
                  <Row
                    className="support-contacts-grid"
                    xs={1}
                    md={2}
                    xl={3}
                    xxl={4}
                  >
                    {threads.map((thread) => {
                      const title = thread.customerName || thread.profileName || thread.whatsappId;
                      const unread = unreadCounts[thread.whatsappId] ?? 0;
                      return (
                        <Col key={`grid-${thread.whatsappId}`}>
                          <Card
                            role="button"
                            onClick={() => handleSelect(thread)}
                            className="shadow-sm support-thread-card h-100"
                            style={{ cursor: "pointer", minHeight: 160 }}
                          >
                            <Card.Body className="d-flex flex-column gap-3 h-100">
                              <div className="d-flex justify-content-between align-items-start gap-2">
                                <span className="fw-semibold text-truncate" title={title}>{title}</span>
                                <div className="d-flex align-items-center gap-2 flex-shrink-0">
                                  {unread > 0 && <Badge bg="danger">{unread}</Badge>}
                                  <Badge bg={thread.status === "open" ? "success" : "secondary"}>
                                    {thread.status === "open" ? "Aberto" : "Encerrado"}
                                  </Badge>
                                </div>
                              </div>
                              <div
                                className="text-secondary small text-truncate"
                                title={thread.lastMessagePreview ?? undefined}
                              >
                                {thread.lastMessagePreview ?? "Sem mensagens"}
                              </div>
                              <div className="text-secondary small mt-auto" suppressHydrationWarning>
                                {thread.lastMessageAt ? formatDateTime(thread.lastMessageAt) : "-"}
                              </div>
                            </Card.Body>
                          </Card>
                        </Col>
                      );
                    })}
                  </Row>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      ) : (
        <Row className="g-4 align-items-stretch">
          <Col lg={4}>
            <Card className="h-100 d-flex flex-column">
              <Card.Header>
                <Card.Title as="h2" className="h6 mb-0">Contatos em suporte</Card.Title>
              </Card.Header>
              <Card.Body className="p-0" style={{ maxHeight: "calc(100vh - 260px)", overflowY: "auto" }}>
                {loadingThreads ? (
                  <div className="d-flex align-items-center justify-content-center py-4">
                    <Spinner animation="border" size="sm" />
                  </div>
                ) : threadsError ? (
                  <Alert variant="danger" className="m-3 mb-0">{threadsError}</Alert>
                ) : threads.length === 0 ? (
                  <div className="text-secondary text-center py-4">Nenhum atendimento em andamento.</div>
                ) : (
                  <ListGroup variant="flush">
                    {threads.map((thread) => {
                      const active = selectedId === thread.whatsappId;
                      const title = thread.customerName || thread.profileName || thread.whatsappId;
                      const unread = unreadCounts[thread.whatsappId] ?? 0;
                      return (
                        <ListGroup.Item
                          key={thread.whatsappId}
                          action
                          active={active}
                          onClick={() => handleSelect(thread)}
                          className="d-flex flex-column gap-1"
                        >
                          <div className="d-flex justify-content-between align-items-center gap-2">
                            <span className="fw-semibold">{title}</span>
                            <div className="d-flex align-items-center gap-2">
                              {unread > 0 && <Badge bg="danger">{unread}</Badge>}
                              {thread.status === "open" ? (
                                <Badge bg="success">Aberto</Badge>
                              ) : (
                                <Badge bg="secondary">Encerrado</Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-secondary small text-truncate">
                            {thread.lastMessagePreview ?? "Sem mensagens"}
                          </div>
                          <div className="text-secondary small" suppressHydrationWarning>
                            {thread.lastMessageAt ? formatDateTime(thread.lastMessageAt) : "-"}
                          </div>
                        </ListGroup.Item>
                      );
                    })}
                  </ListGroup>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col lg={8}>
            <Card className="h-100 d-flex flex-column">
          <Card.Header className="d-flex justify-content-between align-items-center">
            <div>
              <Card.Title as="h2" className="h6 mb-1">
                {selectedThread
                  ? selectedThread.customerName || selectedThread.profileName || selectedThread.whatsappId
                  : "Selecione uma conversa"}
              </Card.Title>
              {conversation && (
                <div className="text-secondary small" suppressHydrationWarning>
                  {conversation.within24h
                    ? `Dentro da janela de 24h (${conversation.minutesLeft24h} min restantes)`
                    : "Fora da janela de 24h"}
                </div>
              )}
            </div>
            {selectedThread && (
              <div className="d-flex gap-2 align-items-center">
                <Badge bg={selectedThread.status === "open" ? "success" : "secondary"}>
                  {selectedThread.status === "open" ? "Aberto" : "Encerrado"}
                </Badge>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={handleCloseThread}
                  disabled={selectedThread.status === "closed"}
                >
                  Encerrar atendimento
                </Button>
              </div>
            )}
          </Card.Header>

          <Card.Body
            className="flex-grow-1 d-flex flex-column gap-3 overflow-hidden"
            style={{ minHeight: "480px", height: "calc(100vh - 260px)" }}
          >
            {feedback && (
              <Alert
                variant={feedback.type === "success" ? "success" : "danger"}
                onClose={() => setFeedback(null)}
                dismissible
              >
                {feedback.message}
              </Alert>
            )}

            {(!selectedThread && !loadingConversation) ? (
              <div className="flex-grow-1 d-flex align-items-center justify-content-center">
                <div style={{ maxWidth: 520 }} className="w-100">
                  <Card className="shadow-sm">
                    <Card.Header>
                      <Card.Title as="h3" className="h6 mb-0">Escolha uma conversa</Card.Title>
                    </Card.Header>
                    <Card.Body style={{ maxHeight: 420, overflowY: "auto" }} className="p-0">
                      {threads.length === 0 ? (
                        <div className="text-secondary text-center py-4">Nenhum atendimento em andamento.</div>
                      ) : (
                        <ListGroup variant="flush">
                          {threads.map((thread) => {
                            const title = thread.customerName || thread.profileName || thread.whatsappId;
                            const unread = unreadCounts[thread.whatsappId] ?? 0;
                            return (
                              <ListGroup.Item
                                key={`picker-${thread.whatsappId}`}
                                action
                                onClick={() => handleSelect(thread)}
                                className="d-flex flex-column gap-1"
                              >
                                <div className="d-flex justify-content-between align-items-center gap-2">
                                  <span className="fw-semibold">{title}</span>
                                  <div className="d-flex align-items-center gap-2">
                                    {unread > 0 && <Badge bg="danger">{unread}</Badge>}
                                    {thread.status === "open" ? (
                                      <Badge bg="success">Aberto</Badge>
                                    ) : (
                                      <Badge bg="secondary">Encerrado</Badge>
                                    )}
                                  </div>
                                </div>
                                <div className="text-secondary small text-truncate">
                                  {thread.lastMessagePreview ?? "Sem mensagens"}
                                </div>
                                <div className="text-secondary small" suppressHydrationWarning>
                                  {thread.lastMessageAt ? formatDateTime(thread.lastMessageAt) : "-"}
                                </div>
                              </ListGroup.Item>
                            );
                          })}
                        </ListGroup>
                      )}
                    </Card.Body>
                  </Card>
                </div>
              </div>
            ) : loadingConversation ? (
              <div className="flex-grow-1 d-flex align-items-center justify-content-center">
                <Spinner animation="border" />
              </div>
            ) : conversationError ? (
              <Alert variant="danger" className="mb-0">
                {conversationError}
              </Alert>
            ) : conversation ? (
              <div
                ref={conversationRef}
                onScroll={handleConversationScroll}
                className="flex-grow-1 overflow-auto border rounded p-3 bg-light"
                style={{ minHeight: 0 }}
              >
                {conversation.messages.length === 0 ? (
                  <div className="text-secondary text-center">
                    Nenhuma mensagem nesta conversa ainda.
                  </div>
                ) : (
                  conversation.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`d-flex mb-3 ${
                        message.direction === "outbound" ? "justify-content-end" : "justify-content-start"
                      }`}
                    >
                      <div
                        className={`rounded px-3 py-2 shadow-sm ${
                          message.direction === "outbound"
                            ? "bg-primary text-white"
                            : "bg-white"
                        }`}
                        style={{ maxWidth: "75%" }}
                      >
                        <div className="small d-flex flex-column gap-2">
                          {message.media ? (
                            <MediaPreview media={message.media} direction={message.direction} />
                          ) : null}
                          {message.text && <span>{message.text}</span>}
                          {!message.text && !message.media && (
                            <em>({message.messageType})</em>
                          )}
                        </div>
                        <div className={`text-end small mt-2 ${message.direction === "outbound" ? "text-white-50" : "text-secondary"}`} suppressHydrationWarning>
                          {formatDateTime(message.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}

            {selectedThread && (
            <div className="border-top pt-3">
              <Form>
                {pendingMedia.length > 0 && (
                  <div className="mb-3 d-flex flex-wrap gap-2">
                    {pendingMedia.map((item) => (
                      <PendingMediaPreview
                        key={item.previewUrl}
                        media={item}
                        onRemove={() => removePendingMedia(item.previewUrl)}
                      />
                    ))}
                  </div>
                )}
                <Form.Group controlId="support-message">
                  <Form.Label>Mensagem</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={messageDraft}
                    onChange={(e) => setMessageDraft(e.target.value)}
                    placeholder="Digite sua resposta..."
                    disabled={!selectedThread || isSending || !conversation?.within24h}
                  />
                </Form.Group>
                {!conversation?.within24h && (
                  <div className="text-warning small mt-2">
                    A janela de 24 horas expirou. Peça ao cliente que envie uma nova mensagem pelo WhatsApp para continuar.
                  </div>
                )}
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <div className="d-flex gap-2">
                    <Button variant="outline-secondary" size="sm" onClick={handleAttachClick}>
                      Anexar
                    </Button>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => setShowInteractiveModal(true)}
                    >
                      Mensagem interativa
                    </Button>
                    <input
                      type="file"
                      multiple
                      hidden
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                  </div>
                  <div className="d-flex gap-2">
                    {showScrollToBottom && (
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => {
                          setAutoScroll(true);
                          if (conversationRef.current) {
                            conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
                          }
                        }}
                      >
                        Ir para o fim
                      </Button>
                    )}
                    <Button onClick={handleSend} disabled={!canSend}>
                      {isSending ? "Enviando..." : "Enviar"}
                    </Button>
                  </div>
                </div>
              </Form>
            </div>
            )}
          </Card.Body>
        </Card>
          </Col>
        </Row>
      )}
      <InteractiveModal
        show={showInteractiveModal}
        onHide={() => setShowInteractiveModal(false)}
        type={interactiveType}
        onTypeChange={setInteractiveType}
        buttons={interactiveButtons}
        setButtons={setInteractiveButtons}
        bodyText={interactiveBody}
        setBodyText={setInteractiveBody}
        footerText={interactiveFooter}
        setFooterText={setInteractiveFooter}
        headerText={interactiveHeader}
        setHeaderText={setInteractiveHeader}
        url={interactiveUrl}
        setUrl={setInteractiveUrl}
        buttonText={interactiveButtonText}
        setButtonText={setInteractiveButtonText}
        onSubmit={handleInteractiveSubmit}
      />
    </>
  );
};

export default UserConversationsClient;

const PendingMediaPreview = ({
  media,
  onRemove,
}: {
  media: PendingMedia;
  onRemove: () => void;
}) => {
  const { mediaType, previewUrl, file } = media;
  return (
    <div className="position-relative border rounded p-2 bg-white" style={{ width: 120 }}>
      <Button
        variant="danger"
        size="sm"
        className="position-absolute top-0 end-0 p-0 px-1"
        onClick={onRemove}
      >
        ×
      </Button>
      {mediaType === "image" ? (
        <Image
          src={previewUrl}
          alt={file.name}
          rounded
          fluid
          style={{ maxHeight: 90 }}
        />
      ) : (
        <div className="d-flex flex-column align-items-start gap-1">
          <span className="fw-semibold text-truncate" title={file.name}>
            {file.name}
          </span>
          <small className="text-secondary">{mediaType}</small>
        </div>
      )}
    </div>
  );
};

type InteractiveModalProps = {
  show: boolean;
  onHide: () => void;
  type: "buttons" | "cta_url";
  onTypeChange: (value: "buttons" | "cta_url") => void;
  buttons: InteractiveButtonState[];
  setButtons: (value: InteractiveButtonState[]) => void;
  bodyText: string;
  setBodyText: (value: string) => void;
  footerText: string;
  setFooterText: (value: string) => void;
  headerText: string;
  setHeaderText: (value: string) => void;
  url: string;
  setUrl: (value: string) => void;
  buttonText: string;
  setButtonText: (value: string) => void;
  onSubmit: () => void;
};

const InteractiveModal = ({
  show,
  onHide,
  type,
  onTypeChange,
  buttons,
  setButtons,
  bodyText,
  setBodyText,
  footerText,
  setFooterText,
  headerText,
  setHeaderText,
  url,
  setUrl,
  buttonText,
  setButtonText,
  onSubmit,
}: InteractiveModalProps) => {
  const updateButton = (index: number, field: keyof InteractiveButtonState, value: string) => {
    setButtons(
      buttons.map((btn, idx) => (idx === index ? { ...btn, [field]: value } : btn)),
    );
  };

  const addButton = () => {
    if (buttons.length >= 3) return;
    setButtons([...buttons, { id: `btn_${buttons.length + 1}`, title: "Novo" }]);
  };

  const removeButton = (index: number) => {
    setButtons(buttons.filter((_, idx) => idx !== index));
  };

  return (
    <Modal show={show} onHide={onHide} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Mensagem interativa</Modal.Title>
      </Modal.Header>
      <Modal.Body className="d-flex flex-column gap-3">
        <Form.Group>
          <Form.Label>Tipo</Form.Label>
          <Form.Select
            value={type}
            onChange={(event) =>
              onTypeChange(event.currentTarget.value as "buttons" | "cta_url")
            }
          >
            <option value="buttons">Botões de resposta</option>
            <option value="cta_url">Botão com link</option>
          </Form.Select>
        </Form.Group>

        <Row className="g-3">
          <Col md={12}>
            <Form.Group>
              <Form.Label>Corpo</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={bodyText}
                onChange={(event) => setBodyText(event.currentTarget.value)}
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Cabeçalho (opcional)</Form.Label>
              <Form.Control
                value={headerText}
                onChange={(event) => setHeaderText(event.currentTarget.value)}
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label>Rodapé (opcional)</Form.Label>
              <Form.Control
                value={footerText}
                onChange={(event) => setFooterText(event.currentTarget.value)}
              />
            </Form.Group>
          </Col>
        </Row>

        {type === "buttons" ? (
          <div className="d-flex flex-column gap-2">
            {buttons.map((button, index) => (
              <Row className="g-2 align-items-end" key={button.id + index}>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label>ID</Form.Label>
                    <Form.Control
                      value={button.id}
                      onChange={(event) => updateButton(index, "id", event.currentTarget.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label>Título</Form.Label>
                    <Form.Control
                      value={button.title}
                      onChange={(event) =>
                        updateButton(index, "title", event.currentTarget.value)
                      }
                    />
                  </Form.Group>
                </Col>
                <Col md={2} className="d-flex justify-content-end">
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => removeButton(index)}
                  >
                    Remover
                  </Button>
                </Col>
              </Row>
            ))}
            {buttons.length < 3 && (
              <Button variant="outline-primary" size="sm" onClick={addButton}>
                Adicionar botão
              </Button>
            )}
          </div>
        ) : (
          <Row className="g-3">
            <Col md={6}>
              <Form.Group>
                <Form.Label>Texto do botão</Form.Label>
                <Form.Control
                  value={buttonText}
                  onChange={(event) => setButtonText(event.currentTarget.value)}
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group>
                <Form.Label>URL</Form.Label>
                <Form.Control
                  value={url}
                  onChange={(event) => setUrl(event.currentTarget.value)}
                />
              </Form.Group>
            </Col>
          </Row>
        )}
      </Modal.Body>
      <Modal.Footer className="d-flex justify-content-between">
        <div className="text-secondary small">As mensagens respeitam a janela de 24 horas do WhatsApp.</div>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={onHide}>
            Cancelar
          </Button>
          <Button onClick={onSubmit}>Enviar</Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};
