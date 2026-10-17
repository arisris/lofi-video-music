import m from "mithril";
import { State } from "./state";
import { getGlobalTime } from "../utils/helpers";

const DEFAULT_TRANSFORMS = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  originX: 0.5,
  originY: 0.5,
};

export const DEFAULT_SETTINGS = {
  visualizer: {
    style: "bars",
    color: "#3b82f6",
    intensity: 0.5,
    opacity: 1,
    density: 1.5,
    rainbow: false,
    ...DEFAULT_TRANSFORMS,
  },
  text: {
    content: "New Text",
    fontFamily: "'Inter', sans-serif",
    fontSize: 32,
    fontWeight: "normal",
    textColor: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 0,
    shadowColor: "rgba(0,0,0,0.8)",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    textAlign: "center",
    lineHeight: 1.2,
    bgColor: "transparent",
    bgPadding: 10,
    bgRadius: 8,
    textEffect: "none",
    typewriterSpeed: 15,
    typewriterOut: true,
    wavyAmplitude: 6,
    wavyFrequency: 4,
    wavySpacing: 0.15,
    ...DEFAULT_TRANSFORMS,
  },
  background: {
    bgType: null,
    bgElement: null,
    bgElements: null,
    activeVidIndex: 0,
    videoDuration: 0,
    bgOffsetX: 0,
    bgOffsetY: 0,
    currentEffect: "random",
    fileName: "",
    thumbnail: null,
    ...DEFAULT_TRANSFORMS,
  },
  overlay: {
    mediaType: null,
    mediaElement: null,
    mediaElements: null,
    videoDuration: 0,
    loop: true,
    fileName: "",
    thumbnail: null,
    opacity: 1.0,
    ...DEFAULT_TRANSFORMS,
  },
  rain: {
    intensity: 200,
    audioReactive: false,
    ...DEFAULT_TRANSFORMS,
  },
  rain_gpu: {
    intensity: 200,
    speed: 1.0,
    size: 1.0,
    opacity: 1.0,
    audioReactive: false,
    ...DEFAULT_TRANSFORMS,
  },
  smoke: {
    intensity: 40,
    audioReactive: false,
    ...DEFAULT_TRANSFORMS,
  },
  flash: {
    frequency: 0.5,
    audioReactive: false,
    ...DEFAULT_TRANSFORMS,
  },
  snow: {
    intensity: 120,
    speed: 1.0,
    size: 1.0,
    opacity: 0.8,
    audioReactive: false,
    ...DEFAULT_TRANSFORMS,
  },
  fireflies: {
    intensity: 50,
    speed: 1.0,
    size: 1.0,
    color: "#facc15",
    audioReactive: false,
    ...DEFAULT_TRANSFORMS,
  },
  filmgrain: {
    grainIntensity: 0.15,
    scanlinesOpacity: 0.08,
    glitchFrequency: 0.3,
    audioReactive: false,
    ...DEFAULT_TRANSFORMS,
  },
  vignette: {
    opacity: 0.4,
    color: "#000000",
    audioReactive: false,
    ...DEFAULT_TRANSFORMS,
  },
  shape: {
    shapeType: "rectangle",
    iconName: "ri:star-fill",
    width: 150,
    height: 150,
    fillType: "solid",
    fillColor: "#3b82f6",
    fillColor2: "#8b5cf6",
    strokeColor: "#ffffff",
    strokeWidth: 0,
    cornerRadius: 8,
    starSpikes: 5,
    starInnerRatio: 0.4,
    polygonSides: 6,
    shadowColor: "rgba(0,0,0,0.5)",
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    opacity: 1.0,
    ...DEFAULT_TRANSFORMS,
  },
};

/**
 * Factory to create a timeline clip object.
 */
export const createTimelineClip = (type, specificSettings = {}) => {
  const id = `clip-${Date.now()}`;
  const globalTime = getGlobalTime(State);
  const targetVisualWidth = 100;
  const timelineZoom = State.timelineZoom || 10;
  const adaptiveDuration = Math.max(5, targetVisualWidth / timelineZoom);

  let duration = adaptiveDuration;
  if (type === "background" && specificSettings.bgType === "video" && typeof specificSettings.videoDuration === "number" && specificSettings.videoDuration > 0) {
    duration = specificSettings.videoDuration;
  } else if (type === "overlay" && specificSettings.mediaType === "video" && typeof specificSettings.videoDuration === "number" && specificSettings.videoDuration > 0) {
    duration = specificSettings.videoDuration;
  }

  // Music clips default to track-1, others to track-2
  const defaultTrackId = (type === "music") ? "track-1" : "track-2";

  const defaultSettings = DEFAULT_SETTINGS[type] || { ...DEFAULT_TRANSFORMS };

  let trackId = State.selectedTrackId || defaultTrackId;
  if (type === "music") {
    trackId = "track-1";
  } else if (trackId === "track-1") {
    trackId = "track-2";
  }

  return {
    id,
    type,
    trackId,
    start: globalTime,
    duration,
    settings: {
      ...defaultSettings,
      ...specificSettings,
    },
  };
};

/**
 * Creates and appends a clip to the global timeline state, handling standard panel transition effects.
 */
export const addClipToTimeline = (type, specificSettings = {}, onComplete = null) => {
  const newClip = createTimelineClip(type, specificSettings);

  const applyFinishedState = (clip) => {
    const isThumbnailMode = State.currentRoute === "/image";
    if (isThumbnailMode && (clip.type === "background" || clip.type === "music")) {
      if (!State.videoClips) State.videoClips = [];
      State.videoClips.push(clip);
    } else {
      State.timelineClips.push(clip);
    }
    State.selectedClipId = clip.id;
    State.activeClipTab = clip.type;
    State.timelineScrollLeft = Math.max(0, (clip.start * (State.timelineZoom || 10)) - 100);
    m.redraw();
  };

  if (onComplete) {
    onComplete(newClip, applyFinishedState);
  } else {
    applyFinishedState(newClip);
  }
};
