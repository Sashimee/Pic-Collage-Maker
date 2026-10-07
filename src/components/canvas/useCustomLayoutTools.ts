import { useState } from 'react'
import { useEditor } from '../../store/editorStore'
import { useT } from '../../i18n/useLang'
import { useToasts } from '../ToastContainer'
import { SNAP_STEP, type LayoutTool } from '../CustomLayoutEditor'
import { zonesToCells } from '../../lib/customLayout'
import { saveCustomLayout } from '../../lib/customLayoutStorage'
import { track } from '../../lib/analytics'

/** State and handlers shared by the custom-layout toolbar and drawing surface. */
export function useCustomLayoutTools() {
  const t = useT()
  const toast = useToasts()
  const splitCustomLayout = useEditor((s) => s.splitCustomLayout)
  const circleCustomLayout = useEditor((s) => s.circleCustomLayout)
  const mergeCustomLayoutCell = useEditor((s) => s.mergeCustomLayoutCell)

  // Bumped to replay the layout gesture demo from the failure toast.
  const [demoNonce, setDemoNonce] = useState(0)
  const [snapEnabled, setSnapEnabled] = useState(true)
  const [tool, setTool] = useState<LayoutTool>('cut')
  const [circleOverlay, setCircleOverlay] = useState(false)

  // A layout gesture either cuts or rounds, depending on the active tool.
  // Both report back so a gesture that did nothing can say why — silence was
  // the main reason the editor felt broken.
  const onStroke = (pts: { x: number; y: number }[]) => {
    const ok =
      tool === 'circle'
        ? circleCustomLayout(pts, circleOverlay)
        : splitCustomLayout(pts, snapEnabled ? SNAP_STEP : undefined)
    if (ok) track('layout-split')
    else {
      // A stroke that did nothing is exactly when the demo is wanted, so offer
      // it rather than only saying what went wrong.
      toast.action(t('customLayout.noSplit'), {
        label: t('tips.showMe'),
        onClick: () => setDemoNonce((n) => n + 1),
      })
    }
  }

  const onTapZone = (i: number) => {
    if (!mergeCustomLayoutCell(i)) toast.info(t('customLayout.noMerge'))
  }

  const apply = () => {
    // Persist the drawn zones as a reusable layout, then apply it.
    // resolveLayoutById (used by the canvas) reads custom layouts from
    // storage, so applyLayout -> grid mode renders it immediately.
    const state = useEditor.getState()
    const cells = zonesToCells(state.customLayoutZones)
    if (cells.length < 2) {
      toast.info(t('customLayout.needMore'))
      return
    }
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)
    saveCustomLayout({
      id,
      name: `Custom ${new Date().toLocaleDateString()}`,
      createdAt: Date.now(),
      cells,
    })
    track('layout-custom-applied')
    state.applyLayout(id)
    // Go straight to filling the zones the user just drew.
    state.setAssignLayoutId(id)
  }

  return {
    demoNonce,
    snapEnabled,
    toggleSnap: () => setSnapEnabled((v) => !v),
    tool,
    setTool,
    circleOverlay,
    toggleCircleOverlay: () => setCircleOverlay((v) => !v),
    onStroke,
    onTapZone,
    apply,
  }
}
