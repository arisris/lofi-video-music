import { ClipsPanel } from "./clips-panel";

/** Inspector dock: hosts the React ClipsPanel, placeholder for future tabs. */
export const InspectorPanel = () => (
  <div className="flex h-full flex-col overflow-hidden">
    <div className="flex-1 overflow-hidden">
      <ClipsPanel />
    </div>
  </div>
);
