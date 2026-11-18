import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BarChart3, MessageSquare, Flame, Dumbbell, UserRound } from 'lucide-react';

export default function Navbar() {
    const navItems = [
        { to: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
        { to: '/exercise', icon: <Dumbbell size={20} />, label: 'Exercise' },
        { to: '/reports', icon: <BarChart3 size={20} />, label: 'Reports' },
        { to: '/chat', icon: <MessageSquare size={20} />, label: 'AI Chat' },
        { to: '/profile', icon: <UserRound size={20} />, label: 'Profile' },
    ];

    return (
        <nav className="navbar" aria-label="Primary navigation">
            <div className="navbar-brand">
                <Flame size={24} className="navbar-logo-icon" />
                <span className="navbar-logo-text">CalorAI</span>
            </div>

            <div className="navbar-links">
                {navItems.map(({ to, icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                        {icon}
                        <span>{label}</span>
                    </NavLink>
                ))}
            </div>

        </nav>
    );
}
