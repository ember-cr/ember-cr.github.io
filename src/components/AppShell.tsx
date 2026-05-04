import { ReactNode, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { playDing, playClick, playNav } from "@/lib/ding";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MessagesSquare, LogOut, UserCog, Moon, Sun } from "lucide-react";
import AnimatedBackground from "@/components/AnimatedBackground";
import { useDarkMode } from "@/hooks/useDarkMode";
import SettingsMenu from "@/components/SettingsMenu";
import { isPrefActive } from "@/hooks/usePreferences";
import { ChangelogDialog } from "./ChangelogDialog";

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initial = (user?.user_metadata?.display_name || user?.email || "?")[0]?.toUpperCase();
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const { enabled: darkOn, toggle: toggleDark } = useDarkMode();

  // Track unread count for title flashing
  const unreadRef = useRef(0);
  const baseTitleRef = useRef<string>(typeof document !== "undefined" ? document.title : "Ember");

  useEffect(() => {
    if (typeof document === "undefined") return;
    // Capture the base title once (without any "(n)" prefix)
    const stripped = document.title.replace(/^\(\d+\)\s*/, "");
    baseTitleRef.current = stripped || "Ember";

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        unreadRef.current = 0;
        document.title = baseTitleRef.current;
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  // Reset unread count + title when navigating into a room
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.visibilityState === "visible") {
      unreadRef.current = 0;
      document.title = baseTitleRef.current;
    }
    // Play navigation sound when entering a room or going back to lobby
    if (location.pathname !== "/") {
      playNav();
    }
  }, [location.pathname]);

  // Global click sound for interactive elements
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Check if the clicked element or its parent is a button, link, or input
      const interactive = target.closest("button, a, input[type='checkbox'], input[type='radio'], [role='button']");
      if (interactive) {
        playClick();
      }
    };
    document.addEventListener("mousedown", handleGlobalClick);
    return () => document.removeEventListener("mousedown", handleGlobalClick);
  }, []);

  // Global "ping" for new messages in any of the user's rooms.
  // Skips messages from yourself, and skips the room you're currently viewing
  // (Room.tsx plays its own ding there).
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("global-message-ping")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as { room_id: string; user_id: string };
          if (msg.user_id === user.id) return;
          const match = location.pathname.match(/^\/rooms\/([^/]+)/);
          if (match && match[1] === msg.room_id) return;
          if (!isPrefActive("muteSounds")) playDing();
          unreadRef.current += 1;
          if (typeof document !== "undefined" && !isPrefActive("disableTitleFlash")) {
            document.title = `(${unreadRef.current}) ${baseTitleRef.current}`;
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, location.pathname]);

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />

      <header className="glass relative z-10 sticky top-0 rounded-none border-x-0 border-t-0">
        <div className="container flex items-center justify-between h-16">
          <Link to="/rooms" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-sunset flex items-center justify-center shadow-glow">
              <MessagesSquare className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-lg">Ember</span>
          </Link>

          <div className="flex items-center gap-2">
            <SettingsMenu />
            <button
              onClick={toggleDark}
              aria-pressed={darkOn}
              title={darkOn ? "Switch to light mode" : "Switch to dark mode"}
              className="inline-flex items-center justify-center rounded-full w-9 h-9 border bg-card/60 border-border text-muted-foreground hover:text-foreground transition"
            >
              {darkOn ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-full ring-2 ring-transparent hover:ring-primary/30 transition">
                <Avatar>
                  {avatarUrl && <AvatarImage src={avatarUrl} alt="avatar" />}
                  <AvatarFallback className="bg-warm text-primary-foreground font-semibold">{initial}</AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="font-semibold">{user?.user_metadata?.display_name || "You"}</div>
                <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("/profile")}>
                <UserCog className="w-4 h-4 mr-2" /> Edit profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={async () => { await signOut(); navigate("/"); }}>
                <LogOut className="w-4 h-4 mr-2" /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="relative z-10 container py-8">{children}</main>
      <ChangelogDialog />
    </div>
  );
}