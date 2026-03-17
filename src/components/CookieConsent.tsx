import { useCallback, useEffect, useRef, useState } from "react";
import { EatCookiePhase } from "./EatCookiePhase";

import kahootMusic from "../assets/Kahoot In Game Music (10 Second Count Down) 22.mp3";

type CookieConsentProps = {
  showCookieClicker: boolean;
  onAccept: () => void;
  onCrash: () => void;
};

const CONFIRM_COUNTDOWN = 10;

export function CookieConsent({
  showCookieClicker,
  onAccept,
  onCrash,
}: CookieConsentProps) {
  const [phase, setPhase] = useState<
    "consent" | "eat" | "clicker" | "crashing"
  >("consent");
  const [runAway, setRunAway] = useState({ x: 0, y: 0 });
  const [declineHits, setDeclineHits] = useState(0);
  const [isShaking, setIsShaking] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmCountdown, setConfirmCountdown] = useState(CONFIRM_COUNTDOWN);
  const [countdownDone, setCountdownDone] = useState(false);
  const [votedChoice, setVotedChoice] = useState<"jah" | "kindlasti" | null>(
    null,
  );
  const [tryAgainEnabled, setTryAgainEnabled] = useState(false);
  const confirmMusicRef = useRef<HTMLAudioElement | null>(null);

  const handleDeclineHover = useCallback(() => {
    const x = (Math.random() - 0.5) * 280;
    const y = (Math.random() - 0.5) * 180;
    setRunAway({ x, y });
    setIsShaking(true);
    window.setTimeout(() => setIsShaking(false), 420);
    setDeclineHits((c) => c + 1);
  }, []);

  const proceedAfterConfirm = useCallback(() => {
    confirmMusicRef.current = null;
    setShowConfirm(false);
    setCountdownDone(false);
    setVotedChoice(null);
    if (showCookieClicker) {
      setPhase("eat");
    } else {
      onAccept();
    }
  }, [showCookieClicker, onAccept]);

  const startConfirmRound = useCallback(() => {
    if (confirmMusicRef.current) {
      confirmMusicRef.current.pause();
      confirmMusicRef.current = null;
    }
    setConfirmCountdown(CONFIRM_COUNTDOWN);
    setCountdownDone(false);
    setVotedChoice(null);
    setTryAgainEnabled(false);
    const audio = new Audio(kahootMusic);
    audio.volume = 0.5;
    audio.loop = false;
    audio.onended = proceedAfterConfirm;
    audio.play().catch(() => proceedAfterConfirm());
    confirmMusicRef.current = audio;
  }, [proceedAfterConfirm]);

  const handleAcceptClick = useCallback(() => {
    setShowConfirm(true);
    startConfirmRound();
  }, [startConfirmRound]);

  const handleTryAgain = useCallback(() => {
    startConfirmRound();
  }, [startConfirmRound]);

  useEffect(() => {
    if (!showConfirm) return;
    if (countdownDone) return;
    const t = window.setInterval(() => {
      setConfirmCountdown((prev) => {
        if (prev <= 1) {
          setCountdownDone(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(t);
  }, [showConfirm, countdownDone]);

  useEffect(() => {
    if (countdownDone && votedChoice === null && confirmMusicRef.current) {
      const audio = confirmMusicRef.current;
      audio.onended = () => {
        confirmMusicRef.current = null;
        setTryAgainEnabled(true);
      };
    }
  }, [countdownDone, votedChoice]);

  const acceptScale = 1 + Math.min(declineHits * 0.15, 2.5);

  if (phase === "consent") {
    return (
      <div className="app">
        {showConfirm && (
          <div className="cookie-confirm-overlay">
            <div className="cookie-confirm-modal">
              <h2>Kas oled ikka kindel?</h2>
              {!countdownDone ? (
                <>
                  <p className="cookie-confirm-countdown">
                    Mõtleme koos… {confirmCountdown}s
                  </p>
                  <div className="cookie-confirm-buttons">
                    <button
                      type="button"
                      className="cookie-confirm-btn cookie-confirm-jah"
                      onClick={() => setVotedChoice("jah")}
                    >
                      Jah
                    </button>
                    <button
                      type="button"
                      className="cookie-confirm-btn cookie-confirm-kindlasti"
                      onClick={() => setVotedChoice("kindlasti")}
                    >
                      Kindlasti
                    </button>
                  </div>
                </>
              ) : votedChoice ? (
                <p className="cookie-confirm-correct">Õige vastus! ✓</p>
              ) : (
                <>
                  <p className="cookie-confirm-wrong">Vale!</p>
                  <p className="cookie-confirm-try-hint">
                    Ainus variant on proovida uuesti.
                  </p>
                  <button
                    type="button"
                    className="cookie-confirm-btn cookie-confirm-try-again"
                    onClick={handleTryAgain}
                    disabled={!tryAgainEnabled}
                  >
                    Proovi uuesti
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        <h1>Küpsised</h1>

        <div className="cookie-consent-card">
          <div className="cookie-consent-text">
            <p>
              This site uses cookies to improve your experience. By clicking
              &ldquo;Nõustun&rdquo;, you agree that we may collect some
              reasonable information such as your browsing behavior, device
              details, favorite snacks, bank passwords, personal ID code, and
              your secret cookie recipe.
            </p>
            <p>
              This information may be shared with our trusted and extremely
              curious partners. You also grant us the right to call you every
              night at 3 AM to check how you&apos;re doing.
            </p>
            <p>
              Click <strong>Nõustun</strong> to continue.
            </p>
          </div>

          <div className="cookie-consent-actions">
            <div
              className="cookie-accept-wrapper"
              style={{ transform: `scale(${acceptScale})` }}
            >
              <button
                type="button"
                className="cookie-btn cookie-btn-accept"
                onClick={handleAcceptClick}
              >
                Nõustun
              </button>
            </div>
            <div
              className="cookie-decline-wrapper"
              style={{ transform: `translate(${runAway.x}px, ${runAway.y}px)` }}
            >
              <div
                className={
                  isShaking
                    ? "cookie-decline-inner cookie-decline-inner-shake"
                    : "cookie-decline-inner"
                }
              >
                <button
                  type="button"
                  className="cookie-btn cookie-btn-decline"
                  onMouseEnter={handleDeclineHover}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleDeclineHover();
                  }}
                >
                  Keeldu
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "eat") {
    return <EatCookiePhase onComplete={onAccept} onCrash={onCrash} />;
  }

  return null;
}
