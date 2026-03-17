type WheelProps = {
  rotation: number;
  isSpinning: boolean;
  isLoadingTime: boolean;
  onSpin: () => void;
  options?: number[];
};

export function Wheel({
  rotation,
  isSpinning,
  isLoadingTime,
  onSpin,
  options = [5, 10, 30, 60],
}: WheelProps) {
  const [top, right, bottom, left] = options;
  return (
    <div className="wheel-wrapper">
      {/* fixed pointer at the top, points down */}
      <div className="pointer" />

      {/* spinning wheel */}
      <div className="wheel" style={{ transform: `rotate(${rotation}deg) translateZ(0)` }}>
        {/* sector labels – rotate together with the wheel */}
        <div className="wheel-label wheel-label-top">{top}s</div>
        <div className="wheel-label wheel-label-right">{right}s</div>
        <div className="wheel-label wheel-label-bottom">{bottom}s</div>
        <div className="wheel-label wheel-label-left">{left}s</div>
      </div>

      {/* center button on top of the wheel – does not rotate */}
      <button
        className="center-button"
        onClick={onSpin}
        disabled={isSpinning || isLoadingTime}
      >
        {isSpinning ? "..." : "SPINNI"}
      </button>
    </div>
  );
}
