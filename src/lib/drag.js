import { State } from "./state";
import { runtime } from "./runtime";
import { ClipRegistry } from "./clips/registry";
import { getGlobalTime, getClipsToSearch, transformPoint, inverseTransformPoint, getSelectedClipInfo } from "../utils/helpers";
import m from "mithril";

export const getEventPos = (e) => {
  const rect = runtime.canvas.getBoundingClientRect();
  const scaleX = runtime.canvas.width / rect.width;
  const scaleY = runtime.canvas.height / rect.height;
  
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

export const findClipAtPos = (pos) => {
  const ctx = runtime.ctx;
  const w = runtime.canvas.width;
  const h = runtime.canvas.height;
  
  // 1. Check Timeline Clips first (they are usually on top)
  const globalTime = getGlobalTime(State);
  const clipsToSearch = getClipsToSearch(State);

  // Sort timeline clips by track index reverse (top tracks first) and filter out background clips
  const sortedClips = [...clipsToSearch]
    .filter(c => c.type !== 'background' && globalTime >= c.start && globalTime <= c.start + c.duration)
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
    if (clip.id === 'text' || clip.id === 'background' || clip.id === 'visualizer') continue; // Skip timeline clips

    const settings = State.clipSettings[clip.id];
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

export const findHandleAtPos = (pos, bbox, settings) => {
  const scaleY = settings.scaleY ?? 1;
  const ptTL = transformPoint(bbox.x, bbox.y, bbox, settings);
  const ptTR = transformPoint(bbox.x + bbox.width, bbox.y, bbox, settings);
  const ptBR = transformPoint(bbox.x + bbox.width, bbox.y + bbox.height, bbox, settings);
  const ptBL = transformPoint(bbox.x, bbox.y + bbox.height, bbox, settings);
  const ptRot = transformPoint(bbox.x + bbox.width * 0.5, bbox.y - 30 / scaleY, bbox, settings);

  const dist = (p1, p2) => Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
  const HANDLE_RADIUS = 12; // 12 pixels hit area

  if (dist(pos, ptRot) < HANDLE_RADIUS) return "rotate";
  if (dist(pos, ptTL) < HANDLE_RADIUS) return "resize-tl";
  if (dist(pos, ptTR) < HANDLE_RADIUS) return "resize-tr";
  if (dist(pos, ptBR) < HANDLE_RADIUS) return "resize-br";
  if (dist(pos, ptBL) < HANDLE_RADIUS) return "resize-bl";

  return null;
};

export const handleDragStart = (e) => {
  const pos = getEventPos(e);
  State.startDragX = pos.x;
  State.startDragY = pos.y;

  if (State.interactionMode === 'pan') {
    const clipsToSearch = getClipsToSearch(State);
    const selectedClip = clipsToSearch.find(c => c.id === State.selectedClipId && c.type === 'background');
    if (selectedClip) {
      State.isDragging = true;
      State.transformMode = 'background';
      State.initialOffsetX = selectedClip.settings.bgOffsetX || 0;
      State.initialOffsetY = selectedClip.settings.bgOffsetY || 0;
    }
  } else {
    // Check if clicked on a handle of the currently selected clip first
    const selectedInfo = getSelectedClipInfo(State);
    let clickedHandle = null;
    if (selectedInfo) {
      const { settings, renderer } = selectedInfo;
      const w = runtime.canvas.width;
      const h = runtime.canvas.height;
      const bbox = renderer.getItemBoundingBox ? renderer.getItemBoundingBox(runtime.ctx, w, h, settings) : null;
      if (bbox) {
        clickedHandle = findHandleAtPos(pos, bbox, settings);
      }
    }

    if (clickedHandle) {
      const { settings, renderer } = selectedInfo;
      const w = runtime.canvas.width;
      const h = runtime.canvas.height;
      const bbox = renderer.getItemBoundingBox(runtime.ctx, w, h, settings);

      State.isDragging = true;
      State.transformMode = clickedHandle;
      State.initialRotation = settings.rotation || 0;
      State.initialScaleX = settings.scaleX || 1;
      State.initialScaleY = settings.scaleY || 1;

      const originX = settings.originX !== undefined ? settings.originX : 0.5;
      const originY = settings.originY !== undefined ? settings.originY : 0.5;
      const cx = bbox.x + bbox.width * originX;
      const cy = bbox.y + bbox.height * originY;

      State.dragPivot = {
        x: cx + (settings.x || 0),
        y: cy + (settings.y || 0)
      };

      const dx = pos.x - State.dragPivot.x;
      const dy = pos.y - State.dragPivot.y;
      State.initialDragDistance = Math.sqrt(dx * dx + dy * dy);
      State.initialDragAngle = Math.atan2(dy, dx);
      
      // Lock cursor during handle drag
      if (clickedHandle === 'rotate') {
        State.canvasCursor = 'crosshair';
      } else if (clickedHandle === 'resize-tl' || clickedHandle === 'resize-br') {
        State.canvasCursor = 'nwse-resize';
      } else if (clickedHandle === 'resize-tr' || clickedHandle === 'resize-bl') {
        State.canvasCursor = 'nesw-resize';
      }
    } else {
      const hit = findClipAtPos(pos);
      if (hit) {
        State.selectedClipId = hit.id;
        State.isDragging = true;
        State.transformMode = 'clip';
        State.canvasCursor = 'move';
        
        if (hit.isTimeline) {
          State.activeClipTab = hit.clip.type;
          State.initialOffsetX = hit.clip.settings.x || 0;
          State.initialOffsetY = hit.clip.settings.y || 0;

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

            const globalTime = getGlobalTime(State);

            State.timelineClips.forEach(other => {
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

            State.staticSnapTargetsX = snapTargetsX;
            State.staticSnapTargetsY = snapTargetsY;
          }
        } else {
          State.activeClipTab = hit.id;
          const target = State.clipSettings[hit.id];
          State.initialOffsetX = target.x || 0;
          State.initialOffsetY = target.y || 0;
        }
        State.activeInspectorTab = "properties";
      } else {
        State.selectedClipId = null;
        State.canvasCursor = null;
      }
    }
  }
  
  m.redraw();
};

export const handleDragMove = (e) => {
  if (!State.isDragging) return;
  const pos = getEventPos(e);
  const dx = pos.x - State.startDragX;
  const dy = pos.y - State.startDragY;

  if (State.transformMode === 'background') {
    const clipsToSearch = getClipsToSearch(State);
    const selectedClip = clipsToSearch.find(c => c.id === State.selectedClipId && c.type === 'background');
    if (selectedClip) {
      selectedClip.settings.bgOffsetX = State.initialOffsetX + dx;
      selectedClip.settings.bgOffsetY = State.initialOffsetY + dy;
    }
  } else if (State.transformMode === 'rotate') {
    const selectedInfo = getSelectedClipInfo(State);
    if (selectedInfo && State.dragPivot) {
      const currentAngle = Math.atan2(pos.y - State.dragPivot.y, pos.x - State.dragPivot.x);
      const deltaAngle = currentAngle - State.initialDragAngle;
      let newRotation = State.initialRotation + deltaAngle * 180 / Math.PI;

      if (e.shiftKey) {
        newRotation = Math.round(newRotation / 15) * 15;
      }
      
      selectedInfo.settings.rotation = newRotation;
    }
  } else if (State.transformMode && State.transformMode.startsWith('resize')) {
    const selectedInfo = getSelectedClipInfo(State);
    if (selectedInfo && State.dragPivot) {
      const currentDx = pos.x - State.dragPivot.x;
      const currentDy = pos.y - State.dragPivot.y;
      const currentDist = Math.sqrt(currentDx * currentDx + currentDy * currentDy);

      let scaleFactor = 1;
      if (State.initialDragDistance > 0) {
        scaleFactor = currentDist / State.initialDragDistance;
        
        // Dot product to check if we dragged to the opposite side of the pivot
        const mxStart = State.startDragX - State.dragPivot.x;
        const myStart = State.startDragY - State.dragPivot.y;
        const dot = currentDx * mxStart + currentDy * myStart;
        if (dot < 0) {
          scaleFactor = -scaleFactor;
        }
      }

      const newScaleX = Math.max(0.05, State.initialScaleX * scaleFactor);
      const newScaleY = Math.max(0.05, State.initialScaleY * scaleFactor);

      selectedInfo.settings.scaleX = newScaleX;
      selectedInfo.settings.scaleY = newScaleY;
    }
  } else if (State.transformMode === 'clip') {
    const clipsToSearch = getClipsToSearch(State);
    const timelineClip = clipsToSearch.find(c => c.id === State.selectedClipId);
    if (timelineClip) {
      const track = State.timelineTracks.find(t => t.id === timelineClip.trackId);
      if (track && track.locked) return; // Prevent drag if track is locked

      let targetX = State.initialOffsetX + dx;
      let targetY = State.initialOffsetY + dy;

      const w = runtime.canvas?.width;
      const h = runtime.canvas?.height;
      const renderer = ClipRegistry.get(timelineClip.type);
      
      State.canvasSnaps = [];
 
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

          const snapTargetsX = State.staticSnapTargetsX || [];
          const snapTargetsY = State.staticSnapTargetsY || [];

          const SNAP_THRESHOLD = 15; // 15 pixels snapping threshold

          // Test X snapping (horizontal align)
          for (const target of snapTargetsX) {
            // Center to target
            if (Math.abs(currentCx - target.value) < SNAP_THRESHOLD) {
              targetX = target.value - baseCx;
              State.canvasSnaps.push({ type: 'x', value: target.value });
              break;
            }
            // Left to target
            if (Math.abs(currentLeft - target.value) < SNAP_THRESHOLD) {
              targetX = target.value - baseCx + hitW * originX;
              State.canvasSnaps.push({ type: 'x', value: target.value });
              break;
            }
            // Right to target
            if (Math.abs(currentRight - target.value) < SNAP_THRESHOLD) {
              targetX = target.value - baseCx - hitW * (1 - originX);
              State.canvasSnaps.push({ type: 'x', value: target.value });
              break;
            }
          }

          // Test Y snapping (vertical align)
          for (const target of snapTargetsY) {
            // Center to target
            if (Math.abs(currentCy - target.value) < SNAP_THRESHOLD) {
              targetY = target.value - baseCy;
              State.canvasSnaps.push({ type: 'y', value: target.value });
              break;
            }
            // Top to target
            if (Math.abs(currentTop - target.value) < SNAP_THRESHOLD) {
              targetY = target.value - baseCy + hitH * originY;
              State.canvasSnaps.push({ type: 'y', value: target.value });
              break;
            }
            // Bottom to target
            if (Math.abs(currentBottom - target.value) < SNAP_THRESHOLD) {
              targetY = target.value - baseCy - hitH * (1 - originY);
              State.canvasSnaps.push({ type: 'y', value: target.value });
              break;
            }
          }
        }
      }

      timelineClip.settings.x = targetX;
      timelineClip.settings.y = targetY;
    } else if (State.clipSettings[State.selectedClipId]) {
      const target = State.clipSettings[State.selectedClipId];
      target.x = State.initialOffsetX + dx;
      target.y = State.initialOffsetY + dy;
    }
  }
  
  m.redraw();
};

export const handleDragEnd = () => {
  State.isDragging = false;
  State.transformMode = null;
  State.canvasSnaps = [];
  State.staticSnapTargetsX = null;
  State.staticSnapTargetsY = null;
  State.canvasCursor = null;
  m.redraw();
};
