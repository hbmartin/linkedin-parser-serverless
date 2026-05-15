import type { ParsedDateRange } from './profile.js';

export interface TextItem {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  width: number;
  height: number;
}

export interface LayoutInfo {
  type: 'two-column' | 'single-column';
  sidebarBounds?: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  mainBounds?: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
}

export interface WorkExperience {
  organization: string;
  totalDuration?: string;
  positions: Position[];
}

export interface Position {
  title: string;
  duration: string;
  dates?: ParsedDateRange;
  location?: string;
  description?: string;
}

export interface StructuralSection {
  type:
    | 'organization'
    | 'position'
    | 'duration'
    | 'location'
    | 'description'
    | 'other';
  text: string;
  fontSize: number;
  y: number;
  confidence: number;
}
