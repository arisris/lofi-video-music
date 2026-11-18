// Pointer interactions on the preview canvas, adapted to the new store
// (clips/currentTime/tracks, immutable updates without bumpClips).
// The new model has no global clip (title/playlist/lyrics are plain timeline
// clips) so the global branch was removed; hit-test order follows the
// render layer order (clips added later are on top).
import { getDesignSize, toDesignPos } from "../../shared/lib/canvas-space";
import { runtime } from "../../shared/lib/runtime";
import {
  inverseTransformPoint,
  transformPoint,
} from "../../shared/lib/canvas-transform";
import type { ClipBBox, TimelineClip } from "../../shared/types/clip";
import { clipRegistry } from "../clips";
import { lyricsClip } from "../clips/lyrics/definition";
import { titleSettingsForFrame } from "../clips/title/definition";
import { activeMusicLyrics } from "../lyrics/active-track";
import { useEditorStore } from "../../store/editor-store";

/** Minimal structural pointer event (mouse or touch). */
export interface DragPointerEvent {
  clientX: number;
  clientY: number;
  shiftKey?: boolean;
  touches?: ArrayLike<{ clientX: number; clientY: number }>;
}

/** Pointer position in design space (canvas backing = design space). */
export const getEventPos = (e: DragPointerEvent) => {
  const canvas = runtime.canvas;
  if (!canvas) return { x: 0, y: 0 };
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / (rect.width || 1);
  const scaleY = canvas.height / (rect.height || 1);

  let clientX: number;
  let clientY: number;
  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  return toDesignPos(
    (clientX - rect.left) * scaleX,
    (clientY - rect.top) * scaleY,
  );
};

export interface SelectedCanvasClip {
  /** Null for the global lyrics layer (not a timeline clip). */
  clip: TimelineClip | null;
  settings: Record<string, unknown>;
  bbox: ClipBBox;
  localTime: number;
  /** True when this is the global lyrics layer (written via lyricsSettings). */
  isGlobalLyrics: boolean;
}

/** Global lyrics bbox at a given time (or null when not shown). */
function globalLyricsBbox(time?: number): {
  settings: Record<string, unknown>;
  bbox: ClipBBox;
  localTime: number;
} | null {
  const st = useEditorStore.getState();
  const ctx = runtime.ctx;
  if (!ctx) return null;
  const now = time ?? st.currentTime;
  if ((st.lyricsSettings.enabled as boolean | undefined) === false) return null;
  if (st.route === "/image") return null;
  const track = activeMusicLyrics(st.clips, now, st.route);
  if (!track) return null;
  const { w, h } = getDesignSize();
  const settings: Record<string, unknown> = {
    ...(lyricsClip.defaultSettings ?? {}),
    ...st.lyricsSettings,
    lines: track.lines,
  };
  const bbox = lyricsClip.getItemBoundingBox?.(ctx, w, h, settings, track.localTime);
  if (!bbox) return null;
  return { settings, bbox, localTime: track.localTime };
}

/** Selected clip currently active at the playhead that can be dragged on canvas. */
export function getSelectedCanvasClip(time?: number): SelectedCanvasClip | null {
  const st = useEditorStore.getState();
  if (!st.selectedClipId) return null;
  // Global lyrics layer ("lyrics") is not a timeline clip — hit-test the global bbox.
  if (st.selectedClipId === "lyrics") {
    const g = globalLyricsBbox(time);
    if (!g) return null;
    return { clip: null, settings: g.settings, bbox: g.bbox, localTime: g.localTime, isGlobalLyrics: true };
  }
  const now = time ?? st.currentTime;
  const clip = st.clips.find((c) => c.id === st.selectedClipId);
  if (!clip || clip.type === "background") return null;
  if (now < clip.start || now > clip.start + clip.duration) return null;
  const renderer = clipRegistry.get(clip.type);
  if (!renderer?.getItemBoundingBox || !runtime.ctx) return null;
  const { w, h } = getDesignSize();
  let settings = clip.settings;
  if (clip.type === "title") {
    const resolved = titleSettingsForFrame(clip.settings, st.clips, now);
    if (!resolved) return null;
    settings = resolved;
  }
  const bbox = renderer.getItemBoundingBox(
    runtime.ctx,
    w,
    h,
    settings,
    now - clip.start,
  );
  if (!bbox) return null;
  return { clip, settings, bbox, localTime: now - clip.start, isGlobalLyrics: false };
}

/** Topmost clip at a canvas position (or null). */
export function findClipAtPos(pos: { x: number; y: number }): SelectedCanvasClip | null {
  const st = useEditorStore.getState();
  const ctx = runtime.ctx;
  if (!ctx) return null;
  const now = st.currentTime;
  const { w, h } = getDesignSize();
  // Reverse layer order: the last-drawn (topmost) clip is checked first.
  const ordered = [...st.clips].reverse();
  for (const clip of ordered) {
    if (clip.type === "background") continue;
    if (now < clip.start || now > clip.start + clip.duration) continue;
    const renderer = clipRegistry.get(clip.type);
    if (!renderer?.getItemBoundingBox) continue;
    let settings = clip.settings;
    if (clip.type === "title") {
      const resolved = titleSettingsForFrame(clip.settings, st.clips, now);
      if (!resolved) continue;
      settings = resolved;
    }
    const bbox = renderer.getItemBoundingBox(ctx, w, h, settings, now - clip.start);
    if (!bbox) continue;
    const local = inverseTransformPoint(pos.x, pos.y, bbox, settings);
    if (
      local.x >= bbox.x &&
      local.x <= bbox.x + bbox.width &&
      local.y >= bbox.y &&
      local.y <= bbox.y + bbox.height
    ) {
      return { clip, settings, bbox, localTime: now - clip.start, isGlobalLyrics: false };
    }
  }
  // Last: global lyrics layer (above background, below other clips is
  // wrong — global is drawn after fg; check after all timeline clips so
  // clips above it win).
  const g = globalLyricsBbox(now);
  if (g) {
    const local = inverseTransformPoint(pos.x, pos.y, g.bbox, g.settings);
    if (
      local.x >= g.bbox.x &&
      local.x <= g.bbox.x + g.bbox.width &&
      local.y >= g.bbox.y &&
      local.y <= g.bbox.y + g.bbox.height
    ) {
      return { clip: null, settings: g.settings, bbox: g.bbox, localTime: g.localTime, isGlobalLyrics: true };
    }
  }
  return null;
}

export function findHandleAtPos(
  pos: { x: number; y: number },
  bbox: ClipBBox,
  settings: Record<string, unknown>,
): string | null {
  const scaleY = typeof settings.scaleY === "number" ? settings.scaleY : 1;
  const ptTL = transformPoint(bbox.x, bbox.y, bbox, settings);
  const ptTR = transformPoint(bbox.x + bbox.width, bbox.y, bbox, settings);
  const ptBR = transformPoint(
    bbox.x + bbox.width,
    bbox.y + bbox.height,
    bbox,
    settings,
  );
  const ptBL = transformPoint(bbox.x, bbox.y + bbox.height, bbox, settings);
  const ptRot = transformPoint(
    bbox.x + bbox.width * 0.5,
    bbox.y - 30 / (scaleY || 1),
    bbox,
    settings,
  );

  const dist = (p1: { x: number; y: number }, p2: { x: number; y: number }) =>
    Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  const HANDLE_RADIUS = 12;

  if (dist(pos, ptRot) < HANDLE_RADIUS) return "rotate";
  if (dist(pos, ptTL) < HANDLE_RADIUS) return "resize-tl";
  if (dist(pos, ptTR) < HANDLE_RADIUS) return "resize-tr";
  if (dist(pos, ptBR) < HANDLE_RADIUS) return "resize-br";
  if (dist(pos, ptBL) < HANDLE_RADIUS) return "resize-bl";
  return null;
}

export const handleCanvasDragStart = (e: DragPointerEvent) => {
  // Right/middle click must not start a drag or clear the selection —
  // the preview context menu handles those buttons separately.
  const button = (e as unknown as { button?: number }).button;
  if (button !== undefined && button !== 0) return;

  const st = useEditorStore.getState();
  const pos = getEventPos(e);
  useEditorStore.setState({ startDragX: pos.x, startDragY: pos.y });

  if (st.interactionMode === "pan") {
    const selected = st.clips.find(
      (c) => c.id === st.selectedClipId && c.type === "background",
    );
    if (selected) {
      const s = selected.settings as Record<string, unknown>;
      useEditorStore.setState({
        isDragging: true,
        transformMode: "background",
        initialOffsetX: typeof s.bgOffsetX === "number" ? s.bgOffsetX : 0,
        initialOffsetY: typeof s.bgOffsetY === "number" ? s.bgOffsetY : 0,
      });
    }
    return;
  }

  const selectedInfo = getSelectedCanvasClip();
  let clickedHandle: string | null = null;
  if (selectedInfo) {
    clickedHandle = findHandleAtPos(pos, selectedInfo.bbox, selectedInfo.settings);
  }

  if (clickedHandle && selectedInfo) {
    const { settings, bbox } = selectedInfo;
    const num = (v: unknown, fb: number) =>
      typeof v === "number" && Number.isFinite(v) ? v : fb;
    useEditorStore.setState({
      isDragging: true,
      transformMode: clickedHandle,
      initialRotation: num(settings.rotation, 0),
      initialScaleX: num(settings.scaleX, 1),
      initialScaleY: num(settings.scaleY, 1),
    });

    const originX = num(settings.originX, 0.5);
    const originY = num(settings.originY, 0.5);
    const cx = bbox.x + bbox.width * originX;
    const cy = bbox.y + bbox.height * originY;
    const dragPivot = { x: cx + num(settings.x, 0), y: cy + num(settings.y, 0) };
    useEditorStore.setState({ dragPivot });

    const dx = pos.x - dragPivot.x;
    const dy = pos.y - dragPivot.y;
    useEditorStore.setState({
      initialDragDistance: Math.sqrt(dx * dx + dy * dy),
      initialDragAngle: Math.atan2(dy, dx),
    });

    if (clickedHandle === "rotate") {
      useEditorStore.setState({ canvasCursor: "crosshair" });
    } else if (clickedHandle === "resize-tl" || clickedHandle === "resize-br") {
      useEditorStore.setState({ canvasCursor: "nwse-resize" });
    } else {
      useEditorStore.setState({ canvasCursor: "nesw-resize" });
    }
    return;
  }

  const hit = findClipAtPos(pos);
  if (hit) {
    useEditorStore.setState({
      selectedClipId: hit.isGlobalLyrics ? "lyrics" : hit.clip!.id,
      selectedTransitionClipId: null,
      isDragging: true,
      transformMode: "clip",
      canvasCursor: "move",
      initialOffsetX:
        typeof hit.settings.x === "number" ? (hit.settings.x as number) : 0,
      initialOffsetY:
        typeof hit.settings.y === "number" ? (hit.settings.y as number) : 0,
    });

    // Static snap targets: canvas center/edges + center/edges of other active clips.
    const { w, h } = getDesignSize();
    const snapTargetsX = [
      { value: w / 2, label: "Center" },
      { value: 0, label: "Left Border" },
      { value: w, label: "Right Border" },
    ];
    const snapTargetsY = [
      { value: h / 2, label: "Center" },
      { value: 0, label: "Top Border" },
      { value: h, label: "Bottom Border" },
    ];

    const live = useEditorStore.getState();
    for (const other of live.clips) {
      if ((hit.clip && other.id === hit.clip.id) || other.type === "background") continue;
      if (live.currentTime < other.start || live.currentTime > other.start + other.duration) {
        continue;
      }
      const renderer = clipRegistry.get(other.type);
      if (!renderer?.getItemBoundingBox || !runtime.ctx) continue;
      const otherBbox = renderer.getItemBoundingBox(
        runtime.ctx,
        w,
        h,
        other.settings,
        live.currentTime - other.start,
      );
      if (!otherBbox) continue;
      const s = other.settings as Record<string, unknown>;
      const num = (v: unknown, fb: number) =>
        typeof v === "number" && Number.isFinite(v) ? v : fb;
      const otherSx = num(s.scaleX, 1);
      const otherSy = num(s.scaleY, 1);
      const otherOriginX = num(s.originX, 0.5);
      const otherOriginY = num(s.originY, 0.5);
      const otherCx = otherBbox.x + otherBbox.width * otherOriginX + num(s.x, 0);
      const otherCy = otherBbox.y + otherBbox.height * otherOriginY + num(s.y, 0);
      const otherW = otherBbox.width * otherSx;
      const otherH = otherBbox.height * otherSy;
      const otherLeft = otherCx - otherW * otherOriginX;
      const otherRight = otherLeft + otherW;
      const otherTop = otherCy - otherH * otherOriginY;
      const otherBottom = otherTop + otherH;
      snapTargetsX.push({ value: otherCx, label: "Center" });
      snapTargetsX.push({ value: otherLeft, label: "Left" });
      snapTargetsX.push({ value: otherRight, label: "Right" });
      snapTargetsY.push({ value: otherCy, label: "Center" });
      snapTargetsY.push({ value: otherTop, label: "Top" });
      snapTargetsY.push({ value: otherBottom, label: "Bottom" });
    }
    useEditorStore.setState({
      staticSnapTargetsX: snapTargetsX,
      staticSnapTargetsY: snapTargetsY,
    });
  } else {
    useEditorStore.setState({ selectedClipId: null, canvasCursor: null });
  }
};

/** Snap a drag target to canvas guides; returns the adjusted position + snaps. */
function snapDragTarget(
  bbox: ClipBBox,
  settings: Record<string, unknown>,
  targetX: number,
  targetY: number,
  snapTargetsX: Array<{ value: number }>,
  snapTargetsY: Array<{ value: number }>,
  defaultOriginY = 0.5,
): { x: number; y: number; snaps: Array<{ type: "x" | "y"; value: number }> } {
  const num = (v: unknown, fb: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fb;
  const sx = num(settings.scaleX, 1);
  const sy = num(settings.scaleY, 1);
  const originX = num(settings.originX, 0.5);
  const originY = num(settings.originY, defaultOriginY);
  const baseCx = bbox.x + bbox.width * originX;
  const baseCy = bbox.y + bbox.height * originY;
  const currentCx = baseCx + targetX;
  const currentCy = baseCy + targetY;
  const hitW = bbox.width * sx;
  const hitH = bbox.height * sy;
  const currentLeft = currentCx - hitW * originX;
  const currentRight = currentLeft + hitW;
  const currentTop = currentCy - hitH * originY;
  const currentBottom = currentTop + hitH;
  const snaps: Array<{ type: "x" | "y"; value: number }> = [];
  const SNAP_THRESHOLD = 15;

  for (const target of snapTargetsX) {
    if (Math.abs(currentCx - target.value) < SNAP_THRESHOLD) {
      targetX = target.value - baseCx;
      snaps.push({ type: "x", value: target.value });
      break;
    }
    if (Math.abs(currentLeft - target.value) < SNAP_THRESHOLD) {
      targetX = target.value - baseCx + hitW * originX;
      snaps.push({ type: "x", value: target.value });
      break;
    }
    if (Math.abs(currentRight - target.value) < SNAP_THRESHOLD) {
      targetX = target.value - baseCx - hitW * (1 - originX);
      snaps.push({ type: "x", value: target.value });
      break;
    }
  }
  for (const target of snapTargetsY) {
    if (Math.abs(currentCy - target.value) < SNAP_THRESHOLD) {
      targetY = target.value - baseCy;
      snaps.push({ type: "y", value: target.value });
      break;
    }
    if (Math.abs(currentTop - target.value) < SNAP_THRESHOLD) {
      targetY = target.value - baseCy + hitH * originY;
      snaps.push({ type: "y", value: target.value });
      break;
    }
    if (Math.abs(currentBottom - target.value) < SNAP_THRESHOLD) {
      targetY = target.value - baseCy - hitH * (1 - originY);
      snaps.push({ type: "y", value: target.value });
      break;
    }
  }
  return { x: targetX, y: targetY, snaps };
}

export const handleCanvasDragMove = (e: DragPointerEvent) => {
  const state = useEditorStore.getState();
  if (!state.isDragging) return;
  const pos = getEventPos(e);
  const dx = pos.x - state.startDragX;
  const dy = pos.y - state.startDragY;

  if (state.transformMode === "background") {
    const selected = state.clips.find(
      (c) => c.id === state.selectedClipId && c.type === "background",
    );
    if (selected) {
      state.updateClipSettings(selected.id, {
        bgOffsetX: state.initialOffsetX + dx,
        bgOffsetY: state.initialOffsetY + dy,
      });
    }
    return;
  }

  if (state.transformMode === "rotate") {
    const selectedInfo = getSelectedCanvasClip();
    if (selectedInfo && state.dragPivot) {
      const currentAngle = Math.atan2(pos.y - state.dragPivot.y, pos.x - state.dragPivot.x);
      const deltaAngle = currentAngle - state.initialDragAngle;
      let newRotation = state.initialRotation + (deltaAngle * 180) / Math.PI;
      if (e.shiftKey) newRotation = Math.round(newRotation / 15) * 15;
      if (selectedInfo.isGlobalLyrics) {
        state.updateLyricsSettings({ rotation: newRotation });
      } else if (selectedInfo.clip) {
        state.updateClipSettings(selectedInfo.clip.id, { rotation: newRotation });
      }
    }
    return;
  }

  if (state.transformMode?.startsWith("resize")) {
    const selectedInfo = getSelectedCanvasClip();
    if (selectedInfo && state.dragPivot) {
      const currentDx = pos.x - state.dragPivot.x;
      const currentDy = pos.y - state.dragPivot.y;
      const currentDist = Math.sqrt(currentDx * currentDx + currentDy * currentDy);
      let scaleFactor = 1;
      if (state.initialDragDistance > 0) {
        // No mirroring: dragging past the pivot just shrinks toward the
        // minimum instead of flipping negative (which collapsed to 0.05).
        scaleFactor = Math.max(currentDist, 1) / state.initialDragDistance;
      }
      const patch = {
        scaleX: Math.max(0.05, state.initialScaleX * scaleFactor),
        scaleY: Math.max(0.05, state.initialScaleY * scaleFactor),
      };
      if (selectedInfo.isGlobalLyrics) state.updateLyricsSettings(patch);
      else if (selectedInfo.clip) state.updateClipSettings(selectedInfo.clip.id, patch);
    }
    return;
  }

  if (state.transformMode === "clip") {
    // Global lyrics layer: shift x/y in lyricsSettings (same snap).
    if (state.selectedClipId === "lyrics") {
      const g = globalLyricsBbox();
      if (!g) return;
      const snapped = snapDragTarget(
        g.bbox,
        g.settings,
        state.initialOffsetX + dx,
        state.initialOffsetY + dy,
        state.staticSnapTargetsX || [],
        state.staticSnapTargetsY || [],
        1,
      );

      state.updateLyricsSettings({ x: snapped.x, y: snapped.y });
      useEditorStore.setState({ canvasSnaps: snapped.snaps });
      return;
    }
    const timelineClip = state.clips.find((c) => c.id === state.selectedClipId);
    if (!timelineClip) return;
    const track = state.tracks.find((t) => t.id === timelineClip.trackId);
    if (track?.locked) return;
    const { w, h } = getDesignSize();
    let targetX = state.initialOffsetX + dx;
    let targetY = state.initialOffsetY + dy;
    let canvasSnaps: Array<{ type: "x" | "y"; value: number }> = [];

    const renderer = clipRegistry.get(timelineClip.type);
    if (renderer?.getItemBoundingBox && runtime.ctx) {
      const bbox = renderer.getItemBoundingBox(
        runtime.ctx,
        w,
        h,
        timelineClip.settings,
        state.currentTime - timelineClip.start,
      );
      if (bbox) {
        const snapped = snapDragTarget(
          bbox,
          timelineClip.settings as Record<string, unknown>,
          targetX,
          targetY,
          state.staticSnapTargetsX || [],
          state.staticSnapTargetsY || [],
        );
        targetX = snapped.x;
        targetY = snapped.y;
        canvasSnaps = snapped.snaps;
      }
    }

    state.updateClipSettings(timelineClip.id, { x: targetX, y: targetY });
    useEditorStore.setState({ canvasSnaps });
  }
};

export const handleCanvasDragEnd = () => {
  useEditorStore.setState({
    isDragging: false,
    transformMode: null,
    canvasSnaps: [],
    staticSnapTargetsX: null,
    staticSnapTargetsY: null,
    canvasCursor: null,
  });
};

/** Draw snap guides + selection transform box. */
export function drawCanvasOverlays(
  ctx: CanvasRenderingContext2D,
  w?: number,
  h?: number,
) {
  const state = useEditorStore.getState();
  const design = getDesignSize();
  const dw = w ?? design.w;
  const dh = h ?? design.h;
  // The render loop draws overlays inside the backing-store scale transform,
  // so raw pixel widths grow while recording. Compensate to keep guides and
  // handles visually constant in design space.
  const inv = 1 / (ctx.getTransform().a || 1);

  if (state.canvasSnaps.length > 0) {
    ctx.save();
    ctx.strokeStyle = "#f43e5e";
    ctx.lineWidth = 1.5 * inv;
    ctx.setLineDash([6 * inv, 4 * inv]);
    for (const snap of state.canvasSnaps) {
      ctx.beginPath();
      if (snap.type === "x") {
        ctx.moveTo(snap.value, 0);
        ctx.lineTo(snap.value, dh);
      } else {
        ctx.moveTo(0, snap.value);
        ctx.lineTo(dw, snap.value);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  if (state.interactionMode !== "select") return;
  const info = getSelectedCanvasClip();
  if (!info) return;
  const { settings, bbox } = info;

  const num = (v: unknown, fb: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fb;
  const scaleY = num(settings.scaleY, 1);
  const ptTL = transformPoint(bbox.x, bbox.y, bbox, settings);
  const ptTR = transformPoint(bbox.x + bbox.width, bbox.y, bbox, settings);
  const ptBR = transformPoint(
    bbox.x + bbox.width,
    bbox.y + bbox.height,
    bbox,
    settings,
  );
  const ptBL = transformPoint(bbox.x, bbox.y + bbox.height, bbox, settings);
  const ptTC = transformPoint(
    bbox.x + bbox.width * 0.5,
    bbox.y,
    bbox,
    settings,
  );
  const ptRot = transformPoint(
    bbox.x + bbox.width * 0.5,
    bbox.y - 30 / (scaleY || 0.001),
    bbox,
    settings,
  );

  ctx.save();
  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 1.5 * inv;
  ctx.beginPath();
  ctx.moveTo(ptTL.x, ptTL.y);
  ctx.lineTo(ptTR.x, ptTR.y);
  ctx.lineTo(ptBR.x, ptBR.y);
  ctx.lineTo(ptBL.x, ptBL.y);
  ctx.closePath();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(ptTC.x, ptTC.y);
  ctx.lineTo(ptRot.x, ptRot.y);
  ctx.stroke();

  const drawHandle = (pt: { x: number; y: number }, isCircle = false) => {
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2 * inv;
    ctx.beginPath();
    if (isCircle) {
      ctx.arc(pt.x, pt.y, 6 * inv, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      const r = 5 * inv;
      ctx.rect(pt.x - r, pt.y - r, r * 2, r * 2);
      ctx.fill();
      ctx.stroke();
    }
  };
  drawHandle(ptTL);
  drawHandle(ptTR);
  drawHandle(ptBR);
  drawHandle(ptBL);
  drawHandle(ptRot, true);
  ctx.restore();
}
