import { useCallback, useEffect, useMemo, useState } from "react";

import laughSound from "../assets/crowd of laughter sound effect.mp3";
import { playCardDealSound, resumeAudioContext } from "../lib/audioUtils";

type BlackjackGameProps = {
  onWin: (balance: number) => void;
  onSkipToCaptcha: () => void;
};

const BET_OPTIONS = [5, 10, 25, 50] as const;

type Suit = "♠" | "♥" | "♦" | "♣";
type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";
type Card = { suit: Suit; rank: Rank };

type RoundState = "playing" | "dealer_turn" | "win" | "lose" | "push";

/** Card with deal order for staggered animation */
type DealtCard = { card: Card; dealOrder: number };

const suits: Suit[] = ["♠", "♥", "♦", "♣"];
const ranks: Rank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

const DEAL_STAGGER_MS = 180;

function playLaughSound(onEnded?: () => void) {
  try {
    const audio = new Audio(laughSound);
    audio.volume = 0.6;
    if (onEnded) audio.onended = onEnded;
    audio.play().catch(() => onEnded?.());
  } catch {
    onEnded?.();
  }
}

function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const s of suits) for (const r of ranks) deck.push({ suit: s, rank: r });
  return deck;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cardValue(rank: Rank): number[] {
  if (rank === "A") return [1, 11];
  if (rank === "K" || rank === "Q" || rank === "J") return [10];
  return [parseInt(rank, 10)];
}

function bestHandValue(hand: Card[]): {
  best: number;
  isSoft: boolean;
  all: number[];
} {
  // Compute all possible totals, then pick the best <=21, else smallest bust.
  let totals = [0];
  for (const c of hand) {
    const vals = cardValue(c.rank);
    const next: number[] = [];
    for (const t of totals) for (const v of vals) next.push(t + v);
    totals = next;
  }
  totals = Array.from(new Set(totals)).sort((a, b) => a - b);
  const under = totals.filter((t) => t <= 21);
  const best = under.length ? under[under.length - 1] : totals[0];
  const isSoft =
    hand.some((c) => c.rank === "A") &&
    totals.includes(best) &&
    totals.includes(best - 10);
  return { best, isSoft, all: totals };
}

function isBlackjack(hand: Card[]): boolean {
  if (hand.length !== 2) return false;
  const { best } = bestHandValue(hand);
  return best === 21;
}

function suitColor(suit: Suit): "red" | "black" {
  return suit === "♥" || suit === "♦" ? "red" : "black";
}

const STARTING_BALANCE = 0;

export function BlackjackGame({ onWin, onSkipToCaptcha }: BlackjackGameProps) {
  const [phase, setPhase] = useState<"bet" | "play" | "rott">("bet");
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [bet, setBet] = useState<number | null>(null);
  const [deck, setDeck] = useState<Card[]>(() => shuffle(makeDeck()));
  const [player, setPlayer] = useState<DealtCard[]>([]);
  const [dealer, setDealer] = useState<DealtCard[]>([]);
  const [round, setRound] = useState<RoundState>("playing");
  const [revealDealer, setRevealDealer] = useState(false);

  const playerCards = useMemo(() => player.map((dc) => dc.card), [player]);
  const dealerCards = useMemo(() => dealer.map((dc) => dc.card), [dealer]);
  const playerValue = useMemo(() => bestHandValue(playerCards), [playerCards]);
  const dealerValue = useMemo(() => bestHandValue(dealerCards), [dealerCards]);

  const draw = useCallback(
    (n: number): Card[] => {
      const drawn = deck.slice(0, n);
      const rest = deck.slice(n);
      setDeck(rest.length < 15 ? shuffle(makeDeck()) : rest);
      return drawn;
    },
    [deck],
  );

  function placeBet(amount: number) {
    resumeAudioContext();
    setBet(amount);
    setTimeout(() => {
      const freshDeck = deck.length < 10 ? shuffle(makeDeck()) : deck;
      if (freshDeck !== deck) setDeck(freshDeck);

      const d0 = freshDeck[0];
      const d1 = freshDeck[1];
      const p0 = freshDeck[2];
      const p1 = freshDeck[3];
      const rest = freshDeck.slice(4);
      setDeck(rest.length < 15 ? shuffle(makeDeck()) : rest);
      setPlayer([
        { card: p0, dealOrder: 1 },
        { card: p1, dealOrder: 3 },
      ]);
      setDealer([
        { card: d0, dealOrder: 0 },
        { card: d1, dealOrder: 2 },
      ]);
      setRevealDealer(false);
      setRound("playing");
      setPhase("play");

      for (let i = 0; i < 4; i++) {
        setTimeout(playCardDealSound, i * DEAL_STAGGER_MS);
      }
    }, 0);
  }

  // Immediate blackjack checks on initial deal.
  useEffect(() => {
    if (
      playerCards.length !== 2 ||
      dealerCards.length !== 2 ||
      round !== "playing"
    )
      return;
    const pBJ = isBlackjack(playerCards);
    const dBJ = isBlackjack(dealerCards);
    if (!pBJ && !dBJ) return;
    setRevealDealer(true);
    if (pBJ && !dBJ) {
      setRound("win");
      setBalance((b) => b + (bet ?? 0) * 2);
    } else if (!pBJ && dBJ) {
      setRound("lose");
      setBalance((b) => b - (bet ?? 0));
    } else setRound("push");
  }, [dealerCards, playerCards, round, bet]);

  // Bust check while playing (player only).
  useEffect(() => {
    if (round !== "playing") return;
    if (player.length < 2) return;
    if (playerValue.best > 21) {
      setRound("lose");
      setBalance((b) => b - (bet ?? 0));
    }
  }, [player.length, playerValue.best, round, bet]);

  // Dealer turn automation.
  useEffect(() => {
    if (round !== "dealer_turn") return;
    setRevealDealer(true);

    const step = () => {
      const { best } = bestHandValue(dealerCards);
      if (best < 17) {
        playCardDealSound();
        const [c] = draw(1);
        const order = dealer.length + player.length;
        setDealer((prev) => [...prev, { card: c, dealOrder: order }]);
        return;
      }

      const p = bestHandValue(playerCards).best;
      const d = bestHandValue(dealerCards).best;
      if (d > 21) {
        setRound("win");
        setBalance((b) => b + (bet ?? 0) * 2);
      } else if (p > 21) {
        setRound("lose");
        setBalance((b) => b - (bet ?? 0));
      } else if (p > d) {
        setRound("win");
        setBalance((b) => b + (bet ?? 0) * 2);
      } else if (p < d) {
        setRound("lose");
        setBalance((b) => b - (bet ?? 0));
      } else setRound("push");
    };

    const t = window.setTimeout(step, 450);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealer, dealerCards, player.length, playerCards, round, bet]);

  const canHit = round === "playing";
  const canStand = round === "playing";

  const statusText =
    round === "win"
      ? "Sa võitsid! Kinnitatud."
      : round === "lose"
        ? "Sa kaotasid. Proovi uuesti, kuni võidad."
        : round === "push"
          ? "Viik. Proovi uuesti, kuni võidad."
          : round === "dealer_turn"
            ? "Diiler mängib…"
            : "Võida blackjack, et jätkata.";

  if (phase === "rott") {
    return (
      <div className="app">
        <h1 className="bj-rott-title">Rott</h1>
      </div>
    );
  }

  if (phase === "bet") {
    return (
      <div className="app">
        <h1>Kinnita, et sa ei ole robot</h1>
        <p
        className={`bj-balance bj-balance-${
          balance > 0 ? "positive" : balance < 0 ? "negative" : "zero"
        }`}
      >
        Saldo: {balance} €
      </p>
        <p className="muted">Tee panus ja võida blackjack, et jätkata.</p>
        <div className="bj-bet-options">
          {BET_OPTIONS.map((amount) => (
            <button
              key={amount}
              type="button"
              className="bj-bet-btn"
              onClick={() => placeBet(amount)}
            >
              {amount} €
            </button>
          ))}
        </div>
        <button
          type="button"
          className="bj-skip-btn"
          onClick={() => {
            setPhase("rott");
            setTimeout(() => playLaughSound(onSkipToCaptcha), 400);
          }}
        >
          Mulle ei meeldi raha peale mängida
        </button>
      </div>
    );
  }

  return (
    <div className="app">
      <h1>Kinnita, et sa ei ole robot</h1>
      <p
        className={`bj-balance bj-balance-${
          balance > 0 ? "positive" : balance < 0 ? "negative" : "zero"
        }`}
      >
        Saldo: {balance} €
      </p>
      <p className="muted">{statusText}</p>

      <div className="bj-table">
        <div className="bj-hand">
          <div className="bj-hand-title">
            Diiler{" "}
            <span className="bj-score">
              {revealDealer ? dealerValue.best : "??"}
            </span>
          </div>
          <div className="bj-cards">
            {dealer.map((dc, i) => {
              const hidden = !revealDealer && i === 1 && round === "playing";
              return (
                <div
                  key={`d-${dc.dealOrder}-${dc.card.rank}${dc.card.suit}`}
                  className={`bj-card ${hidden ? "bj-card-back" : ""} bj-card-deal`}
                  style={{
                    animationDelay: `${dc.dealOrder * (DEAL_STAGGER_MS / 1000)}s`,
                  }}
                >
                  {!hidden && (
                    <span className={`bj-card-face ${suitColor(dc.card.suit)}`}>
                      {dc.card.rank}
                      {dc.card.suit}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bj-hand">
          <div className="bj-hand-title">
            Sinu käsi <span className="bj-score">{playerValue.best}</span>
            {playerValue.isSoft ? <span className="bj-soft">pehme</span> : null}
          </div>
          <div className="bj-cards">
            {player.map((dc) => (
              <div
                key={`p-${dc.dealOrder}-${dc.card.rank}${dc.card.suit}`}
                className="bj-card bj-card-deal"
                style={{
                  animationDelay: `${dc.dealOrder * (DEAL_STAGGER_MS / 1000)}s`,
                }}
              >
                <span className={`bj-card-face ${suitColor(dc.card.suit)}`}>
                  {dc.card.rank}
                  {dc.card.suit}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {bet !== null && (
        <p className="bj-bet-display">Panus: {bet} €</p>
      )}
      <div className="bj-actions">
        <button
          type="button"
          onClick={() => {
            const [c] = draw(1);
            playCardDealSound();
            const order = dealer.length + player.length;
            setPlayer((prev) => [...prev, { card: c, dealOrder: order }]);
          }}
          disabled={!canHit}
        >
          Hit
        </button>
        <button
          type="button"
          onClick={() => setRound("dealer_turn")}
          disabled={!canStand}
        >
          Stand
        </button>
        {(round === "lose" || round === "push") && (
          <button
            type="button"
            onClick={() => {
              setPhase("bet");
              setBet(null);
              setPlayer([]);
              setDealer([]);
              setDeck(shuffle(makeDeck()));
            }}
          >
            Proovi uuesti
          </button>
        )}
        {round === "win" && (
          <button type="button" onClick={() => onWin(balance)}>
            Jätka
          </button>
        )}
      </div>
    </div>
  );
}
