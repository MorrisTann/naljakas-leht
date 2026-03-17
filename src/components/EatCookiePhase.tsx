import { useCallback, useEffect, useRef, useState } from "react";

import crashpilt from "../assets/crashpilt.png";
import error1 from "../assets/error1.jpg";
import error2 from "../assets/error2.jpg";
import error3 from "../assets/error3.png";
import error4 from "../assets/error4.png";
import error5 from "../assets/error5.png";
import biteSound from "../assets/Bite sound effect.mp3";
import xpErrorSound from "../assets/Windows XP Error Sound.mp3";
import multibleErrorSound from "../assets/multible_error_sounds.mp3";
import shutdownSound from "../assets/shutdown.mp3";
import { loadSound, playSound, playSoundWithCallback } from "../lib/audioUtils";
import shutdownImg from "../assets/shutdown.png";

const CRASH_POPUP_IMAGES = [error1, error2, error3, error4, error5] as const;

type CrashPopup = {
  id: number;
  src: string;
  x: number;
  y: number;
};

type FloatingCookie = {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
};

type EatCookiePhaseProps = {
  onComplete: () => void;
  onCrash: () => void;
};

function CookieEmoji({ size = 48 }: { size?: number }) {
  return (
    <span
      className="cookie-emoji"
      style={{ fontSize: size }}
      role="img"
      aria-label="küpsis"
    >
      🍪
    </span>
  );
}

const COOKIES_NEEDED = 20;

function playBiteSound() {
  playSound(biteSound, 0.6);
}

function playCookieSpawnSound() {
  try {
    const ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext
    )();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 440;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  } catch {
    /* ignore */
  }
}

export function EatCookiePhase({ onComplete, onCrash }: EatCookiePhaseProps) {
  const [bigCookieEaten, setBigCookieEaten] = useState(false);
  const [floatingCookies, setFloatingCookies] = useState<FloatingCookie[]>([]);
  const [cookiesEaten, setCookiesEaten] = useState(0);
  const [isCrashing, setIsCrashing] = useState(false);
  const [crashPopups, setCrashPopups] = useState<CrashPopup[]>([]);
  const [showShutdownOverlay, setShowShutdownOverlay] = useState(false);
  const [showJatkaHint, setShowJatkaHint] = useState(false);
  const [boxPos, setBoxPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const nextIdRef = useRef(0);
  const crashPopupIdRef = useRef(0);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      startPosX: boxPos.x,
      startPosY: boxPos.y,
    };
  }, [boxPos]);

  useEffect(() => {
    if (!dragRef.current) return;
    const onMove = (clientX: number, clientY: number) => {
      const d = dragRef.current;
      if (!d) return;
      setBoxPos({
        x: d.startPosX + clientX - d.startX,
        y: d.startPosY + clientY - d.startY,
      });
    };
    const handleMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const handleMouseUp = () => { dragRef.current = null; };
    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const handleTouchEnd = () => { dragRef.current = null; };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  useEffect(() => {
    loadSound(biteSound).catch(() => {});
    loadSound(xpErrorSound).catch(() => {});
    loadSound(multibleErrorSound).catch(() => {});
    loadSound(shutdownSound).catch(() => {});
  }, []);

  const addCrashPopup = useCallback((img?: string) => {
    const src =
      img ??
      CRASH_POPUP_IMAGES[Math.floor(Math.random() * CRASH_POPUP_IMAGES.length)];
    setCrashPopups((prev) => [
      ...prev,
      {
        id: crashPopupIdRef.current++,
        src,
        x: 5 + Math.random() * 70,
        y: 5 + Math.random() * 60,
      },
    ]);
  }, []);

  const spawnCookies = useCallback((count: number) => {
    for (let i = 0; i < count; i++) {
      setTimeout(playCookieSpawnSound, i * 80);
    }
    const newCookies: FloatingCookie[] = [];
    for (let i = 0; i < count; i++) {
      newCookies.push({
        id: nextIdRef.current++,
        x: 15 + Math.random() * 70,
        y: 5 + Math.random() * 40,
        rotation: (Math.random() - 0.5) * 60,
        scale: 0.6 + Math.random() * 0.6,
      });
    }
    setFloatingCookies((prev) => [...prev, ...newCookies]);
  }, []);

  const eatFloatingCookie = useCallback((id: number) => {
    playBiteSound();
    setFloatingCookies((prev) => prev.filter((c) => c.id !== id));
    setCookiesEaten((n) => n + 1);
  }, []);

  const handleAcceptAll = useCallback(() => {
    setCrashPopups([]);
    setShowShutdownOverlay(false);
    setIsCrashing(true);

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onCrash();
    };

    addCrashPopup(CRASH_POPUP_IMAGES[0]);

    playSoundWithCallback(xpErrorSound, () => {
      const interval = 120;
      const timeouts: number[] = [];
      for (let round = 0; round < 5; round++) {
        for (let i = 0; i < CRASH_POPUP_IMAGES.length; i++) {
          timeouts.push(
            window.setTimeout(
              () =>
                setCrashPopups((prev) => [
                  ...prev,
                  {
                    id: crashPopupIdRef.current++,
                    src: CRASH_POPUP_IMAGES[i],
                    x: 5 + Math.random() * 70,
                    y: 5 + Math.random() * 60,
                  },
                ]),
              (round * CRASH_POPUP_IMAGES.length + i) * interval,
            ) as unknown as number,
          );
        }
      }
      playSoundWithCallback(multibleErrorSound, () => {
        timeouts.forEach((t) => clearTimeout(t));
        setShowShutdownOverlay(true);
        playSoundWithCallback(shutdownSound, finish, 0.6);
      }, 0.6);
    }, 0.6);
    window.setTimeout(finish, 15000);
  }, [onCrash, addCrashPopup]);

  if (isCrashing) {
    return (
      <div className="app cookie-crash-container">
        <div className="cookie-crash-overlay" aria-hidden="true">
          <img
            src={crashpilt}
            alt=""
            className="cookie-crash-main-img"
            aria-hidden
          />
          {crashPopups.map((p) => (
            <img
              key={p.id}
              src={p.src}
              alt=""
              className="cookie-crash-popup-img"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
              }}
              aria-hidden
            />
          ))}
        </div>
        {showShutdownOverlay && (
          <img
            src={shutdownImg}
            alt=""
            className="cookie-crash-shutdown-overlay"
            aria-hidden
          />
        )}
      </div>
    );
  }

  return (
    <div className="app cookie-game-container">
      <h1>Küpsised</h1>
      <p className="cookie-game-hint">
        Palun, siin on sinu küpsis! Kui soovid rohkem, siis kliki allolevatel
        nuppudel.
      </p>

      <div className="cookie-game-area">
        {!bigCookieEaten && (
          <button
            type="button"
            className="cookie-big-cookie"
            onClick={() => {
              playBiteSound();
              setBigCookieEaten(true);
              setCookiesEaten((n) => n + 1);
            }}
            aria-label="Söö küpsise ära"
          >
            <CookieEmoji size={120} />
          </button>
        )}

        {floatingCookies.map((c) => (
          <button
            key={c.id}
            type="button"
            className="cookie-floating cookie-floating-clickable"
            style={{
              left: `${c.x}%`,
              top: `${c.y}%`,
              transform: `rotate(${c.rotation}deg) scale(${c.scale})`,
            }}
            onClick={() => eatFloatingCookie(c.id)}
            aria-label="Söö küpsise ära"
          >
            <span className="cookie-floating-emoji">
              <CookieEmoji size={40} />
            </span>
          </button>
        ))}
      </div>

      <div
        className="cookie-clicker-buttons"
        style={{
          transform: `translate(calc(-50% + ${boxPos.x}px), ${boxPos.y}px)`,
        }}
      >
        <div
          className="cookie-clicker-drag-handle"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleDragStart(e as unknown as React.MouseEvent);
          }}
          aria-label="Tõmba kasti liigutamiseks"
        >
          ⋮⋮
        </div>
        <button
          type="button"
          className="cookie-clicker-btn"
          onClick={() => spawnCookies(1)}
        >
          Nõustun küpsisega
        </button>
        <button
          type="button"
          className="cookie-clicker-btn"
          onClick={() => spawnCookies(2)}
        >
          Nõustun rohkemate küpsistega
        </button>
        <button
          type="button"
          className="cookie-clicker-btn"
          onClick={() => spawnCookies(3)}
        >
          Nõustun veel rohkemate küpsistega
        </button>
        <button
          type="button"
          className="cookie-clicker-btn"
          onClick={handleAcceptAll}
        >
          Nõustun KÕIGI küpsistega
        </button>
        <div className="cookie-jatka-row">
          {showJatkaHint && (
            <p className="cookie-jatka-hint cookie-jatka-hint-fade">
              Jätkamiseks söö {COOKIES_NEEDED} küpsist. Söödud: {cookiesEaten}
            </p>
          )}
          <button
            type="button"
            className="cookie-clicker-btn cookie-clicker-btn-success"
            onClick={() => {
              if (cookiesEaten >= COOKIES_NEEDED) {
                onComplete();
              } else {
                setShowJatkaHint(true);
              }
            }}
            disabled={showJatkaHint && cookiesEaten < COOKIES_NEEDED}
          >
            Jätka
          </button>
        </div>
      </div>
    </div>
  );
}
