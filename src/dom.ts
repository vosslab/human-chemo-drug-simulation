// ============================================
// dom.ts -- Typed DOM lookup helpers that fail loudly on missing nodes
// ============================================
// The render and bootstrap modules look elements up by id and immediately use
// concrete element APIs (innerHTML, textContent, value, checked, addEventListener).
// These helpers centralize the null check so callers get a narrowed element type
// and a clear error naming the missing id, rather than a silent null dereference.
// ============================================

// ============================================
// Look up an element by id, throwing if it is absent.
export function requireElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`Required element not found: #${id}`);
  }
  return element;
}

// ============================================
// Look up an <input> by id (range sliders, checkboxes), throwing if absent or wrong type.
export function requireInput(id: string): HTMLInputElement {
  const element = requireElement(id);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`Element #${id} is not an <input> element`);
  }
  return element;
}

// ============================================
// Look up a <select> by id (randomness mode), throwing if absent or wrong type.
export function requireSelect(id: string): HTMLSelectElement {
  const element = requireElement(id);
  if (!(element instanceof HTMLSelectElement)) {
    throw new Error(`Element #${id} is not a <select> element`);
  }
  return element;
}

// ============================================
// Look up a <button> by id, throwing if absent or wrong type.
export function requireButton(id: string): HTMLButtonElement {
  const element = requireElement(id);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Element #${id} is not a <button> element`);
  }
  return element;
}

// ============================================
// Look up an <svg> element by id, throwing if absent or wrong type.
export function requireSvg(id: string): SVGSVGElement {
  const element = document.getElementById(id);
  if (element === null) {
    throw new Error(`Required SVG element not found: #${id}`);
  }
  if (!(element instanceof SVGSVGElement)) {
    throw new Error(`Element #${id} is not an <svg> element`);
  }
  return element;
}
