import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Send, ArrowLeft, UserPlus, Link2, Copy, Check, Hash, Users, Trash2, Loader2, Settings, LogOut, UserMinus, Save, Paperclip, X as XIcon, ImageIcon, Lock, LockOpen } from "lucide-react";
import { playDing } from "@/lib/ding";
import { isPrefActive } from "@/hooks/usePreferences";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  created_at: string;
  media_url?: string | null;
  media_type?: string | null;
}
interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
}
interface Room {
  id: string;
  name: string;
  invite_code: string;
  short_code: string;
  owner_id: string;
  password_hash?: string | null;
  icon?: string | null;
  color?: string | null;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function formatFull(iso: string) {
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}
function formatDayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  const diffDays = (today.getTime() - d.getTime()) / 86400000;
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { dateStyle: "medium" } as any);
}
function formatRelative(iso: string, now: number) {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const ROOM_COLORS: Record<string, string> = {
  sunset: "bg-[#ff6b35]",
  ocean: "bg-[#00a2ff]",
  emerald: "bg-[#00cc66]",
  rose: "bg-[#ff3385]",
  violet: "bg-[#6c5ce7]",
  amber: "bg-[#f7931e]",
};

const ROOM_ICONS = ["#", "%", "!", "@", "$", "^", "*", "Smile", "Flame", "Heart", "Star"];

// Local fallback storage for room icons/colors if Supabase migration is missing
const getLocalRoomMeta = (roomId: string) => {
  try {
    const raw = localStorage.getItem(`room_meta_${roomId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

const setLocalRoomMeta = (roomId: string, meta: { icon?: string; color?: string }) => {
  try {
    const existing = getLocalRoomMeta(roomId) || {};
    localStorage.setItem(`room_meta_${roomId}`, JSON.stringify({ ...existing, ...meta }));
  } catch { /* ignore */ }
};

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Profile[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingInvites, setPendingInvites] = useState<{ id: string; email: string }[]>([]);
  const [content, setContent] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [roomIcon, setRoomIcon] = useState("#");
  const [roomColor, setRoomColor] = useState("sunset");
  const [savingSettings, setSavingSettings] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const unreadRef = useRef(0);
  const originalTitleRef = useRef<string>("");
  const titleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialLoadRef = useRef(true);
  const [now, setNow] = useState(() => Date.now());

  // Presence (who's online) + typing indicators
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [typingIds, setTypingIds] = useState<Set<string>>(new Set());
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastTypingSentRef = useRef<number>(0);
  const stopTypingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Presence + typing channel — separate from postgres-changes channel above.
  useEffect(() => {
    if (!user || !id) return;
    const displayName =
      (user.user_metadata?.display_name as string | undefined) ||
      (user.email?.split("@")[0]) || "Someone";

    const ch = supabase.channel(`room-presence-${id}`, {
      config: { presence: { key: user.id } },
    });
    presenceChannelRef.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState() as Record<string, unknown[]>;
      setOnlineIds(new Set(Object.keys(state)));
    });

    ch.on("broadcast", { event: "typing" }, ({ payload }) => {
      const uid = (payload as { user_id?: string })?.user_id;
      if (!uid || uid === user.id) return;
      setTypingIds((prev) => {
        if (prev.has(uid)) return prev;
        const next = new Set(prev);
        next.add(uid);
        return next;
      });
      // Auto-clear after 3s of no further "typing" events
      if (typingTimersRef.current[uid]) clearTimeout(typingTimersRef.current[uid]);
      typingTimersRef.current[uid] = setTimeout(() => {
        setTypingIds((prev) => {
          if (!prev.has(uid)) return prev;
          const next = new Set(prev);
          next.delete(uid);
          return next;
        });
        delete typingTimersRef.current[uid];
      }, 3000);
    });

    ch.on("broadcast", { event: "stop_typing" }, ({ payload }) => {
      const uid = (payload as { user_id?: string })?.user_id;
      if (!uid) return;
      if (typingTimersRef.current[uid]) {
        clearTimeout(typingTimersRef.current[uid]);
        delete typingTimersRef.current[uid];
      }
      setTypingIds((prev) => {
        if (!prev.has(uid)) return prev;
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ user_id: user.id, display_name: displayName, online_at: new Date().toISOString() });
      }
    });

    return () => {
      // Clear typing state for everyone
      Object.values(typingTimersRef.current).forEach((t) => clearTimeout(t));
      typingTimersRef.current = {};
      if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
      stopTypingTimerRef.current = null;
      supabase.removeChannel(ch);
      presenceChannelRef.current = null;
      setOnlineIds(new Set());
      setTypingIds(new Set());
    };
  }, [id, user]);

  // Throttled typing broadcast — call on every keystroke
  const notifyTyping = () => {
    const ch = presenceChannelRef.current;
    if (!ch || !user) return;
    const nowMs = Date.now();
    if (nowMs - lastTypingSentRef.current > 1500) {
      lastTypingSentRef.current = nowMs;
      ch.send({ type: "broadcast", event: "typing", payload: { user_id: user.id } });
    }
    // Schedule a stop_typing if user pauses
    if (stopTypingTimerRef.current) clearTimeout(stopTypingTimerRef.current);
    stopTypingTimerRef.current = setTimeout(() => {
      ch.send({ type: "broadcast", event: "stop_typing", payload: { user_id: user.id } });
      lastTypingSentRef.current = 0;
    }, 2500);
  };

  const stopTypingNow = () => {
    const ch = presenceChannelRef.current;
    if (!ch || !user) return;
    if (stopTypingTimerRef.current) {
      clearTimeout(stopTypingTimerRef.current);
      stopTypingTimerRef.current = null;
    }
    lastTypingSentRef.current = 0;
    ch.send({ type: "broadcast", event: "stop_typing", payload: { user_id: user.id } });
  };

  // Ask for notification permission once
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Title flashing when tab is hidden
  const startTitleFlash = () => {
    if (titleIntervalRef.current) return;
    if (isPrefActive("disableTitleFlash")) return;
    if (!originalTitleRef.current) originalTitleRef.current = document.title;
    let toggle = false;
    titleIntervalRef.current = setInterval(() => {
      toggle = !toggle;
      document.title = toggle
        ? `(${unreadRef.current}) New message — ${originalTitleRef.current}`
        : originalTitleRef.current;
    }, 1000);
  };

  const stopTitleFlash = () => {
    if (titleIntervalRef.current) {
      clearInterval(titleIntervalRef.current);
      titleIntervalRef.current = null;
    }
    if (originalTitleRef.current) document.title = originalTitleRef.current;
    unreadRef.current = 0;
  };

  useEffect(() => {
    const onVisible = () => { if (!document.hidden) stopTitleFlash(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      stopTitleFlash();
    };
  }, []);

  useEffect(() => {
    if (!user || !id) return;
    let active = true;

    const markRead = () => {
      supabase.from("room_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("room_id", id).eq("user_id", user.id)
        .then(() => {});
    };

    const load = async () => {
      const [{ data: r, error: re }, { data: m }, { data: msgs }, { data: invites }] = await Promise.all([
        supabase.from("rooms").select("*").eq("id", id).maybeSingle(),
        supabase.from("room_members").select("user_id").eq("room_id", id),
        supabase.from("messages").select("*").eq("room_id", id).order("created_at", { ascending: true }).limit(500),
        supabase.from("email_invites").select("id, email").eq("room_id", id),
      ]);
      if (!active) return;
      if (re || !r) { toast.error("Room not found"); navigate("/rooms"); return; }
      
      // Apply local overrides for icon/color if they exist
      const localMeta = getLocalRoomMeta(id!);
      const finalRoom = {
        ...r,
        icon: localMeta?.icon || r.icon,
        color: localMeta?.color || r.color
      };
      
      setRoom(finalRoom);
      setPendingInvites(invites ?? []);
      setMessages(msgs ?? []);

      const ids = Array.from(new Set([...(m ?? []).map((x) => x.user_id), ...(msgs ?? []).map((x) => x.user_id)]));
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("*").in("id", ids);
        const map: Record<string, Profile> = {};
        (profs ?? []).forEach((p) => { map[p.id] = p as Profile; });
        setProfiles(map);
        setMembers((m ?? []).map((x) => map[x.user_id]).filter(Boolean));
      }
      setFetching(false);
      // Mark initial load complete after first paint so we don't ding on history
      setTimeout(() => { initialLoadRef.current = false; }, 300);
      markRead();
    };
    load();

    const channel = supabase
      .channel(`room-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${id}` },
        async (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => [...prev, msg]);
          if (!document.hidden && msg.user_id !== user.id) markRead();
          let senderName = profiles[msg.user_id]?.display_name;
          if (!profiles[msg.user_id]) {
            const { data: p } = await supabase.from("profiles").select("*").eq("id", msg.user_id).maybeSingle();
            if (p) {
              setProfiles((prev) => ({ ...prev, [p.id]: p as Profile }));
              senderName = (p as Profile).display_name;
            }
          }
          // Notify only for messages from others, after initial load
          if (!initialLoadRef.current && msg.user_id !== user?.id) {
            if (!isPrefActive("muteSounds")) playDing();
            if (document.hidden) {
              unreadRef.current += 1;
              startTitleFlash();
              if ("Notification" in window && Notification.permission === "granted") {
                try {
                  const n = new Notification(`${senderName ?? "New message"}`, {
                    body: msg.content.slice(0, 120),
                    tag: `room-${id}`,
                  });
                  n.onclick = () => { window.focus(); n.close(); };
                } catch { /* ignore */ }
              }
            }
          }
        })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_members", filter: `room_id=eq.${id}` },
        async (payload) => {
          const newUserId = (payload.new as { user_id: string }).user_id;
          const { data: p } = await supabase.from("profiles").select("*").eq("id", newUserId).maybeSingle();
          if (p) {
            setProfiles((prev) => ({ ...prev, [p.id]: p as Profile }));
            setMembers((prev) => prev.find((x) => x.id === p.id) ? prev : [...prev, p as Profile]);
          }
        })
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [id, user, navigate]);

  // Mark read when tab becomes visible again
  useEffect(() => {
    if (!user || !id) return;
    const onVis = () => {
      if (!document.hidden) {
        supabase.from("room_members")
          .update({ last_read_at: new Date().toISOString() })
          .eq("room_id", id).eq("user_id", user.id)
          .then(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [id, user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  if (!loading && !user) return <Navigate to="/auth" replace />;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = content.trim();
    if (!text && !pendingFile) return;
    if (text.length > 2000) { toast.error("Message too long"); return; }
    setSending(true);
    stopTypingNow();
    let media_url: string | null = null;
    let media_type: string | null = null;
    if (pendingFile) {
      if (pendingFile.size > 25 * 1024 * 1024) {
        toast.error("File too large (max 25 MB)");
        setSending(false);
        return;
      }
      setUploading(true);
      const ext = pendingFile.name.split(".").pop() || "bin";
      const path = `${id}/${user!.id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("chat-media").upload(path, pendingFile, {
        cacheControl: "3600", contentType: pendingFile.type,
      });
      setUploading(false);
      if (upErr) { toast.error(upErr.message); setSending(false); return; }
      const { data: pub } = supabase.storage.from("chat-media").getPublicUrl(path);
      media_url = pub.publicUrl;
      media_type = pendingFile.type.startsWith("video/") ? "video" : "image";
    }
    const { error } = await supabase.from("messages").insert({
      room_id: id!, user_id: user!.id, content: text, media_url, media_type,
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setContent("");
    clearPendingFile();
  };

  const onPickFile = (f: File | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) {
      toast.error("Only images and videos are supported");
      return;
    }
    setPendingFile(f);
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingPreview(URL.createObjectURL(f));
  };
  const clearPendingFile = () => {
    if (pendingPreview) URL.revokeObjectURL(pendingPreview);
    setPendingPreview(null);
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const copyLink = async () => {
    if (!room) return;
    const url = `${window.location.origin}/join/${room.invite_code}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Invite link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const inviteByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = z.string().trim().email().max(255).safeParse(inviteEmail);
    if (!parsed.success) { toast.error("Enter a valid email"); return; }
    const { error } = await supabase.from("email_invites").insert({
      room_id: id!, email: parsed.data.toLowerCase(), invited_by: user!.id,
    });
    if (error) {
      if (error.message.includes("duplicate")) toast.error("Already invited");
      else toast.error(error.message);
      return;
    }
    setPendingInvites((p) => [...p, { id: crypto.randomUUID(), email: parsed.data.toLowerCase() }]);
    setInviteEmail("");
    toast.success("Invite saved — they'll join automatically when they sign up");
  };

  const revokeInvite = async (inviteId: string) => {
    const { error } = await supabase.from("email_invites").delete().eq("id", inviteId);
    if (error) { toast.error(error.message); return; }
    setPendingInvites((p) => p.filter((x) => x.id !== inviteId));
  };

  const renameRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = z.string().trim().min(1).max(60).safeParse(renameValue);
    if (!parsed.success) { toast.error("Pick a name (1-60 chars)"); return; }
    if (parsed.data === room?.name) return;
    setSavingName(true);
    const { error } = await supabase.from("rooms").update({ name: parsed.data }).eq("id", id!);
    setSavingName(false);
    if (error) { toast.error(error.message); return; }
    setRoom((r) => r ? { ...r, name: parsed.data } : r);
    toast.success("Room renamed");
  };

  const updateRoomSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room) return;
    setSavingSettings(true);
    const { error } = await supabase
      .from("rooms")
      .update({ icon: roomIcon, color: roomColor })
      .eq("id", id!);
    setSavingSettings(false);
    
    if (error) {
      if (error.message.includes("color") || error.message.includes("icon")) {
        // Fallback to local storage if database columns are missing
        setLocalRoomMeta(id!, { icon: roomIcon, color: roomColor });
        setRoom({ ...room, icon: roomIcon, color: roomColor });
        toast.info("Saved locally (Supabase migration pending)");
      } else {
        toast.error(error.message);
      }
      return;
    }
    
    // If database update succeeded, we can clear the local override (optional)
    setRoom({ ...room, icon: roomIcon, color: roomColor });
    toast.success("Room settings updated");
  };

  const removeMember = async (memberId: string) => {
    const { error } = await supabase.from("room_members").delete().eq("room_id", id!).eq("user_id", memberId);
    if (error) { toast.error(error.message); return; }
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    toast.success("Member removed");
  };

  const leaveRoom = async () => {
    const { error } = await supabase.from("room_members").delete().eq("room_id", id!).eq("user_id", user!.id);
    if (error) { toast.error(error.message); return; }
    toast.success("You left the room");
    navigate("/rooms");
  };

  const deleteRoom = async () => {
    setDeleting(true);
    const { error } = await supabase.from("rooms").delete().eq("id", id!);
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Room deleted");
    navigate("/rooms");
  };

  const openSettings = () => {
    if (room) {
      setRenameValue(room.name);
      setRoomIcon(room.icon || "#");
      setRoomColor(room.color || "sunset");
    }
    setNewPassword("");
    setSettingsOpen(true);
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!room) return;
    const pwd = newPassword.trim();
    if (pwd.length < 4) { toast.error("Password must be at least 4 characters"); return; }
    setSavingPassword(true);
    const { error } = await supabase.rpc("set_room_password", {
      _room_id: room.id,
      _new_password: pwd,
    } as any);
    setSavingPassword(false);
    if (error) { toast.error(error.message); return; }
    setRoom({ ...room, password_hash: "set" });
    setNewPassword("");
    toast.success("Password updated");
  };

  const clearPassword = async () => {
    if (!room) return;
    setSavingPassword(true);
    const { error } = await supabase.rpc("set_room_password", {
      _room_id: room.id,
      _new_password: null,
    } as any);
    setSavingPassword(false);
    if (error) { toast.error(error.message); return; }
    setRoom({ ...room, password_hash: null });
    toast.success("Password removed");
  };

  if (fetching || !room) {
    return <AppShell><div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div></AppShell>;
  }

  const isOwner = room.owner_id === user?.id;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_280px] gap-6 animate-fade-in-up">
        {/* Chat panel */}
        <div className="glass rounded-3xl flex flex-col overflow-hidden h-[calc(100vh-10rem)]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
            <div className="flex items-center gap-3 min-w-0">
              <Button asChild variant="ghost" size="icon"><Link to="/rooms"><ArrowLeft className="w-4 h-4" /></Link></Button>
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shadow-glow shrink-0 text-primary-foreground font-bold",
                room.color ? ROOM_COLORS[room.color] || "bg-warm" : "bg-warm"
              )}>
                {room.icon === "Smile" ? "😊" : room.icon === "Flame" ? "🔥" : room.icon === "Heart" ? "❤️" : room.icon === "Star" ? "⭐" : (room.icon || "#")}
              </div>
              <div className="min-w-0">
                <h2 className="font-display font-semibold truncate flex items-center gap-1.5">
                  {room.name}
                  {room.password_hash && (
                    <Lock className="w-3.5 h-3.5 text-primary shrink-0" aria-label="Password protected" />
                  )}
                </h2>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span>{members.length} member{members.length !== 1 && "s"}</span>
                  {onlineIds.size > 0 && (
                    <>
                      <span className="opacity-50">·</span>
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/25" />
                        {onlineIds.size} online
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button variant="hero" size="sm"><UserPlus className="w-4 h-4" /> Invite</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Invite people</DialogTitle></DialogHeader>
                <div className="space-y-5">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">6-digit room code</Label>
                    <div className="flex gap-2 mt-2">
                      <Input
                        readOnly
                        value={room.short_code}
                        className="font-mono text-2xl tracking-[0.5em] text-center"
                      />
                      <Button
                        type="button"
                        variant="soft"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(room.short_code);
                          toast.success("Code copied");
                        }}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Share this code — others can enter it on the Rooms page via "Join with code".</p>
                  </div>

                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Shareable link</Label>
                    <div className="flex gap-2 mt-2">
                      <Input readOnly value={`${window.location.origin}/join/${room.invite_code}`} />
                      <Button type="button" variant="soft" size="icon" onClick={copyLink}>
                        {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>

                  {isOwner && (
                    <div>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Or invite by email</Label>
                      <form onSubmit={inviteByEmail} className="flex gap-2 mt-2">
                        <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="friend@example.com" />
                        <Button type="submit" variant="hero">Send</Button>
                      </form>
                      {pendingInvites.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          <p className="text-xs text-muted-foreground">Pending invites</p>
                          {pendingInvites.map((inv) => (
                            <div key={inv.id} className="flex items-center justify-between bg-muted/60 rounded-lg px-3 py-1.5 text-sm">
                              <span className="truncate">{inv.email}</span>
                              <button onClick={() => revokeInvite(inv.id)} className="text-muted-foreground hover:text-destructive">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Button variant="soft" size="icon" onClick={openSettings} title="Room settings" className="ml-2">
              <Settings className="w-4 h-4" />
            </Button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto">
            <div className="px-6 py-6 space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-16">
                  <Link2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
                  <p>No messages yet — say hi 👋</p>
                </div>
              )}
              <TooltipProvider delayDuration={200}>
                {messages.map((m, idx) => {
                  const p = profiles[m.user_id];
                  const mine = m.user_id === user?.id;
                  const prev = messages[idx - 1];
                  const showDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
                  return (
                    <div key={m.id}>
                      {showDay && (
                        <div className="flex items-center gap-3 my-4">
                          <div className="flex-1 h-px bg-border/60" />
                          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                            {formatDayLabel(m.created_at)}
                          </span>
                          <div className="flex-1 h-px bg-border/60" />
                        </div>
                      )}
                      <div className={`flex gap-3 ${mine ? "flex-row-reverse" : ""}`}>
                        <Avatar className="w-8 h-8 shrink-0">
                          {p?.avatar_url && <AvatarImage src={p.avatar_url} alt={p.display_name} />}
                          <AvatarFallback className={mine ? "bg-warm text-primary-foreground text-xs" : "bg-secondary text-xs"}>
                            {(p?.display_name || "?")[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`max-w-[75%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                          <div className={`flex items-baseline gap-2 mb-1 px-1 ${mine ? "flex-row-reverse" : ""}`}>
                            <span className="text-xs text-muted-foreground">{p?.display_name ?? "…"}</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="text-[10px] text-muted-foreground/70 cursor-default">
                                  {formatTime(m.created_at)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <div className="text-xs">
                                  <div>{formatFull(m.created_at)}</div>
                                  <div className="text-muted-foreground">{formatRelative(m.created_at, now)}</div>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          {m.media_url && (
                            <div className={`mb-1 overflow-hidden rounded-2xl border border-border/60 ${mine ? "rounded-br-sm" : "rounded-bl-sm"} max-w-sm`}>
                              {m.media_type === "video" ? (
                                <video src={m.media_url} controls className="block max-h-80 w-full bg-black" />
                              ) : (
                                <a href={m.media_url} target="_blank" rel="noreferrer">
                                  <img src={m.media_url} alt="shared media" className="block max-h-80 w-full object-cover" loading="lazy" />
                                </a>
                              )}
                            </div>
                          )}
                          {m.content && (
                            <div className={`px-4 py-2.5 rounded-2xl ${mine ? "bg-warm text-primary-foreground rounded-br-sm" : "bg-secondary text-secondary-foreground rounded-bl-sm"} break-words`}>
                              {m.content}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </TooltipProvider>
            </div>
          </div>

          <form onSubmit={send} className="border-t border-border/60 p-4 space-y-2">
            {(() => {
              const others = Array.from(typingIds).filter((uid) => uid !== user?.id);
              if (others.length === 0) return null;
              const names = others.map((uid) => profiles[uid]?.display_name ?? "Someone");
              const label =
                names.length === 1 ? `${names[0]} is typing…`
                : names.length === 2 ? `${names[0]} and ${names[1]} are typing…`
                : `${names[0]}, ${names[1]} and ${names.length - 2} other${names.length - 2 === 1 ? "" : "s"} are typing…`;
              return (
                <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground" aria-live="polite">
                  <span className="inline-flex gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "120ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "240ms" }} />
                  </span>
                  <span className="truncate">{label}</span>
                </div>
              );
            })()}
            {pendingPreview && pendingFile && (
              <div className="relative inline-block rounded-xl overflow-hidden border border-border/60 bg-muted/40">
                {pendingFile.type.startsWith("video/") ? (
                  <video src={pendingPreview} className="max-h-32 max-w-[200px]" muted />
                ) : (
                  <img src={pendingPreview} alt="preview" className="max-h-32 max-w-[200px] object-cover" />
                )}
                <button
                  type="button"
                  onClick={clearPendingFile}
                  className="absolute top-1 right-1 bg-background/80 hover:bg-background rounded-full p-1"
                  aria-label="Remove attachment"
                >
                  <XIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="soft"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending}
                title="Attach photo or video"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <Input
                value={content}
                onChange={(e) => { setContent(e.target.value); notifyTyping(); }}
                onBlur={stopTypingNow}
                placeholder="Type a message…"
                maxLength={2000}
                className="rounded-xl"
              />
              <Button type="submit" variant="hero" size="icon" disabled={sending || (!content.trim() && !pendingFile)}>
                {uploading || sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </form>
        </div>

        {/* Members panel */}
        <aside className="glass rounded-3xl p-5 h-fit hidden lg:block">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-primary" />
            <h3 className="font-display font-semibold">Members</h3>
          </div>
          <div className="space-y-2">
            {[...members]
              .sort((a, b) => Number(onlineIds.has(b.id)) - Number(onlineIds.has(a.id)))
              .map((m) => {
                const online = onlineIds.has(m.id);
                const typing = typingIds.has(m.id) && m.id !== user?.id;
                return (
                  <div key={m.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-muted/50">
                    <div className="relative shrink-0">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="bg-warm text-primary-foreground text-xs">
                          {m.display_name[0]?.toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        title={online ? "Online" : "Offline"}
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-card ${
                          online ? "bg-emerald-500" : "bg-muted-foreground/40"
                        }`}
                      />
                    </div>
                    <div className="text-sm truncate flex-1">
                      {m.display_name}
                      {m.id === room.owner_id && <span className="text-xs text-primary"> · owner</span>}
                      {typing && (
                        <span className="block text-[11px] text-muted-foreground italic">typing…</span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </aside>
      </div>

      {/* Settings dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Room settings</DialogTitle></DialogHeader>
          <div className="space-y-6">
            {/* Rename */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Room name</Label>
              <form onSubmit={renameRoom} className="flex gap-2 mt-2">
                <Input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  maxLength={60}
                  disabled={!isOwner}
                />
                {isOwner && (
                  <Button type="submit" variant="hero" disabled={savingName || !renameValue.trim()}>
                    {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save</>}
                  </Button>
                )}
              </form>
              {!isOwner && <p className="text-xs text-muted-foreground mt-1.5">Only the owner can rename this room.</p>}
            </div>

            {/* Icon & Color */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Room Icon & Color</Label>
              <div className="space-y-4 mt-2">
                <div className="flex flex-wrap gap-2">
                  {ROOM_ICONS.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setRoomIcon(icon)}
                      disabled={!isOwner}
                      className={cn(
                        "w-10 h-10 rounded-lg border border-border flex items-center justify-center text-sm font-bold transition-all",
                        roomIcon === icon ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted",
                        !isOwner && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {icon === "Smile" ? "😊" : icon === "Flame" ? "🔥" : icon === "Heart" ? "❤️" : icon === "Star" ? "⭐" : icon}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(ROOM_COLORS).map(([id, colorClass]) => (
                    <button
                      key={id}
                      onClick={() => setRoomColor(id)}
                      disabled={!isOwner}
                      className={cn(
                        "w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center",
                        roomColor === id ? "border-primary scale-110 shadow-glow" : "border-transparent hover:scale-105",
                        colorClass,
                        !isOwner && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {roomColor === id && <Check className="w-4 h-4 text-white" />}
                    </button>
                  ))}
                </div>
                {isOwner && (
                  <Button
                    onClick={updateRoomSettings}
                    variant="hero"
                    className="w-full"
                    disabled={savingSettings || (room.icon === roomIcon && room.color === roomColor)}
                  >
                    {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save Appearance</>}
                  </Button>
                )}
              </div>
            </div>

            {/* Password */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                {room.password_hash ? <Lock className="w-3.5 h-3.5" /> : <LockOpen className="w-3.5 h-3.5" />}
                Password
              </Label>
              {isOwner ? (
                <>
                  <p className="text-xs text-muted-foreground mt-1.5">
                    {room.password_hash
                      ? "This room is password-protected. New joiners must enter the password."
                      : "No password set. Anyone with the code or link can join."}
                  </p>
                  <form onSubmit={savePassword} className="flex gap-2 mt-2">
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={room.password_hash ? "Enter a new password" : "Set a password"}
                      minLength={4}
                    />
                    <Button type="submit" variant="hero" disabled={savingPassword || newPassword.trim().length < 4}>
                      {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> {room.password_hash ? "Update" : "Set"}</>}
                    </Button>
                  </form>
                  {room.password_hash && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearPassword}
                      disabled={savingPassword}
                      className="mt-2 text-muted-foreground hover:text-destructive"
                    >
                      <LockOpen className="w-3.5 h-3.5" /> Remove password
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground mt-1.5">
                  {room.password_hash
                    ? "This room is password-protected. Only the owner can change the password."
                    : "No password set. Only the owner can change the password."}
                </p>
              )}
            </div>

            {/* Members */}
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> Members ({members.length})
              </Label>
              <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
                {members.map((m) => {
                  const isMemberOwner = m.id === room.owner_id;
                  const isMe = m.id === user?.id;
                  return (
                    <div key={m.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="w-7 h-7">
                          {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.display_name} />}
                          <AvatarFallback className="bg-warm text-primary-foreground text-xs">
                            {m.display_name[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm truncate">
                          {m.display_name}
                          {isMe && <span className="text-muted-foreground"> (you)</span>}
                          {isMemberOwner && <span className="text-primary text-xs ml-1">· owner</span>}
                        </span>
                      </div>
                      {isOwner && !isMemberOwner && (
                        <button
                          onClick={() => removeMember(m.id)}
                          className="text-muted-foreground hover:text-destructive p-1"
                          title="Remove member"
                        >
                          <UserMinus className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Danger zone */}
            <div className="border-t border-border/60 pt-5">
              <Label className="text-xs uppercase tracking-wider text-destructive">Danger zone</Label>
              <div className="mt-3 space-y-2">
                {!isOwner && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="w-full justify-start"><LogOut className="w-4 h-4" /> Leave room</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Leave this room?</AlertDialogTitle>
                        <AlertDialogDescription>You'll stop receiving messages and need a new invite to rejoin.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={leaveRoom}>Leave</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                {isOwner && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full justify-start">
                        <Trash2 className="w-4 h-4" /> Delete room
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{room.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently deletes the room, all messages, and all members. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={deleteRoom}
                          disabled={deleting}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete forever"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}