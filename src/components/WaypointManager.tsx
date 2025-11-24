import { type Waypoint as WaypointType } from "../types/waypoint";
import { type Vector3 } from "rpo-suite";
import { Waypoint } from "./Waypoint";

type WaypointManagerProps = {
  waypoints: WaypointType[];
  onWaypointChange: (id: string, position: Vector3) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
};

export function WaypointManager({
  waypoints,
  onWaypointChange,
  onDragStart,
  onDragEnd,
}: WaypointManagerProps) {
  return (
    <>
      {waypoints.map((wp, index) => (
        <Waypoint
          key={wp.id}
          id={wp.id}
          position={wp.position}
          index={index}
          onPositionChange={onWaypointChange}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      ))}
    </>
  );
}
