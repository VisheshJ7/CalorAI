/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(isSupabaseConfigured);

    const loadProfile = useCallback(async (authUser) => {
        if (!authUser) {
            setUser(null);
            return;
        }

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();

        if (error) throw error;

        setUser({
            id: authUser.id,
            email: authUser.email,
            username: profile?.username || authUser.email?.split('@')[0] || 'User',
            calorieGoal: profile?.calorie_goal || 2000,
            onboardingCompleted: Boolean(profile?.onboarding_completed),
            gender: profile?.gender || 'male',
            age: profile?.age || '',
            height: profile?.height || '',
            weight: profile?.weight || '',
            activityLevel: profile?.activity_level || 'moderate',
            goal: profile?.goal || authUser.user_metadata?.goal || 'maintain',
            weightChangePerWeek: profile?.weight_change_per_week || authUser.user_metadata?.weight_change_per_week || 0.5,
        });
    }, []);

    useEffect(() => {
        if (!isSupabaseConfigured) {
            return;
        }

        supabase.auth.getSession().then(({ data: { session } }) => {
            loadProfile(session?.user).finally(() => setLoading(false));
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            loadProfile(session?.user).finally(() => setLoading(false));
        });

        return () => subscription.unsubscribe();
    }, [loadProfile]);

    const register = useCallback(async (username, email, password) => {
        if (!supabase) throw new Error('Supabase is not configured');
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { username: username.trim() } },
        });
        if (error) throw error;

        if (!data.session) {
            return {
                verificationRequired: true,
                email,
            };
        }
        await loadProfile(data.user);
        return { verificationRequired: false, user: data.user };
    }, [loadProfile]);

    const login = useCallback(async (email, password) => {
        if (!supabase) throw new Error('Supabase is not configured');
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await loadProfile(data.user);
        const { data: profile } = await supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('id', data.user.id)
            .maybeSingle();
        return { onboarding_completed: Boolean(profile?.onboarding_completed) };
    }, [loadProfile]);

    const completeOnboarding = useCallback(async (onboardingData) => {
        if (!supabase) throw new Error('Supabase is not configured');
        const gender = onboardingData.gender;
        const maintenance = gender === 'male'
            ? (10 * onboardingData.weight + 6.25 * onboardingData.height - 5 * onboardingData.age + 5)
                * { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }[onboardingData.activity_level]
            : (10 * onboardingData.weight + 6.25 * onboardingData.height - 5 * onboardingData.age - 161)
                * { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }[onboardingData.activity_level];

        const weeklyChange = onboardingData.weight_change_per_week || 0.5;
        let recommendedGoal = Math.round(maintenance);
        if (onboardingData.goal === 'lose') {
            recommendedGoal = Math.max(1200, Math.round(maintenance - (weeklyChange * 7700) / 7));
        } else if (onboardingData.goal === 'gain') {
            recommendedGoal = Math.round(maintenance + Math.min((weeklyChange * 7700) / 7, 1000));
        }

        const { error } = await supabase
            .from('profiles')
            .update({
                gender,
                age: onboardingData.age,
                height: onboardingData.height,
                weight: onboardingData.weight,
                activity_level: onboardingData.activity_level,
                calorie_goal: recommendedGoal,
                onboarding_completed: true,
            })
            .eq('id', user.id);
        if (error) throw error;

        const { error: metadataError } = await supabase.auth.updateUser({
            data: {
                goal: onboardingData.goal,
                weight_change_per_week: onboardingData.goal === 'maintain' ? 0 : weeklyChange,
            },
        });
        if (metadataError) throw metadataError;

        setUser((current) => ({
            ...current,
            calorieGoal: recommendedGoal,
            onboardingCompleted: true,
            gender,
            age: onboardingData.age,
            height: onboardingData.height,
            weight: onboardingData.weight,
            activityLevel: onboardingData.activity_level,
            goal: onboardingData.goal,
            weightChangePerWeek: onboardingData.goal === 'maintain' ? 0 : weeklyChange,
        }));

        return {
            maintenance_calories: Math.round(maintenance),
            recommended_goal: recommendedGoal,
            calorie_goal: recommendedGoal,
            weekly_change: onboardingData.goal === 'maintain' ? 0 : weeklyChange,
        };
    }, [user]);

    const updateSettings = useCallback(async (calorieGoal) => {
        if (!supabase) throw new Error('Supabase is not configured');
        const { error } = await supabase
            .from('profiles')
            .update({ calorie_goal: calorieGoal })
            .eq('id', user.id);
        if (error) throw error;
        setUser((current) => ({ ...current, calorieGoal }));
        return { calorie_goal: calorieGoal };
    }, [user]);

    const logout = useCallback(async () => {
        if (supabase) await supabase.auth.signOut();
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, register, updateSettings, completeOnboarding }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
