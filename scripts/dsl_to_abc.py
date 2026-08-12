#!/usr/bin/env python3
"""
One-off, dev-time-only migration tool. Converts the app's legacy tuneFiles/*.js DSL
(parsed by data/tunes.js's parseMelodyString/parseChordsString) into real ABC notation
files consumed by data/abcTuneLoader.js. Never shipped/served - not part of the running app.

Reads the raw DSL strings directly out of each .js file's source text (regex, not JS
evaluation) so this has no Node/npm dependency, and preserves the exact original note
letter/accidental/octave spelling (no MIDI round-trip -> no enharmonic respelling risk).

Usage: python3 scripts/dsl_to_abc.py
"""
import re
import sys
from fractions import Fraction
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TUNE_DIR = ROOT / "data" / "tuneFiles"

NOTE_RE = re.compile(r'^([A-Ga-g])([#b]?)(-?\d+)$')
NUMBER_RE = re.compile(r'^\d+(\.\d+)?(/\d+(\.\d+)?)?$')
MARKER_ABC = {'REPEAT_START': '|:', 'REPEAT_END': ':|', 'ENDING_1': '|1', 'ENDING_2': '|2'}


def parse_duration_literal(s):
    if '/' in s:
        n, d = s.split('/')
        return Fraction(int(n), int(d))
    return Fraction(s)


def frac_to_abc_multiplier(frac):
    if frac == 1:
        return ''
    if frac.denominator == 1:
        return str(frac.numerator)
    if frac.numerator == 1:
        return f'/{frac.denominator}'
    return f'{frac.numerator}/{frac.denominator}'


def note_to_abc_pitch(letter, acc, octave):
    letter = letter.upper()
    if octave == 4:
        base = letter
    elif octave == 5:
        base = letter.lower()
    elif octave < 4:
        base = letter + ',' * (4 - octave)
    else:
        base = letter.lower() + "'" * (octave - 5)
    return {'#': '^', 'b': '_', '': ''}[acc] + base


def extract_string_arg(src, start_idx):
    """src[start_idx] is the opening quote (`"` or backtick). Returns (content, idx_after_close)."""
    quote = src[start_idx]
    i = start_idx + 1
    buf = []
    while i < len(src):
        c = src[i]
        if c == '\\' and i + 1 < len(src):
            nxt = src[i + 1]
            if nxt == '\n':
                i += 2  # JS line continuation: backslash+newline contribute nothing
                continue
            buf.append(nxt)
            i += 2
            continue
        if c == quote:
            return ''.join(buf), i + 1
        buf.append(c)
        i += 1
    raise ValueError("Unterminated string literal")


def find_call_string(src, func_name):
    m = re.search(re.escape(func_name) + r'\(\s*', src)
    if not m:
        raise ValueError(f"Could not find call to {func_name}")
    content, _ = extract_string_arg(src, m.end())
    return content


def tokenize_visual(dsl_string, is_chord):
    """Re-implements the pre-unroll walk in data/tunes.js's parseMelodyString/parseChordsString,
    just to recover each element's visualBeat (needed to align chord symbols to melody notes)."""
    elements = []
    visual_beat = Fraction(0)
    for tok in dsl_string.split():
        if tok.startswith('[') and tok.endswith(']'):
            continue
        if tok in ('|:', ':|', '|1', '|2'):
            kind = {'|:': 'REPEAT_START', ':|': 'REPEAT_END', '|1': 'ENDING_1', '|2': 'ENDING_2'}[tok]
            elements.append({'kind': kind, 'vb': visual_beat})
            continue
        if tok == '|':
            continue

        if is_chord:
            parts = tok.split(':')
            if len(parts) != 3:
                continue
            root_part, type_part, dur_part = parts
            dur = parse_duration_literal(dur_part)
            if root_part.upper() == 'NC':
                elements.append({'kind': 'CHORD', 'nc': True, 'vb': visual_beat, 'dur': dur})
            else:
                elements.append({'kind': 'CHORD', 'nc': False, 'root': root_part, 'type': type_part,
                                  'vb': visual_beat, 'dur': dur})
            visual_beat += dur
            continue

        if NUMBER_RE.match(tok):
            dur = parse_duration_literal(tok)
            elements.append({'kind': 'REST', 'vb': visual_beat, 'dur': dur})
            visual_beat += dur
            continue

        note_part_raw, sep, dur_str_part = tok.partition(':')
        if not sep:
            continue
        dur_part, us, str_part = dur_str_part.partition('_')
        note_part = note_part_raw
        string_num = None
        if us:
            m = re.search(r'([1-6])$', str_part)
            if m:
                string_num = int(m.group(1))
        tied = False
        if note_part.startswith('-'):
            tied = True
            note_part = note_part[1:]
        dur = parse_duration_literal(dur_part)
        if note_part.upper() == 'R':
            elements.append({'kind': 'REST', 'vb': visual_beat, 'dur': dur})
            visual_beat += dur
            continue
        m = NOTE_RE.match(note_part)
        if not m:
            raise ValueError(f"Cannot parse note token: {tok!r}")
        letter, acc, octave = m.group(1), m.group(2), int(m.group(3))
        elements.append({'kind': 'NOTE', 'letter': letter, 'acc': acc, 'octave': octave,
                          'dur': dur, 'tied': tied, 'string': string_num, 'vb': visual_beat})
        visual_beat += dur
    return elements


def chord_symbol_text(chord_el):
    if chord_el['nc']:
        return 'NC'
    m = re.match(r'^([A-Ga-g])([#b]?)', chord_el['root'])
    return f"{m.group(1).upper()}{m.group(2)}{chord_el['type']}"


def chord_octave(chord_el):
    """The octave the DSL author actually voiced this chord in (e.g. "C3" -> 3). Lead-sheet
    ABC chord symbols carry no octave, so this is threaded through as a separate "ON" annotation
    (see emit_note_token) - otherwise every chord would collapse to a single hardcoded octave at
    load time, shifting the whole accompaniment's register away from what was authored/mixed."""
    if chord_el['nc']:
        return None
    m = re.match(r'^[A-Ga-g][#b]?(\d+)$', chord_el['root'])
    return int(m.group(1)) if m else None


def chord_annotation_texts(chord_el):
    """The full set of annotation strings a single chord contributes to its note: the chord
    symbol itself, plus an "ON" octave marker (see chord_octave) when it has a real root."""
    texts = [chord_symbol_text(chord_el)]
    octave = chord_octave(chord_el)
    if octave is not None:
        # ">" placement prefix keeps this a separate annotation entry - two unprefixed ("default"
        # position) quoted strings before a note get merged by abcjs into one newline-joined
        # chord.name instead of staying as distinct array entries.
        texts.append(f'>O{octave}')
    return texts


def emit_note_token(el, chord_annotations):
    prefix = ''.join(f'"{txt}"' for txt in chord_annotations)
    if el.get('string'):
        prefix += f'"<S{el["string"]}"'
    if el['kind'] == 'REST':
        return prefix + 'z' + frac_to_abc_multiplier(el['dur'])
    pitch = note_to_abc_pitch(el['letter'], el['acc'], el['octave'])
    return prefix + pitch + frac_to_abc_multiplier(el['dur'])


def merge_and_emit(melody_elements, chord_elements, tune_id, warnings):
    content_indices = [i for i, e in enumerate(melody_elements) if e['kind'] in ('NOTE', 'REST')]
    ci = 0
    nchords = len(chord_elements)
    out_tokens = []
    last_note_out_idx = None

    for pos, i in enumerate(content_indices):
        el = melody_elements[i]
        prev_content_i = content_indices[pos - 1] if pos > 0 else -1
        for j in range(prev_content_i + 1, i):
            mk = melody_elements[j]
            if mk['kind'] in MARKER_ABC:
                out_tokens.append(MARKER_ABC[mk['kind']])

        vb = el['vb']
        next_vb = melody_elements[content_indices[pos + 1]]['vb'] if pos + 1 < len(content_indices) else None
        el_end = next_vb if next_vb is not None else vb + el['dur']

        if ci < nchords and chord_elements[ci]['vb'] < vb:
            warnings.append(f"{tune_id}: chord at beat {chord_elements[ci]['vb']} precedes "
                             f"note at beat {vb}, snapping forward onto this note")

        chords_in_window = []
        while ci < nchords and (next_vb is None or chord_elements[ci]['vb'] < next_vb):
            chords_in_window.append(chord_elements[ci])
            ci += 1

        if len(chords_in_window) <= 1:
            annotations = [t for c in chords_in_window for t in chord_annotation_texts(c)]
            out_tokens.append(emit_note_token(el, annotations))
            if el['kind'] == 'NOTE':
                if el.get('tied') and last_note_out_idx is not None:
                    out_tokens[last_note_out_idx] += '-'
                last_note_out_idx = len(out_tokens) - 1
        else:
            # A chord changes mid-note, with no melody re-attack at that beat (e.g. a sustained
            # tied note under a walking ii-V). Plain ABC annotation only attaches at note onsets,
            # so split this element into consecutive tied sub-notes - same sound, one attachment
            # point per chord - rather than silently dropping every chord but the first.
            warnings.append(f"{tune_id}: beat {vb} note split into {len(chords_in_window)} tied "
                             f"parts to carry chord changes {[chord_symbol_text(c) for c in chords_in_window]}")
            bounds = [c['vb'] for c in chords_in_window] + [el_end]
            for k, c in enumerate(chords_in_window):
                sub_el = dict(el)
                sub_el['dur'] = bounds[k + 1] - bounds[k]
                if k > 0:
                    sub_el['string'] = None  # only the true attack carries the fret/string hint
                is_last_sub = (k == len(chords_in_window) - 1)
                token = emit_note_token(sub_el, chord_annotation_texts(c))
                if el['kind'] == 'NOTE' and not is_last_sub:
                    token += '-'  # tie this sub-note into the next (same original pitch)
                out_tokens.append(token)
                if el['kind'] == 'NOTE':
                    if k == 0 and el.get('tied') and last_note_out_idx is not None:
                        out_tokens[last_note_out_idx] += '-'
                    last_note_out_idx = len(out_tokens) - 1

    last_content_i = content_indices[-1] if content_indices else -1
    for j in range(last_content_i + 1, len(melody_elements)):
        mk = melody_elements[j]
        if mk['kind'] in MARKER_ABC:
            out_tokens.append(MARKER_ABC[mk['kind']])

    if ci < nchords:
        warnings.append(f"{tune_id}: {nchords - ci} trailing chord(s) never attached: "
                         f"{[chord_symbol_text(c) for c in chord_elements[ci:]]}")

    return out_tokens


def convert_tune(js_path, warnings):
    src = js_path.read_text()
    title = re.search(r'title:\s*"([^"]*)"', src).group(1)
    original_key = re.search(r'const originalKey\s*=\s*"([^"]*)"', src).group(1)
    ts_m = re.search(r'timeSignature:\s*\[(\d+),\s*(\d+)\]', src)
    time_sig = (int(ts_m.group(1)), int(ts_m.group(2)))
    anacrouse = re.search(r'anacrouse:\s*([\d.]+)', src).group(1)
    tempo = re.search(r'originalTempo:\s*(\d+)', src).group(1)
    yt_m = re.search(r'youtube:\s*"([^"]*)"', src)
    youtube = yt_m.group(1) if yt_m else ''

    melody_str = find_call_string(src, 'parseMelodyString')
    chords_str = find_call_string(src, 'parseChordsString')

    tune_id = js_path.stem
    melody_elements = tokenize_visual(melody_str, is_chord=False)
    # Melody's own markers are the sole structural skeleton for the merged stream (see
    # merge_and_emit); the chords string's own |:/:|/|1/|2 markers are redundant with it
    # (both streams describe the same bar/repeat structure "by convention") and are dropped here.
    chord_elements = [e for e in tokenize_visual(chords_str, is_chord=True) if e['kind'] == 'CHORD']

    # The two streams were authored independently, so the chords string can run longer than the
    # melody (e.g. a final chord written for a measure with no melody note at all). Since chord
    # symbols can only attach to a melody note/rest, extend the melody with a trailing rest to
    # cover any such gap - otherwise trailing chords get crammed into the last note's window with
    # no room, producing degenerate zero-duration splits.
    content_els = [e for e in melody_elements if e['kind'] in ('NOTE', 'REST')]
    if content_els and chord_elements:
        melody_end = content_els[-1]['vb'] + content_els[-1]['dur']
        chords_end = chord_elements[-1]['vb'] + chord_elements[-1]['dur']
        if chords_end > melody_end:
            warnings.append(f"{tune_id}: chords extend {chords_end - melody_end} beats past the "
                             f"last melody note; appending a trailing rest to cover it")
            melody_elements.append({'kind': 'REST', 'vb': melody_end, 'dur': chords_end - melody_end})
    body_tokens = merge_and_emit(melody_elements, chord_elements, tune_id, warnings)

    lines = [
        'X:1',
        f'T:{title}',
        f'M:{time_sig[0]}/{time_sig[1]}',
        'L:1/4',
        f'Q:1/4={tempo}',
        f'K:{original_key}',
    ]
    if youtube:
        lines.append(f'%%youtube {youtube}')
    lines.append(f'%%anacrusis {anacrouse}')
    lines.append(' '.join(body_tokens) + ' |]')
    return '\n'.join(lines) + '\n'


def main():
    targets = sys.argv[1:] or None  # optional list of tune ids to convert, default: all
    warnings = []
    for js_path in sorted(TUNE_DIR.glob('*.js')):
        if targets and js_path.stem not in targets:
            continue
        abc_text = convert_tune(js_path, warnings)
        abc_path = js_path.with_suffix('.abc')
        abc_path.write_text(abc_text)
        print(f"wrote {abc_path.relative_to(ROOT)}")

    if warnings:
        print("\n--- warnings ---")
        for w in warnings:
            print(w)
    else:
        print("\nno warnings")


if __name__ == '__main__':
    main()
