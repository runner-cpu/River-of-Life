import type { ModelViewerElement } from "@google/model-viewer";
import {
  specimenAnnotations,
  type AnnotationRepresentation,
} from "../content/annotations";
import { learningSources } from "../content/learning-sources";
import { escape } from "../core/ui";
import type { SpecimenStage } from "../scene/life-scene";
import "./specimen-annotations.css";

type AnchoredViewer = ModelViewerElement;
export function mountSpecimenAnnotations(
  dialog: HTMLDialogElement,
  speciesId: string,
) {
  const points = specimenAnnotations[speciesId] || [];
  const host = dialog.querySelector<HTMLElement>("#specimen-annotations")!;
  host.innerHTML = `<button class="btn small" id="toggle-annotations" aria-pressed="false" ${points.length ? "" : "disabled"}>结构标注</button><p class="annotation-caution">${points.length ? "近似教学观察位置，非精确解剖标定；扫描、复原和示意的可见细节不同。" : "此档案尚无经核对的结构观察点。"}</p><div class="annotation-reading" hidden><p class="muted">文字观察点（与模型标记同序；模型不可见时仍可阅读）</p><div class="annotation-list"></div><div class="annotation-description" role="region" aria-label="观察点说明" hidden></div></div>`;
  const toggle = host.querySelector<HTMLButtonElement>("#toggle-annotations")!;
  const reading = host.querySelector<HTMLElement>(".annotation-reading")!;
  const list = host.querySelector<HTMLElement>(".annotation-list")!;
  const description = host.querySelector<HTMLElement>(
    ".annotation-description",
  )!;
  let enabled = false,
    selected = -1,
    origin: HTMLElement | undefined,
    marks: HTMLButtonElement[] = [],
    unsubscribe: (() => void) | undefined;
  let viewer: AnchoredViewer | undefined,
    stage: SpecimenStage | undefined,
    kind: AnnotationRepresentation = "diagram";
  const textButtons = points.map((point, index) => {
    const button = document.createElement("button");
    button.className = "btn small";
    button.textContent = `${index + 1} ${point.name}`;
    button.setAttribute("aria-expanded", "false");
    button.addEventListener("click", () => open(index, button));
    list.append(button);
    return button;
  });
  function open(index: number, trigger: HTMLElement) {
    selected = index;
    origin = trigger;
    const point = points[index],
      source = learningSources[point.sourceRef];
    textButtons.forEach((b, i) =>
      b.setAttribute("aria-expanded", String(i === index)),
    );
    marks.forEach((b, i) =>
      b.setAttribute("aria-expanded", String(i === index)),
    );
    description.hidden = false;
    description.innerHTML = `<h3>${index + 1} ${escape(point.name)}</h3><p>${escape(point.description)}</p><p><strong>核对范围：</strong>${escape(point.scope)}</p><p>${point.teachingOnly ? "教学观察点，非科学复原断言。" : "来源的文字证据不等于当前模型可见细节。"}</p><a target="_blank" rel="noopener noreferrer" href="${escape(source.url)}">${escape(source.title)}</a><small>核对 ${escape(source.checked)} · ${escape(kind === "fossil" ? "扫描" : kind === "reconstruction" ? "艺术复原" : "结构示意")}中的近似教学观察区</small><button class="btn small annotation-close">关闭观察点说明</button>`;
    description
      .querySelector("button")!
      .addEventListener("click", closeDescription);
  }
  function closeDescription() {
    description.hidden = true;
    selected = -1;
    textButtons.forEach((b) => b.setAttribute("aria-expanded", "false"));
    marks.forEach((b) => b.setAttribute("aria-expanded", "false"));
    if (origin?.isConnected) origin.focus({ preventScroll: true });
  }
  function detach() {
    unsubscribe?.();
    unsubscribe = undefined;
    marks.forEach((b) => b.remove());
    marks = [];
  }
  function attach() {
    detach();
    if (!enabled) return;
    if (!viewer && !stage) return;
    points.forEach((point, index) => {
      const position = point.positions[kind];
      if (!position) return;
      const button = document.createElement("button");
      button.className = "annotation-hotspot";
      button.textContent = String(index + 1);
      button.setAttribute("aria-label", `${index + 1} ${point.name}`);
      button.setAttribute("aria-expanded", String(selected === index));
      button.addEventListener("click", () => open(index, button));
      if (viewer) {
        const size = viewer.getDimensions(),
          center = viewer.getBoundingBoxCenter();
        button.slot = `hotspot-${point.id}`;
        button.dataset.position = position
          .map(
            (v, i) =>
              center[(["x", "y", "z"] as const)[i]] +
              (v - 0.5) * size[(["x", "y", "z"] as const)[i]],
          )
          .map((v) => `${v}m`)
          .join(" ");
        if (point.surfaces?.[kind])
          button.dataset.surface = point.surfaces[kind];
        viewer.append(button);
      } else dialog.querySelector("#model-stage")!.append(button);
      marks.push(button);
    });
    if (stage)
      unsubscribe = stage.onProjection(
        points.map((p) => p.positions.diagram!),
        (projected) =>
          projected.forEach((p, index) => {
            const button = marks[index];
            if (!button) return;
            button.style.left = `${p.x}px`;
            button.style.top = `${p.y}px`;
            button.hidden = !p.visible;
          }),
      );
  }
  toggle.addEventListener("click", () => {
    enabled = !enabled;
    toggle.setAttribute("aria-pressed", String(enabled));
    reading.hidden = !enabled;
    if (!enabled) {
      description.hidden = true;
      selected = -1;
      textButtons.forEach((b) => b.setAttribute("aria-expanded", "false"));
    }
    attach();
  });
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape" && selected >= 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeDescription();
    }
  };
  dialog.addEventListener("keydown", onKey, true);
  return {
    bind(
      nextViewer: HTMLElement | undefined,
      nextStage: SpecimenStage | undefined,
      representation: AnnotationRepresentation = "diagram",
    ) {
      detach();
      viewer = nextViewer as AnchoredViewer | undefined;
      stage = nextStage;
      kind = representation;
      attach();
      if (selected >= 0) open(selected, textButtons[selected]);
    },
    dispose() {
      detach();
      dialog.removeEventListener("keydown", onKey, true);
    },
  };
}
