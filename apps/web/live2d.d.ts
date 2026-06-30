// JSX typings for the <live2d-model> custom element provided by
// @live2d-loader/element. React 19 reads intrinsic elements from the
// `React.JSX` namespace, so we augment that. The global `JSX` namespace is
// augmented too as a fallback for tooling that still consults it.
import type { Live2DModelElement } from "@live2d-loader/element";
import type { DetailedHTMLProps, HTMLAttributes } from "react";

type Live2DModelProps = DetailedHTMLProps<
  HTMLAttributes<Live2DModelElement> & {
    src?: string;
    width?: number;
    height?: number;
    "cubism-core"?: string;
  },
  Live2DModelElement
>;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "live2d-model": Live2DModelProps;
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "live2d-model": Live2DModelProps;
    }
  }
}

export {};
