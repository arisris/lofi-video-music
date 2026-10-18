import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./tailwind.css";

// React entry point: mounts <App/> into #root.
const root = createRoot(document.getElementById("root")!);
root.render(<App />);

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    // Fast Refresh handles component updates; a full accept keeps state.
  });
}
