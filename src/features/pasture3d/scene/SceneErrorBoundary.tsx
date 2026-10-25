import { Component, type ReactNode } from 'react'

interface SceneErrorBoundaryProps {
  fallback: ReactNode
  children: ReactNode
}

/** Catches WebGL context or shader failures that the up-front probe cannot predict. */
export class SceneErrorBoundary extends Component<SceneErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
