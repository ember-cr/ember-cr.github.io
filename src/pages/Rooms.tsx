import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Hash, ArrowRight, Loader2, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

interface Room {
  id: string;
  name: string;
  invite_code: string;
  owner_id: string;
  created_at: string;
  icon?: string | null;
  color?: string | null;
}

const ROOM_COLORS: Record<string, string> = {
  sunset: "bg-[#ff6b35]",
  ocean: "bg-[#00a2ff]",
  emerald: "bg-[#00cc66]",
  rose: "bg-[#ff3385]",
  violet: "bg-[#6c5ce7]",
  amber: "bg-[#f7931e]",
};

// Local fallback storage for room icons/colors if Supabase migration is missing
const getLocalRoomMeta = (roomId: string) => {
  try {
    const raw = localStorage.getItem(`room_meta_${roomId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};

export default function Rooms() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [fetching, setFetching] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joinNeedsPassword, setJoinNeedsPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) { toast.error(error.message); setFetching(false); return; }
      const list = data ?? [];
      setRooms(list);

      // Get my last_read_at per room, then count messages newer than that (excluding mine)
      const { data: memberships } = await supabase
        .from("room_members")
        .select("room_id, last_read_at")
        .eq("user_id", user.id);
      const lastRead: Record<string, string> = {};
      (memberships ?? []).forEach((m) => { lastRead[m.room_id] = m.last_read_at; });

      const counts: Record<string, number> = {};
      await Promise.all(list.map(async (r) => {
        const after = lastRead[r.id] ?? r.created_at;
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("room_id", r.id)
          .neq("user_id", user.id)
          .gt("created_at", after);
        counts[r.id] = count ?? 0;
      }));
      setUnread(counts);
      setFetching(false);
    };
    load();

    // Live updates: bump count when a new message lands in any of my rooms
    const channel = supabase
      .channel("rooms-unread")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as { room_id: string; user_id: string };
        if (msg.user_id === user.id) return;
        setUnread((prev) => ({ ...prev, [msg.room_id]: (prev[msg.room_id] ?? 0) + 1 }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  if (!loading && !user) return <Navigate to="/auth" replace />;

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = z.string().trim().min(1).max(60).safeParse(name);
    if (!parsed.success) { toast.error("Pick a room name (1-60 chars)"); return; }
    setBusy(true);
    const { data, error } = await supabase
      .from("rooms")
      .insert({ name: parsed.data, owner_id: user!.id })
      .select()
      .single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setCreateOpen(false);
    setName("");
    navigate(`/rooms/${data.id}`);
  };

  const joinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim();
    if (!c) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("join_room_by_code", {
      _code: c,
      _password: joinPassword || null,
    } as any);
    setBusy(false);
    if (error || !data) {
      const msg = error?.message ?? "Invalid invite code";
      if (/password required/i.test(msg)) {
        setJoinNeedsPassword(true);
        toast.error("This room is password-protected. Enter the password.");
      } else if (/incorrect password/i.test(msg)) {
        setJoinNeedsPassword(true);
        toast.error("Incorrect password");
      } else {
        toast.error(msg);
      }
      return;
    }
    setJoinOpen(false);
    setCode("");
    setJoinPassword("");
    setJoinNeedsPassword(false);
    navigate(`/rooms/${data}`);
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto animate-fade-in-up">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <h1 className="text-4xl md:text-5xl font-display font-extrabold tracking-tight">
              Your <span className="text-sunset">rooms</span>
            </h1>
            <p className="text-muted-foreground mt-2">Jump back in or start something new.</p>
          </div>
          <div className="flex gap-2">
            <Dialog
              open={joinOpen}
              onOpenChange={(o) => {
                setJoinOpen(o);
                if (!o) { setJoinPassword(""); setJoinNeedsPassword(false); }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="soft"><KeyRound className="w-4 h-4" /> Join with code</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Join a room</DialogTitle></DialogHeader>
                <form onSubmit={joinByCode} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Invite code</Label>
                    <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code or invite code" autoFocus />
                    <p className="text-xs text-muted-foreground">Enter the 6-digit room code or paste a long invite code.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="join-password">
                      Password {joinNeedsPassword ? <span className="text-destructive">*</span> : <span className="text-muted-foreground font-normal">(if required)</span>}
                    </Label>
                    <Input
                      id="join-password"
                      type="password"
                      value={joinPassword}
                      onChange={(e) => setJoinPassword(e.target.value)}
                      placeholder="Leave blank if the room has none"
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" variant="hero" disabled={busy}>
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Join"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button variant="hero"><Plus className="w-4 h-4" /> New room</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create a chat room</DialogTitle></DialogHeader>
                <form onSubmit={createRoom} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Room name</Label>
                    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekend planning" autoFocus maxLength={60} />
                  </div>
                  <DialogFooter>
                    <Button type="submit" variant="hero" disabled={busy}>
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create room"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {fetching ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : rooms.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-warm flex items-center justify-center shadow-glow mb-4 animate-float">
              <Hash className="w-7 h-7 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-display font-semibold mb-2">No rooms yet</h3>
            <p className="text-muted-foreground mb-6">Create your first room to start chatting.</p>
            <Button variant="hero" onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4" /> Create a room</Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {rooms.map((r, i) => {
              const localMeta = getLocalRoomMeta(r.id);
              const displayIcon = localMeta?.icon || r.icon || "#";
              const displayColor = localMeta?.color || r.color || "sunset";
              
              return (
                <Link key={r.id} to={`/rooms/${r.id}`} className="group glass rounded-2xl p-6 hover:shadow-glow hover:border-primary/40 transition-smooth animate-fade-in-up" style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center shadow-glow text-primary-foreground font-bold text-lg",
                      ROOM_COLORS[displayColor] || "bg-warm"
                    )}>
                      {displayIcon === "Smile" ? "😊" : displayIcon === "Flame" ? "🔥" : displayIcon === "Heart" ? "❤️" : displayIcon === "Star" ? "⭐" : displayIcon}
                    </div>
                    <div className="flex items-center gap-2">
                    {unread[r.id] > 0 && (
                      <span className="min-w-[1.5rem] h-6 px-2 rounded-full bg-warm text-primary-foreground text-xs font-semibold flex items-center justify-center shadow-glow animate-fade-in-up">
                        {unread[r.id] > 99 ? "99+" : unread[r.id]}
                      </span>
                    )}
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition" />
                  </div>
                </div>
                <h3 className="font-display font-semibold text-lg mb-1 truncate">{r.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {r.owner_id === user?.id ? "You own this room" : "Member"}
                </p>
              </Link>
            )})}
          </div>
        )}
      </div>
    </AppShell>
  );
}