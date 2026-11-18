import type {
    CalibrationFineTune,
    CalibrationQuad,
    KeyboardLayoutId,
    UserProfile,
} from '../types';

const STORAGE_KEY = 'kinetictype_cv_state_v2';

export interface PersistedAppState {
    activeUserId: string;
    users: UserProfile[];
    layout: KeyboardLayoutId;
    calibration: CalibrationQuad;
    fineTune: CalibrationFineTune;
    customText: string;
}

export const DEFAULT_QUAD: CalibrationQuad = {
    topLeft: { x: 0.14, y: 0.28 },
    topRight: { x: 0.86, y: 0.28 },
    bottomLeft: { x: 0.10, y: 0.78 },
    bottomRight: { x: 0.90, y: 0.78 },
};

export const DEFAULT_FINE_TUNE: CalibrationFineTune = {
    offsetX: 0,
    offsetY: 0,
    parallaxFactor: 0.04,
};

export function createDefaultProfile(name: string): UserProfile {
    return {
        id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        name,
        createdAt: Date.now(),
        cumulativeSeconds: 0,
        bestWpm: 0,
        sessions: [],
        weakChars: {},
        weakBigrams: {},
    };
}

export function loadPersistedState(): PersistedAppState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as PersistedAppState;
            if (Array.isArray(parsed.users) && parsed.users.length > 0) {
                return {
                    activeUserId: parsed.activeUserId || parsed.users[0].id,
                    users: parsed.users,
                    layout: parsed.layout || 'QWERTY_ANSI',
                    calibration: parsed.calibration || DEFAULT_QUAD,
                    fineTune: parsed.fineTune || DEFAULT_FINE_TUNE,
                    customText: parsed.customText || '',
                };
            }
        }
    } catch {
        // Fallback to clean default state
    }

    const starter = createDefaultProfile('Default Typist');
    return {
        activeUserId: starter.id,
        users: [starter],
        layout: 'QWERTY_ANSI',
        calibration: DEFAULT_QUAD,
        fineTune: DEFAULT_FINE_TUNE,
        customText: '',
    };
}

export function savePersistedState(state: PersistedAppState): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Ignore storage quota errors
    }
}
