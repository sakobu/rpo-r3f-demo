import { ORBITAL_PARAMS } from "../config/orbital";

export function SimulationInfo() {
  const { elements, period, semiMajorAxis } = ORBITAL_PARAMS;
  const { eccentricity, gravitationalParameter } = elements;

  const earthRadius = 6371000;
  const altitude = semiMajorAxis - earthRadius;

  return (
    <div
      style={{
        position: "absolute",
        bottom: "10px",
        left: "10px",
        background: "rgba(0,0,0,0.8)",
        color: "#cccccc",
        padding: "15px",
        fontFamily: "monospace",
        fontSize: "12px",
        borderRadius: "5px",
        pointerEvents: "none",
        userSelect: "none",
        minWidth: "200px",
      }}
    >
      <div
        style={{ marginBottom: "8px", color: "#ffffff", fontWeight: "bold" }}
      >
        SIMULATION PARAMETERS
      </div>
      <div style={{ marginBottom: "4px", color: "#aaaaaa" }}>
        -- Chief Orbit --
      </div>
      <div>Semi-major Axis: {(semiMajorAxis / 1000).toFixed(1)} km</div>
      <div>Altitude: {(altitude / 1000).toFixed(1)} km</div>
      <div>Eccentricity: {eccentricity}</div>
      <div>Period: {(period / 60).toFixed(1)} min</div>

      <div style={{ marginTop: "8px", marginBottom: "4px", color: "#aaaaaa" }}>
        -- Constants --
      </div>
      <div>Mu: {gravitationalParameter.toExponential(3)} m^3/s^2</div>
    </div>
  );
}
