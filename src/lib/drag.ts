import { editorStore } from "../store/editor-store";
import { runtime } from "./runtime";
import { ClipRegistry } from "./clips/registry";
import { getGlobalTime, getClipsToSearch, transformPoint, inverseTransformPoint, getSelectedClipInfo } from "../utils/helpers";
import { bumpClips, updateTimelineClipSettings } from "../store/actions/timeline-actions";
import { updateClipSettings } from "../store/actions/clip-settings";
import type { CanvasSnap } from "../types/clips";

/** Minimal structural pointer event (mouse or touch). */
export interface DragPointerEvent {
  clientX: number;
  clientY: number;
  shiftKey?: boolean;
  touches?: ArrayLike<{ clientX: number; clientY: number }>;
}

export const getEventPos = (e: DragPointerEvent) => {
  const canvas = runtime.canvas!;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  let clientX, clientY;
  if (e.touches && e.touches.length > 0) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }
  
  return { 
    x: (clientX - rect.left) * scaleX, 
    y: (clientY - rect.top) * scaleY 
  };
};

export const findClipAtPos = (pos: { x: number; y: number }) => {
  const ctx = runtime.ctx!;
  const w = runtime.canvas!.width;
  const h = runtime.canvas!.height;
  
  // 1. Check Timeline Clips first (they are usually on top)
  const globalTime = getGlobalTime(editorStore.getState());
  const clipsToSearch = getClipsToSearch(editorStore.getState());

  // Sort timeline clips by track index reverse (top tracks first) and filter out background clips
  const sortedClips = [...clipsToSearch]
    .filter((c: any) => c.type !== 'background' && globalTime >= c.start && globalTime <= c.start + c.duration)
    .reverse();

  for (const clip of sortedClips) {
    const renderer = ClipRegistry.get(clip.type);
    if (!renderer || typeof renderer.getItemBoundingBox !== "function") continue;
    
    const bbox = renderer.getItemBoundingBox(ctx, w, h, clip.settings);
    if (!bbox) continue;

    const localPos = inverseTransformPoint(pos.x, pos.y, bbox, clip.settings);
    if (localPos.x >= bbox.x && localPos.x <= bbox.x + bbox.width &&
        localPos.y >= bbox.y && localPos.y <= bbox.y + bbox.height) {
      return { id: clip.id, isTimeline: true, clip: clip };
    }
  }

  // 2. Check Global Clips (Visualizer, etc.)
  const globalClips = [...ClipRegistry.getAll()].reverse();
  for (const clip of globalClips) {
    // Timeline clips are hit-tested above; only true global clips (no drawItem)
    // take part here. The previous id list missed most timeline clips, which fell
    // back to a full-canvas bbox and hijacked clicks on empty space.
    if (typeof clip.drawItem === "function") continue;

    const settings = editorStore.getState().clipSettings[clip.id];
    if (!settings) continue;
    
    const bbox = clip.getBoundingBox ? clip.getBoundingBox(ctx, w, h) : { x: 0, y: 0, width: w, height: h };
    
    const localPos = inverseTransformPoint(pos.x, pos.y, bbox, settings);
    if (localPos.x >= bbox.x && localPos.x <= bbox.x + bbox.width &&
        localPos.y >= bbox.y && localPos.y <= bbox.y + bbox.height) {
      return { id: clip.id, isTimeline: false };
    }
  }
  return null;
};

export const findHandleAtPos = (pos: { x: number; y: number }, bbox: { x: number; y: number; width: number; height: number }, settings: Record<string, any>): string | null => {
  const scaleY = settings.scaleY ?? 1;
  const ptTL = transformPoint(bbox.x, bbox.y, bbox, settings);
  const ptTR = transformPoint(bbox.x + bbox.width, bbox.y, bbox, settings);
  const ptBR = transformPoint(bbox.x + bbox.width, bbox.y + bbox.height, bbox, settings);
  const ptBL = transformPoint(bbox.x, bbox.y + bbox.height, bbox, settings);
  const ptRot = transformPoint(bbox.x + bbox.width * 0.5, bbox.y - 30 / scaleY, bbox, settings);

  const dist = (p1: { x: number; y: number }, p2: { x: number; y: number }) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  const HANDLE_RADIUS = 12; // 12 pixels hit area

  if (dist(pos, ptRot) < HANDLE_RADIUS) return "rotate";
  if (dist(pos, ptTL) < HANDLE_RADIUS) return "resize-tl";
  if (dist(pos, ptTR) < HANDLE_RADIUS) return "resize-tr";
  if (dist(pos, ptBR) < HANDLE_RADIUS) return "resize-br";
  if (dist(pos, ptBL) < HANDLE_RADIUS) return "resize-bl";

  return null;
};

export const handleDragStart = (e: DragPointerEvent) => {
  const pos = getEventPos(e);
  editorStore.setState({ startDragX: pos.x });
  editorStore.setState({ startDragY: pos.y });

  if (editorStore.getState().interactionMode === 'pan') {
    const clipsToSearch = getClipsToSearch(editorStore.getState());
    const selectedClip = clipsToSearch.find((c: any) => c.id === editorStore.getState().selectedClipId && c.type === 'background');
    if (selectedClip) {
      editorStore.setState({ isDragging: true });
      editorStore.setState({ transformMode: 'background' });
      editorStore.setState({ initialOffsetX: selectedClip.settings.bgOffsetX || 0 });
      editorStore.setState({ initialOffsetY: selectedClip.settings.bgOffsetY || 0 });
    }
  } else {
    // Check if clicked on a handle of the currently selected clip first
    const selectedInfo = getSelectedClipInfo(editorStore.getState());
    let clickedHandle: string | null = null;
    if (selectedInfo) {
      const { settings, renderer } = selectedInfo;
      const w = runtime.canvas!.width;
      const h = runtime.canvas!.height;
      const bbox = renderer.getItemBoundingBox ? renderer.getItemBoundingBox(runtime.ctx!, w, h, settings) : null;
      if (bbox) {
        clickedHandle = findHandleAtPos(pos, bbox, settings);
      }
    }

    if (clickedHandle) {
      const { settings, renderer } = selectedInfo!;
      const w = runtime.canvas!.width;
      const h = runtime.canvas!.height;
      const bbox = renderer.getItemBoundingBox(runtime.ctx!, w, h, settings);

      editorStore.setState({ isDragging: true });
      editorStore.setState({ transformMode: clickedHandle });
      editorStore.setState({ initialRotation: settings.rotation || 0 });
      editorStore.setState({ initialScaleX: settings.scaleX || 1 });
      editorStore.setState({ initialScaleY: settings.scaleY || 1 });

      const originX = settings.originX !== undefined ? settings.originX : 0.5;
      const originY = settings.originY !== undefined ? settings.originY : 0.5;
      const cx = bbox.x + bbox.width * originX;
      const cy = bbox.y + bbox.height * originY;

      const dragPivot = { x: cx + (settings.x || 0), y: cy + (settings.y || 0) };
      editorStore.setState({ dragPivot });

      const dx = pos.x - dragPivot.x;
      const dy = pos.y - dragPivot.y;
      editorStore.setState({ initialDragDistance: Math.sqrt(dx * dx + dy * dy) });
      editorStore.setState({ initialDragAngle: Math.atan2(dy, dx) });
      
      // Lock cursor during handle drag
      if (clickedHandle === 'rotate') {
        editorStore.setState({ canvasCursor: 'crosshair' });
      } else if (clickedHandle === 'resize-tl' || clickedHandle === 'resize-br') {
        editorStore.setState({ canvasCursor: 'nwse-resize' });
      } else if (clickedHandle === 'resize-tr' || clickedHandle === 'resize-bl') {
        editorStore.setState({ canvasCursor: 'nesw-resize' });
      }
    } else {
      const hit = findClipAtPos(pos);
      if (hit) {
        editorStore.setState({ selectedClipId: hit.id });
        editorStore.setState({ isDragging: true });
        editorStore.setState({ transformMode: 'clip' });
        editorStore.setState({ canvasCursor: 'move' });
        
        if (hit.isTimeline) {
          editorStore.setState({ activeClipTab: hit.clip.type });
          editorStore.setState({ initialOffsetX: hit.clip.settings.x || 0 });
          editorStore.setState({ initialOffsetY: hit.clip.settings.y || 0 });

          // Pre-calculate and cache static snap targets
          const timelineClip = hit.clip;
          const w = runtime.canvas?.width;
          const h = runtime.canvas?.height;
          if (w && h) {
            const snapTargetsX = [
              { value: w / 2, label: 'Center' },
              { value: 0, label: 'Left Border' },
              { value: w, label: 'Right Border' }
            ];
            const snapTargetsY = [
              { value: h / 2, label: 'Center' },
              { value: 0, label: 'Top Border' },
              { value: h, label: 'Bottom Border' }
            ];

            const globalTime = getGlobalTime(editorStore.getState());

            editorStore.getState().timelineClips.forEach((other: any) => {
              if (other.id === timelineClip.id || other.type === 'background') return;
              if (globalTime < other.start || globalTime > other.start + other.duration) return;

              const otherRenderer = ClipRegistry.get(other.type);
              if (otherRenderer && typeof otherRenderer.getItemBoundingBox === "function") {
                const otherBbox = otherRenderer.getItemBoundingBox(runtime.ctx, w, h, other.settings);
                if (otherBbox) {
                  const otherSx = other.settings.scaleX || 1;
                  const otherSy = other.settings.scaleY || 1;
                  const otherOriginX = other.settings.originX !== undefined ? other.settings.originX : 0.5;
                  const otherOriginY = other.settings.originY !== undefined ? other.settings.originY : 0.5;

                  const otherCx = otherBbox.x + otherBbox.width * otherOriginX + (other.settings.x || 0);
                  const otherCy = otherBbox.y + otherBbox.height * otherOriginY + (other.settings.y || 0);

                  const otherW = otherBbox.width * otherSx;
                  const otherH = otherBbox.height * otherSy;
                  const otherLeft = otherCx - otherW * otherOriginX;
                  const otherRight = otherLeft + otherW;
                  const otherTop = otherCy - otherH * otherOriginY;
                  const otherBottom = otherTop + otherH;

                  snapTargetsX.push({ value: otherCx, label: 'Center' });
                  snapTargetsX.push({ value: otherLeft, label: 'Left' });
                  snapTargetsX.push({ value: otherRight, label: 'Right' });

                  snapTargetsY.push({ value: otherCy, label: 'Center' });
                  snapTargetsY.push({ value: otherTop, label: 'Top' });
                  snapTargetsY.push({ value: otherBottom, label: 'Bottom' });
                }
              }
            });

            editorStore.setState({ staticSnapTargetsX: snapTargetsX, staticSnapTargetsY: snapTargetsY });
          }
        } else {
          editorStore.setState({ activeClipTab: hit.id });
          const target = editorStore.getState().clipSettings[hit.id] as Record<string, any>;
          editorStore.setState({ initialOffsetX: target.x || 0, initialOffsetY: target.y || 0 });
        }
        editorStore.setState({ activeInspectorTab: "properties" });
      } else {
        editorStore.setState({ selectedClipId: null });
        editorStore.setState({ canvasCursor: null });
      }
    }
  }

  bumpClips();
};

export const handleDragMove = (e: DragPointerEvent) => {
  const state = editorStore.getState();
  if (!state.isDragging) return;
  const pos = getEventPos(e);
  const dx = pos.x - state.startDragX;
  const dy = pos.y - state.startDragY;

  // Helper: apply a settings patch to either a timeline clip or a global clip
  const applySettingsPatch = (info: any, patch: Record<string, any>) => {
    if (info.isTimeline) {
      updateTimelineClipSettings(info.clip.id, patch);
    } else {
      updateClipSettings(info.clip.id, patch);
    }
  };

  if (state.transformMode === 'background') {
    const clipsToSearch = getClipsToSearch(state);
    const selectedClip = clipsToSearch.find((c: any) => c.id === state.selectedClipId && c.type === 'background');
    if (selectedClip) {
      updateTimelineClipSettings(selectedClip.id, {
        bgOffsetX: state.initialOffsetX + dx,
        bgOffsetY: state.initialOffsetY + dy,
      });
    }
  } else if (state.transformMode === 'rotate') {
    const selectedInfo = getSelectedClipInfo(state);
    if (selectedInfo && state.dragPivot) {
      const currentAngle = Math.atan2(pos.y - state.dragPivot.y, pos.x - state.dragPivot.x);
      const deltaAngle = currentAngle - state.initialDragAngle;
      let newRotation = state.initialRotation + (deltaAngle * 180) / Math.PI;

      if (e.shiftKey) {
        newRotation = Math.round(newRotation / 15) * 15;
      }

      applySettingsPatch(selectedInfo, { rotation: newRotation });
    }
  } else if (state.transformMode?.startsWith('resize')) {
    const selectedInfo = getSelectedClipInfo(state);
    if (selectedInfo && state.dragPivot) {
      const currentDx = pos.x - state.dragPivot.x;
      const currentDy = pos.y - state.dragPivot.y;
      const currentDist = Math.sqrt(currentDx * currentDx + currentDy * currentDy);

      let scaleFactor = 1;
      if (state.initialDragDistance > 0) {
        scaleFactor = currentDist / state.initialDragDistance;

        // Dot product to check if we dragged to the opposite side of the pivot
        const mxStart = state.startDragX - state.dragPivot.x;
        const myStart = state.startDragY - state.dragPivot.y;
        const dot = currentDx * mxStart + currentDy * myStart;
        if (dot < 0) {
          scaleFactor = -scaleFactor;
        }
      }

      applySettingsPatch(selectedInfo, {
        scaleX: Math.max(0.05, state.initialScaleX * scaleFactor),
        scaleY: Math.max(0.05, state.initialScaleY * scaleFactor),
      });
    }
  } else if (state.transformMode === 'clip') {
    const clipsToSearch = getClipsToSearch(state);
    const timelineClip = clipsToSearch.find((c: any) => c.id === state.selectedClipId);
    const canvasSnaps: CanvasSnap[] = [];

    if (timelineClip) {
      const track = state.timelineTracks.find((t: any) => t.id === timelineClip.trackId);
      if (track && track.locked) return; // Prevent drag if track is locked

      let targetX = state.initialOffsetX + dx;
      let targetY = state.initialOffsetY + dy;

      const w = runtime.canvas?.width;
      const h = runtime.canvas?.height;
      const renderer = ClipRegistry.get(timelineClip.type);

      if (w && h && renderer && typeof renderer.getItemBoundingBox === "function") {
        const bbox = renderer.getItemBoundingBox(runtime.ctx, w, h, timelineClip.settings);
        if (bbox) {
          const sx = timelineClip.settings.scaleX || 1;
          const sy = timelineClip.settings.scaleY || 1;
          const originX = timelineClip.settings.originX !== undefined ? timelineClip.settings.originX : 0.5;
          const originY = timelineClip.settings.originY !== undefined ? timelineClip.settings.originY : 0.5;

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

          const snapTargetsX = state.staticSnapTargetsX || [];
          const snapTargetsY = state.staticSnapTargetsY || [];

          const SNAP_THRESHOLD = 15; // 15 pixels snapping threshold

          // Test X snapping (horizontal align)
          for (const target of snapTargetsX) {
            // Center to target
            if (Math.abs(currentCx - target.value) < SNAP_THRESHOLD) {
              targetX = target.value - baseCx;
              canvasSnaps.push({ type: 'x', value: target.value });
              break;
            }
            // Left to target
            if (Math.abs(currentLeft - target.value) < SNAP_THRESHOLD) {
              targetX = target.value - baseCx + hitW * originX;
              canvasSnaps.push({ type: 'x', value: target.value });
              break;
            }
            // Right to target
            if (Math.abs(currentRight - target.value) < SNAP_THRESHOLD) {
              targetX = target.value - baseCx - hitW * (1 - originX);
              canvasSnaps.push({ type: 'x', value: target.value });
              break;
            }
          }

          // Test Y snapping (vertical align)
          for (const target of snapTargetsY) {
            // Center to target
            if (Math.abs(currentCy - target.value) < SNAP_THRESHOLD) {
              targetY = target.value - baseCy;
              canvasSnaps.push({ type: 'y', value: target.value });
              break;
            }
            // Top to target
            if (Math.abs(currentTop - target.value) < SNAP_THRESHOLD) {
              targetY = target.value - baseCy + hitH * originY;
              canvasSnaps.push({ type: 'y', value: target.value });
              break;
            }
            // Bottom to target
            if (Math.abs(currentBottom - target.value) < SNAP_THRESHOLD) {
              targetY = target.value - baseCy - hitH * (1 - originY);
              canvasSnaps.push({ type: 'y', value: target.value });
              break;
            }
          }
        }
      }

      editorStore.setState({ canvasSnaps });
      updateTimelineClipSettings(timelineClip.id, { x: targetX, y: targetY });
    } else if (state.clipSettings[state.selectedClipId as string]) {
      updateClipSettings(state.selectedClipId as string, {
        x: state.initialOffsetX + dx,
        y: state.initialOffsetY + dy,
      });
    }
  }
};

export const handleDragEnd = () => {
  editorStore.setState({
    isDragging: false,
    transformMode: null,
    canvasSnaps: [],
    staticSnapTargetsX: null,
    staticSnapTargetsY: null,
    canvasCursor: null,
  });
  bumpClips();
};
