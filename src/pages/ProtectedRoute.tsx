// ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
  // Check for the existence of your session/cookie
  // In a real app, you might also call an API to verify the token
  const isAuthenticated = document.cookie.includes('access_token');

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};

export default ProtectedRoute;