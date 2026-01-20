import type { VideoTextTiming, TextAnimation } from "../../types";

export const TIMING_OPTIONS: { value: VideoTextTiming; label: string }[] = [
  { value: "full", label: "Full video" },
  { value: "first-3s", label: "First 3 seconds" },
  { value: "last-3s", label: "Last 3 seconds" },
  { value: "first-5s", label: "First 5 seconds" },
  { value: "last-5s", label: "Last 5 seconds" },
];

export const ANIMATION_OPTIONS: { value: TextAnimation; label: string }[] = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade In" },
  { value: "typewriter", label: "Typewriter" },
  { value: "bounce", label: "Bounce" },
  { value: "slide-up", label: "Slide Up" },
  { value: "slide-down", label: "Slide Down" },
  { value: "slide-left", label: "Slide Left" },
  { value: "slide-right", label: "Slide Right" },
];
