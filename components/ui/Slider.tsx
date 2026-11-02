"use client";
// The app's slider: a range input styled in globals.css, with the track
// filled up to the value.

import type { CSSProperties, InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange" | "min" | "max"> & {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
};

export default function Slider({ value, min, max, onChange, style, ...rest }: Props) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      {...rest}
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ ...style, "--fill-pct": `${pct}%` } as CSSProperties}
    />
  );
}
