import { useCallback, useEffect, useRef, useState } from 'react';
import { BetPanel } from './components/BetPanel';
import { CrashModals } from './components/CrashModals';
import { CrashScene } from './components/CrashScene';
import { Header } from './components/Header';
import {
  HISTORY_ICON_URI,
  STATS_BETS_ICON_URI,
  STATS_PROFIT_ICON_URI,
  STATS_TOTAL_ICON_URI,
} from './data/crashAssets';
import {
  generateCrashPoint,
  generateSimulatedBets,
  INITIAL_HISTORY_ROUNDS,
} from './data/mockRounds';
import {
  ActiveSheet,
  AutoPlayConfig,
  BetNoticeToast,
  BetSlotState,
  GamePhase,
  HistoryRound,
  LiveBetRow,
  SceneResultBanner,
} from './types/crash';
const WAITING_DURATION_MS = 6000;
const CRASH_PAUSE_MS = 2800;
const INITIAL_BALANCE = 1000;

function createInitialSlot(id: 0 | 1): BetSlotState {
  return {
    id,
    inputValue: '20',
    activeBet: null,
    queuedBet: null,
    autoConfig: {
      enabled: false,
      baseStake: 20,
      autoCashout: 2,
      roundsRemaining: null,
      onWin: 'continue',
      onLoss: 'continue',
    },
  };
}

export default function App() {
  const [balance, setBalance] = useState<number>(INITIAL_BALANCE);
  const [phase, setPhase] = useState<GamePhase>('waiting');
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(6);
  const [countdownProgress, setCountdownProgress] = useState<number>(0);
  const [flightElapsedSec, setFlightElapsedSec] = useState<number>(0);
  const [roundNumber, setRoundNumber] = useState<number>(4813);

  const [slots, setSlots] = useState<[BetSlotState, BetSlotState]>([
    createInitialSlot(0),
    createInitialSlot(1),
  ]);

  const [simulatedRows, setSimulatedRows] = useState<LiveBetRow[]>(() =>
    generateSimulatedBets(4813).rows
  );
  const [baseStats, setBaseStats] = useState<{
    count: number;
    pool: number;
  }>(() => {
    const initial = generateSimulatedBets(4813);
    return { count: initial.totalBetsCount, pool: initial.baseTotalPool };
  });

  const [historyRounds, setHistoryRounds] = useState<HistoryRound[]>(
    INITIAL_HISTORY_ROUNDS
  );
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [betNotice, setBetNotice] = useState<BetNoticeToast | null>(null);
  const [resultBanner, setResultBanner] = useState<SceneResultBanner | null>(null);
  const [isRoundTransition, setIsRoundTransition] = useState<boolean>(false);
  const [notifications, setNotifications] = useState([
    {
      id: 'n-1',
      title: 'مرحباً بك في Crash — MaxBet',
      body: 'توقّع لحظة الانفجار واسحب أرباحك في الوقت المناسب. يمكنك شحن رصيدك التجريبي من أيقونة المحفظة بالأعلى.',
      time: 'الآن',
      unread: true,
    },
  ]);

  const balanceRef = useRef(balance);
  balanceRef.current = balance;

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const multiplierRef = useRef(multiplier);
  multiplierRef.current = multiplier;

  const slotsRef = useRef(slots);
  slotsRef.current = slots;

  const roundNumberRef = useRef(roundNumber);
  roundNumberRef.current = roundNumber;

  const crashPointRef = useRef<number>(generateCrashPoint());
  const phaseStartRef = useRef<number>(performance.now());
  const toastCounterRef = useRef<number>(1);

  const showNotice = useCallback((type: 'success' | 'error', text: string) => {
    const id = ++toastCounterRef.current;
    setBetNotice({ id, type, text });
    window.setTimeout(() => {
      setBetNotice((curr) => (curr?.id === id ? null : curr));
    }, 2200);
  }, []);

  const showBanner = useCallback((type: 'win' | 'loss', text: string) => {
    const id = ++toastCounterRef.current;
    setResultBanner({ id, type, text });
    window.setTimeout(() => {
      setResultBanner((curr) => (curr?.id === id ? null : curr));
    }, 2400);
  }, []);

  const settleCashout = useCallback(
    (slotId: 0 | 1, atMultiplier: number) => {
      const targetSlot = slotsRef.current[slotId];
      if (!targetSlot.activeBet || targetSlot.activeBet.cashedOutAt !== null) {
        return;
      }
      const payout = Number(
        (targetSlot.activeBet.stake * atMultiplier).toFixed(2)
      );

      setSlots((prev) => {
        const next: [BetSlotState, BetSlotState] = [prev[0], prev[1]];
        const curr = next[slotId];
        if (!curr.activeBet || curr.activeBet.cashedOutAt !== null) return prev;
        next[slotId] = {
          ...curr,
          activeBet: {
            ...curr.activeBet,
            cashedOutAt: atMultiplier,
            payout,
          },
        };
        return next;
      });

      setBalance((b) => Number((b + payout).toFixed(2)));
      showBanner('win', `ربحت ${payout.toFixed(2)} ج.م`);
    },
    [showBanner]
  );

  // Main game phase loop driven by requestAnimationFrame
  useEffect(() => {
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - phaseStartRef.current;
      const currentPhase = phaseRef.current;

      if (currentPhase === 'waiting') {
        const remainingMs = Math.max(0, WAITING_DURATION_MS - elapsed);
        const sec = Math.max(1, Math.ceil(remainingMs / 1000));
        setCountdownSeconds((prev) => (prev !== sec ? sec : prev));
        setCountdownProgress(Math.min(1, elapsed / WAITING_DURATION_MS));

        if (elapsed >= WAITING_DURATION_MS) {
          crashPointRef.current = generateCrashPoint();
          phaseStartRef.current = now;
          phaseRef.current = 'flight';
          setPhase('flight');
          setMultiplier(1.0);
          setFlightElapsedSec(0);
          setIsRoundTransition(false);
        }
      } else if (currentPhase === 'flight') {
        const sec = elapsed / 1000;
        const nextMult = Number(Math.exp(0.064 * sec).toFixed(2));
        const crashTarget = crashPointRef.current;

        if (nextMult >= crashTarget) {
          // Crash occurred!
          phaseStartRef.current = now;
          phaseRef.current = 'crashed';
          setPhase('crashed');
          setMultiplier(crashTarget);

          // Settle simulated players who hadn't cashed out before crashTarget
          setSimulatedRows((prev) =>
            prev.map((row) =>
              row.cashedOutAt !== null
                ? row
                : { ...row, status: 'loss', payout: 0 }
            )
          );

          // Settle user bets & update history / auto-play rules
          const currentSlots = slotsRef.current;
          let roundStake = 0;
          let roundPayout = 0;
          let bestCashout: number | null = null;
          let hadLoss = false;

          currentSlots.forEach((slot) => {
            if (slot.activeBet) {
              roundStake += slot.activeBet.stake;
              if (slot.activeBet.cashedOutAt !== null) {
                roundPayout += slot.activeBet.payout;
                bestCashout =
                  bestCashout === null
                    ? slot.activeBet.cashedOutAt
                    : Math.max(bestCashout, slot.activeBet.cashedOutAt);
              } else {
                hadLoss = true;
              }
            }
          });

          if (roundStake > 0) {
            const newHistory: HistoryRound = {
              id: `r-${roundNumberRef.current}-${Date.now()}`,
              roundNumber: roundNumberRef.current,
              crashPoint: crashTarget,
              stake: Number(roundStake.toFixed(2)),
              cashoutAt: bestCashout,
              payout: Number(roundPayout.toFixed(2)),
              timestamp: 'الآن',
            };
            setHistoryRounds((prev) => [newHistory, ...prev.slice(0, 29)]);

            if (hadLoss && roundPayout === 0) {
              showBanner('loss', `خسرت ${roundStake.toFixed(2)} ج.م`);
            }
          }
        } else {
          setMultiplier(nextMult);
          multiplierRef.current = nextMult;
          setFlightElapsedSec(sec);

          // Settle simulated players hitting targetCashout
          setSimulatedRows((prev) => {
            let changed = false;
            const mapped = prev.map((row) => {
              if (row.cashedOutAt === null && nextMult >= row.targetCashout) {
                changed = true;
                return {
                  ...row,
                  cashedOutAt: row.targetCashout,
                  payout: Number((row.stake * row.targetCashout).toFixed(2)),
                  status: 'win' as const,
                };
              }
              return row;
            });
            return changed ? mapped : prev;
          });

          // Auto-cashout check for user slots
          slotsRef.current.forEach((slot) => {
            if (
              slot.activeBet &&
              slot.activeBet.cashedOutAt === null &&
              slot.autoConfig.enabled &&
              nextMult >= slot.autoConfig.autoCashout
            ) {
              settleCashout(slot.id, slot.autoConfig.autoCashout);
            }
          });
        }
      } else if (currentPhase === 'crashed') {
        if (elapsed >= CRASH_PAUSE_MS) {
          // Prepare next round
          const nextRound = roundNumberRef.current + 1;
          roundNumberRef.current = nextRound;
          setRoundNumber(nextRound);

          const sim = generateSimulatedBets(nextRound);
          setSimulatedRows(sim.rows);
          setBaseStats({ count: sim.totalBetsCount, pool: sim.baseTotalPool });

          // Promote queued bets & handle auto-play for next round
          let deductedTotal = 0;
          const prevSlots = slotsRef.current;
          const updatedSlots: [BetSlotState, BetSlotState] = [
            prevSlots[0],
            prevSlots[1],
          ];

          for (const idx of [0, 1] as const) {
            const s = prevSlots[idx];
            const wonPrev =
              s.activeBet !== null && s.activeBet.cashedOutAt !== null;
            const lostPrev =
              s.activeBet !== null && s.activeBet.cashedOutAt === null;

            let nextAuto = { ...s.autoConfig };
            if (nextAuto.enabled && s.activeBet !== null) {
              if (wonPrev && nextAuto.onWin === 'stop') {
                nextAuto.enabled = false;
              } else if (lostPrev && nextAuto.onLoss === 'stop') {
                nextAuto.enabled = false;
              } else if (nextAuto.roundsRemaining !== null) {
                const left = nextAuto.roundsRemaining - 1;
                if (left <= 0) {
                  nextAuto.enabled = false;
                  nextAuto.roundsRemaining = null;
                } else {
                  nextAuto.roundsRemaining = left;
                }
              }
            }

            let nextActiveBet: BetSlotState['activeBet'] = null;
            if (s.queuedBet !== null) {
              nextActiveBet = {
                stake: s.queuedBet,
                cashedOutAt: null,
                payout: 0,
              };
            } else if (nextAuto.enabled) {
              const available = balanceRef.current - deductedTotal;
              if (available >= nextAuto.baseStake) {
                deductedTotal += nextAuto.baseStake;
                nextActiveBet = {
                  stake: nextAuto.baseStake,
                  cashedOutAt: null,
                  payout: 0,
                };
              } else {
                nextAuto.enabled = false;
                showNotice('error', 'الرصيد غير كافٍ لإكمال التشغيل التلقائي');
              }
            }

            updatedSlots[idx] = {
              ...s,
              activeBet: nextActiveBet,
              queuedBet: null,
              autoConfig: nextAuto,
            };
          }

          if (deductedTotal > 0) {
            setBalance((b) => Number(Math.max(0, b - deductedTotal).toFixed(2)));
          }
          setSlots(updatedSlots);

          phaseStartRef.current = now;
          phaseRef.current = 'waiting';
          setPhase('waiting');
          setCountdownSeconds(6);
          setCountdownProgress(0);
          setMultiplier(1.0);
          setFlightElapsedSec(0);
          setIsRoundTransition(true);
          window.setTimeout(() => setIsRoundTransition(false), 320);
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [settleCashout, showBanner, showNotice]);

  const handleChangeInput = (slotId: 0 | 1, value: string) => {
    const sanitized = value.replace(/[^0-9.]/g, '');
    setSlots((prev) => {
      const next: [BetSlotState, BetSlotState] = [prev[0], prev[1]];
      next[slotId] = { ...next[slotId], inputValue: sanitized };
      return next;
    });
  };

  const handlePickPreset = (slotId: 0 | 1, amount: number) => {
    setSlots((prev) => {
      const next: [BetSlotState, BetSlotState] = [prev[0], prev[1]];
      next[slotId] = { ...next[slotId], inputValue: String(amount) };
      return next;
    });
  };

  const handleClearInput = (slotId: 0 | 1) => {
    setSlots((prev) => {
      const next: [BetSlotState, BetSlotState] = [prev[0], prev[1]];
      next[slotId] = { ...next[slotId], inputValue: '' };
      return next;
    });
  };

  const handleAction = (slotId: 0 | 1) => {
    const slot = slots[slotId];
    const currPhase = phase;

    // 1. Live Cashout during flight
    if (
      currPhase === 'flight' &&
      slot.activeBet !== null &&
      slot.activeBet.cashedOutAt === null
    ) {
      settleCashout(slotId, multiplierRef.current);
      return;
    }

    // 2. Cancel active bet during waiting countdown
    if (currPhase === 'waiting' && slot.activeBet !== null) {
      const refund = slot.activeBet.stake;
      setSlots((prev) => {
        const next: [BetSlotState, BetSlotState] = [prev[0], prev[1]];
        next[slotId] = { ...next[slotId], activeBet: null };
        return next;
      });
      setBalance((b) => Number((b + refund).toFixed(2)));
      showNotice('success', 'تم إلغاء الرهان واسترداد القيمة');
      return;
    }

    // 3. Cancel queued bet for next round
    if (slot.queuedBet !== null) {
      const refund = slot.queuedBet;
      setSlots((prev) => {
        const next: [BetSlotState, BetSlotState] = [prev[0], prev[1]];
        next[slotId] = { ...next[slotId], queuedBet: null };
        return next;
      });
      setBalance((b) => Number((b + refund).toFixed(2)));
      showNotice('success', 'تم إلغاء الرهان المنتظر');
      return;
    }

    // 4. Already cashed out in this flight round -> do nothing until next round
    if (
      currPhase === 'flight' &&
      slot.activeBet !== null &&
      slot.activeBet.cashedOutAt !== null
    ) {
      return;
    }

    // 5. Place new bet (either immediate in waiting or queued for next round)
    const stake = Number.parseFloat(slot.inputValue);
    if (Number.isNaN(stake) || stake < 1) {
      showNotice('error', 'أدخل قيمة رهان صالحة (1 EGP على الأقل)');
      return;
    }
    if (stake > balance) {
      showNotice('error', 'الرصيد غير كافٍ — يمكنك الإيداع من المحفظة');
      return;
    }

    const roundedStake = Number(stake.toFixed(2));
    setBalance((b) => Number((b - roundedStake).toFixed(2)));

    if (currPhase === 'waiting') {
      setSlots((prev) => {
        const next: [BetSlotState, BetSlotState] = [prev[0], prev[1]];
        next[slotId] = {
          ...next[slotId],
          activeBet: { stake: roundedStake, cashedOutAt: null, payout: 0 },
        };
        return next;
      });
      showNotice('success', `تم وضع رهان ${roundedStake} ج.م`);
    } else {
      setSlots((prev) => {
        const next: [BetSlotState, BetSlotState] = [prev[0], prev[1]];
        next[slotId] = { ...next[slotId], queuedBet: roundedStake };
        return next;
      });
      showNotice('success', 'تم تجهيز الرهان للجولة القادمة');
    }
  };

  const handleSaveAutoPlay = (slotId: 0 | 1, config: AutoPlayConfig) => {
    const slot = slots[slotId];
    const shouldPlaceNow =
      phase === 'waiting' &&
      slot.activeBet === null &&
      balance >= config.baseStake;

    if (shouldPlaceNow) {
      setBalance((b) => Number((b - config.baseStake).toFixed(2)));
    }

    setSlots((prev) => {
      const next: [BetSlotState, BetSlotState] = [prev[0], prev[1]];
      next[slotId] = {
        ...next[slotId],
        inputValue: String(config.baseStake),
        autoConfig: config,
        activeBet: shouldPlaceNow
          ? { stake: config.baseStake, cashedOutAt: null, payout: 0 }
          : next[slotId].activeBet,
      };
      return next;
    });
    showNotice('success', `تم تفعيل التشغيل التلقائي عند x${config.autoCashout}`);
  };

  const handleDisableAutoPlay = (slotId: 0 | 1) => {
    setSlots((prev) => {
      const next: [BetSlotState, BetSlotState] = [prev[0], prev[1]];
      next[slotId] = {
        ...next[slotId],
        autoConfig: { ...next[slotId].autoConfig, enabled: false },
      };
      return next;
    });
    showNotice('success', 'تم إيقاف التشغيل التلقائي');
  };

  const handleDeposit = (amount: number) => {
    setBalance((b) => Number((b + amount).toFixed(2)));
    showNotice('success', `تم إضافة ${amount.toFixed(2)} ج.م إلى الرصيد`);
  };

  // Build user live bet rows so they appear highlighted with .is-me at top of the list
  const userLiveRows: LiveBetRow[] = [];
  slots.forEach((slot) => {
    if (slot.activeBet) {
      const isWin = slot.activeBet.cashedOutAt !== null;
      const isLoss = phase === 'crashed' && !isWin;
      userLiveRows.push({
        id: `me-${slot.id}`,
        username: `أنت (${slot.id + 1})`,
        stake: slot.activeBet.stake,
        targetCashout: slot.autoConfig.enabled ? slot.autoConfig.autoCashout : 0,
        cashedOutAt: slot.activeBet.cashedOutAt,
        payout: slot.activeBet.payout,
        isMe: true,
        status: isWin ? 'win' : isLoss ? 'loss' : 'active',
      });
    }
  });

  const combinedRows = [...userLiveRows, ...simulatedRows];

  const userStakeSum = userLiveRows.reduce((acc, r) => acc + r.stake, 0);
  const simProfitSum = simulatedRows.reduce(
    (acc, r) => acc + (r.cashedOutAt !== null ? r.payout : 0),
    0
  );
  const userProfitSum = userLiveRows.reduce((acc, r) => acc + r.payout, 0);

  const displayBetsCount = baseStats.count + userLiveRows.length;
  const displayTotalPool = Math.round(baseStats.pool + userStakeSum);
  const displayTotalProfit = Math.round(
    simProfitSum * 6.85 + userProfitSum + (phase === 'waiting' ? 0 : 12400)
  );

  const unreadCount = notifications.filter((n) => n.unread).length;
  const activeAutoSlot =
    activeSheet?.type === 'auto' ? slots[activeSheet.slotId] : undefined;

  return (
    <div id="top">
      <Header
        balance={balance}
        unreadCount={unreadCount}
        onOpenDeposit={() => setActiveSheet({ type: 'deposit' })}
        onOpenNotifications={() => {
          setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
          setActiveSheet({ type: 'notifications' });
        }}
        onBack={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />

      <div className="c1x">
        <main className="recording-shell">
          <div className="game-canvas" dir="rtl">
            <div className="game-content">
              <nav className="game-tabs" aria-label="تبويبات اللعبة">
                <button
                  type="button"
                  className="terms-tab"
                  onClick={() => setActiveSheet({ type: 'terms' })}
                >
                  الأحكام و الشروط
                </button>
                <button
                  type="button"
                  className="history-tab"
                  onClick={() => setActiveSheet({ type: 'history' })}
                >
                  <i
                    className="ico"
                    aria-hidden="true"
                    style={{
                      maskImage: `url("${HISTORY_ICON_URI}")`,
                      WebkitMaskImage: `url("${HISTORY_ICON_URI}")`,
                    }}
                  />
                  <span>السجل</span>
                </button>
              </nav>

              <CrashScene
                phase={phase}
                multiplier={multiplier}
                countdownSeconds={countdownSeconds}
                countdownProgress={countdownProgress}
                flightElapsedSec={flightElapsedSec}
                resultBanner={resultBanner}
              />

              <div
                className={`bet-stack ${
                  isRoundTransition ? 'is-round-transition' : ''
                }`}
              >
                {betNotice && (
                  <div
                    key={betNotice.id}
                    className={`bet-notice ${
                      betNotice.type === 'error' ? 'is-error' : ''
                    }`}
                  >
                    {betNotice.text}
                  </div>
                )}

                <BetPanel
                  slot={slots[0]}
                  phase={phase}
                  onChangeInput={handleChangeInput}
                  onPickPreset={handlePickPreset}
                  onClearInput={handleClearInput}
                  onAction={handleAction}
                  onOpenAuto={(id) => setActiveSheet({ type: 'auto', slotId: id })}
                />

                <BetPanel
                  slot={slots[1]}
                  phase={phase}
                  onChangeInput={handleChangeInput}
                  onPickPreset={handlePickPreset}
                  onClearInput={handleClearInput}
                  onAction={handleAction}
                  onOpenAuto={(id) => setActiveSheet({ type: 'auto', slotId: id })}
                />
              </div>

              <section className="stats-row">
                <div>
                  <span>عدد الرهانات</span>
                  <b>
                    {displayBetsCount}{' '}
                    <i
                      className="ico"
                      aria-hidden="true"
                      style={{
                        maskImage: `url("${STATS_BETS_ICON_URI}")`,
                        WebkitMaskImage: `url("${STATS_BETS_ICON_URI}")`,
                      }}
                    />
                  </b>
                </div>
                <div>
                  <span>مجموع الرهانات</span>
                  <b>
                    {displayTotalPool}{' '}
                    <i
                      className="ico"
                      aria-hidden="true"
                      style={{
                        maskImage: `url("${STATS_TOTAL_ICON_URI}")`,
                        WebkitMaskImage: `url("${STATS_TOTAL_ICON_URI}")`,
                      }}
                    />
                  </b>
                  <strong>EGP</strong>
                </div>
                <div>
                  <span>مجموع الربح</span>
                  <b>
                    {displayTotalProfit}{' '}
                    <i
                      className="ico"
                      aria-hidden="true"
                      style={{
                        maskImage: `url("${STATS_PROFIT_ICON_URI}")`,
                        WebkitMaskImage: `url("${STATS_PROFIT_ICON_URI}")`,
                      }}
                    />
                  </b>
                  <strong>EGP</strong>
                </div>
              </section>

              <section className="bets-list" aria-label="قائمة الرهانات">
                <div className="list-head">
                  <span>اسم المستخدم</span>
                  <span>الفرص</span>
                  <span>الرهان</span>
                  <span>الأرباح</span>
                </div>

                {combinedRows.map((row) => (
                  <div
                    key={row.id}
                    className={`bet-row ${
                      row.status === 'win'
                        ? 'is-win'
                        : row.status === 'loss'
                        ? 'is-loss'
                        : ''
                    } ${row.isMe ? 'is-me' : ''}`}
                  >
                    <span>{row.username}</span>
                    <span>
                      x
                      {row.cashedOutAt !== null
                        ? row.cashedOutAt.toFixed(2)
                        : '0'}
                    </span>
                    <span>EGP {Number(row.stake.toFixed(2))}</span>
                    <span>
                      EGP {row.cashedOutAt !== null ? Number(row.payout.toFixed(2)) : 0}
                    </span>
                  </div>
                ))}
              </section>
            </div>
          </div>
        </main>
      </div>

      <CrashModals
        sheet={activeSheet}
        onClose={() => setActiveSheet(null)}
        historyRounds={historyRounds}
        currentSlotAuto={activeAutoSlot?.autoConfig}
        currentSlotInput={activeAutoSlot?.inputValue}
        onSaveAutoPlay={handleSaveAutoPlay}
        onDisableAutoPlay={handleDisableAutoPlay}
        balance={balance}
        onDeposit={handleDeposit}
        notifications={notifications}
      />
    </div>
  );
}
