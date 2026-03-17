import { useEffect, useRef, useState } from "react";
import { Wheel } from "./components/Wheel";
import { FakeCaptchaCard } from "./components/FakeCaptchaCard";
import { BlackjackGame } from "./components/BlackjackGame";
import { CookieConsent } from "./components/CookieConsent";
import { EatCookiePhase } from "./components/EatCookiePhase";
import { CelebrationOverlay } from "./components/CelebrationOverlay";
import { SuccessPage } from "./components/SuccessPage";
import { loadAdminConfig, isAdminMode } from "./lib/adminConfig";
import { playTickSound, resumeAudioContext } from "./lib/audioUtils";
import { AdminPanel, type FlowStepForAdmin } from "./components/AdminPanel";
import type { AdminConfig } from "./lib/adminConfig";
import "./App.css";

const options = [5, 10, 30, 60];

type FlowStep =
  | "idle"
  | "spinning"
  | "celebration"
  | "loading"
  | "captcha"
  | "blackjack"
  | "cookies"
  | "cookiesClicker"
  | "success";

function getNextStep(current: FlowStep, config: AdminConfig): FlowStep {
  switch (current) {
    case "loading":
      if (config.showCaptcha) return "captcha";
      if (config.showBlackjack) return "blackjack";
      if (config.showCookies) return "cookies";
      return "success";
    case "captcha":
      if (config.showBlackjack) return "blackjack";
      if (config.showCookies) return "cookies";
      return "success";
    case "blackjack":
      if (config.showCookies) return "cookies";
      return "success";
    case "cookies":
      return "success";
    case "cookiesClicker":
      return "success";
    default:
      return "success";
  }
}

function App() {
  const [adminConfig, setAdminConfig] = useState<AdminConfig>(loadAdminConfig);
  const [isSpinning, setIsSpinning] = useState(false);
  const [selectedSeconds, setSelectedSeconds] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const [introStep, setIntroStep] = useState<0 | 1 | 2>(() =>
    loadAdminConfig().showIntro ? 0 : 2,
  );
  const [step, setStep] = useState<FlowStep>("idle");
  const [showCrashMessage, setShowCrashMessage] = useState(false);
  const [balance, setBalance] = useState(0);

  const frameIdRef = useRef<number | null>(null);
  const lastSectorRef = useRef<number>(0);


  function handleSpin() {
    resumeAudioContext();
    if (
      isSpinning ||
      step === "celebration" ||
      step === "loading" ||
      step === "captcha" ||
      step === "blackjack" ||
      step === "cookies" ||
      step === "cookiesClicker"
    )
      return;

    // reset state
    setStep("spinning");
    setSelectedSeconds(null);
    setRemainingSeconds(null);
    setRotation(0);

    const index = Math.floor(Math.random() * options.length);

    // Pointer is at the top. Sector centers in wheel coordinates: 0°, 90°, 180°, 270°.
    // To bring a sector center under the pointer we rotate the wheel: 0, -90, -180, -270.
    const sectorCenters = [0, -90, -180, -270];

    // Allow the wheel to stop close to sector borders but stay inside
    // the same sector: ±40° < 45° (half of 90° sector).
    const jitter = Math.random() * 80 - 40; // -40 ... +40 degrees

    const spins = 4 + Math.floor(Math.random() * 3);
    const finalAngle = spins * 360 + sectorCenters[index] + jitter;

    setIsSpinning(true);

    const duration = 3000; // ms
    const start = performance.now();
    const startAngle = 0;
    lastSectorRef.current = Math.floor((startAngle - 45) / 90);

    const animate = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      // ease-out
      const ease = 1 - Math.pow(1 - t, 3);
      const current = startAngle + (finalAngle - startAngle) * ease;

      const sector = Math.floor((current - 45) / 90);
      if (sector !== lastSectorRef.current) {
        lastSectorRef.current = sector;
        playTickSound();
      }

      setRotation(current);

      if (t < 1) {
        frameIdRef.current = requestAnimationFrame(animate);
      } else {
        setIsSpinning(false);
        // Pointer is at the top; wheel rotation R means angle -R is under the pointer
        const wheelAngleUnderPointer = ((-finalAngle % 360) + 360) % 360;
        const sectorIndex =
          wheelAngleUnderPointer <= 45 || wheelAngleUnderPointer > 315
            ? 0
            : wheelAngleUnderPointer <= 135
              ? 1
              : wheelAngleUnderPointer <= 225
                ? 2
                : 3;
        const landedSeconds = options[sectorIndex];
        setSelectedSeconds(landedSeconds);
        setStep("celebration");
        setTimeout(() => {
          setStep("loading");
          setRemainingSeconds(landedSeconds);
        }, 2500);
      }
    };

    frameIdRef.current = requestAnimationFrame(animate);
  }

  // Clean up animation frame on unmount
  useEffect(() => {
    return () => {
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
      }
    };
  }, []);

  // Clear crash message after delay
  useEffect(() => {
    if (!showCrashMessage) return;
    const t = setTimeout(() => setShowCrashMessage(false), 4500);
    return () => clearTimeout(t);
  }, [showCrashMessage]);

  // Intro text sequence on first load (kui showIntro)
  useEffect(() => {
    if (!adminConfig.showIntro) return;
    const t = setTimeout(() => setIntroStep(2), 2600);
    return () => clearTimeout(t);
  }, [adminConfig.showIntro]);

  // countdown logic
  useEffect(() => {
    if (step !== "loading") return;
    if (remainingSeconds === null) return;
    const timer = setTimeout(() => {
      setRemainingSeconds((prev) => {
        if (prev === null) return null;

        if (prev <= 1) {
          setStep(getNextStep("loading", adminConfig));
          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [remainingSeconds, step, adminConfig]);

  const showAdmin = isAdminMode();
  const goToStep = (s: FlowStepForAdmin) => {
    setStep(s);
    if (s === "loading") {
      setSelectedSeconds(3);
      setRemainingSeconds(3);
    }
  };

  const adminPanel = showAdmin ? (
    <AdminPanel
      config={adminConfig}
      onConfigChange={setAdminConfig}
      onGoToStep={goToStep}
    />
  ) : null;

  // 0. intro screens (vaata ainult kui showIntro)
  if (adminConfig.showIntro && introStep === 0) {
    return (
      <>
        {adminPanel}
        <div className="app">
          <h1 className="intro-text intro-text-1">Tere tulemast sõber!</h1>
        </div>
      </>
    );
  }

  // final loaded content
  if (step === "success") {
    return (
      <>
        {adminPanel}
        <SuccessPage balance={balance} />
      </>
    );
  }

  if (step === "celebration" && selectedSeconds !== null) {
    return (
      <>
        {adminPanel}
        <CelebrationOverlay seconds={selectedSeconds} />
      </>
    );
  }

  // blank loading page with countdown
  if (step === "loading") {
    return (
      <>
        {adminPanel}
        <div className="app">
          <h1>Leht laeb. Ole kannatlik!</h1>
          {selectedSeconds && <p>Kokku laeb: {selectedSeconds} sekundit.</p>}
          <div className="loading-dots" aria-label="Laeb">
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
          </div>
          <p className="countdown">Jäänud: {remainingSeconds}s</p>
        </div>
      </>
    );
  }

  // fake captcha verification gate
  if (step === "captcha") {
    return (
      <>
        {adminPanel}
        <FakeCaptchaCard
          onVerified={() => setStep(getNextStep("captcha", adminConfig))}
        />
      </>
    );
  }

  // blackjack verification gate (must win)
  if (step === "blackjack") {
    return (
      <>
        {adminPanel}
        <BlackjackGame
          onWin={(bal) => {
            setBalance(bal);
            setStep(getNextStep("blackjack", adminConfig));
          }}
          onSkipToCaptcha={() => setStep("captcha")}
        />
      </>
    );
  }

  // küpsiste nõustumine
  if (step === "cookies") {
    return (
      <>
        {adminPanel}
        <CookieConsent
          showCookieClicker={adminConfig.showCookieClicker}
          onAccept={() => setStep("success")}
          onCrash={() => {
            setStep("idle");
            setShowCrashMessage(true);
          }}
        />
      </>
    );
  }

  // Cookie Clicker (otse, ilma consentita)
  if (step === "cookiesClicker") {
    return (
      <>
        {adminPanel}
        <EatCookiePhase
          onComplete={() => setStep("success")}
          onCrash={() => {
            setStep("idle");
            setShowCrashMessage(true);
          }}
        />
      </>
    );
  }

  // wheel screen
  return (
    <>
      {adminPanel}
      {showCrashMessage && (
        <div className="crash-message-overlay" role="alert">
          <p className="crash-message-title">Liiga palju küpsiseid</p>
          <p className="crash-message-sub">Tagasi ratta juurde…</p>
        </div>
      )}
      <div className="app">
        <h1>Lehe laadimisaja õnneratas!</h1>
        <Wheel
          rotation={rotation}
          isSpinning={isSpinning}
          isLoadingTime={false}
          onSpin={handleSpin}
          options={options}
        />
        <p>Võimalikud ajad: 5, 10, 30, 60 sekundit</p>
      </div>
    </>
  );
}

export default App;
