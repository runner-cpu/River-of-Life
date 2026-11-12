import { learningSources } from "../content/learning-sources";
import type { SpecimenAnnotation } from "../content/annotations";
export function validateAnnotations(
  data: Record<string, SpecimenAnnotation[]>,
): string[] {
  const errors: string[] = [];
  for (const [species, points] of Object.entries(data)) {
    if (points.length < 3 || points.length > 5)
      errors.push(`${species}: expected 3–5 points`);
    const ids = new Set<string>();
    for (const point of points) {
      if (!point.id || ids.has(point.id))
        errors.push(`${species}: duplicate/empty id`);
      ids.add(point.id);
      if (!learningSources[point.sourceRef])
        errors.push(`${species}: unknown source`);
      if (
        !point.scope.trim() ||
        !point.description.trim() ||
        !point.name.trim()
      )
        errors.push(`${species}: missing text/scope`);
      for (const [representation, surface] of Object.entries(
        point.surfaces || {},
      )) {
        const values = surface.trim().split(/\s+/).map(Number);
        if (
          !point.positions[representation as keyof typeof point.positions] ||
          values.length !== 8 ||
          values.some((v) => !Number.isFinite(v)) ||
          values.slice(0, 5).some((v) => v < 0 || !Number.isInteger(v)) ||
          values.slice(5).some((v) => v < 0 || v > 1) ||
          Math.abs(values.slice(5).reduce((a, b) => a + b, 0) - 1) > 0.002
        )
          errors.push(`${species}: invalid surface`);
      }
      if (!point.positions.diagram)
        errors.push(`${species}: missing diagram position`);
      for (const [kind, position] of Object.entries(point.positions))
        if (
          !["fossil", "reconstruction", "diagram"].includes(kind) ||
          !position ||
          position.length !== 3 ||
          position.some((v) => !Number.isFinite(v) || v < 0 || v > 1)
        )
          errors.push(`${species}: invalid position`);
    }
  }
  return errors;
}
