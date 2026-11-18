import type { FingerId, KeyDef, KeyboardLayoutId } from '../types';

export const FINGER_COLORS: Record<
FingerId,
{ hex: string; badge: string; text: string; border: string; bg: string }
> = {
    'L-Pinky':  { hex: '#f43f5e', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',       text: 'text-rose-400',    border: 'border-rose-500',    bg: 'bg-rose-500' },
    'L-Ring':   { hex: '#f59e0b', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',    text: 'text-amber-400',   border: 'border-amber-500',   bg: 'bg-amber-500' },
    'L-Middle': { hex: '#10b981', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', text: 'text-emerald-400', border: 'border-emerald-500', bg: 'bg-emerald-500' },
    'L-Index':  { hex: '#06b6d4', badge: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',       text: 'text-cyan-400',    border: 'border-cyan-500',    bg: 'bg-cyan-500' },
    'L-Thumb':  { hex: '#a855f7', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40', text: 'text-purple-400',  border: 'border-purple-500',  bg: 'bg-purple-500' },
    'R-Thumb':  { hex: '#a855f7', badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40', text: 'text-purple-400',  border: 'border-purple-500',  bg: 'bg-purple-500' },
    'R-Index':  { hex: '#3b82f6', badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',       text: 'text-blue-400',    border: 'border-blue-500',    bg: 'bg-blue-500' },
    'R-Middle': { hex: '#14b8a6', badge: 'bg-teal-500/20 text-teal-300 border-teal-500/40',       text: 'text-teal-400',    border: 'border-teal-500',    bg: 'bg-teal-500' },
    'R-Ring':   { hex: '#eab308', badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40', text: 'text-yellow-400',  border: 'border-yellow-500',  bg: 'bg-yellow-500' },
    'R-Pinky':  { hex: '#ec4899', badge: 'bg-pink-500/20 text-pink-300 border-pink-500/40',       text: 'text-pink-400',    border: 'border-pink-500',    bg: 'bg-pink-500' },
};

export const ALL_FINGERS: FingerId[] = [
    'L-Pinky',
'L-Ring',
'L-Middle',
'L-Index',
'L-Thumb',
'R-Thumb',
'R-Index',
'R-Middle',
'R-Ring',
'R-Pinky',
];

const U = 1 / 15; // 15U standard keyboard width
const H = 0.2;    // 5 rows

function k(
    code: string,
    label: string,
    chars: string[],
    xU: number,
    row: number,
    wU: number,
    finger: FingerId,
    shiftLabel?: string
): KeyDef {
    return {
        code,
        label,
        shiftLabel,
        chars,
        x: xU * U,
        y: row * H,
        w: wU * U,
        h: H,
        finger,
        row,
    };
}

export function buildKeyboardKeys(layout: KeyboardLayoutId): KeyDef[] {
    const isAzerty = layout === 'AZERTY_FR';
    const isIso = layout === 'QWERTY_ISO' || isAzerty;

    const row0: KeyDef[] = [
        k('Escape', 'Esc', [], 0, 0, 1, 'L-Pinky'),
        k('Digit1', isAzerty ? '&' : '1', isAzerty ? ['&', '1'] : ['1', '!'], 1, 0, 1, 'L-Pinky', isAzerty ? '1' : '!'),
        k('Digit2', isAzerty ? 'é' : '2', isAzerty ? ['é', '2', '~'] : ['2', '@'], 2, 0, 1, 'L-Ring', isAzerty ? '2' : '@'),
        k('Digit3', isAzerty ? '"' : '3', isAzerty ? ['"', '3', '#'] : ['3', '#'], 3, 0, 1, 'L-Middle', isAzerty ? '3' : '#'),
        k('Digit4', isAzerty ? "'" : '4', isAzerty ? ["'", '4', '{'] : ['4', '$'], 4, 0, 1, 'L-Index', isAzerty ? '4' : '$'),
        k('Digit5', isAzerty ? '(' : '5', isAzerty ? ['(', '5', '['] : ['5', '%'], 5, 0, 1, 'L-Index', isAzerty ? '5' : '%'),
        k('Digit6', isAzerty ? '-' : '6', isAzerty ? ['-', '6', '|'] : ['6', '^'], 6, 0, 1, 'R-Index', isAzerty ? '6' : '^'),
        k('Digit7', isAzerty ? 'è' : '7', isAzerty ? ['è', '7', '`'] : ['7', '&'], 7, 0, 1, 'R-Index', isAzerty ? '7' : '&'),
        k('Digit8', isAzerty ? '_' : '8', isAzerty ? ['_', '8', '\\'] : ['8', '*'], 8, 0, 1, 'R-Middle', isAzerty ? '8' : '*'),
        k('Digit9', isAzerty ? 'ç' : '9', isAzerty ? ['ç', '9', '^'] : ['9', '('], 9, 0, 1, 'R-Ring', isAzerty ? '9' : '('),
        k('Digit0', isAzerty ? 'à' : '0', isAzerty ? ['à', '0', '@'] : ['0', ')'], 10, 0, 1, 'R-Pinky', isAzerty ? '0' : ')'),
        k('Minus', isAzerty ? ')' : '-', isAzerty ? [')', '°', ']'] : ['-', '_'], 11, 0, 1, 'R-Pinky', isAzerty ? '°' : '_'),
        k('Equal', '=', ['=', '+'], 12, 0, 1, 'R-Pinky', '+'),
        k('Backspace', 'Bksp', [], 13, 0, 2, 'R-Pinky'),
    ];

    const row1: KeyDef[] = [
        k('Tab', 'Tab', ['\t'], 0, 1, 1.5, 'L-Pinky'),
        k('KeyQ', isAzerty ? 'A' : 'Q', isAzerty ? ['a', 'A'] : ['q', 'Q'], 1.5, 1, 1, 'L-Pinky'),
        k('KeyW', isAzerty ? 'Z' : 'W', isAzerty ? ['z', 'Z'] : ['w', 'W'], 2.5, 1, 1, 'L-Ring'),
        k('KeyE', 'E', ['e', 'E'], 3.5, 1, 1, 'L-Middle'),
        k('KeyR', 'R', ['r', 'R'], 4.5, 1, 1, 'L-Index'),
        k('KeyT', 'T', ['t', 'T'], 5.5, 1, 1, 'L-Index'),
        k('KeyY', 'Y', ['y', 'Y'], 6.5, 1, 1, 'R-Index'),
        k('KeyU', 'U', ['u', 'U'], 7.5, 1, 1, 'R-Index'),
        k('KeyI', 'I', ['i', 'I'], 8.5, 1, 1, 'R-Middle'),
        k('KeyO', 'O', ['o', 'O'], 9.5, 1, 1, 'R-Ring'),
        k('KeyP', 'P', ['p', 'P'], 10.5, 1, 1, 'R-Pinky'),
        k('BracketLeft', isAzerty ? '^' : '[', isAzerty ? ['^', '¨'] : ['[', '{'], 11.5, 1, 1, 'R-Pinky', isAzerty ? '¨' : '{'),
        k('BracketRight', isAzerty ? '$' : ']', isAzerty ? ['$', '£'] : [']', '}'], 12.5, 1, 1, 'R-Pinky', isAzerty ? '£' : '}'),
        ...(isIso
        ? [k('Enter', 'Enter', ['\n'], 13.5, 1, 1.5, 'R-Pinky')]
        : [k('Backslash', '\\', ['\\', '|'], 13.5, 1, 1.5, 'R-Pinky', '|')]),
    ];

    const row2: KeyDef[] = [
        k('CapsLock', 'Caps', [], 0, 2, 1.75, 'L-Pinky'),
        k('KeyA', isAzerty ? 'Q' : 'A', isAzerty ? ['q', 'Q'] : ['a', 'A'], 1.75, 2, 1, 'L-Pinky'),
        k('KeyS', 'S', ['s', 'S'], 2.75, 2, 1, 'L-Ring'),
        k('KeyD', 'D', ['d', 'D'], 3.75, 2, 1, 'L-Middle'),
        k('KeyF', 'F', ['f', 'F'], 4.75, 2, 1, 'L-Index'),
        k('KeyG', 'G', ['g', 'G'], 5.75, 2, 1, 'L-Index'),
        k('KeyH', 'H', ['h', 'H'], 6.75, 2, 1, 'R-Index'),
        k('KeyJ', 'J', ['j', 'J'], 7.75, 2, 1, 'R-Index'),
        k('KeyK', 'K', ['k', 'K'], 8.75, 2, 1, 'R-Middle'),
        k('KeyL', 'L', ['l', 'L'], 9.75, 2, 1, 'R-Ring'),
        k('Semicolon', isAzerty ? 'M' : ';', isAzerty ? ['m', 'M'] : [';', ':'], 10.75, 2, 1, 'R-Pinky', isAzerty ? undefined : ':'),
        k('Quote', isAzerty ? 'ù' : "'", isAzerty ? ['ù', '%'] : ["'", '"'], 11.75, 2, 1, 'R-Pinky', isAzerty ? '%' : '"'),
        ...(isIso
        ? [k('Backslash', isAzerty ? '*' : '#', isAzerty ? ['*', 'µ'] : ['#', '~'], 12.75, 2, 1, 'R-Pinky')]
        : []),
        k('Enter', 'Enter', ['\n'], isIso ? 13.75 : 12.75, 2, isIso ? 1.25 : 2.25, 'R-Pinky'),
    ];

    const row3: KeyDef[] = isIso
    ? [
        k('ShiftLeft', 'Shift', [], 0, 3, 1.25, 'L-Pinky'),
        k('IntlBackslash', '<', ['<', '>'], 1.25, 3, 1, 'L-Pinky', '>'),
        k('KeyZ', isAzerty ? 'W' : 'Z', isAzerty ? ['w', 'W'] : ['z', 'Z'], 2.25, 3, 1, 'L-Pinky'),
        k('KeyX', 'X', ['x', 'X'], 3.25, 3, 1, 'L-Ring'),
        k('KeyC', 'C', ['c', 'C'], 4.25, 3, 1, 'L-Middle'),
        k('KeyV', 'V', ['v', 'V'], 5.25, 3, 1, 'L-Index'),
        k('KeyB', 'B', ['b', 'B'], 6.25, 3, 1, 'L-Index'),
        k('KeyN', 'N', ['n', 'N'], 7.25, 3, 1, 'R-Index'),
        k('KeyM', isAzerty ? ',' : 'M', isAzerty ? [',', '?'] : ['m', 'M'], 8.25, 3, 1, 'R-Index', isAzerty ? '?' : undefined),
        k('Comma', isAzerty ? ';' : ',', isAzerty ? [';', '.'] : [',', '<'], 9.25, 3, 1, 'R-Middle', isAzerty ? '.' : '<'),
        k('Period', isAzerty ? ':' : '.', isAzerty ? [':', '/'] : ['.', '>'], 10.25, 3, 1, 'R-Ring', isAzerty ? '/' : '>'),
        k('Slash', isAzerty ? '!' : '/', isAzerty ? ['!', '§'] : ['/', '?'], 11.25, 3, 1, 'R-Pinky', isAzerty ? '§' : '?'),
        k('ShiftRight', 'Shift', [], 12.25, 3, 2.75, 'R-Pinky'),
    ]
    : [
        k('ShiftLeft', 'Shift', [], 0, 3, 2.25, 'L-Pinky'),
        k('KeyZ', 'Z', ['z', 'Z'], 2.25, 3, 1, 'L-Pinky'),
        k('KeyX', 'X', ['x', 'X'], 3.25, 3, 1, 'L-Ring'),
        k('KeyC', 'C', ['c', 'C'], 4.25, 3, 1, 'L-Middle'),
        k('KeyV', 'V', ['v', 'V'], 5.25, 3, 1, 'L-Index'),
        k('KeyB', 'B', ['b', 'B'], 6.25, 3, 1, 'L-Index'),
        k('KeyN', 'N', ['n', 'N'], 7.25, 3, 1, 'R-Index'),
        k('KeyM', 'M', ['m', 'M'], 8.25, 3, 1, 'R-Index'),
        k('Comma', ',', [',', '<'], 9.25, 3, 1, 'R-Middle', '<'),
        k('Period', '.', ['.', '>'], 10.25, 3, 1, 'R-Ring', '>'),
        k('Slash', '/', ['/', '?'], 11.25, 3, 1, 'R-Pinky', '?'),
        k('ShiftRight', 'Shift', [], 12.25, 3, 2.75, 'R-Pinky'),
    ];

    const row4: KeyDef[] = [
        k('ControlLeft', 'Ctrl', [], 0, 4, 1.5, 'L-Pinky'),
        k('MetaLeft', 'Win', [], 1.5, 4, 1.25, 'L-Pinky'),
        k('AltLeft', 'Alt', [], 2.75, 4, 1.25, 'L-Thumb'),
        k('Space', 'Space', [' '], 4.0, 4, 6.25, 'R-Thumb'),
        k('AltRight', 'AltGr', [], 10.25, 4, 1.25, 'R-Thumb'),
        k('Fn', 'Fn', [], 11.5, 4, 1.0, 'R-Pinky'),
        k('ContextMenu', 'Menu', [], 12.5, 4, 1.0, 'R-Pinky'),
        k('ControlRight', 'Ctrl', [], 13.5, 4, 1.5, 'R-Pinky'),
    ];

    return [...row0, ...row1, ...row2, ...row3, ...row4];
}

export function findKeyForChar(keys: KeyDef[], char: string): KeyDef {
    const direct = keys.find((item) => item.chars.includes(char));
    if (direct) return direct;
    const lower = char.toLowerCase();
    const fallback = keys.find((item) => item.chars.includes(lower));
    return fallback ?? keys.find((item) => item.code === 'Space')!;
}

export function getHomeRowCenters(keys: KeyDef[]): Record<FingerId, { x: number; y: number }> {
    const byCode = (code: string) => {
        const key = keys.find((item) => item.code === code) ?? keys[0];
        return { x: key.x + key.w / 2, y: key.y + key.h / 2 };
    };

    return {
        'L-Pinky': byCode('KeyA'),
        'L-Ring': byCode('KeyS'),
        'L-Middle': byCode('KeyD'),
        'L-Index': byCode('KeyF'),
        'L-Thumb': { x: 5.5 / 15, y: 4.5 * 0.2 },
        'R-Thumb': { x: 8.5 / 15, y: 4.5 * 0.2 },
        'R-Index': byCode('KeyJ'),
        'R-Middle': byCode('KeyK'),
        'R-Ring': byCode('KeyL'),
        'R-Pinky': byCode('Semicolon'),
    };
}
