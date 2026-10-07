import type { CanvasElement, ElementType } from '../types'

const COMMON = ['opacity', 'blendMode'] as const

const BY_TYPE: Record<ElementType, readonly string[]> = {
  photo: ['filters', 'filterStack', 'shape', 'styling'],
  text: [
    'fontFamily',
    'fontSize',
    'fill',
    'fontStyle',
    'stroke',
    'strokeWidth',
    'shadowColor',
    'shadowBlur',
    'chip',
    'lineHeight',
    'letterSpacing',
    'align',
    'effects',
  ],
  shape: ['fill', 'stroke', 'strokeWidth'],
  drawing: ['stroke', 'strokeWidth'],
  path: ['stroke', 'strokeWidth', 'fill'],
  sticker: [],
  group: [],
}

/** The look of an element, without its content or placement. */
export interface ElementStyle {
  type: ElementType
  props: Record<string, unknown>
}

/**
 * Keys the source lacks are kept as `undefined`, so pasting clears them on the
 * target: a photo without a border pastes "no border", not "whatever it had".
 */
export function styleOf(el: CanvasElement): ElementStyle {
  const source = el as unknown as Record<string, unknown>
  const props: Record<string, unknown> = {}
  for (const key of [...COMMON, ...BY_TYPE[el.type]]) props[key] = source[key]
  return { type: el.type, props }
}

/**
 * The patch that gives `target` the copied style. Opacity and blend mode carry
 * across element types; everything else only between elements of one type.
 */
export function stylePatch(style: ElementStyle, target: CanvasElement): Partial<CanvasElement> {
  const keys = style.type === target.type ? [...COMMON, ...BY_TYPE[target.type]] : COMMON
  const patch: Record<string, unknown> = {}
  for (const key of keys) patch[key] = style.props[key]
  return patch as Partial<CanvasElement>
}
