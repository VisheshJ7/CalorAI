import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Scale, Ruler, User, Activity, Target, TrendingDown, TrendingUp } from 'lucide-react';
import Navbar from '../components/Navbar';
import { useAuth } from '../contexts/AuthContext';
import { calculateGoalPreview } from '../utils/trackerMetrics';

const ACTIVITY_LEVELS = [
    { value: 'sedentary', label: 'Sedentary', desc: 'Little or no exercise' },
    { value: 'light', label: 'Light activity', desc: '1–3 days per week' },
    { value: 'moderate', label: 'Moderately active', desc: '3–5 days per week' },
    { value: 'active', label: 'Active', desc: '6–7 days per week' },
    { value: 'very_active', label: 'Very active', desc: 'Daily or physical work' },
];

const GOALS = [
    { value: 'lose', label: 'Lose weight', icon: TrendingDown },
    { value: 'maintain', label: 'Maintain weight', icon: Scale },
    { value: 'gain', label: 'Gain weight', icon: TrendingUp },
];

const WEIGHT_CHANGE_OPTIONS = [
    { value: 0.25, label: '0.25 kg/week', desc: 'Slow and steady' },
    { value: 0.5, label: '0.5 kg/week', desc: 'Recommended' },
    { value: 0.75, label: '0.75 kg/week', desc: 'Faster progress' },
    { value: 1.0, label: '1 kg/week', desc: 'Aggressive' },
];

export default function Profile() {
    const { user, logout, completeOnboarding } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState({
        gender: user?.gender || 'male',
        age: user?.age || '',
        height: user?.height || '',
        weight: user?.weight || '',
        activity_level: user?.activityLevel || 'moderate',
        goal: user?.goal || 'maintain',
        weight_change_per_week: user?.weightChangePerWeek || 0.5,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const goalPreview = calculateGoalPreview(user?.calorieGoal || 2000, {
        gender: form.gender,
        age: Number(form.age),
        height: Number(form.height),
        weight: Number(form.weight),
        activityLevel: form.activity_level,
        goal: form.goal,
        weeklyChangePerWeek: form.goal === 'maintain' ? 0 : Number(form.weight_change_per_week),
    });

    const handleChange = (event) => {
        setSaved(false);
        setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    };

    const handleSave = async (event) => {
        event.preventDefault();
        const age = Number(form.age);
        const height = Number(form.height);
        const weight = Number(form.weight);
        if (!Number.isInteger(age) || age < 10 || age > 120) {
            setError('Enter a valid age from 10 to 120');
            return;
        }
        if (!Number.isFinite(height) || height < 100 || height > 250) {
            setError('Enter a valid height from 100 to 250 cm');
            return;
        }
        if (!Number.isFinite(weight) || weight < 30 || weight > 300) {
            setError('Enter a valid weight from 30 to 300 kg');
            return;
        }
        setSaving(true);
        setError('');
        setSaved(false);
        try {
            await completeOnboarding({
                gender: form.gender,
                age: Number(form.age),
                height: Number(form.height),
                weight: Number(form.weight),
                activity_level: form.activity_level,
                goal: form.goal,
                weight_change_per_week: form.goal === 'maintain' ? 0 : Number(form.weight_change_per_week),
            });
            setSaved(true);
        } catch (saveError) {
            setError(saveError.message || 'Could not save your profile');
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    return (
        <div className="app-layout">
            <Navbar />
            <main className="main-content profile-page">
                <header className="page-header profile-header">
                    <div>
                        <h1 className="page-title">Profile</h1>
                        <p className="page-subtitle">Update your details and calorie goal</p>
                    </div>
                </header>

                <form className="profile-form" onSubmit={handleSave}>
                    <section className="profile-section">
                        <div className="profile-account">
                            <div className="profile-avatar">{user?.username?.[0]?.toUpperCase()}</div>
                            <div>
                                <h2>{user?.username}</h2>
                                <p>{user?.email}</p>
                            </div>
                            <span className="profile-goal-badge">{user?.calorieGoal || 2000} kcal</span>
                        </div>
                    </section>

                    <section className="profile-section">
                        <h2 className="profile-section-title">Body details</h2>
                        <div className="profile-fields">
                            <div className="form-group">
                                <label>Gender</label>
                                <div className="gender-toggle">
                                    <button type="button" className={`gender-btn ${form.gender === 'male' ? 'active' : ''}`} onClick={() => setForm((current) => ({ ...current, gender: 'male' }))}>Male</button>
                                    <button type="button" className={`gender-btn ${form.gender === 'female' ? 'active' : ''}`} onClick={() => setForm((current) => ({ ...current, gender: 'female' }))}>Female</button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="profile-age">Age</label>
                                <div className="input-icon-wrap"><User size={16} className="input-icon" /><input id="profile-age" name="age" type="number" min="10" max="120" value={form.age} onChange={handleChange} /></div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="profile-height">Height (cm)</label>
                                <div className="input-icon-wrap"><Ruler size={16} className="input-icon" /><input id="profile-height" name="height" type="number" min="100" max="250" value={form.height} onChange={handleChange} /></div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="profile-weight">Weight (kg)</label>
                                <div className="input-icon-wrap"><Scale size={16} className="input-icon" /><input id="profile-weight" name="weight" type="number" min="30" max="300" step="0.1" value={form.weight} onChange={handleChange} /></div>
                            </div>
                        </div>
                    </section>

                    <section className="profile-section">
                        <h2 className="profile-section-title"><Activity size={18} /> Activity</h2>
                        <div className="profile-choice-list">
                            {ACTIVITY_LEVELS.map((level) => (
                                <button type="button" key={level.value} className={`profile-choice ${form.activity_level === level.value ? 'active' : ''}`} onClick={() => setForm((current) => ({ ...current, activity_level: level.value }))}>
                                    <span><strong>{level.label}</strong><small>{level.desc}</small></span>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="profile-section">
                        <h2 className="profile-section-title"><Target size={18} /> Goal</h2>
                        <div className="profile-goal-grid">
                            {GOALS.map((goal) => {
                                const GoalIcon = goal.icon;
                                return (
                                    <button type="button" key={goal.value} className={`profile-choice profile-goal ${form.goal === goal.value ? 'active' : ''}`} onClick={() => setForm((current) => ({ ...current, goal: goal.value, weight_change_per_week: goal.value === 'maintain' ? 0 : current.weight_change_per_week || 0.5 }))}>
                                        <GoalIcon size={20} />
                                        <strong>{goal.label}</strong>
                                    </button>
                                );
                            })}
                        </div>
                        {form.goal !== 'maintain' && (
                            <div className="profile-rate-grid">
                                {WEIGHT_CHANGE_OPTIONS.map((option) => (
                                    <button type="button" key={option.value} className={`profile-choice ${Number(form.weight_change_per_week) === option.value ? 'active' : ''}`} onClick={() => setForm((current) => ({ ...current, weight_change_per_week: option.value }))}>
                                        <span><strong>{option.label}</strong><small>{option.desc}</small></span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>

                    {error && <div className="profile-error" role="alert">{error}</div>}
                    {saved && <div className="profile-success" role="status">Profile saved. Your calorie goal is updated.</div>}

                    {goalPreview.changed && (
                        <div className="goal-preview" role="status">
                            <span>New daily goal</span>
                            <strong>{user?.calorieGoal || 2000} → {goalPreview.goal} kcal</strong>
                            <small>Maintenance estimate: {goalPreview.maintenance} kcal</small>
                        </div>
                    )}

                    <button type="submit" className="profile-save" disabled={saving}>
                        {saving ? 'Saving...' : 'Save changes'}
                    </button>
                    <button type="button" className="profile-logout" onClick={handleLogout}>
                        <LogOut size={18} /> Log out
                    </button>
                </form>
            </main>
        </div>
    );
}
