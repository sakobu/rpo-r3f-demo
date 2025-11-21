import { useEffect, useRef } from "react";
import { useControls, button, folder } from "leva";
import { type Vector3 } from "rpo-suite";

export type ManeuverParams = {
  targetPosition: Vector3;
  transferTime: number;
};

export const useManeuverControls = (
  onExecute: (params: ManeuverParams) => void
) => {
  const onExecuteRef = useRef(onExecute);

  useEffect(() => {
    onExecuteRef.current = onExecute;
  }, [onExecute]);

  const [values] = useControls(() => ({
    "Maneuver Planner": folder(
      {
        targetRadial: {
          label: "Target Radial (m)",
          value: 0,
          step: 1,
        },
        targetInTrack: {
          label: "Target In-Track (m)",
          value: 100,
          step: 1,
        },
        targetCrossTrack: {
          label: "Target Cross-Track (m)",
          value: 0,
          step: 1,
        },
        transferTime: {
          label: "Transfer Time (s)",
          value: 1000,
          min: 10,
          max: 10000,
          step: 10,
        },
        "Execute Burn": button((get) => {
          const targetPosition: Vector3 = [
            get("Maneuver Planner.targetRadial"),
            get("Maneuver Planner.targetInTrack"),
            get("Maneuver Planner.targetCrossTrack"),
          ];
          const transferTime = get("Maneuver Planner.transferTime");

          onExecuteRef.current({ targetPosition, transferTime });
        }),
      },
      { collapsed: true }
    ),
  }));

  return values;
};
