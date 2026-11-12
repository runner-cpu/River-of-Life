import type { LearningSourceRef } from "./learning-sources";
export type AnnotationPoint = readonly [number, number, number];
export type AnnotationRepresentation = "fossil" | "reconstruction" | "diagram";
export interface SpecimenAnnotation {
  id: string;
  name: string;
  description: string;
  sourceRef: LearningSourceRef;
  scope: string;
  teachingOnly?: boolean;
  surfaces?: Partial<Record<AnnotationRepresentation, string>>;
  positions: Partial<Record<AnnotationRepresentation, AnnotationPoint>>;
}
// Coordinates are fractions of each representation's own bounds, not anatomical measurements.
export const specimenAnnotations: Record<string, SpecimenAnnotation[]> = {
  archaeopteryx: [
    {
      id: "head",
      name: "头部观察区",
      description:
        "来源记述始祖鸟具有牙齿；扫描与示意未必能清楚显示牙齿，请结合来源阅读。",
      sourceRef: "archaeopteryx",
      scope: "羽毛、牙齿、长骨尾与有爪前肢中的牙齿。",
      positions: { fossil: [0.57, 0.65, 0.6], diagram: [0.12, 0.9, 0.5] },
    },
    {
      id: "forelimb",
      name: "前肢观察区",
      description:
        "来源记述羽毛与有爪前肢；在当前表现中寻找前肢区域，不将纹理视为可确证的细节。",
      sourceRef: "archaeopteryx",
      scope: "羽毛与有爪前肢。",
      positions: { fossil: [0.5, 0.48, 0.6], diagram: [0.46, 0.56, 0.78] },
    },
    {
      id: "tail",
      name: "尾部观察区",
      description: "来源记述长骨尾；比较整体延伸方向，定位只作近似教学提示。",
      sourceRef: "archaeopteryx",
      scope: "长骨尾。",
      positions: { fossil: [0.2, 0.78, 0.6], diagram: [0.8, 0.73, 0.5] },
    },
  ],
  // Surface triangles calibrated on the shipped /models/mosasaurus.glb (2026-11-12).
  // Visible head/appendage/tail triangle centroids are approximate teaching regions.
  // Recalibrate if this asset changes; these IDs follow animation in model-viewer.
  mosasaurus: [
    {
      id: "head",
      surfaces: { reconstruction: "0 0 1890 1905 1889 0.333 0.333 0.334" },
      name: "头部观察区",
      description:
        "来源讨论头骨特征与有鳞类归属；外部模型为艺术复原，不能代替头骨证据。",
      sourceRef: "mosasaurus",
      scope: "有鳞类海生爬行动物与头骨分类依据。",
      positions: {
        reconstruction: [0.15, 0.55, 0.5],
        diagram: [0.1, 0.82, 0.5],
      },
    },
    {
      id: "fin",
      surfaces: { reconstruction: "0 0 4086 4070 4071 0.333 0.333 0.334" },
      name: "附肢外形观察区",
      description:
        "观察当前模型的附肢外形；结构示意采用简化附肢，不是鳍形科学复原，不据此作分类结论。",
      sourceRef: "mosasaurus",
      scope: "教学观察点，非科学复原断言；来源仅供有鳞类分类背景阅读。",
      teachingOnly: true,
      positions: {
        reconstruction: [0.4, 0.35, 0.82],
        diagram: [0.22, 0.18, 0.8],
      },
    },
    {
      id: "tail",
      surfaces: { reconstruction: "0 0 1215 1231 1214 0.333 0.333 0.334" },
      name: "尾部外形观察区",
      description:
        "比较身体与尾部的延伸方向；动作与轮廓为艺术呈现，不作为化石证据。",
      sourceRef: "mosasaurus",
      scope: "教学观察点，非科学复原断言；来源不支持尾部形状或动作结论。",
      teachingOnly: true,
      positions: {
        reconstruction: [0.82, 0.5, 0.5],
        diagram: [0.82, 0.5, 0.5],
      },
    },
  ],
  tiktaalik: [
    {
      id: "head",
      name: "头颈观察区",
      description: "来源讨论颅骨与颈部的特征组合；结构示意不显示精确内部骨骼。",
      sourceRef: "tiktaalik",
      scope: "报道中的颅骨与颈部特征组合。",
      positions: { diagram: [0.18, 0.55, 0.5] },
    },
    {
      id: "fin",
      name: "鳍部观察区",
      description:
        "来源同时讨论鳍与部分肢体特征；示意仅帮助找到观察区域，不能验证内部骨骼。",
      sourceRef: "tiktaalik",
      scope: "鳍与部分肢体特征组合。",
      positions: { diagram: [0.43, 0.3, 0.8] },
    },
    {
      id: "body",
      name: "身体表面观察区",
      description:
        "来源记述鳞片；当前示意并非鳞片扫描，请阅读来源区分可见外形与研究证据。",
      sourceRef: "tiktaalik",
      scope: "报道中的鳞片与特征组合。",
      positions: { diagram: [0.58, 0.6, 0.65] },
    },
  ],
};
