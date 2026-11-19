import { useState, useEffect, useCallback, useRef } from 'react';
import { Flame, Clock, Trash2, Dumbbell, TrendingUp, Activity, Zap, Plus } from 'lucide-react';
import Navbar from '../components/Navbar';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import { getLocalDayRange, loggedAtForDate, toLocalDateKey } from '../utils/date';
import { inferExerciseFallback } from '../utils/exerciseInference.js';

export default function Exercise() {
    const { user } = useAuth();
    const [todayLogs, setTodayLogs] = useState([]);
    const [totalBurnt, setTotalBurnt] = useState(0);
    const [exerciseDescription, setExerciseDescription] = useState('');
    const [inferredExercise, setInferredExercise] = useState(null);
    const [loading, setLoading] = useState(false);
    const [logging, setLogging] = useState(false);
    const [error, setError] = useState('');
    const [selectedDate, setSelectedDate] = useState(toLocalDateKey());
    const fetchRequestRef = useRef(0);

    // Fetch today's exercise logs
    const fetchTodayLogs = useCallback(async () => {
        const requestId = ++fetchRequestRef.current;
        setLoading(true);
        try {
            const { start, end } = getLocalDayRange(selectedDate);
            const { data, error } = await supabase
                .from('exercise_logs')
                .select('*')
                .eq('user_id', user.id)
                .gte('logged_at', start.toISOString())
                .lt('logged_at', end.toISOString())
                .order('logged_at', { ascending: false });
            if (error) throw error;
            if (requestId !== fetchRequestRef.current) return;
            setTodayLogs(data || []);
            setTotalBurnt((data || []).reduce((sum, log) => sum + log.calories_burnt, 0));
        } catch (err) {
            console.error('Failed to fetch today logs:', err);
        } finally {
            setLoading(false);
        }
    }, [user?.id, selectedDate]);

    useEffect(() => {
        fetchTodayLogs();
    }, [fetchTodayLogs]);

    const handleLogExercise = async () => {
        if (!exerciseDescription.trim()) {
            setError('Describe the exercise, such as “5 km brisk walk”');
            return;
        }

        setLogging(true);
        setError('');
        try {
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('weight, height')
                .eq('id', user.id)
                .single();
            if (profileError) throw profileError;
            if (!profile?.weight) throw new Error('Please complete onboarding to set your weight');

            let inference;
            try {
                const response = await fetch('/api/exercise', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        exerciseDescription: exerciseDescription.trim(),
                        weightKg: profile.weight,
                        heightCm: profile.height,
                    }),
                });
                const contentType = response.headers.get('content-type') || '';
                if (!response.ok || !contentType.includes('application/json')) {
                    throw new Error('AI inference unavailable');
                }
                inference = await response.json();
            } catch {
                const catalogueResponse = await fetch('/exercises.json');
                if (!catalogueResponse.ok) throw new Error('Could not load exercise data');
                const catalogue = await catalogueResponse.json();
                inference = inferExerciseFallback(
                    exerciseDescription,
                    profile.weight,
                    profile.height,
                    catalogue,
                );
            }
            setInferredExercise(inference);
            setExerciseDescription('');
        } catch (err) {
            setError(err.message || 'Failed to log exercise');
        } finally {
            setLogging(false);
        }
    };

    const handleConfirmExercise = async () => {
        if (!inferredExercise) return;
        setLogging(true);
        setError('');
        try {
            const { error } = await supabase
                .from('exercise_logs')
                .insert({
                    user_id: user.id,
                    exercise_name: inferredExercise.exerciseName,
                    duration_minutes: inferredExercise.durationMinutes,
                    calories_burnt: inferredExercise.caloriesBurnt,
                    logged_at: loggedAtForDate(selectedDate).toISOString(),
                });
            if (error) throw error;
            setInferredExercise(null);
            await fetchTodayLogs();
        } catch (err) {
            setError(err.message || 'Failed to log exercise');
        } finally {
            setLogging(false);
        }
    };

    const handleDeleteLog = async (logId) => {
        try {
            const { error } = await supabase
                .from('exercise_logs')
                .delete()
                .eq('id', logId)
                .eq('user_id', user.id);
            if (error) throw error;
            await fetchTodayLogs();
        } catch (err) {
            console.error('Failed to delete log:', err);
        }
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const normalized = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
        const date = new Date(normalized.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(normalized)
            ? normalized
            : `${normalized}Z`);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="app-layout">
            <Navbar />
            <main className="main-content">
                <div className="exercise-page">
                    <header className="page-header">
                        <div className="header-title">
                            <Dumbbell size={28} className="header-icon" />
                            <h1>Exercise Tracker</h1>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <p className="header-subtitle">Log your workouts and track calories burnt</p>
                            <input
                                type="date"
                                value={selectedDate}
                                max={toLocalDateKey()}
                                onChange={(event) => setSelectedDate(event.target.value)}
                                aria-label="Exercise tracking date"
                                className="date-picker"
                                id="exercise-tracking-date"
                            />
                        </div>
                    </header>

            {/* Stats Cards */}
            <div className="exercise-stats">
                <div className="stat-card burnt">
                    <div className="stat-icon">
                        <Flame size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Calories Burnt Today</span>
                        <span className="stat-value">{Math.round(totalBurnt)}</span>
                    </div>
                </div>
                <div className="stat-card sessions">
                    <div className="stat-icon">
                        <Activity size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Sessions Today</span>
                        <span className="stat-value">{todayLogs.length}</span>
                    </div>
                </div>
                <div className="stat-card duration">
                    <div className="stat-icon">
                        <Clock size={24} />
                    </div>
                    <div className="stat-info">
                        <span className="stat-label">Total Duration</span>
                        <span className="stat-value">
                            {Math.round(todayLogs.reduce((sum, l) => sum + l.duration_minutes, 0))} min
                        </span>
                    </div>
                </div>
            </div>

            {/* Log Exercise Form */}
            <div className="exercise-logger card">
                <h2 className="card-title">
                    <Plus size={20} /> Log Exercise
                </h2>
                
                {error && <div className="exercise-error">{error}</div>}

                <div className="exercise-form">
                    <div className="exercise-description-wrap">
                        <input
                            type="text"
                            placeholder="Try “5 km brisk walk” or “45 minutes cycling”"
                            value={exerciseDescription}
                            onChange={(event) => {
                                setExerciseDescription(event.target.value);
                                setInferredExercise(null);
                                setError('');
                            }}
                            className="exercise-description-input"
                            aria-label="Exercise description"
                        />
                    </div>

                    <button
                        className="log-exercise-btn"
                        onClick={handleLogExercise}
                        disabled={!exerciseDescription.trim() || logging}
                    >
                        {logging ? (
                            <span className="btn-spinner" />
                        ) : (
                            <>
                                <Zap size={18} />
                                Log Exercise
                            </>
                        )}
                    </button>
                </div>

                {inferredExercise && (
                    <div className="calorie-preview">
                        <div className="exercise-preview-copy">
                            <TrendingUp size={16} />
                            <strong>{inferredExercise.exerciseName}</strong>
                        </div>
                        <div className="exercise-preview-fields">
                            <label>
                                <span>Duration</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={inferredExercise.durationMinutes}
                                    onChange={(event) => setInferredExercise((current) => ({ ...current, durationMinutes: Number(event.target.value) || 0 }))}
                                />
                            </label>
                            <label>
                                <span>Calories</span>
                                <input
                                    type="number"
                                    min="1"
                                    value={inferredExercise.caloriesBurnt}
                                    onChange={(event) => setInferredExercise((current) => ({ ...current, caloriesBurnt: Number(event.target.value) || 0 }))}
                                />
                            </label>
                        </div>
                        <button type="button" className="log-exercise-btn exercise-confirm" onClick={handleConfirmExercise} disabled={logging || inferredExercise.durationMinutes <= 0 || inferredExercise.caloriesBurnt <= 0}>
                            {logging ? <span className="btn-spinner" /> : <>Add to today</>}
                        </button>
                    </div>
                )}
            </div>

            {/* Today's Exercise Log */}
            <div className="exercise-log card">
                <h2 className="card-title">
                <Activity size={20} /> {selectedDate === toLocalDateKey() ? "Today's" : 'Selected'} Workouts
                </h2>

                {loading ? (
                    <div className="loading-state">Loading...</div>
                ) : todayLogs.length === 0 ? (
                    <div className="empty-state">
                        <Dumbbell size={48} className="empty-icon" />
                        <p>No exercises logged today</p>
                        <span>Start your workout and log it above!</span>
                    </div>
                ) : (
                    <div className="exercise-list">
                        {todayLogs.map((log) => (
                            <div key={log.id} className="exercise-item">
                                <div className="exercise-item-main">
                                    <div className="exercise-item-icon">
                                        <Dumbbell size={20} />
                                    </div>
                                    <div className="exercise-item-info">
                                        <span className="exercise-item-name">{log.exercise_name}</span>
                                        <span className="exercise-item-meta">
                                            <Clock size={12} /> {log.duration_minutes} min • {formatTime(log.logged_at)}
                                        </span>
                                    </div>
                                </div>
                                <div className="exercise-item-right">
                                    <span className="exercise-item-calories">
                                        <Flame size={14} />
                                        {Math.round(log.calories_burnt)} kcal
                                    </span>
                                    <button
                                        className="delete-btn"
                                        onClick={() => handleDeleteLog(log.id)}
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                </div>
            </div>
            </main>
        </div>
    );
}
