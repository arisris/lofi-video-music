// Persist state across HMR reloads
const initialState = {
  playlist: [],
  currentTrackIndex: -1,

  isAudioInit: false,


  aspectRatio: "16:9",
  activeClipTab: "visualizer", 
  
  // Settings for all clips managed by registry
  clipSettings: {},
  effectSettings: {},

  // Track Transition Status
  bgTransitionStyle: "fade",
  prevTrackIndex: -1,
  prevTrackTime: 0,
  transitionStartTime: 0,
  isTransitioning: false,
  transitionDuration: 1500,

  isPlaying: false,
  isRecording: false,
  recordingMode: "track", // "track" or "playlist"
  recordStartTime: 0,
  recordingTime: "00:00",
  showRecordSettingsModal: false,
  pendingRecordMode: "timeline", // "timeline" or "clip"
  recordResolution: "720p", // "720p", "1080p", "1440p"
  recordFps: 30, // 30 or 60



  // Dragging State
  isDragging: false,
  startDragX: 0,
  startDragY: 0,
  initialOffsetX: 0,
  initialOffsetY: 0,

  // Rain
  drops: [],

  // Timeline State
  currentTime: 0,
  timelineTracks: [
    { id: "track-1", name: "Track 1 (Music)", locked: false },
    { id: "track-2", name: "Track 2", locked: false }
  ],
  timelineClips: [], // { id, type, trackId, start, duration, settings }
  mediaPool: [], // Central project media library
  timelineZoom: 4, // pixels per second
  timelineScrollLeft: 0,
  timelineScrollTop: 0,
  
  // UI Hints
  dragHintVisible: false,

  // Clip Interaction
  selectedClipId: null, // This will now refer to a timeline clip ID
  selectedTrackId: "track-1",
  selectedTextItemIndex: -1, 

  transformMode: 'translate',
  interactionMode: 'select', // 'select' or 'pan' (for background)
  snapLines: [], // {time, type: 'start'|'end'}
  canvasSnaps: [], // [{type: 'x'|'y', value}]
  staticSnapTargetsX: null,
  staticSnapTargetsY: null,

  // UI Layout
  mediaPoolWidth: typeof window !== "undefined" ? Math.max(300, Math.floor(window.innerWidth * 0.22)) : 300,
  inspectorWidth: typeof window !== "undefined" ? Math.max(320, Math.floor(window.innerWidth * 0.22)) : 320,
  leftPanelCollapsed: false,

  // Media Panel States
  emojiPanelState: null,
  pexelsPanelState: null,
  pixabayPanelState: null,

  currentRoute: "/",
  get isThumbnailMode() {
    return this.currentRoute === "/image";
  },
  videoTracks: undefined,
  thumbnailTracks: undefined,
  videoSelectedTrackId: undefined,
  thumbnailSelectedTrackId: undefined,

  // Thumbnail Editor State
  thumbnail: {
    layers: [
      {
        id: "default-text-1",
        type: "text",
        content: "LOFI CHILL VIBES",
        fontFamily: "'Bangers', cursive",
        fontSize: 70,
        textColor: "#ffffff",
        strokeColor: "#f43f5e",
        strokeWidth: 6,
        shadowColor: "#000000",
        shadowBlur: 10,
        shadowOffsetX: 4,
        shadowOffsetY: 4,
        x: 640,
        y: 280,
        rotation: -4,
        scale: 1,
        bgPadding: 0,
        bgRadius: 0,
        bgColor: "transparent"
      },
      {
        id: "default-text-2",
        type: "text",
        content: "Late Night Study & Code",
        fontFamily: "'Lexend', sans-serif",
        fontSize: 36,
        textColor: "#ffffff",
        strokeColor: "#0f172a",
        strokeWidth: 4,
        shadowColor: "#000000",
        shadowBlur: 5,
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        x: 640,
        y: 380,
        rotation: 0,
        scale: 1,
        bgPadding: 8,
        bgRadius: 8,
        bgColor: "rgba(15, 23, 42, 0.75)"
      }
    ],
    selectedLayerId: "default-text-1"
  },
};

export const State = import.meta.hot?.data?.state || initialState;

if (!Object.getOwnPropertyDescriptor(State, "isThumbnailMode")) {
  Object.defineProperty(State, "isThumbnailMode", {
    get() {
      return this.currentRoute === "/image";
    },
    configurable: true
  });
}

if (import.meta.hot) {
  import.meta.hot.data.state = State;
}
