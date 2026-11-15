import { Bell, ChevronLeft, Plus, Wallet } from 'lucide-react';

interface HeaderProps {
  balance: number;
  unreadCount: number;
  onOpenDeposit: () => void;
  onOpenNotifications: () => void;
  onBack: () => void;
}

export function Header({
  balance,
  unreadCount,
  onOpenDeposit,
  onOpenNotifications,
  onBack,
}: HeaderProps) {
  const formattedBalance = Number.isInteger(balance)
    ? balance.toString()
    : balance.toFixed(2);

  return (
    <div className="sticky top-0 z-40" dir="rtl">
      <header className="border-b border-primary/25 bg-header text-header-foreground shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 md:h-16 md:px-4">
          <a
            dir="ltr"
            className="display flex items-center gap-1.5 text-base font-extrabold"
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <span
              className="relative inline-flex shrink-0 items-center justify-center h-9 w-9"
              aria-label="MaxBet"
            >
              <img
                alt="MaxBet"
                draggable={false}
                className="h-full w-full object-contain"
                src="/assets/aistudio/maxbet-logo_9275602c.png"
              />
            </span>
            <span className="text-header-foreground">MaxBet</span>
          </a>

          <div className="me-auto" />

          <button
            type="button"
            aria-label="إيداع"
            onClick={onOpenDeposit}
            className="group flex min-w-0 max-w-[58vw] cursor-pointer items-center gap-2 overflow-hidden rounded-2xl bg-card ps-3 pe-1 py-1 ring-1 ring-border shadow-md sm:max-w-none"
          >
            <div className="flex min-w-0 flex-col items-end leading-tight">
              <span className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                الرصيد
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gold text-[10px] font-extrabold text-stone-950">
                  <Plus className="h-2.5 w-2.5" strokeWidth={4} aria-hidden="true" />
                </span>
              </span>
              <span className="text-sm font-extrabold tabular-nums text-foreground whitespace-nowrap">
                {formattedBalance} ج.م
              </span>
            </div>
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground text-primary-foreground transition-transform group-hover:scale-105">
              <Wallet className="h-4 w-4" aria-hidden="true" />
            </span>
          </button>

          <button
            type="button"
            aria-label="الإشعارات"
            onClick={onOpenNotifications}
            className="relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-primary/15 text-header-foreground ring-1 ring-primary/25 hover:bg-primary/25"
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-extrabold text-white">
                {unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            aria-label="رجوع"
            onClick={onBack}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-primary/15 text-header-foreground ring-1 ring-primary/25 transition-colors hover:bg-primary/25 hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>
    </div>
  );
}
