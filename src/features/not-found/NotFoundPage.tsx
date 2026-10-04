import { Link } from 'react-router'
import { PageHeader } from '../../components/ui/PageHeader'

export function NotFoundPage() {
  return <>
    <PageHeader title="Página no encontrada" />
    <p>La dirección no existe.</p>
    <Link to="/">Volver al inicio</Link>
  </>
}
