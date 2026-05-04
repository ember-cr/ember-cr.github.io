import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import pkg from "../../package.json";

const CHANGELOG = [
  {
    version: "1.7.1",
    date: "Deployment Fixes",
    changes: [
      "Fixed blank page issue on static hosts like page.gd. (#rb009)",
      "Switched to HashRouter for 100% compatibility with all hosts.",
      "Configured relative base paths in Vite."
    ]
  },
  {
    version: "1.7.0",
    date: "Sound System",
    changes: [
      "Added Master Volume control in Preferences.",
      "Added Click Sounds for buttons and links.",
      "Added Navigation Sounds when entering rooms.",
      "All sounds now respect the master volume and mute settings."
    ]
  },
  {
    version: "1.6.1",
    date: "Resilient Mode",
    changes: [
      "Room icons and colors now work even without Supabase migrations. (#rb007)",
      "Settings fallback to LocalStorage if the database is out of sync."
    ]
  },
  {
    version: "1.6.0",
    date: "Standalone Mode",
    changes: [
      "The website can now run entirely by itself without Supabase!",
      "Data is saved to your browser's LocalStorage.",
      "Real-time chat works across tabs using BroadcastChannel.",
      "Automatically activates if Supabase keys are missing."
    ]
  },
  {
    version: "1.5.2",
    changes: [
      "Fixed 'column not found' error by providing migration instructions. (#rb006)",
      "Migration required: Run the SQL migration file in your Supabase SQL Editor."
    ]
  },
  {
    version: "1.5.1",
    changes: [
      "Fixed blank page when entering a room. (#rb005)",
      "Added bug tracking system to the changelog."
    ]
  },
  {
    version: "1.5.0",
    changes: [
      "Added a full Chat Icon System for rooms.",
      "Customize room icons (e.g., #, %, Smile, Heart) and colors in Room Settings.",
      "Room icons and colors are now visible in the room list and chat header."
    ]
  },
  {
    version: "1.4.5",
    changes: [
      "Added a full Theme System (Sunset, Ocean, Emerald, Rose).",
      "Fixed theme colors not applying to the animated background. (#rb004)",
      "Fixed avatar rendering issues in chat and member lists. (#rb003)"
    ]
  },
  {
    version: "1.4.4",
    changes: [
      "Added extra settings."
    ]
  },
  {
    version: "1.4.3",
    changes: [
      "Added User status Checker.",
      "Added Visual Effect Settings Menu."
    ]
  },
  {
    version: "1.3.3",
    changes: [
      "Removed Liquid Glass effect",
      "Added floating Glass effect to buttons.",
      "Added Dark mode/toggleable button."
    ]
  },
  {
    version: "1.3.2",
    changes: [
      "Added Interactive Background.",
      "Added Liquid Glass effect.",
      "Added Account Profile.",
      "Added Room Password.",
      "Added Visual Settings to dev."
    ]
  },
  {
    version: "1.2.2",
    changes: [
      "Fixed Interactive Background freeze. (#db001)"
    ]
  },
  {
    version: "1.2.1",
    changes: [
      "Added Animated Background.",
      "Added Account System.",
      "Added New invite system",
      "Added interactive background to dev.",
      "Added Liquid Glass effect to dev.",
      "Added Account profile/passwords to dev.",
      "Added User stats system. (online/offline, typing?)"
    ]
  },
  {
    version: "1.1.1",
    changes: [
      "Fixed Animated Background. (#rb002)"
    ]
  },
  {
    version: "1.1.0",
    changes: [
      "Fixed out of frame. (#rb001)",
      "Added dev panel/features.",
      "Added Animated Background to dev.",
      "Added Account system to dev.",
      "Added 6-digit code invite system to dev."
    ]
  },
  {
    version: "1.0.0",
    changes: [
      "Initial release of the Ember chat website.",
      "Real-time messaging rooms.",
      "Added Changelog"
    ]
  }
];

export function ChangelogDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full glass border border-border/50 text-[10px] text-muted-foreground uppercase tracking-wider font-medium hover:text-foreground hover:border-primary/30 transition-all active:scale-95 shadow-lg">
          <Info className="w-3 h-3" />
          v{pkg.version}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="font-display text-xl">Changelog</DialogTitle>
            <Badge variant="outline" className="font-mono">v{pkg.version}</Badge>
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1 p-6">
          <div className="space-y-8">
            {CHANGELOG.map((entry) => (
              <div key={entry.version} className="relative pl-6 border-l border-border/50 last:border-0">
                <div className="absolute left-[-5px] top-1.5 w-2 h-2 rounded-full bg-primary shadow-glow" />
                <div className="flex items-baseline gap-2 mb-2">
                  <h4 className="font-display font-bold text-base">[{entry.version}]</h4>
                  {entry.date && (
                    <span className="text-xs text-muted-foreground font-medium">
                      ({entry.date})
                    </span>
                  )}
                </div>
                <ul className="space-y-1.5">
                  {entry.changes.map((change, i) => (
                    <li key={i} className="text-sm text-muted-foreground leading-relaxed flex items-start gap-2">
                      <span className="mt-1.5 w-1 h-1 rounded-full bg-muted-foreground/30 shrink-0" />
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
