import { ORBITAL_PARAMS } from "../config/orbital";

type StatsProps = {
  readonly distance: number;
  readonly speed: number;
  readonly elapsedTime: number;
  readonly isPlaying: boolean;
};

export function Stats({ distance, speed, elapsedTime, isPlaying }: StatsProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: "10px",
        left: "10px",
        background: "rgba(0,0,0,0.8)",
        color: "#00ff00",
        padding: "15px",
        fontFamily: "monospace",
        fontSize: "14px",
        borderRadius: "5px",
        minWidth: "200px",
      }}
    >
      <div
        style={{ marginBottom: "8px", color: "#00ffff", fontWeight: "bold" }}
      >
        {isPlaying ? "RUNNING" : "PAUSED"}
      </div>
      <div>Distance: {distance.toFixed(1)} m</div>
      <div>Speed: {speed.toFixed(3)} m/s</div>
      <div>Time: {(elapsedTime / 60).toFixed(1)} min</div>
      <div>Orbit: {(elapsedTime / ORBITAL_PARAMS.period).toFixed(2)}</div>
    </div>
  );
}
