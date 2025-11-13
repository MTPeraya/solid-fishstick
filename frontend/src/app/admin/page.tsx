import ProtectedRoute from '../../components/auth/ProtectedRoute'

export default function AdminPage() {
  return (
    <ProtectedRoute>
      <div className="p-8">Admin</div>
    </ProtectedRoute>
  )
}