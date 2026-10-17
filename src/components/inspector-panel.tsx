import { ClipsPanel } from "./clips-panel";

/** Inspector dock: hosts the React ClipsPanel, placeholder for future tabs. */
export const InspectorPanel = () => (
  <div className="flex flex-col h-full overflow-hidden">
    <div className="flex-1 overflow-hidden">
      <ClipsPanel />
    </div>
  </div>
);
