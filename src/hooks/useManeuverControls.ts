import { useEffect, useRef } from "react";
import { useControls, button, folder } from "leva";
import { type Vector3 } from "rpo-suite";
import { type ManeuverParams } from "../types/simulation";

export const useManeuverControls = (
  onExecute: (params: ManeuverParams) => void
) => {
  const onExecuteRef = useRef(onExecute);

  useEffect(() => {
    onExecuteRef.current = onExecute;
  }, [onExecute]);

  const [values, set] = useControls(() => ({
    "Maneuver Planner": folder(
      {
        targetRadial: {
          label: "Target Radial (m)",
          value: 0,
          min: -4000,
          max: 4000,
          step: 1,
        },
        targetInTrack: {
          label: "Target In-Track (m)",
          value: 500,
          min: -6000,
          max: 6000,
          step: 1,
        },
        targetCrossTrack: {
          label: "Target Cross-Track (m)",
          value: 0,
          min: -2000,
          max: 2000,
          step: 1,
        },
        transferTime: {
          label: "Transfer Time (s)",
          value: 1000,
          min: 10,
          max: 10000,
          step: 10,
        },

        fmc: {
          label: "FMC (Forced Motion)",
          value: false,
        },
        "Execute Burn": button((get) => {
          const targetPosition: Vector3 = [
            get("Maneuver Planner.targetRadial"),
            get("Maneuver Planner.targetInTrack"),
            get("Maneuver Planner.targetCrossTrack"),
          ];
          const transferTime = get("Maneuver Planner.transferTime");
          const fmc = get("Maneuver Planner.fmc");

          onExecuteRef.current({ targetPosition, transferTime, fmc });
        }),
      },
      { collapsed: true }
    ),
  }));

  return { ...values, setValues: set };
};
