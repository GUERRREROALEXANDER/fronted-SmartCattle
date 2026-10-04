import { RouterProvider } from 'react-router'
import { router } from './router'
import { AuthProvider } from './auth/AuthProvider'

export default function App() {
  return <AuthProvider><RouterProvider router={router} /></AuthProvider>
}
