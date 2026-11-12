import { expect, it } from "vitest";
import { specimenAnnotations } from "../src/content/annotations";
import { validateAnnotations } from "../src/core/annotations";
it("validates all three annotation sets and distinct representation maps", () => {
  expect(Object.keys(specimenAnnotations)).toHaveLength(3);
  expect(validateAnnotations(specimenAnnotations)).toEqual([]);
  expect(specimenAnnotations.archaeopteryx[0].positions.fossil).not.toEqual(
    specimenAnnotations.archaeopteryx[0].positions.diagram,
  );
});
it("rejects count, duplicate ids, missing source/scope and invalid coordinates", () => {
  const point = structuredClone(specimenAnnotations.archaeopteryx[0]);
  point.sourceRef = "absent";
  point.scope = "";
  point.positions.diagram = [NaN, 2, 0];
  expect(validateAnnotations({ bad: [point, point] })).toEqual(
    expect.arrayContaining([
      expect.stringContaining("3–5"),
      expect.stringContaining("unknown source"),
      expect.stringContaining("missing text/scope"),
      expect.stringContaining("invalid position"),
      expect.stringContaining("duplicate"),
    ]),
  );
});

it('rejects invalid surface triangle weights',()=>{
 const point=structuredClone(specimenAnnotations.mosasaurus[0]);
 point.surfaces={reconstruction:'0 0 1 2 3 3 -1 -1'};
 expect(validateAnnotations({bad:[point,point,point]})).toContain('bad: invalid surface');
});
