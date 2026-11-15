import { useState } from 'react';
import { PRESET_STAKES } from '../data/mockRounds';
import { BetSlotState, GamePhase } from '../types/crash';

interface BetPanelProps {
  slot: BetSlotState;
  phase: GamePhase;
  onChangeInput: (slotId: 0 | 1, value: string) => void;
  onPickPreset: (slotId: 0 | 1, amount: number) => void;
  onClearInput: (slotId: 0 | 1) => void;
  onAction: (slotId: 0 | 1) => void;
  onOpenAuto: (slotId: 0 | 1) => void;
}

export function BetPanel({
  slot,
  phase,
  onChangeInput,
  onPickPreset,
  onClearInput,
  onAction,
  onOpenAuto,
}: BetPanelProps) {
  const [pressedKey, setPressedKey] = useState<string | null>(null);

  const triggerPress = (key: string) => {
    setPressedKey(key);
    window.setTimeout(() => {
      setPressedKey((curr) => (curr === key ? null : curr));
    }, 160);
  };

  const parsedStake = Number.parseFloat(slot.inputValue);
  const isWaiting = phase === 'waiting';
  const isFlight = phase === 'flight';
  const isCrashed = phase === 'crashed';

  const hasUnsettledFlightBet =
    isFlight && slot.activeBet !== null && slot.activeBet.cashedOutAt === null;
  const hasWaitingBet = isWaiting && slot.activeBet !== null;
  const hasQueuedNext = slot.queuedBet !== null;

  const isLocked =
    hasWaitingBet ||
    hasQueuedNext ||
    (isFlight && slot.activeBet !== null && slot.activeBet.cashedOutAt !== null);

  let primaryLabel = 'وضع الرهان';
  let isPendingStyle = false;

  if (hasUnsettledFlightBet && slot.activeBet) {
    primaryLabel = 'سحب';
  } else if (hasWaitingBet) {
    primaryLabel = 'إلغاء';
    isPendingStyle = true;
  } else if (hasQueuedNext) {
    primaryLabel = 'في الانتظار';
    isPendingStyle = true;
  } else if (isFlight || isCrashed) {
    primaryLabel = 'وضع الرهان';
  }

  return (
    <section
      className={`bet-panel ${hasUnsettledFlightBet ? 'has-bet' : ''} ${
        isLocked ? 'is-locked' : ''
      }`}
      aria-label="لوحة الرهان"
    >
      <div className="bet-controls">
        <label className="amount-input">
          <input
            inputMode="decimal"
            aria-label="قيمة الرهان"
            value={slot.inputValue}
            disabled={hasWaitingBet || hasUnsettledFlightBet || hasQueuedNext}
            onChange={(e) => onChangeInput(slot.id, e.target.value)}
          />
          <button
            type="button"
            aria-label="مسح القيمة"
            disabled={hasWaitingBet || hasUnsettledFlightBet || hasQueuedNext}
            onClick={() => onClearInput(slot.id)}
          >
            ×
          </button>
        </label>

        <div className="amount-grid">
          {PRESET_STAKES.map((amount) => {
            const isPicked =
              !Number.isNaN(parsedStake) && Math.abs(parsedStake - amount) < 0.001;
            return (
              <button
                key={amount}
                type="button"
                disabled={hasWaitingBet || hasUnsettledFlightBet || hasQueuedNext}
                className={isPicked ? 'is-picked' : ''}
                onClick={() => onPickPreset(slot.id, amount)}
              >
                {amount}
              </button>
            );
          })}
        </div>
      </div>

      <div className="bet-actions">
        <button
          type="button"
          className={`auto-button ${slot.autoConfig.enabled ? 'is-on' : ''} ${
            pressedKey === 'auto' ? 'is-pressed' : ''
          }`}
          onClick={() => {
            triggerPress('auto');
            onOpenAuto(slot.id);
          }}
        >
          {slot.autoConfig.enabled
            ? 'إيقاف التشغيل التلقائي'
            : 'تمكين التشغيل التلقائي'}
        </button>

        <button
          type="button"
          className={`place-button ${isPendingStyle ? 'is-pending' : ''} ${
            pressedKey === 'place' ? 'is-pressed' : ''
          }`}
          aria-busy={hasQueuedNext ? 'true' : 'false'}
          onClick={() => {
            triggerPress('place');
            onAction(slot.id);
          }}
        >
          {hasQueuedNext ? (
            <span className="place-button-lines">
              <span>{primaryLabel}</span>
              <span className="bet-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </span>
          ) : (
            <span className="place-button-lines">
              <span>{primaryLabel}</span>
            </span>
          )}
        </button>
      </div>
    </section>
  );
}
