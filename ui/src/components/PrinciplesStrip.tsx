import { Desktop, Key, EyeOff, CloudOff, DatabaseOff, UserOff } from "@/lib/icons";

const PRINCIPLES = [
  { Icon: Desktop, label: "Local-first", sub: "Runs on your machine" },
  { Icon: Key, label: "BYOK", sub: "Your own API keys" },
  { Icon: EyeOff, label: "No telemetry", sub: "Nothing phoned home" },
  { Icon: CloudOff, label: "No SaaS", sub: "No hosted backend" },
  { Icon: DatabaseOff, label: "No database", sub: "File-based state" },
  { Icon: UserOff, label: "No accounts", sub: "No login, no billing" },
];

/**
 * Principles strip (CLAUDE.md §5.3). Compact bordered row of trust signals —
 * the things a suspicious backend engineer wants to hear first.
 */
export function PrinciplesStrip() {
  return (
    <section className="border-border-dim border-y">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-5 px-5 py-6 sm:grid-cols-3 lg:grid-cols-6">
        {PRINCIPLES.map(({ Icon, label, sub }) => (
          <div key={label} className="flex items-center gap-2.5">
            <Icon size={18} className="text-text-secondary shrink-0" />
            <div className="leading-tight">
              <div className="text-text-primary text-[13px] font-medium">{label}</div>
              <div className="text-text-tertiary text-[11px]">{sub}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
