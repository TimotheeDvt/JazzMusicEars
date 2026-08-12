export const NOTE_NAME_TO_PC = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
    'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};

export function parseKeyName(keyName) {
    const key = keyName || 'C';
    const rootStr = key.replace(/m.*$/, '');
    const isMinor = key.toLowerCase().replace(rootStr.toLowerCase(), '').includes('m');
    return { tonicPC: NOTE_NAME_TO_PC[rootStr] ?? 0, isMinor };
}

const MINOR_CHORD_TYPES = new Set(['m', 'm6', 'm7', 'm7b5', 'm9', 'm11', 'm13']);
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

const MAJOR_DEGREES = [
    { deg: 0, acc: '' }, { deg: 1, acc: 'b' }, { deg: 1, acc: '' }, { deg: 2, acc: 'b' }, { deg: 2, acc: '' },
    { deg: 3, acc: '' }, { deg: 3, acc: '#' }, { deg: 4, acc: '' }, { deg: 5, acc: 'b' }, { deg: 5, acc: '' },
    { deg: 6, acc: 'b' }, { deg: 6, acc: '' }
];

const MINOR_DEGREES = [
    { deg: 0, acc: '' }, { deg: 1, acc: 'b' }, { deg: 1, acc: '' }, { deg: 2, acc: '' }, { deg: 2, acc: '#' },
    { deg: 3, acc: '' }, { deg: 3, acc: '#' }, { deg: 4, acc: '' }, { deg: 5, acc: '' }, { deg: 5, acc: '#' },
    { deg: 6, acc: '' }, { deg: 6, acc: '#' }
];

export function chordToScaleDegree(chordRootPC, chordType, tonicPC, isMinorKey) {
    const interval = ((chordRootPC - tonicPC) % 12 + 12) % 12;
    const { deg, acc } = (isMinorKey ? MINOR_DEGREES : MAJOR_DEGREES)[interval];
    let numeral = ROMAN[deg];
    if (MINOR_CHORD_TYPES.has(chordType)) numeral = numeral.toLowerCase();
    return acc + numeral + chordType;
}
