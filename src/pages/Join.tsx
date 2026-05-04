import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function Join() {
  const { code } = useParams<{ code: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Joining…");
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const attemptJoin = async (pwd: string | null) => {
    setSubmitting(true);
    setErrorMsg(null);
    const { data, error } = await supabase.rpc("join_room_by_code", {
      _code: code!,
      _password: pwd,
    } as any);
    setSubmitting(false);
    if (error || !data) {
      const msg = error?.message ?? "Invalid invite link";
      if (/password required/i.test(msg)) {
        setNeedsPassword(true);
        setStatus("This room is password-protected.");
        return;
      }
      if (/incorrect password/i.test(msg)) {
        setNeedsPassword(true);
        setErrorMsg("Incorrect password");
        return;
      }
      toast.error(msg);
      navigate("/rooms");
      return;
    }
    navigate(`/rooms/${data}`, { replace: true });
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      sessionStorage.setItem("pending_invite", code ?? "");
      navigate("/auth", { replace: true });
      return;
    }
    setStatus("Adding you to the room…");
    attemptJoin(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading, code, navigate]);

  if (!loading && !user && !code) return <Navigate to="/" replace />;

  if (needsPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <form
          onSubmit={(e) => { e.preventDefault(); attemptJoin(password); }}
          className="glass rounded-3xl p-8 w-full max-w-sm space-y-5"
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-warm flex items-center justify-center shadow-glow">
              <KeyRound className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-semibold text-lg leading-tight">Password required</h1>
              <p className="text-xs text-muted-foreground">Ask the room owner if you don't have it.</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pwd">Room password</Label>
            <Input id="pwd" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
            {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}
          </div>
          <Button type="submit" variant="hero" className="w-full" disabled={submitting || !password}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Join room"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">{status}</p>
      </div>
    </div>
  );
}