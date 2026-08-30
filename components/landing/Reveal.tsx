"use client";

// Scroll-reveal wrapper. One module-scoped IntersectionObserver is
// shared across every Reveal on the page; each instance registers a
// callback that adds the `is-revealed` class to its element on first
// intersection. Once-only.
//
// Default visual state (opacity 0, translateY 12px, 600ms ease-out)
// lives in landing.css so prefers-reduced-motion can override it.
// The `delay` prop becomes an inline `transitionDelay`.

import {
  useEffect,
  useRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";

type RevealTag = "div" | "section" | "article" | "figure" | "blockquote";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: RevealTag;
};

type RevealCallback = (el: Element) => void;

const callbacks = new Set<RevealCallback>();
let observer: IntersectionObserver | null = null;
let reduceMotion = false;

function getReduceMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function ensureObserver() {
  if (observer || typeof window === "undefined") return;
  reduceMotion = getReduceMotion();
  if (reduceMotion) return; // never created; callers fall back to immediate reveal
  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          callbacks.forEach((cb) => cb(entry.target));
        }
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.15 },
  );
}

export function Reveal({
  children,
  className = "",
  delay = 0,
  as = "div",
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    ensureObserver();

    // Reduced-motion path: skip observation entirely and reveal now.
    // The CSS in landing.css collapses opacity/transform/transition,
    // so this is a one-line shortcut that costs nothing.
    if (!observer || reduceMotion) {
      node.classList.add("is-revealed");
      return;
    }

    const cb: RevealCallback = (el) => {
      if (el === node) node.classList.add("is-revealed");
    };
    callbacks.add(cb);
    observer.observe(node);
    return () => {
      callbacks.delete(cb);
      observer?.unobserve(node);
    };
  }, []);

  const Tag = as as ElementType;
  const style: CSSProperties = delay ? { transitionDelay: `${delay}ms` } : {};
  const merged = `reveal ${className}`.trim();

  return (
    <Tag ref={ref as never} className={merged} style={style}>
      {children}
    </Tag>
  );
}