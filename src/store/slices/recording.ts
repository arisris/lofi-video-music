import type { StateCreator } from "zustand";
import type { EditorStore } from "../store-types";

/** Recording modes: the full timeline, or a single music clip. */
export type RecordMode = "timeline" | "clip";
export type PendingRecordMode = RecordMode;
export type RecordResolution = "720p" | "1080p" | "1440p";
export type RecordFps = 30 | 60;

/** Video recording options and live recording status. */
export interface RecordingSlice {
  isRecording: boolean;
  recordingMode: RecordMode;
  recordStartTime: number;
  /** Formatted mm:ss shown in the transport bar. */
  recordingTime: string;
  /** Total clip duration while recording a single clip. */
  recordingTargetClipEnd: number;

  showRecordSettingsModal: boolean;
  showRecordMenu: boolean;
  pendingRecordMode: PendingRecordMode;
  recordResolution: RecordResolution;
  recordFps: RecordFps;
}

export const createRecordingSlice: StateCreator<EditorStore, [], [], RecordingSlice> = () => ({
  isRecording: false,
  recordingMode: "timeline",
  recordStartTime: 0,
  recordingTime: "00:00",
  recordingTargetClipEnd: 0,

  showRecordSettingsModal: false,
  showRecordMenu: false,
  pendingRecordMode: "timeline",
  recordResolution: "720p",
  recordFps: 30,
});
