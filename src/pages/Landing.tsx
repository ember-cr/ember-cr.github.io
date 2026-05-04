import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { MessagesSquare, Sparkles, Users, Zap, Moon, Sun } from "lucide-react";
import AnimatedBackground from "@/components/AnimatedBackground";
import { useDarkMode } from "@/hooks/useDarkMode";

export default function Landing() {
  const { user, loading } = useAuth();
  const { enabled: darkOn, toggle: toggleDark } = useDarkMode();
  if (!loading && user) return <Navigate to="/rooms" replace />;

  return (
    <div className="min-h-screen relative">
      <AnimatedBackground />

      <header className="relative z-10 container flex items-center justify-between py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl bg-sunset flex items-center justify-center shadow-glow">
            <MessagesSquare className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-display font-bold">Ember</span>
        </Link>
        <div className="flex gap-2">
          <button
            onClick={toggleDark}
            aria-pressed={darkOn}
            title={darkOn ? "Switch to light mode" : "Switch to dark mode"}
            className="inline-flex items-center justify-center rounded-full w-9 h-9 border bg-card/60 border-border text-muted-foreground hover:text-foreground transition"
          >
            {darkOn ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <Button asChild variant="ghost"><Link to="/auth">Sign in</Link></Button>
          <Button asChild variant="hero"><Link to="/auth">Get started</Link></Button>
        </div>
      </header>

      <main className="relative z-10 container py-20 md:py-32">
        <div className="max-w-3xl mx-auto text-center animate-fade-in-up">
          <div className="glass inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm text-muted-foreground mb-8">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Real-time chat, made warm
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-extrabold tracking-tight leading-[1.05] mb-6">
            Chat rooms with<br/>
            <span className="text-sunset">a sunset glow.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-10">
            Spin up a room in seconds, invite anyone with a link or by email, and start a conversation that actually feels alive.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild variant="hero" size="xl"><Link to="/auth">Start chatting free</Link></Button>
            <Button asChild variant="soft" size="xl"><Link to="/auth">I have an invite</Link></Button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-24 max-w-5xl mx-auto">
          {[
            { icon: Zap, title: "Instant rooms", body: "Create a chat room in one click and start talking immediately." },
            { icon: Users, title: "Invite anyone", body: "Share a link or invite by email — your choice." },
            { icon: Sparkles, title: "Live & warm", body: "Messages stream in real-time with a UI that doesn't feel cold." },
          ].map((f, i) => (
            <div key={i} className="glass rounded-3xl p-7 hover:shadow-soft transition-smooth">
              <div className="w-11 h-11 rounded-2xl bg-warm flex items-center justify-center mb-4 shadow-glow">
                <f.icon className="w-5 h-5 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-display font-semibold mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}