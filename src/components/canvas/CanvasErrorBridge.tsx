import { Component, type ReactNode } from 'react'

/**
 * react-konva renders the stage through its own reconciler, so an error thrown
 * by a node inside it never reaches the DOM tree's ErrorBoundary: the board
 * just goes blank while the app keeps running — and keeps autosaving the state
 * that broke it. This catches inside the stage and hands the error to the DOM
 * side, which rethrows it there.
 */
export class CanvasErrorBridge extends Component<
  { onError: (error: Error) => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    this.props.onError(error)
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
