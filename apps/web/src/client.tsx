import { StartClient } from '@tanstack/react-start'
import { createRouter } from './router'
import { hydrateRoot } from 'react-dom/client'
import { StrictMode } from 'react'

const router = createRouter()

hydrateRoot(
  document,
  <StrictMode>
    <StartClient router={router} />
  </StrictMode>,
)
