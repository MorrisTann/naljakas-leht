import { useState } from "react";

type SuccessPageProps = {
  balance: number;
};

export function SuccessPage({ balance }: SuccessPageProps) {
  const [eiFlying, setEiFlying] = useState(false);
  const [eiGone, setEiGone] = useState(false);
  const [answeredJah, setAnsweredJah] = useState(false);
  const [showBlackScreen, setShowBlackScreen] = useState(false);

  const handleEiClick = () => {
    if (eiFlying || eiGone) return;
    setEiFlying(true);
    setTimeout(() => {
      setEiGone(true);
      setEiFlying(false);
    }, 3600);
  };

  const showDonationQuestion = !answeredJah;

  return (
    <div className="app success-page">
      <h1>Leht on lõpuks laaditud!</h1>
      <p className="success-saldo">Saldo: {answeredJah ? 0 : balance} €</p>
      {showDonationQuestion && (
        <>
          <p className="success-donation-question">
            Kas annetad kogu oma saldo kirikule?
          </p>
          <div className="success-donation-buttons">
            <button
              type="button"
              className="success-btn success-btn-jah"
              onClick={() => setAnsweredJah(true)}
            >
              Jah
            </button>
            <div
              className={`success-ei-wrapper ${eiGone ? "success-ei-wrapper-gone" : ""}`}
            >
              <button
                type="button"
                className={`success-btn success-btn-ei ${
                  eiFlying ? "success-btn-ei-flying" : ""
                }`}
                onClick={handleEiClick}
                disabled={eiFlying}
              >
                Ei
              </button>
            </div>
          </div>
        </>
      )}

      {answeredJah && (
        <>
          <p className="success-thanks">Aitäh annetuse eest!</p>
          <button
            type="button"
            className="success-btn success-btn-spin"
            onClick={() => {
              setShowBlackScreen(true);
              window.close();
            }}
          >
            Mine nüüd ära
          </button>
        </>
      )}

      {showBlackScreen && <div className="success-black-screen" aria-hidden="true" />}
    </div>
  );
}
