import { RouterProvider } from 'react-router/dom'
import { Providers } from './providers'
import { PwaUpdater } from './PwaUpdater'
import { router } from './router'

export function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
      <PwaUpdater />
    </Providers>
  )
}
