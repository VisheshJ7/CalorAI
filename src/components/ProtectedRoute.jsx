import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, requireOnboarding = false }) {
    const { user, loading } = useAuth();

    if (loading) return null;
    
    if (!user) {
        return <Navigate to="/login" replace />;
    }
    
    // If this route requires onboarding and user hasn't completed it
    if (requireOnboarding && !user.onboardingCompleted) {
        return <Navigate to="/onboarding" replace />;
    }
    
    return children;
}
