import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { Loader2, Upload, ArrowLeft, KeyRound } from "lucide-react";
import { z } from "zod";

const schema = z.object({
  display_name: z.string().trim().min(1, "Required").max(50, "Max 50 chars"),
});

const passwordSchema = z.object({
  password: z.string().min(6, "Min 6 characters").max(72, "Max 72 characters"),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

export default function Profile() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);

  const isPasswordUser = !!user?.email && (
    !user?.app_metadata?.providers ||
    (user.app_metadata.providers as string[]).includes("email")
  );

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setDisplayName(data.display_name || "");
        setAvatarUrl(data.avatar_url);
      }
      setFetched(true);
    })();
  }, [user]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 2MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
    setUploading(false);
    toast({ title: "Avatar uploaded", description: "Don't forget to save." });
  };

  const handleSave = async () => {
    if (!user) return;
    const parsed = schema.safeParse({ display_name: displayName });
    if (!parsed.success) {
      toast({ title: "Invalid", description: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: parsed.data.display_name, avatar_url: avatarUrl })
      .eq("id", user.id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      await supabase.auth.updateUser({ data: { display_name: parsed.data.display_name, avatar_url: avatarUrl } });
      toast({ title: "Profile saved" });
    }
    setSaving(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = passwordSchema.safeParse({ password: newPwd, confirm: confirmPwd });
    if (!parsed.success) {
      toast({ title: "Invalid", description: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    setChangingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
    setChangingPwd(false);
    if (error) {
      toast({ title: "Couldn't change password", description: error.message, variant: "destructive" });
    } else {
      setNewPwd("");
      setConfirmPwd("");
      toast({ title: "Password updated" });
    }
  };

  const initial = (displayName || user?.email || "?")[0]?.toUpperCase();

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate("/rooms")} className="mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to rooms
        </Button>
        <Card className="bg-card/60 backdrop-blur border-border/60">
          <CardHeader>
            <CardTitle className="font-display">Edit profile</CardTitle>
            <CardDescription>Update how you appear to others in chat rooms.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-5">
              <Avatar className="w-20 h-20">
                {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                <AvatarFallback className="bg-warm text-primary-foreground text-2xl font-semibold">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                <Button variant="soft" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? "Uploading..." : "Change avatar"}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">PNG or JPG, max 2MB</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_name">Display name</Label>
              <Input
                id="display_name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                placeholder="Your name"
                disabled={!fetched}
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ""} disabled />
            </div>

            <div className="flex justify-end">
              <Button variant="hero" onClick={handleSave} disabled={saving || !fetched}>
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 backdrop-blur border-border/60 mt-6">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <KeyRound className="w-5 h-5" /> Change password
            </CardTitle>
            <CardDescription>
              {isPasswordUser
                ? "Choose a strong new password for your account."
                : "You signed in with a social provider. Setting a password lets you also sign in with email."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-pwd">New password</Label>
                <Input
                  id="new-pwd"
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  minLength={6}
                  maxLength={72}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-pwd">Confirm new password</Label>
                <Input
                  id="confirm-pwd"
                  type="password"
                  value={confirmPwd}
                  onChange={(e) => setConfirmPwd(e.target.value)}
                  minLength={6}
                  maxLength={72}
                  autoComplete="new-password"
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="hero" disabled={changingPwd || !newPwd || !confirmPwd}>
                  {changingPwd && <Loader2 className="w-4 h-4 animate-spin" />}
                  Update password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
