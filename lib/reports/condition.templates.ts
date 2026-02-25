import type { ReportPhoto } from "./condition.types";

interface Templates {
  comments: string[];
  recommendations: string[];
}

const COMMENT_MAP: Record<string, string> = {
  crack:
    "Cracking was observed to the render/coating surface, indicative of movement and moisture ingress.",
  damp: "Damp and moisture damage was identified in several locations, requiring treatment prior to coating application.",
  water:
    "Damp and moisture damage was identified in several locations, requiring treatment prior to coating application.",
  moisture:
    "Damp and moisture damage was identified in several locations, requiring treatment prior to coating application.",
  spall:
    "Spalling and delamination of the render was noted across multiple faces of the building envelope.",
  delam:
    "Spalling and delamination of the render was noted across multiple faces of the building envelope.",
  rust: "Rust staining and carbonation of the concrete substrate was observed, requiring treatment prior to recoating.",
  carbon:
    "Rust staining and carbonation of the concrete substrate was observed, requiring treatment prior to recoating.",
  paint:
    "Peeling and flaking of the existing paint system was prevalent across the building envelope, requiring full preparation prior to recoating.",
  peel: "Peeling and flaking of the existing paint system was prevalent across the building envelope, requiring full preparation prior to recoating.",
  flak: "Peeling and flaking of the existing paint system was prevalent across the building envelope, requiring full preparation prior to recoating.",
};

const RECOMMENDATION_MAP: Record<string, string> = {
  crack:
    "Raking out and repointing of all visible cracks with a flexible sealant prior to recoating.",
  damp: "Investigation and rectification of all water ingress points prior to commencement of coating works.",
  water:
    "Investigation and rectification of all water ingress points prior to commencement of coating works.",
  moisture:
    "Investigation and rectification of all water ingress points prior to commencement of coating works.",
  spall:
    "Full removal of all delaminated render and application of a compatible render system to match existing profile.",
  delam:
    "Full removal of all delaminated render and application of a compatible render system to match existing profile.",
  rust: "Treatment of all affected reinforcement with a rust inhibitor and application of a protective barrier coat prior to recoating.",
  carbon:
    "Treatment of all affected reinforcement with a rust inhibitor and application of a protective barrier coat prior to recoating.",
  paint:
    "High-pressure wash, full preparation of all surfaces and application of the specified paint system.",
  peel: "High-pressure wash, full preparation of all surfaces and application of the specified paint system.",
  flak: "High-pressure wash, full preparation of all surfaces and application of the specified paint system.",
  roof: "Engagement of a licensed roofing contractor to assess and repair all roof flashings and penetrations.",
  flash:
    "Engagement of a licensed roofing contractor to assess and repair all roof flashings and penetrations.",
};

const DEFAULT_COMMENT =
  "A general inspection of the building was carried out. Maintenance requirements were identified and are documented within this report.";

const DEFAULT_RECOMMENDATION =
  "Carry out all identified repair works prior to application of the specified coating system. Re-inspect on completion.";

export function inferTemplatesFromPhotos(photos: ReportPhoto[]): Templates {
  const combined = photos.map((p) => p.name.toLowerCase()).join(" ");

  const seenCommentKeys = new Set<string>();
  const seenRecoKeys = new Set<string>();
  const comments: string[] = [];
  const recommendations: string[] = [];

  for (const [key, text] of Object.entries(COMMENT_MAP)) {
    if (combined.includes(key) && !seenCommentKeys.has(text)) {
      seenCommentKeys.add(text);
      comments.push(text);
    }
  }

  for (const [key, text] of Object.entries(RECOMMENDATION_MAP)) {
    if (combined.includes(key) && !seenRecoKeys.has(text)) {
      seenRecoKeys.add(text);
      recommendations.push(text);
    }
  }

  return {
    comments: comments.length > 0 ? comments : [DEFAULT_COMMENT],
    recommendations:
      recommendations.length > 0
        ? [DEFAULT_RECOMMENDATION]
        : [DEFAULT_RECOMMENDATION],
  };
}

export function formatDate(iso?: string): string {
  if (!iso) return new Date().toLocaleDateString("en-AU");
  try {
    return new Date(iso).toLocaleDateString("en-AU");
  } catch {
    return iso;
  }
}
