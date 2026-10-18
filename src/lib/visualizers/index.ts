import { BarsVisualizer } from "./bars";
import { CircleVisualizer } from "./circle";
import { WaveformVisualizer } from "./waveform";
import { BlocksVisualizer } from "./blocks";
import { LiquidWavesVisualizer } from "./liquid-waves";

export const VisualizerRegistry = [
  BarsVisualizer,
  CircleVisualizer,
  WaveformVisualizer,
  BlocksVisualizer,
  LiquidWavesVisualizer,
];

export const getVisualizer = (id: string) => {
  return VisualizerRegistry.find((v) => v.id === id) || BarsVisualizer;
};
