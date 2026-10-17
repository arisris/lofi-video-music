import m from "mithril";
import { State } from "./state";
import { runtime } from "./runtime";
import { getRandomKenBurnsEffect, getClipsToSearch } from "../utils/helpers";
import { stopRecording } from "./recorder";

export const reconnectAudioEngine = () => {
  if (!runtime.audioCtx || !runtime.audioEl) return;
  
  try {
    // Focus only on connecting audio nodes, not playback control
    if (!runtime.source) {
      runtime.source = runtime.audioCtx.createMediaElementSource(runtime.audioEl);
      
      // Connect in series: source -> eqLow -> eqMid -> eqHigh -> gainNode -> panner -> analyser
      let lastNode = runtime.source;
      if (runtime.eqLow) {
        lastNode.connect(runtime.eqLow);
        lastNode = runtime.eqLow;
      }
      if (runtime.eqMid) {
        lastNode.connect(runtime.eqMid);
        lastNode = runtime.eqMid;
      }
      if (runtime.eqHigh) {
        lastNode.connect(runtime.eqHigh);
        lastNode = runtime.eqHigh;
      }
      if (runtime.gainNode) {
        lastNode.connect(runtime.gainNode);
        lastNode = runtime.gainNode;
      }
      if (runtime.panner) {
        lastNode.connect(runtime.panner);
        lastNode = runtime.panner;
      }
      lastNode.connect(runtime.analyser);
    }
  } catch (e) {
    console.warn("Audio reconnection failed:", e);
  }
};

export const applyAudioSettings = (clip) => {
  if (!clip || !runtime.audioEl) return;

  const volumeVal = clip.settings.volume ?? 1.0;

  // Apply volume. Keep base HTML5 volume fader at 1.0 maximum.
  // If the audio engine is not initialized yet, fall back to setting audioEl.volume (up to 1.0).
  if (!State.isAudioInit) {
    runtime.audioEl.volume = Math.min(1.0, volumeVal);
  } else {
    runtime.audioEl.volume = 1.0;
  }

  // Apply playback speed
  runtime.audioEl.playbackRate = clip.settings.playbackRate ?? 1.0;

  // Apply EQ, Gain (Volume Boost) & Panning settings if audio engine is initialized
  if (State.isAudioInit && runtime.audioCtx) {
    const time = runtime.audioCtx.currentTime;
    if (runtime.gainNode) {
      runtime.gainNode.gain.setValueAtTime(volumeVal, time);
    }
    if (runtime.eqLow) {
      runtime.eqLow.gain.setValueAtTime(clip.settings.eqLow ?? 0, time);
    }
    if (runtime.eqMid) {
      runtime.eqMid.gain.setValueAtTime(clip.settings.eqMid ?? 0, time);
    }
    if (runtime.eqHigh) {
      runtime.eqHigh.gain.setValueAtTime(clip.settings.eqHigh ?? 0, time);
    }
    if (runtime.panner) {
      runtime.panner.pan.setValueAtTime(clip.settings.pan ?? 0, time);
    }
  }
};

export const initAudioEngine = () => {
  if (State.isAudioInit) {
    reconnectAudioEngine();
    return;
  }
  
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  runtime.audioCtx = new AudioContext();

  runtime.analyser = runtime.audioCtx.createAnalyser();
  runtime.analyser.fftSize = 512;
  runtime.analyser.smoothingTimeConstant = 0.8;

  if (!runtime.source) {
    runtime.source = runtime.audioCtx.createMediaElementSource(runtime.audioEl);
  }

  // Create 3-band EQ filters
  runtime.eqLow = runtime.audioCtx.createBiquadFilter();
  runtime.eqLow.type = "lowshelf";
  runtime.eqLow.frequency.value = 150;

  runtime.eqMid = runtime.audioCtx.createBiquadFilter();
  runtime.eqMid.type = "peaking";
  runtime.eqMid.Q.value = 1.0;
  runtime.eqMid.frequency.value = 1000;

  runtime.eqHigh = runtime.audioCtx.createBiquadFilter();
  runtime.eqHigh.type = "highshelf";
  runtime.eqHigh.frequency.value = 4000;

  // Create Gain Node for volume boost
  runtime.gainNode = runtime.audioCtx.createGain();

  // Create Stereo Panner Node
  runtime.panner = runtime.audioCtx.createStereoPanner ? runtime.audioCtx.createStereoPanner() : null;
  
  runtime.dest = runtime.audioCtx.createMediaStreamDestination();

  // Route in series: source -> eqLow -> eqMid -> eqHigh -> gainNode -> panner -> analyser -> outputs
  let lastNode = runtime.source;
  
  lastNode.connect(runtime.eqLow);
  lastNode = runtime.eqLow;

  lastNode.connect(runtime.eqMid);
  lastNode = runtime.eqMid;

  lastNode.connect(runtime.eqHigh);
  lastNode = runtime.eqHigh;

  lastNode.connect(runtime.gainNode);
  lastNode = runtime.gainNode;

  if (runtime.panner) {
    lastNode.connect(runtime.panner);
    lastNode = runtime.panner;
  }

  lastNode.connect(runtime.analyser);
  runtime.analyser.connect(runtime.audioCtx.destination);
  runtime.analyser.connect(runtime.dest);

  const bufferLength = runtime.analyser.frequencyBinCount;
  runtime.dataArray = new Uint8Array(bufferLength);

  State.isAudioInit = true;
};

export const playAudio = () => {
  initAudioEngine();
  
  if (runtime.audioCtx.state === "suspended") {
    runtime.audioCtx.resume().catch((e) => console.warn(e));
  }

  const clipsToSearch = getClipsToSearch(State);

  const activeClip = clipsToSearch.find(c => 
    c.type === 'music' && 
    c.settings?.enabled !== false &&
    State.currentTime >= c.start && 
    State.currentTime <= c.start + c.duration
  );

  State.isPlaying = true;

  if (activeClip) {
    const localTime = State.currentTime - activeClip.start;
    const playheadTime = localTime + (activeClip.settings.startOffset || 0);

    if (runtime.audioEl.src !== activeClip.settings.audioUrl) {
      runtime.audioEl.src = activeClip.settings.audioUrl;
    }
    
    // Apply current settings (volume, speed, pan, EQ)
    applyAudioSettings(activeClip);
    
    if (playheadTime < (activeClip.settings.audioDuration || activeClip.duration)) {
      runtime.audioEl.currentTime = playheadTime;
      runtime.audioEl.play().catch((error) => {
        if (error.name !== "AbortError") {
          console.warn("Playback prevented by browser policy.", error);
        }
      });
    } else {
      runtime.audioEl.pause();
    }
  } else {
    runtime.audioEl.pause();
  }
  m.redraw();
};

export const pauseAudio = () => {
  if (runtime.audioEl) {
    runtime.audioEl.pause();
  }
  State.isPlaying = false;
  m.redraw();
};

export const skipToNextTrack = () => {
  const clipsToSearch = getClipsToSearch(State);

  const musicClips = clipsToSearch
    .filter(c => c.type === 'music' && c.settings?.enabled !== false)
    .sort((a, b) => a.start - b.start);
    
  if (musicClips.length === 0) return;
  
  const nextClip = musicClips.find(c => c.start > (State.currentTime || 0) + 0.1);
  if (nextClip) {
    State.currentTime = nextClip.start;
  } else {
    State.currentTime = musicClips[0].start;
  }
  
  if (State.isPlaying) {
    playAudio();
  } else {
    m.redraw();
  }
};

export const skipToPrevTrack = () => {
  const clipsToSearch = getClipsToSearch(State);

  const musicClips = clipsToSearch
    .filter(c => c.type === 'music' && c.settings?.enabled !== false)
    .sort((a, b) => a.start - b.start);
    
  if (musicClips.length === 0) return;
  
  const curTime = State.currentTime || 0;
  const currentClipIdx = musicClips.findIndex(c => curTime >= c.start && curTime <= c.start + c.duration);
  
  if (currentClipIdx !== -1) {
    const currentClip = musicClips[currentClipIdx];
    if (curTime - currentClip.start > 2) {
      State.currentTime = currentClip.start;
    } else if (currentClipIdx > 0) {
      State.currentTime = musicClips[currentClipIdx - 1].start;
    } else {
      State.currentTime = currentClip.start;
    }
  } else {
    const prevClip = [...musicClips].reverse().find(c => c.start + c.duration < curTime);
    if (prevClip) {
      State.currentTime = prevClip.start;
    } else {
      State.currentTime = musicClips[0].start;
    }
  }
  
  if (State.isPlaying) {
    playAudio();
  } else {
    m.redraw();
  }
};

// Deprecated selectTrack compatibility stub
export const selectTrack = (index, autoPlay = true) => {
  console.warn("selectTrack is deprecated. Use timeline music clip controls.");
};
