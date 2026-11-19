import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import { getLocalDayRange, loggedAtForDate, toLocalDateKey } from '../utils/date';
import { calculateDailySummary } from '../utils/trackerMetrics';
import { estimateFoodFallback } from '../utils/foodEstimate';
import { useNavigate } from 'react-router-dom';
import {
    Flame, Plus, Trash2, Apple, RefreshCw, Target, TrendingUp, Utensils, Settings, X, Dumbbell, Minus
} from 'lucide-react';

export default function Dashboard() {
    const { user, updateSettings } = useAuth();
    const navigate = useNavigate();
    const [foodInput, setFoodInput] = useState('');
    const [logs, setLogs] = useState([]);
    const [totalCalories, setTotalCalories] = useState(0);
    const [totalMacros, setTotalMacros] = useState({ protein: 0, carbs: 0, fats: 0 });
    const [caloriesBurnt, setCaloriesBurnt] = useState(0);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState('');
    const [lastAdded, setLastAdded] = useState(null);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [newGoal, setNewGoal] = useState(user?.calorieGoal || 2000);
    const [savingGoal, setSavingGoal] = useState(false);
    const [selectedDate, setSelectedDate] = useState(toLocalDateKey());
    const [nutritionPreview, setNutritionPreview] = useState(null);
    const fetchRequestRef = useRef(0);

    const dailyGoal = user?.calorieGoal || 2000;

    const fetchToday = useCallback(async () => {
        const requestId = ++fetchRequestRef.current;
        try {
            setFetching(true);
            const { start, end } = getLocalDayRange(selectedDate);
            const [foodRes, exerciseRes] = await Promise.all([
                supabase.from('calorie_logs').select('*').eq('user_id', user.id)
                    .gte('logged_at', start.toISOString()).lt('logged_at', end.toISOString())
                    .order('logged_at', { ascending: false }),
                supabase.from('exercise_logs').select('*').eq('user_id', user.id)
                    .gte('logged_at', start.toISOString()).lt('logged_at', end.toISOString()),
            ]);
            if (foodRes.error) throw foodRes.error;
            if (exerciseRes.error) throw exerciseRes.error;
            if (requestId !== fetchRequestRef.current) return;
            const foodLogs = foodRes.data || [];
            const exerciseLogs = exerciseRes.data || [];
            setLogs(foodLogs);
            setTotalCalories(foodLogs.reduce((sum, log) => sum + log.calories, 0));
            setTotalMacros({
                protein: foodLogs.reduce((sum, log) => sum + (log.protein || 0), 0),
                carbs: foodLogs.reduce((sum, log) => sum + (log.carbs || 0), 0),
                fats: foodLogs.reduce((sum, log) => sum + (log.fats || 0), 0),
            });
            setCaloriesBurnt(exerciseLogs.reduce((sum, log) => sum + log.calories_burnt, 0));
        } catch (e) {
            console.error(e);
        } finally {
            setFetching(false);
        }
    }, [user?.id, selectedDate]);

    useEffect(() => { fetchToday(); }, [fetchToday]);

    const handleSaveGoal = async () => {
        if (newGoal < 500 || newGoal > 10000) return;
        setSavingGoal(true);
        try {
            await updateSettings(newGoal);
            setShowGoalModal(false);
        } catch (e) {
            console.error(e);
        } finally {
            setSavingGoal(false);
        }
    };

    const handleLog = async (e) => {
        e.preventDefault();
        if (!foodInput.trim()) return;
        setError('');
        setLoading(true);
        setNutritionPreview(null);
        try {
            let nutrition;
            try {
                const response = await fetch('/api/nutrition', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ foodItem: foodInput.trim() }),
                });
                const contentType = response.headers.get('content-type') || '';
                if (!response.ok || !contentType.includes('application/json')) {
                    throw new Error('AI unavailable');
                }
                nutrition = await response.json();
            } catch {
                nutrition = estimateFoodFallback(foodInput.trim());
            }
            setNutritionPreview({
                food_item: foodInput.trim(),
                calories: Number(nutrition.calories),
                protein: Number(nutrition.protein || 0),
                carbs: Number(nutrition.carbs || 0),
                fats: Number(nutrition.fats || 0),
                serving_size: String(nutrition.serving_size || '1 serving'),
                notes: String(nutrition.notes || ''),
                source: 'estimated',
            });
        } catch (err) {
            setError(err.message || 'Failed to analyze food. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmNutrition = async () => {
        if (!nutritionPreview) return;
        setLoading(true);
        setError('');
        try {
            const { data, error } = await supabase
                .from('calorie_logs')
                .insert({
                    user_id: user.id,
                    food_item: nutritionPreview.food_item,
                    calories: nutritionPreview.calories,
                    protein: nutritionPreview.protein,
                    carbs: nutritionPreview.carbs,
                    fats: nutritionPreview.fats,
                    serving_size: nutritionPreview.serving_size,
                    notes: nutritionPreview.notes,
                    logged_at: loggedAtForDate(selectedDate).toISOString(),
                })
                .select('*')
                .single();
            if (error) throw error;
            setLogs((prev) => [data, ...prev]);
            setTotalCalories((prev) => prev + data.calories);
            setTotalMacros((prev) => ({
                protein: prev.protein + (data.protein || 0),
                carbs: prev.carbs + (data.carbs || 0),
                fats: prev.fats + (data.fats || 0)
            }));
            setLastAdded(data);
            setFoodInput('');
            setNutritionPreview(null);
        } catch (err) {
            setError(err.message || 'Failed to log food. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, calories, protein = 0, carbs = 0, fats = 0) => {
        try {
            const { error } = await supabase
                .from('calorie_logs')
                .delete()
                .eq('id', id)
                .eq('user_id', user.id);
            if (error) throw error;
            setLogs((prev) => prev.filter((l) => l.id !== id));
            setTotalCalories((prev) => Math.max(0, prev - calories));
            setTotalMacros((prev) => ({
                protein: Math.max(0, prev.protein - protein),
                carbs: Math.max(0, prev.carbs - carbs),
                fats: Math.max(0, prev.fats - fats)
            }));
            if (lastAdded?.id === id) setLastAdded(null);
        } catch (e) {
            console.error(e);
        }
    };

    const summary = calculateDailySummary(logs, caloriesBurnt ? [{ calories_burnt: caloriesBurnt }] : [], dailyGoal);
    const netCalories = summary.net;
    const percentage = summary.progress;
    const remaining = summary.remaining;
    const selectedDateObject = new Date(`${selectedDate}T12:00:00`);
    const today = selectedDateObject.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    const progressColor = percentage > 90 ? '#ef4444' : percentage > 70 ? '#f59e0b' : '#2f7d5b';

    return (
        <div className="app-layout">
            <Navbar />
            <main className="main-content">
                <div className="page-header">
                    <div>
                        <h1 className="page-title">{greeting}, {user?.username || 'there'}</h1>
                        <p className="page-subtitle">{today}</p>
                    </div>
                    <div className="page-header-actions">
                        <input
                            type="date"
                            value={selectedDate}
                            max={toLocalDateKey()}
                            onChange={(event) => setSelectedDate(event.target.value)}
                            aria-label="Tracking date"
                            className="date-picker"
                            id="tracking-date"
                        />
                        <button className="icon-btn" onClick={fetchToday} title="Refresh">
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </div>

                <section className="daily-summary" aria-label="Daily calorie summary">
                    <button type="button" className="remaining-card" onClick={() => { setNewGoal(dailyGoal); setShowGoalModal(true); }}>
                        <span className="summary-label">Remaining today</span>
                        <strong className="remaining-value">{remaining}</strong>
                        <span className="summary-unit">kcal</span>
                        <span className="summary-progress"><span style={{ width: `${percentage}%`, background: progressColor }} /></span>
                    </button>
                    <div className="summary-metrics">
                        <div><span>Food</span><strong>{summary.consumed}</strong><small>kcal</small></div>
                        <div><span>Exercise</span><strong>{summary.exercise}</strong><small>kcal</small></div>
                        <div><span>Net</span><strong>{netCalories}</strong><small>kcal</small></div>
                    </div>
                </section>

                <section className="quick-actions" aria-label="Quick actions">
                    <button type="button" onClick={() => document.querySelector('#food-input')?.focus()}>
                        <Plus size={20} /><span><strong>Add food</strong><small>Describe a meal</small></span>
                    </button>
                    <button type="button" onClick={() => navigate('/exercise')}>
                        <Dumbbell size={20} /><span><strong>Add exercise</strong><small>Type a workout</small></span>
                    </button>
                </section>

                {/* Macros Summary */}
                <div className="macros-grid">
                    <div className="macro-card protein">
                        <span className="macro-label">Protein</span>
                        <span className="macro-value">{totalMacros.protein.toFixed(1)}g</span>
                    </div>
                    <div className="macro-card carbs">
                        <span className="macro-label">Carbs</span>
                        <span className="macro-value">{totalMacros.carbs.toFixed(1)}g</span>
                    </div>
                    <div className="macro-card fats">
                        <span className="macro-label">Fats</span>
                        <span className="macro-value">{totalMacros.fats.toFixed(1)}g</span>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="progress-card">
                    <div className="progress-header">
                        <span className="progress-label">Daily Progress</span>
                        <span className="progress-pct">{percentage.toFixed(1)}%</span>
                    </div>
                    <div className="progress-track">
                        <div
                            className="progress-fill"
                            style={{ width: `${percentage}%`, background: progressColor }}
                        />
                    </div>
                    <div className="progress-footer">
                        <span>{netCalories.toFixed(0)} kcal net ({totalCalories.toFixed(0)} - {caloriesBurnt.toFixed(0)})</span>
                        <span>{dailyGoal} kcal goal</span>
                    </div>
                </div>

                {/* Food Logger */}
                <div className="logger-card">
                    <h2 className="card-title"><Apple size={20} /> Log Food</h2>
                    <form className="logger-form" onSubmit={handleLog}>
                        <div className="logger-input-wrap">
                            <input
                                type="text"
                                className="logger-input"
                                placeholder="e.g. 1 cup oatmeal, 2 boiled eggs, medium banana..."
                                value={foodInput}
                                onChange={(e) => setFoodInput(e.target.value)}
                                disabled={loading}
                                id="food-input"
                            />
                            <button type="submit" className="logger-btn" disabled={loading || !foodInput.trim()} id="log-food-btn">
                                {loading ? <span className="btn-spinner small" /> : <><Plus size={18} /> Log Food</>}
                            </button>
                        </div>
                        {error && <p className="logger-error">{error}</p>}
                    </form>

                    {lastAdded && (
                        <div className="last-added-banner">
                            <strong>{lastAdded.food_item}</strong> — {lastAdded.calories.toFixed(0)} kcal
                            <span className="banner-detail"> ({lastAdded.serving_size})</span>
                        </div>
                    )}

                    {nutritionPreview && (
                        <div className="nutrition-review" aria-label="Review estimated nutrition">
                            <div className="nutrition-review-header">
                                <div>
                                    <span className="review-kicker">Estimated for review</span>
                                    <strong>{nutritionPreview.food_item}</strong>
                                </div>
                                <button type="button" className="icon-btn" onClick={() => setNutritionPreview(null)} aria-label="Cancel nutrition estimate">×</button>
                            </div>
                            <div className="nutrition-review-grid">
                                {[
                                    ['calories', 'Calories'],
                                    ['protein', 'Protein'],
                                    ['carbs', 'Carbs'],
                                    ['fats', 'Fats'],
                                ].map(([key, label]) => (
                                    <label key={key}>
                                        <span>{label}</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step={key === 'calories' ? '1' : '0.1'}
                                            value={nutritionPreview[key]}
                                            onChange={(event) => setNutritionPreview((current) => ({ ...current, [key]: Number(event.target.value) || 0 }))}
                                        />
                                    </label>
                                ))}
                            </div>
                            <label className="nutrition-serving">
                                <span>Serving</span>
                                <input
                                    type="text"
                                    value={nutritionPreview.serving_size}
                                    onChange={(event) => setNutritionPreview((current) => ({ ...current, serving_size: event.target.value }))}
                                />
                            </label>
                            <button type="button" className="logger-btn nutrition-confirm" onClick={handleConfirmNutrition} disabled={loading || nutritionPreview.calories <= 0}>
                                {loading ? <span className="btn-spinner small" /> : <><Plus size={18} /> Add to today</>}
                            </button>
                        </div>
                    )}
                </div>

                {/* Food Log List */}
                <div className="log-card">
                    <h2 className="card-title"><Utensils size={20} /> {selectedDate === toLocalDateKey() ? "Today's" : 'Selected'} Food Log</h2>
                    {fetching ? (
                        <div className="loading-state">
                            <span className="btn-spinner large" />
                            <span>Loading today's logs...</span>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="empty-state">
                            <Apple size={40} className="empty-icon" />
                            <p>No food logged yet today.</p>
                            <p className="empty-sub">Start by entering a food item above!</p>
                        </div>
                    ) : (
                        <div className="food-list">
                            {logs.map((log) => (
                                <div key={log.id} className="food-item">
                                    <div className="food-item-left">
                                        <div className="food-dot" />
                                        <div className="food-details">
                                            <span className="food-name">{log.food_item}</span>
                                            <span className="food-meta">{log.serving_size}</span>
                                            <span className="food-macros">
                                                P: {(log.protein || 0).toFixed(1)}g • C: {(log.carbs || 0).toFixed(1)}g • F: {(log.fats || 0).toFixed(1)}g
                                            </span>
                                            {log.notes && <span className="food-notes">{log.notes}</span>}
                                        </div>
                                    </div>
                                    <div className="food-item-right">
                                        <span className="food-cal">{log.calories.toFixed(0)} kcal</span>
                                        <span className="food-time">
                                            {new Date(log.logged_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <button
                                            className="delete-btn"
                                            onClick={() => handleDelete(log.id, log.calories, log.protein, log.carbs, log.fats)}
                                            title="Remove"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Goal Edit Modal */}
                {showGoalModal && (
                    <div className="modal-overlay" onClick={() => setShowGoalModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>Edit Daily Goal</h3>
                                <button className="modal-close" onClick={() => setShowGoalModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="modal-body">
                                <label>Daily Calorie Goal</label>
                                <input
                                    type="number"
                                    value={newGoal}
                                    onChange={(e) => setNewGoal(parseInt(e.target.value) || 0)}
                                    min={500}
                                    max={10000}
                                    className="goal-input"
                                />
                                <span className="form-hint">Recommended: 1500-3000 kcal depending on your goals</span>
                            </div>
                            <div className="modal-footer">
                                <button className="btn-secondary" onClick={() => setShowGoalModal(false)}>Cancel</button>
                                <button className="btn-primary" onClick={handleSaveGoal} disabled={savingGoal}>
                                    {savingGoal ? <span className="btn-spinner small" /> : 'Save'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
