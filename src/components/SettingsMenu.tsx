import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Settings2, RotateCcw, Palette, Check, Volume2, VolumeX } from "lucide-react";
import { usePreferences, type PrefKey, type ThemeKey } from "@/hooks/usePreferences";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";

const OPTIONS: { key: PrefKey; label: string; hint: string }[] = [
  { key: "reduceMotion", label: "Reduce motion", hint: "Disable cursor-following & most animations" },
  { key: "disableParallax", label: "Disable cursor parallax", hint: "Background stops following the cursor" },
  { key: "disableBgAnim", label: "Disable background animation", hint: "Freeze aurora & blob movement" },
  { key: "disableGlassBlur", label: "Disable glass blur", hint: "Remove backdrop-blur for performance" },
  { key: "muteSounds", label: "Mute notification sounds", hint: "Silence the message ding" },
  { key: "disableClickSounds", label: "Disable click sounds", hint: "Silence button and menu clicks" },
  { key: "disableTitleFlash", label: "Disable tab title alerts", hint: "Don't update tab title with unread count" },
];

const THEMES: { id: ThemeKey; label: string; color: string }[] = [
  { id: "sunset", label: "Sunset", color: "bg-[#ff6b35]" },
  { id: "ocean", label: "Ocean", color: "bg-[#00a2ff]" },
  { id: "emerald", label: "Emerald", color: "bg-[#00cc66]" },
  { id: "rose", label: "Rose", color: "bg-[#ff3385]" },
];

export default function SettingsMenu() {
  const { prefs, setPref, reset } = usePreferences();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          title="Settings"
          className="inline-flex items-center justify-center rounded-full w-9 h-9 border bg-card/60 border-border text-muted-foreground hover:text-foreground transition"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="px-4 pt-4 pb-2">
          <h3 className="font-display font-semibold text-sm flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" /> Appearance
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose your theme and visual style.
          </p>
        </div>
        
        <div className="px-4 py-3 border-y border-border/50">
          <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/80 mb-2 block">
            Color Theme
          </Label>
          <div className="grid grid-cols-4 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setPref("theme", t.id)}
                className={cn(
                  "group relative flex flex-col items-center gap-1.5 p-1 rounded-xl transition-all hover:bg-muted",
                  prefs.theme === t.id && "bg-muted shadow-inner"
                )}
                title={t.label}
              >
                <div className={cn(
                  "w-full aspect-square rounded-lg shadow-sm flex items-center justify-center transition-transform group-hover:scale-110",
                  t.color
                )}>
                  {prefs.theme === t.id && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                </div>
                <span className="text-[10px] font-medium truncate w-full text-center">
                  {t.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 py-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/80">
              Master Volume
            </Label>
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              {prefs.muteSounds ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              {prefs.muteSounds ? "Muted" : `${prefs.volume}%`}
            </div>
          </div>
          <Slider
            value={[prefs.volume]}
            max={100}
            step={1}
            onValueChange={([v]) => setPref("volume", v)}
            disabled={prefs.muteSounds}
            className="py-2"
          />
        </div>

        <div className="px-4 py-3 space-y-3 max-h-[40vh] overflow-y-auto">
          {OPTIONS.map((opt) => (
            <div key={opt.key} className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <Label htmlFor={`pref-${opt.key}`} className="text-sm cursor-pointer">
                  {opt.label}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.hint}</p>
              </div>
              <Switch
                id={`pref-${opt.key}`}
                checked={prefs[opt.key]}
                onCheckedChange={(v) => setPref(opt.key, v)}
              />
            </div>
          ))}
        </div>
        <Separator />
        <div className="px-4 py-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={reset} className="h-8">
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset to defaults
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}