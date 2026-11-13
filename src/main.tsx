import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./tailwind.css";

// Fresh entry point (rewritten from scratch).
const root = createRoot(document.getElementById("root")!);
root.render(<App />);
