import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: IndexPage,
})

function IndexPage() {
  return (
    <main>
      <h1>GovTrace</h1>
      <p>Trace the flow of money and influence in Canadian government.</p>
      <p>
        <em>Search and entity profiles coming in Phase 2.</em>
      </p>
    </main>
  )
}
