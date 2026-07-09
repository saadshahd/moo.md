import type { ModelElement, ComponentFunction } from "./types";

export function createElement(
  type: string | ComponentFunction,
  props: Record<string, any> | null,
  ...children: any[]
): ModelElement {
  const normalizedChildren = children
    .flat()
    .filter(Boolean)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return {
          type: "text",
          props: { value: child.toString() },
          children: [],
        };
      }
      return child;
    });

  return {
    type,
    props: props || {},
    children: normalizedChildren,
    key: props?.key,
  };
}

export function Fragment({
  children,
}: {
  children: ModelElement[];
}): ModelElement {
  return {
    type: "Fragment",
    props: {},
    children: Array.isArray(children) ? children : [children].filter(Boolean),
  };
}
