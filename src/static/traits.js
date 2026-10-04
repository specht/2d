var SPRITE_TRAITS_ORDER = [
    [
        'Spielfigur',
        [
            'actor',
        ],
    ],
    [
        'Begleiter',
        [
            'companion',
        ],
    ],
    [
        'Kampf',
        [
            'melee_attack',
            'ranged_attack',
            'bomb',
        ],
    ],
    [
        'Blöcke',
        [
            'block_above',
            'block_sides',
            'block_below',
            'falls_down',
        ],
    ],
    [
        'Schrägen',
        [
            'slope',
        ],
    ],
    [
        'Förderbänder',
        [
            'conveyor',
        ],
    ],
    [
        'Plattformen',
        [
            'moving',
        ],
    ],
    [
        'Türen',
        [
            'door',
        ],
    ],
    [
        'Schlüssel',
        [
            'key',
        ],
    ],
    [
        'Schalter',
        [
            'switch',
            'pressure_plate',
            'counter',
        ],
    ],
    [
        'Leitern',
        [
            'ladder',
        ],
    ],
    [
        'Einsammeln',
        [
            'pickup',
        ],
    ],
    [
        'Fallen und Gegner',
        [
            'trap',
            'baddie',
            'smart',
        ],
    ],
    [
        'Text',
        [
            'text',
        ],
    ],
    [
        'Level',
        [
            'level_complete',
            'checkpoint',
        ],
    ],
];

var STATE_TRAITS_ORDER = {
    actor: [
        ['Stehen', ['front', 'back', 'left', 'right']],
        ['Laufen', ['walk_front', 'walk_back', 'walk_left', 'walk_right']],
        ['Springen', ['jump_front', 'jump_back', 'jump_left', 'jump_right']],
        ['Fallen', ['fall_front', 'fall_back', 'fall_left', 'fall_right']],
        'climb',
        ['Angriff', ['attack_front', 'attack_back', 'attack_left', 'attack_right']],
        ['Treffer', ['hit_front', 'hit_back', 'hit_left', 'hit_right']],
        // in the water or in space (a Bewegungsbereich, movement_regions.js) – one group
        ['Schwimmen und Schweben', [
            ['Schwimmt', ['swim_front', 'swim_back', 'swim_left', 'swim_right']],
            ['Schwebt', ['float_front', 'float_back', 'float_left', 'float_right']],
            ['Treibt', ['drift_front', 'drift_back', 'drift_left', 'drift_right']],
            ['Taucht ab', ['dive_front', 'dive_back', 'dive_left', 'dive_right']],
            ['Taucht auf', ['rise_front', 'rise_back', 'rise_left', 'rise_right']],
        ]],
        'dead',
    ],
    baddie: [
        ['Stehen', ['front', 'back', 'left', 'right']],
        ['Laufen', ['walk_front', 'walk_back', 'walk_left', 'walk_right']],
        ['Springen', ['jump_front', 'jump_back', 'jump_left', 'jump_right']],
        ['Fallen', ['fall_front', 'fall_back', 'fall_left', 'fall_right']],
        'climb',
        ['Angriff', ['attack_front', 'attack_back', 'attack_left', 'attack_right']],
        ['Treffer', ['hit_front', 'hit_back', 'hit_left', 'hit_right']],
        ['Jagt (Jäger, Lauerer)', ['hunt_front', 'hunt_back', 'hunt_left', 'hunt_right']],
        ['Flieht (Angsthase)', ['flee_front', 'flee_back', 'flee_left', 'flee_right']],
        ['Benommen (Lauerer)', ['stunned_front', 'stunned_back', 'stunned_left', 'stunned_right']],
        ['Aufgeschlagen (Stampfer)', ['landed_front', 'landed_back', 'landed_left', 'landed_right']],
        // in the water or in space (a Bewegungsbereich, movement_regions.js) – one group
        ['Schwimmen und Schweben', [
            ['Schwimmt', ['swim_front', 'swim_back', 'swim_left', 'swim_right']],
            ['Schwebt', ['float_front', 'float_back', 'float_left', 'float_right']],
            ['Treibt', ['drift_front', 'drift_back', 'drift_left', 'drift_right']],
            ['Taucht ab', ['dive_front', 'dive_back', 'dive_left', 'dive_right']],
            ['Taucht auf', ['rise_front', 'rise_back', 'rise_left', 'rise_right']],
        ]],
        'dead',
    ],
    // Begleiter (companion_ai.js): the same pictures as a figure – optional
    // "fliegt", "schwimmt", "schwebt"; without them it walks and stands
    companion: [
        ['Stehen', ['front', 'back', 'left', 'right']],
        ['Laufen', ['walk_front', 'walk_back', 'walk_left', 'walk_right']],
        ['Springen', ['jump_front', 'jump_back', 'jump_left', 'jump_right']],
        ['Fallen', ['fall_front', 'fall_back', 'fall_left', 'fall_right']],
        ['Fliegen', ['fly_front', 'fly_back', 'fly_left', 'fly_right']],
        ['Schwimmen und Schweben', [
            ['Schwimmt', ['swim_front', 'swim_back', 'swim_left', 'swim_right']],
            ['Schwebt', ['float_front', 'float_back', 'float_left', 'float_right']],
            ['Treibt', ['drift_front', 'drift_back', 'drift_left', 'drift_right']],
            ['Taucht ab', ['dive_front', 'dive_back', 'dive_left', 'dive_right']],
            ['Taucht auf', ['rise_front', 'rise_back', 'rise_left', 'rise_right']],
        ]],
        // keeping busy while the player stands still (companion_ai.js COMPANION_IDLE)
        ['Sitzt', ['sit_front', 'sit_back', 'sit_left', 'sit_right']],
        ['Beschäftigt sich (schnüffelt, pickt …)', ['busy_front', 'busy_back', 'busy_left', 'busy_right']],
        // no Klettern (a Begleiter does not climb ladders), no Angriff, Treffer
        // or tot (no combat, no health)
    ],
    checkpoint: [
        'active',
    ],
    falls_down: [
        'crumbling',
    ],
    door: [
        'closed',
        'open',
        'transition',
    ],
    switch: ['off', 'on'],
    pressure_plate: ['up', 'down'],
    // a Zähler: "zeigt 1" … "zeigt 9" while it counts (only the ones drawn), "erreicht" when full
    counter: ['waiting', ['Zählt', ['count_1', 'count_2', 'count_3', 'count_4', 'count_5', 'count_6', 'count_7', 'count_8', 'count_9']], 'done'],
    bomb: ['fuse', 'explosion'],
    // a sign or a figure at the roadside that speaks itself: this state while it talks
    text: ['speaking'],
};

// Signale: Verzögerung of a sender (placed signal_delay, absent = 0 = at
// once; signals.js signal_delay_seconds). The maximum is
// SIGNAL_DELAY_MAX_SECONDS there.
function signal_delay_placed_property(hint) {
    return {
        label: 'Verzögerung',
        hint: `${hint} 0: sofort.`,
        type: 'float',
        suffix: 's',
        min: 0,
        max: 60,
        step: 0.5,
        decimalPlaces: 1,
        default: 0,
    };
}

var SPRITE_TRAITS = {
    bomb: { label: 'Bombe' },
    ranged_attack: {
        label: 'Fernkampfangriff',
    },
    melee_attack: {
        label: 'Nahkampfangriff',
        // The attack definition is managed by the shared combat trait adapter.
        // No default fields here: loading an old game must not create new JSON.
    },
    actor: {
        label: 'Spielfigur',
        properties: {
            vrun: {
                label: 'Geschwindigkeit',
                hint: 'Gib hier an, wie schnell deine Spielfigur laufen soll.',
                type: 'float',
                min: 0.0,
                max: 100.0,
                default: 3.0,
                decimalPlaces: 1,
                step: 0.1,
            },
            vjump: {
                label: 'Sprungkraft',
                hint: 'Gib hier an, wie kräftig deine Spielfigur springen können soll.',
                type: 'float',
                default: 9.0,
                min: 0.0,
                max: 100.0,
                decimalPlaces: 1,
                step: 0.1,
            },
            can_jump: {
                label: 'kann springen',
                hint: 'Kann deine Spielfigur springen?',
                type: 'bool',
                default: true,
            },
            affected_by_gravity: {
                label: 'beeinflusst durch Schwerkraft',
                hint: 'Soll deine Spielfigur von der Schwerkraft beeinflusst werden?',
                type: 'bool',
                default: true,
            },
            ex_left: {
                label: 'Kollisionsbox links',
                hint: 'Mit diesem Wert kannst du anpassen, wo genau deine Spielfigur mit der Umgebung oder Gegnern kollidiert.',
                type: 'float',
                min: 0,
                max: 1,
                step: 0.05,
                decimalPlaces: 2,
                default: 0.7,
                onfocus: () => {
                    canvas.draw_ex = true;
                    canvas.handleResize();
                },
                onblur: () => {
                    canvas.draw_ex = false;
                    canvas.handleResize();
                },
                onchange: () => {
                    canvas.handleResize();
                }
            },
            ex_right: {
                label: 'Kollisionsbox rechts',
                hint: 'Mit diesem Wert kannst du anpassen, wo genau deine Spielfigur mit der Umgebung oder Gegnern kollidiert.',
                type: 'float',
                min: 0,
                max: 1,
                step: 0.05,
                decimalPlaces: 2,
                default: 0.7,
                onfocus: () => {
                    canvas.draw_ex = true;
                    canvas.handleResize();
                },
                onblur: () => {
                    canvas.draw_ex = false;
                    canvas.handleResize();
                },
                onchange: () => {
                    canvas.handleResize();
                }
            },
            ex_top: {
                label: 'Kollisionsbox oben',
                hint: 'Mit diesem Wert kannst du anpassen, wo genau deine Spielfigur mit der Umgebung oder Gegnern kollidiert.',
                type: 'float',
                min: 0,
                max: 1,
                step: 0.05,
                decimalPlaces: 2,
                default: 1.0,
                onfocus: () => {
                    canvas.draw_ex = true;
                    canvas.handleResize();
                },
                onblur: () => {
                    canvas.draw_ex = false;
                    canvas.handleResize();
                },
                onchange: () => {
                    canvas.handleResize();
                }
            },
            force_x: {
                label: 'Kraft in X-Richtung',
                hint: 'Gib hier an, welche Kraft in X-Richtung auf die Spielfigur wirken soll (z.B. für Wind).',
                type: 'float',
                min: -100.0,
                max: 100.0,
                default: 0.0,
                decimalPlaces: 1,
                step: 0.1,
            },
            force_non_controllable: {
                label: 'Kraft gegensteuerbar',
                hint: 'Kann deine Spielfigur gegen die Kraft in X-Richtung ankämpfen?',
                type: 'bool',
                default: true,
            },
        },
    },
    // Begleiter: follows the player with its own way of moving (companion_ai.js).
    // Only what a child needs; distances, timers and the way back are internal.
    companion: {
        label: 'Begleiter',
        properties: {
            vrun: {
                label: 'Geschwindigkeit',
                hint: 'So schnell läuft (oder fliegt) dein Begleiter. Ist er weit weg, rennt er ein bisschen schneller, um dich einzuholen.',
                type: 'float',
                min: 0.0,
                max: 100.0,
                default: 3.0,
                decimalPlaces: 1,
                step: 0.1,
            },
            can_fly: {
                label: 'kann fliegen',
                hint: 'Ein fliegender Begleiter folgt dir durch die Luft – über Lücken und Wasser hinweg, ohne zu springen. Gut für einen Vogel, eine Fee, eine Drohne oder einen Geist.',
                type: 'bool',
                default: false,
                rebuilds_panel: true,
            },
            can_jump: {
                visible: (t) => t?.can_fly !== true,
                label: 'kann springen',
                hint: 'Ohne Sprung bleibt dein Begleiter vor jeder Stufe stehen – wie ein Roboter auf Rädern.',
                type: 'bool',
                default: true,
                rebuilds_panel: true,
            },
            vjump: {
                visible: (t) => t?.can_fly !== true && t?.can_jump !== false,
                label: 'Sprungkraft',
                hint: 'So kräftig springt dein Begleiter. Er springt nur so hoch, wie er kann – ist er schwächer als deine Spielfigur, bleibt er an hohen Kanten zurück.',
                type: 'float',
                default: 6.0,
                min: 0.0,
                max: 100.0,
                decimalPlaces: 1,
                step: 0.1,
            },
            can_swim: {
                visible: (t) => t?.can_fly !== true,
                label: 'kann schwimmen',
                hint: 'Ein Begleiter, der schwimmen kann, folgt dir ins Wasser (einen Bewegungsbereich „Schwimmen“). Alle anderen warten am Ufer.',
                type: 'bool',
                default: false,
            },
        },
        // Signale (signals.js): absent = it follows from the start, as always
        placed_properties: {
            waits_for_signal: {
                label: 'kommt erst bei Signal mit',
                hint: 'Ist das an, wartet dieser Begleiter, wo er steht, bis ein Signal „an“ mit seinem Code ankommt – dann kommt er mit und bleibt bei dir. Zum Beispiel ein Freund, den du erst finden musst: Leg einen Signalbereich um ihn herum.',
                type: 'bool',
                default: false,
                rebuilds_panel: true,   // Code appears or goes
            },
            signal_code: {
                label: 'Code',
                hint: 'Kommt ein Signal „an“ mit diesem Code, kommt der Begleiter mit.',
                type: 'int',
                default: 0,
                min: 0,
                max: 1000,
                visible: (traits, traits_of, props) => props?.waits_for_signal === true,
            },
        },
    },
    block_above: {
        label: 'man kann nicht von oben reinfallen',
    },
    block_sides: {
        label: 'man kann nicht von den Seiten reinlaufen',
    },
    block_below: {
        label: 'man kann nicht von unten reinspringen',
    },
    slope: {
        label: 'Schräge / Treppe',
        properties: {
            direction: {
                label: 'Richtung',
                type: 'select',
                options: {
                    'positive': 'nach rechts oben',
                    'negative': 'nach rechts unten',
                },
                default: 'positive',
            },
            slippery: {
                label: 'rutschig',
                type: 'float',
                min: 0.0,
                max: 1000,
                decimalPlaces: 0,
                default: 0,
                suffix: '%',
            },
        },
    },
    door: {
        label: 'ist eine Tür',
        properties: {
            lockable: {
                label: 'ist verschließbar',
                hint: 'Gib hier an, ob man einen Schlüssel braucht (oder einen Schalter oder eine Druckplatte mit demselben Code), um diese Tür zu öffnen.',
                type: 'bool',
                default: true,
            },
            automatic: {
                label: 'automatische Tür',
                type: 'bool',
                default: true,
            },
            closable: {
                label: 'lässt sich schließen',
                type: 'bool',
                default: false,
            },
            // closing again by itself: placed door.close_after ("schließt wieder nach")
            xsense: {
                label: 'Rand links/rechts',
                hint: 'Gibt an, wie weit der Sensor der Tür in horizontaler Richtung reicht.',
                type: 'float',
                suffix: 'px',
                min: 0.0,
                max: 100.0,
                default: 10.0,
                decimalPlaces: 0,
                step: 1,
            },
            ysense: {
                label: 'Rand oben/unten',
                hint: 'Gibt an, wie weit der Sensor der Tür in vertikaler Richtung reicht.',
                type: 'float',
                suffix: 'px',
                min: 0.0,
                max: 100.0,
                default: 0.0,
                decimalPlaces: 0,
                step: 1,
            },
        },
        placed_properties: {
            // absent = as drawn (signals.js door_setting)
            lockable: {
                label: 'ist verschließbar',
                hint: '„wie beim Sprite“: so, wie du die Tür gezeichnet hast. Hier kannst du es für diese eine Tür anders einstellen – dann reicht eine Zeichnung für eine normale Tür und für ein Tor, das nur ein Schlüssel oder Schalter öffnet.',
                type: 'override',
            },
            automatic: {
                label: 'automatische Tür',
                hint: '„wie beim Sprite“: so, wie du die Tür gezeichnet hast. „ja“: Die Tür geht auf, sobald die Spielfigur davorsteht. „nein“: Man muss die Aktionstaste (F) drücken.',
                type: 'override',
            },
            // older games: door_code (signals.js promote_legacy_signals)
            signal_code: {
                label: 'Code',
                hint: 'Schlüssel, Schalter, Druckplatten, Signalbereiche und Gegner mit demselben Code senden dieser Tür ein Signal. Was die Tür dann macht, stellst du darunter ein.',
                type: 'int',
                default: 0,
                min: 0,
                max: 1000,
            },
            door_closed: {
                label: 'Tür geschlossen',
                hint: 'Gib an, ob die Tür geschlossen sein soll.',
                type: 'bool',
                default: true,
            },
            door_reaction: {
                label: 'Bei Signal',
                hint: 'Was die Tür macht, wenn ein Schlüssel, Schalter oder eine Druckplatte mit ihrem Code ein Signal sendet. „aufschließen“: wie ein Schlüssel – danach geht die Tür auf wie sonst auch. „öffnen“ und „schließen“: Die Tür bewegt sich von selbst, auch wenn niemand davorsteht und auch, wenn sie verschließbar ist. „offen, solange an“: auf bei „an“, zu bei „aus“ – passt zu einer Druckplatte. „wechseln“: Jedes Signal macht die Tür auf oder zu.',
                type: 'select',
                options: typeof DOOR_SIGNAL_REACTIONS !== 'undefined' ? DOOR_SIGNAL_REACTIONS : { unlock: 'aufschließen' },
                default: 'unlock',
            },
            // absent = 0 = stays open (signals.js door_auto_close_step)
            close_after: {
                label: 'schließt wieder nach',
                hint: 'Ist die Tür ganz offen, geht sie nach so vielen Sekunden von selbst wieder zu – egal, wer oder was sie geöffnet hat, auch wenn sie sich sonst nicht schließen lässt. 0: Sie bleibt offen. Eine automatische Tür bleibt offen, solange die Spielfigur davorsteht. Steht jemand in der Tür, wartet sie, bis der Weg frei ist. So baust du ein Tor, das ein Schalter nur für ein paar Sekunden öffnet.',
                type: 'float',
                suffix: 's',
                min: 0,
                max: 60,
                step: 0.5,
                decimalPlaces: 1,
                default: 0,
            },
        },
    },
    key: {
        label: 'ist ein Schlüssel',
        placed_properties: {
            // older games: door_code (signals.js promote_legacy_signals)
            signal_code: {
                label: 'Code',
                hint: 'Wenn man den Schlüssel einsammelt, sendet er seinen Code. Er kann nur Türen mit demselben Code in diesem Level öffnen.',
                type: 'int',
                min: 0,
                max: 1000,
                default: 0,
            },
            signal_delay: signal_delay_placed_property('Der Schlüssel sendet seinen Code erst so viele Sekunden nach dem Einsammeln. Aufschließen kann er sofort.'),
        },
    },
    switch: {
        label: 'ist ein Schalter',
        placed_properties: {
            signal_code: {
                label: 'Code',
                hint: 'Legt man den Schalter mit der Aktionstaste (F) um, sendet er diesen Code: „an“ oder „aus“. Türen und Ebenen mit demselben Code reagieren darauf.',
                type: 'int',
                default: 0,
                min: 0,
                max: 1000,
            },
            signal_delay: signal_delay_placed_property('„an“ und „aus“ kommen erst so viele Sekunden nach dem Umlegen an – zum Beispiel stürzt eine Brücke ein, kurz nachdem man den Schalter umgelegt hat.'),
            switch_on: {
                label: 'ist am Anfang an',
                hint: 'Ein Schalter, der am Anfang an ist, sendet beim ersten Umlegen „aus“.',
                type: 'bool',
                default: false,
            },
        },
    },
    pressure_plate: {
        label: 'ist eine Druckplatte',
        placed_properties: {
            signal_code: {
                label: 'Code',
                hint: 'Tritt die Spielfigur auf die Druckplatte, sendet sie diesen Code mit „an“. Geht sie wieder herunter, sendet sie „aus“.',
                type: 'int',
                default: 0,
                min: 0,
                max: 1000,
            },
            signal_delay: signal_delay_placed_property('„an“ und „aus“ kommen erst so viele Sekunden später an – zum Beispiel bleibt ein Tor noch kurz offen, nachdem man von der Platte gegangen ist.'),
        },
    },
    // Zähler (signals.js): receives and sends. Placed: the Code it counts,
    // the Anzahl and the Code it sends; absent = the defaults (a new one gets
    // two free Codes when placed, give_new_senders_codes)
    counter: {
        label: 'ist ein Zähler',
        placed_properties: {
            signal_code: {
                label: 'zählt Code',
                hint: 'Jedes Signal „an“ mit diesem Code zählt eins dazu, jedes „aus“ eins weg. Gib allen Schaltern (Druckplatten, Münzen …), die zählen sollen, diesen Code.',
                type: 'int',
                default: 0,
                min: 0,
                max: 1000,
                entry_key: 'counter_in',
            },
            count: {
                label: 'Anzahl',
                hint: 'So viele muss der Zähler zählen, bis er sein eigenes Signal sendet. Drei Schalter und Anzahl 3: Erst wenn alle drei an sind, geht es weiter.',
                type: 'int',
                default: 3,
                min: 1,
                max: 99,
                entry_key: 'counter_count',
            },
            send_code: {
                label: 'sendet Code',
                hint: 'Hat der Zähler seine Anzahl erreicht, sendet er diesen Code mit „an“. Fällt er wieder darunter (ein Schalter wird zurückgelegt), sendet er „aus“.',
                type: 'int',
                default: 0,
                min: 0,
                max: 1000,
                entry_key: 'counter_out',
            },
            signal_delay: { ...signal_delay_placed_property('Der Zähler sendet sein Signal erst so viele Sekunden später.'),
                entry_key: 'counter_delay' },
        },
    },
    text: {
        label: 'Hinweistext',
        // speech.js: shown above the speaker, one line after the other
        placed_properties: {
            text: {
                label: 'Text',
                hint: 'Steht die Spielfigur davor und man drückt die Aktionstaste (F), wird dieser Text gesprochen – Satz für Satz, jeder Satz in einer eigenen Sprechblase. Willst du selbst bestimmen, wo eine neue Sprechblase beginnt, setze dort ein | (Knopf „Neue Sprechblase“ oder AltGr + <). Mit der Punkt-Taste (.) oder F geht es gleich zur nächsten Sprechblase.',
                type: 'string',
                options: {
                    multiline: true,
                    // level_editor.js: a button that puts the separator at the cursor
                    insert_button: { text: ' | ', label: 'Neue Sprechblase', icon: 'fa-comment-o' },
                },
                default: '',
            },
            speaker: {
                label: 'Wer spricht',
                hint: '„die Spielfigur liest vor“: Der Text erscheint über der Spielfigur, in ihrer Farbe (unter Einstellungen → Texte) – gut für Schilder. „das Sprite spricht selbst“: Der Text erscheint über diesem Sprite, in der Farbe darunter – gut für eine Figur, die etwas sagt. Hat das Sprite einen Zustand „spricht gerade“, zeigt es ihn, solange es redet.',
                type: 'select',
                options: typeof SPEECH_SPEAKERS !== 'undefined' ? SPEECH_SPEAKERS : { player: 'die Spielfigur liest vor' },
                default: 'player',
                rebuilds_panel: true,   // Textfarbe appears or goes
            },
            color: {
                label: 'Textfarbe',
                hint: 'In dieser Farbe spricht das Sprite. Gib jeder Figur ihre eigene Farbe – dann sieht man sofort, wer redet.',
                type: 'color',
                default: typeof SPEECH_SELF_COLOR !== 'undefined' ? SPEECH_SELF_COLOR : '#73eff7',
                // only when the sprite speaks itself (the level editor rebuilds the panel)
                visible: (traits, traits_of, props) => props?.speaker === 'self',
            },
            // Signale (signals.js): absent = only with the action key, as always
            speaks_on_signal: {
                label: 'spricht bei Signal',
                hint: 'Ist das an, wird der Text auch gesprochen, sobald ein Signal mit diesem Code „an“ ankommt – ohne dass jemand F drückt. Mit einem Signalbereich davor sagt das Schild etwas, sobald die Spielfigur vorbeiläuft; mit einem Schalter, wenn er umgelegt wird. Mit F kann man den Text trotzdem noch einmal lesen.',
                type: 'bool',
                default: false,
                rebuilds_panel: true,   // Code appears or goes
            },
            signal_code: {
                label: 'Code',
                hint: 'Kommt ein Signal mit diesem Code „an“, wird der Text gesprochen.',
                type: 'int',
                default: 0,
                min: 0,
                max: 1000,
                visible: (traits, traits_of, props) => props?.speaks_on_signal === true,
            },
        },
    },
    falls_down: {
        label: 'fällt runter, wenn man drauf steht',
        properties: {
            timeout: {
                label: 'fällt nach',
                hint: 'Gibt an, nach welcher Zeit ein Sprite fällt.',
                type: 'float',
                suffix: 's',
                min: 0.0,
                max: 100.0,
                default: 1.0,
                decimalPlaces: 1,
                step: 0.1,
            },
            accumulates: {
                label: 'akkumuliert Schaden',
                hint: 'Diese Angabe ist vor allem im Zusammenhang mit animierten Sprites sinnvoll. Ist diese Eigenschaft aktiviert, so wird je nach Zerfallszustand der passende Frame deiner Animation angezeigt.',
                type: 'bool',
                default: false,
            },
            falls_on_baddie: {
                label: 'fällt auch bei Gegnern',
                hint: 'Soll das Sprite auch fallen, wenn ein Gegner drauf steht?',
                type: 'bool',
                default: false,
            },
            damage: {
                label: 'Schaden',
                hint: 'Gibt an, wie viel Fallschaden das Sprite anrichtet, wenn es einen Gegner trifft.',
                type: 'float',
                default: 0,
                min: 0,
                max: 1000,
            },
        },
    },
    conveyor: {
        label: 'Förderband / Rolltreppe',
        properties: {
            direction: {
                label: 'Richtung',
                hint: 'In diese Richtung nimmt das Band Figuren mit. Zusammen mit „Schräge / Treppe“ wird daraus eine Rolltreppe.',
                type: 'select',
                options: {
                    'right': 'nach rechts',
                    'left': 'nach links',
                },
                default: 'right',
            },
            speed: {
                label: 'Geschwindigkeit',
                hint: 'So schnell wird eine Figur mitgenommen, die darauf steht. Zum Vergleich: Eine Spielfigur läuft meistens mit 3.',
                type: 'float',
                min: 0.0,
                max: 20.0,
                step: 0.1,
                decimalPlaces: 1,
                default: 1.5,
            },
            moves_baddies: {
                label: 'nimmt auch Gegner mit',
                hint: 'Sollen auch Gegner mitfahren? Dann kann ein Band sie zum Beispiel in eine Falle tragen.',
                type: 'bool',
                default: true,
            },
        },
    },
    // Bewegte Plattformen und Aufzüge (platforms.js): the drawing has the
    // speed and the pause, every placed copy its own Weg and start
    moving: {
        label: 'bewegt sich (Plattform, Aufzug)',
        properties: {
            speed: {
                label: 'Geschwindigkeit',
                hint: 'So schnell fährt das Sprite seinen Weg entlang. Zum Vergleich: Eine Spielfigur läuft meistens mit 3. Wer obendrauf steht, fährt mit – gib dem Sprite dazu „Block von oben“.',
                type: 'float',
                min: 0.1,
                max: 10.0,
                step: 0.1,
                decimalPlaces: 1,
                default: 1.0,
            },
            pause: {
                label: 'Pause am Ende',
                hint: 'So lange wartet es an jedem Ende seines Wegs, bevor es zurückfährt. Ein Aufzug wartet so lange, bevor er leer wieder nach unten fährt.',
                type: 'float',
                suffix: 's',
                min: 0,
                max: 10,
                step: 0.5,
                decimalPlaces: 1,
                default: 1.0,
            },
        },
        // absent = the defaults in platforms.js (PLATFORM)
        placed_properties: {
            path_x: {
                label: 'Weg nach rechts',
                hint: 'So weit fährt dieses Sprite von hier aus nach rechts (24 Pixel sind ein Block). Eine Zahl mit Minus fährt nach links. Im Level siehst du den Weg als gestrichelte Linie und das Ende als Rahmen. Einfacher: Wähl die Plattform mit dem Auswahl-Werkzeug aus und zieh den runden Griff im Rahmen dorthin, wo sie hinfahren soll.',
                type: 'int',
                suffix: 'px',
                min: -4800,
                max: 4800,
                step: 24,
                width: '3.5em',
                default: 96,
            },
            path_y: {
                label: 'Weg nach oben',
                hint: 'So weit fährt dieses Sprite von hier aus nach oben – zum Beispiel ein Aufzug. Eine Zahl mit Minus fährt nach unten. Beide Wege zusammen: Es fährt schräg.',
                type: 'int',
                suffix: 'px',
                min: -4800,
                max: 4800,
                step: 24,
                width: '3.5em',
                default: 0,
            },
            start: {
                label: 'Fährt',
                hint: '„immer hin und her“: zum Ende, Pause, zurück, Pause … „wenn die Spielfigur draufsteht (Aufzug)“: Es wartet, bis die Spielfigur draufsteigt, und bringt sie ans andere Ende. Bleibt es dort leer, kommt es nach der Pause zurück. „bei Signal“: Ein Signal „an“ mit seinem Code schickt es ans Ende, „aus“ wieder zurück.',
                type: 'select',
                options: typeof PLATFORM_START_MODES !== 'undefined' ? PLATFORM_START_MODES : { always: 'immer hin und her' },
                default: 'always',
                entry_key: 'platform_start',
                rebuilds_panel: true,   // Code appears or goes
            },
            signal_code: {
                label: 'Code',
                hint: 'Schalter, Druckplatten, Schlüssel, Signalbereiche und Gegner mit demselben Code schicken es los: „an“ ans Ende, „aus“ zurück an den Anfang.',
                type: 'int',
                default: 0,
                min: 0,
                max: 1000,
                entry_key: 'platform_code',
                visible: (traits, traits_of, props) => props?.start === 'signal',
            },
        },
    },
    ladder: {
        label: 'man kann dran hoch- und runterklettern',
        properties: {
            center: {
                label: 'Figur zentrieren',
                hint: 'Soll die Spielfigur automatisch zentriert werden?',
                type: 'bool',
                default: true,
            },
        },
    },
    pickup: {
        label: 'man kann es einsammeln',
        // Signale (signals.js): absent = it sends nothing, as always. Stored as
        // placed pickup.signal_* like every Code; in the game they are entry fields
        // of their own (entry_key), so a key that is also a pickup keeps its Code.
        placed_properties: {
            signal_on_collect: {
                label: 'sendet, wenn eingesammelt',
                hint: 'Ist das an, sendet dieses Sprite seinen Code, sobald die Spielfigur es einsammelt – zum Beispiel erscheint dann eine Brücke, wenn man den Edelstein holt.',
                type: 'bool',
                default: false,
                entry_key: 'pickup_signal_on',
                rebuilds_panel: true,   // Code and Verzögerung appear or go
            },
            signal_code: {
                label: 'Code',
                hint: 'Diesen Code sendet das Sprite, wenn es eingesammelt wird.',
                type: 'int',
                default: 0,
                min: 0,
                max: 1000,
                entry_key: 'pickup_signal_code',
                visible: (traits, traits_of, props) => props?.signal_on_collect === true,
            },
            signal_delay: { ...signal_delay_placed_property('Das Sprite sendet seinen Code erst so viele Sekunden nach dem Einsammeln.'),
                entry_key: 'pickup_signal_delay',
                visible: (traits, traits_of, props) => props?.signal_on_collect === true },
        },
        properties: {
            duration: {
                label: 'Ausblenden',
                hint: 'Gibt an, innerhalb welcher Zeit das Sprite ausgeblendet wird, nachdem es eingesammelt wurde.',
                type: 'float',
                suffix: 's',
                width: '3.2em',
                min: 0.0,
                max: 10.0,
                step: 0.1,
                decimalPlaces: 1,
                default: 0.5,
            },
            move_up: {
                label: 'Bewegung',
                hint: 'Gibt an, wie schnell sich das Sprite nach oben bewegen soll, nachdem es eingesammelt wurde.',
                type: 'float',
                suffix: 'px/s',
                width: '1.8em',
                min: 0,
                max: 1000,
                step: 1,
                decimalPlaces: 0,
                default: 100,
            },
            points: {
                label: 'gibt Punkte',
                hint: 'Gib hier an, wie viele Punkte deine Spielfigur erhalten soll, wenn das Sprite eingesammelt wird.',
                type: 'float',
                min: 0,
                max: 100,
                step: 1,
                decimalPlaces: 0,
                default: 0,
            },
            lives: {
                label: 'gibt Leben',
                hint: 'Gib hier an, wie viele Leben deine Spielfigur erhalten soll, wenn das Sprite eingesammelt wird.',
                type: 'float',
                min: 0,
                max: 100,
                step: 1,
                decimalPlaces: 0,
                default: 0,
            },
            energy: {
                label: 'gibt Energie',
                hint: 'Gib hier an, wie viel Energie deine Spielfigur erhalten soll, wenn das Sprite eingesammelt wird.',
                type: 'float',
                min: 0,
                max: 100,
                step: 1,
                decimalPlaces: 0,
                default: 0,
            },
            invincible: {
                label: 'unverwundbar für',
                hint: 'Gib hier an, für wie viele Sekunden deine Spielfigur unverwundbar sein soll.',
                type: 'float',
                min: 0,
                max: 100,
                step: 1,
                decimalPlaces: 1,
                default: 0,
                suffix: 's',
            },
            speed_boost_vrun: {
                label: 'Beschleunigung (laufen)',
                hint: 'Gib hier eine Zahl an, wenn deine Figur einen Geschwindigkeitsboost erhalten soll (1.0 = normale Geschwindigkeit).',
                type: 'float',
                min: 0.0,
                max: 10.0,
                step: 0.1,
                decimalPlaces: 1,
                default: 1.0,
                suffix: '',
            },
            speed_boost_vjump: {
                label: 'Beschleunigung (springen)',
                hint: 'Gib hier eine Zahl an, wenn deine Figur einen Geschwindigkeitsboost erhalten soll (1.0 = normale Geschwindigkeit).',
                type: 'float',
                min: 0.0,
                max: 10.0,
                step: 0.1,
                decimalPlaces: 1,
                default: 1.0,
                suffix: '',
            },
            speed_boost_duration: {
                label: 'Beschleunigung für',
                hint: 'Gib hier an, für wie viele Sekunden deine Spielfigur einen Geschwindigkeitsboost erhalten soll.',
                type: 'float',
                min: 0,
                max: 100,
                step: 1,
                decimalPlaces: 1,
                default: 0,
                suffix: 's',
            },
        },
    },
    trap: {
        label: 'Falle',
        properties: {
            damage: {
                label: 'Schaden',
                hint: 'Der Schaden wird von der Energie deiner Spielfigur abgezogen, wenn sie mit der Falle in Berührung kommt.',
                type: 'float',
                default: 100,
                min: 0,
                max: 1000,
            },
            damage_cool_down: {
                label: 'Cooldown',
                hint: 'Für diese Zeit verursacht die Falle keinen weiteren Schaden, nachdem sie ausgelöst wurde.',
                type: 'float',
                default: 1.0,
                suffix: 's',
                decimalPlaces: 1,
                step: 0.1,
                min: 0.0,
                max: 10.0,
            },
        },
    },
    // Intelligenz: what a walking enemy can do besides walking. A trait of its
    // own, so the enemy panel stays short; without it (old games) nothing changes.
    // Each behaviour uses what fits it (baddie_ai.js: baddie_moves).
    smart: {
        label: 'Intelligenz (für Gegner)',
        properties: {
            walks_slopes: {
                visible: (t, all) => typeof behavior_uses !== 'function' || !all?.baddie || behavior_uses(all.baddie, 'move'),
                label: 'Schrägen und Treppen laufen',
                hint: 'Beim Hin-und-her-Laufen läuft er Schrägen und Treppen hinauf und hinunter, statt dort umzudrehen. Beim Verfolgen und auf der Flucht kann er das sowieso.',
                type: 'bool',
                default: false,
            },
            jumps_obstacles: {
                visible: (t, all) => typeof behavior_uses !== 'function' || !all?.baddie || behavior_uses(all.baddie, 'move'),
                label: 'über Hindernisse springen',
                hint: 'Steht ihm beim Hin-und-her-Laufen ein Block im Weg, der nicht höher ist als sein Sprung, springt er darüber, statt umzudrehen. Ein Angsthase springt so aus der Ecke. Ein Jäger springt beim Verfolgen sowieso.',
                type: 'bool',
                default: false,
            },
            jumps_gaps: {
                visible: (t, all) => typeof behavior_uses !== 'function' || !all?.baddie || behavior_uses(all.baddie, 'move'),
                label: 'über Lücken springen',
                hint: 'An einer Kante springt er hinüber, wenn er auf der anderen Seite landen kann – beim Hin-und-her-Laufen, beim Verfolgen und auf der Flucht.',
                type: 'bool',
                default: false,
            },
            drops_down: {
                visible: (t, all) => typeof behavior_uses !== 'function' || !all?.baddie || behavior_uses(all.baddie, 'move'),
                label: 'von Kanten hinunterspringen',
                hint: 'Beim Hin-und-her-Laufen (und als Angsthase in der Ecke) lässt er sich von einer Kante fallen – aber nur, wenn höchstens fünf Blöcke tiefer Boden ist. Ein Jäger springt dir beim Verfolgen sowieso hinterher, mit Intelligenz aber nie in einen Abgrund.',
                type: 'bool',
                default: false,
            },
            climbs_ladders: {
                visible: (t, all) => typeof baddie_behavior_type !== 'function' || !all?.baddie || ['hunter', 'coward'].includes(baddie_behavior_type(all.baddie)),
                label: 'Leitern klettern',
                hint: 'Der Jäger sucht beim Verfolgen eine Leiter in bis zu fünf Blöcken Entfernung, wenn die Spielfigur über oder unter ihm ist. Der Angsthase flieht jede Leiter hoch oder runter, an der er vorbeikommt – nur nicht der Spielfigur entgegen.',
                type: 'bool',
                default: false,
            },
        },
    },
    baddie: {
        label: 'Gegner',
        // Signale (signals.js): absent = the enemy sends nothing, as always
        placed_properties: {
            signal_on_defeat: {
                label: 'sendet, wenn besiegt',
                hint: 'Ist das an, sendet dieser Gegner seinen Code, sobald er besiegt ist – zum Beispiel öffnet sich dann ein Tor oder eine Brücke erscheint.',
                type: 'bool',
                default: false,
                rebuilds_panel: true,   // Code and Verzögerung appear or go
            },
            signal_code: {
                label: 'Code',
                hint: 'Diesen Code sendet der Gegner, wenn er besiegt ist.',
                type: 'int',
                default: 0,
                min: 0,
                max: 1000,
                visible: (traits, traits_of, props) => props?.signal_on_defeat === true,
            },
            signal_delay: { ...signal_delay_placed_property('Der Gegner sendet seinen Code erst so viele Sekunden, nachdem er besiegt ist.'),
                visible: (traits, traits_of, props) => props?.signal_on_defeat === true },
            // Beute: absent = the Code set at the drawing (signals.js effective_loot_code)
            drop_code: {
                label: 'Code der Beute',
                hint: 'Dieser Gegner lässt einen Schlüssel zurück. Der Schlüssel öffnet Türen mit diesem Code – so kann jeder Gegner im Level einen anderen Schlüssel tragen. Am Anfang steht hier der Code, den du beim Gegner unter „Beute“ eingestellt hast.',
                type: 'int',
                min: 0,
                max: 1000,
                // only for an enemy whose Beute is a key; until set, the drawing's Code
                visible: (traits, traits_of) => typeof loot_key_code !== 'function' ||
                    loot_key_code(null, traits?.baddie, traits_of) !== null,
                default_for: (traits) => Number.isInteger(traits?.baddie?.drop?.signal_code) ? traits.baddie.drop.signal_code : 0,
            },
        },
        properties: {
            energy: {
                label: 'Energie',
                hint: 'Da auch Gegner Schaden erleiden können, muss hier die Anfangsenergie angegeben werden.',
                type: 'float',
                min: 0,
                max: 10000,
                default: 100,
            },
            // false: as always (app.js take_damage, combat.js apply_hit)
            invincible: {
                label: 'unverwundbar',
                hint: 'Ist das an, kann man diesen Gegner nicht verletzen – zum Beispiel eine Katze, die kratzt, der man aber nichts tun soll. Schwert, Geschosse, Bomben und herabfallende Blöcke machen ihm nichts; ein Geschoss, das ihn trifft, ist weg. Er selbst kann trotzdem angreifen und bei Berührung Schaden machen. Für „alle Gegner besiegt“ zählt er nicht mit.',
                type: 'bool',
                default: false,
            },
            damage: {
                label: 'Schaden',
                hint: 'Wie viel Schaden verursacht dieser Gegner bei Berührung?',
                type: 'float',
                default: 100,
                min: 0,
                max: 1000,
            },
            damage_cool_down: {
                label: 'Cooldown',
                hint: 'Für diese Zeit verursacht die der Gegner keinen weiteren Schaden, nachdem er berührt wurde.',
                type: 'float',
                default: 1.0,
                suffix: 's',
                decimalPlaces: 1,
                step: 0.1,
                min: 0.0,
                max: 10.0,
            },
            hit_pause: {
                label: 'Pause nach Treffer',
                hint: 'So viele Sekunden bleibt der Gegner stehen, nachdem ihn ein Angriff getroffen hat. Er läuft dann nicht und greift nicht an. 0 bedeutet: Er macht sofort weiter.',
                type: 'float',
                default: 0.0,
                suffix: 's',
                decimalPlaces: 1,
                step: 0.1,
                min: 0.0,
                max: 10.0,
            },
            // knockback: {
            //     label: 'Knockback',
            //     type: 'float',
            //     default: 0.0,
            //     step: 1.0,
            //     min: 0.0,
            //     max: 100.0,
            // },
            vrun: {
                visible: (t) => typeof behavior_uses !== 'function' || behavior_uses(t, 'speed'),
                label: 'Geschwindigkeit',
                hint: 'Gib hier die Geschwindigkeit an, mit der sich der Gegner bewegen soll.',
                type: 'float',
                min: 0.0,
                max: 100.0,
                default: 0.5,
                decimalPlaces: 1,
                step: 0.1,
            },
            affected_by_gravity: {
                visible: (t) => typeof behavior_uses !== 'function' || behavior_uses(t, 'gravity'),
                label: 'beeinflusst durch Schwerkraft',
                hint: 'Wenn der Gegner durch die Schwerkraft beeinflusst wird, fällt er nach unten.',
                type: 'bool',
                default: true,
            },
            vjump: {
                visible: (t) => typeof behavior_uses !== 'function' || behavior_uses(t, 'jump'),
                label: 'Sprungkraft',
                hint: 'Mit welcher Kraft soll der Gegner abspringen, wenner sprint?',
                type: 'float',
                default: 9.0,
                min: 0.0,
                max: 100.0,
                decimalPlaces: 1,
                step: 0.1,
            },
            patrols: {
                // Wächter / Steht still: the type decides; Jäger and Angsthase may wait instead of patrolling
                visible: (t) => typeof baddie_behavior_type !== 'function' || ['hunter', 'coward'].includes(baddie_behavior_type(t)),
                label: 'patrouilliert',
                hint: 'Ein patrouillierender Gegner läuft hin und her und bewacht ein begrenztes Gebiet.',
                type: 'bool',
                default: true,
            },
            start_dir: {
                visible: (t) => typeof baddie_behavior_type !== 'function' || baddie_behavior_type(t) !== 'stomper',
                label: 'Startrichtung',
                hint: 'In welche Richtung soll der Gegner zuerst laufen?',
                type: 'select',
                options: {
                    'left': 'links',
                    'right': 'rechts',
                    'random': 'zufällig',
                },
                default: 'random',
            },
            jump_from_edge_probability: {
                visible: (t) => typeof behavior_uses !== 'function' || behavior_uses(t, 'patrol'),
                label: 'springt von Plattformen',
                hint: 'Gegner können auch von Plattformen abspringen, anstatt umzukehren. Dadurch kannst du komplexe Patrouille-Muster entwerfen.',
                type: 'float',
                min: 0.0,
                max: 100,
                decimalPlaces: 0,
                default: 0,
                suffix: '%',
            },
            jump_vfactor: {
                advanced: true,
                visible: (t) => typeof behavior_uses !== 'function' || behavior_uses(t, 'jump'),
                label: 'Sprungfaktor',
                type: 'float',
                min: 0.0,
                max: 100,
                decimalPlaces: 1,
                default: 3.0,
            },
            camera_shake_on_land: {
                advanced: true,
                label: 'Camera Shake bei Landung',
                type: 'float',
                min: 0.0,
                max: 100,
                decimalPlaces: 0,
                default: 0,
                suffix: 'px',
            },
            camera_shake_max_dist: {
                advanced: true,
                label: 'Camera Shake max. Entfernung',
                type: 'float',
                min: 0.0,
                max: 10000,
                decimalPlaces: 0,
                default: 200,
                suffix: 'px',
            },
            wait_until_seen: {
                label: 'bleibt stehen, solange nicht zu sehen',
                type: 'bool',
                default: true,
            },
            takes_breaks: {
                visible: (t) => typeof behavior_uses !== 'function' || behavior_uses(t, 'patrol'),
                label: 'Pausen alle',
                type: 'float',
                count: 2,
                connector: '–',
                default: [0.0, 0.0],
                suffix: 's',
                width: '1.4em',
                min: [0.0, 0.0],
                max: [1000, 1000],
                step: 1,
            },
            break_length: {
                visible: (t) => typeof behavior_uses !== 'function' || behavior_uses(t, 'patrol'),
                label: 'Pausendauer',
                type: 'float',
                count: 2,
                connector: '–',
                default: [0.0, 0.0],
                suffix: 's',
                width: '1.4em',
                min: [0.0, 0.0],
                max: [1000, 1000],
                step: 1,
            },
            ex_left: {
                advanced: true,
                label: 'Kollisionsbox links',
                type: 'float',
                min: 0,
                max: 1,
                step: 0.05,
                decimalPlaces: 2,
                default: 0.7,
                onfocus: () => {
                    canvas.draw_ex = true;
                    canvas.handleResize();
                },
                onblur: () => {
                    canvas.draw_ex = false;
                    canvas.handleResize();
                },
                onchange: () => {
                    canvas.handleResize();
                }
            },
            ex_right: {
                advanced: true,
                label: 'Kollisionsbox rechts',
                type: 'float',
                min: 0,
                max: 1,
                step: 0.05,
                decimalPlaces: 2,
                default: 0.7,
                onfocus: () => {
                    canvas.draw_ex = true;
                    canvas.handleResize();
                },
                onblur: () => {
                    canvas.draw_ex = false;
                    canvas.handleResize();
                },
                onchange: () => {
                    canvas.handleResize();
                }
            },
            ex_top: {
                advanced: true,
                label: 'Kollisionsbox oben',
                type: 'float',
                min: 0,
                max: 1,
                step: 0.05,
                decimalPlaces: 2,
                default: 1.0,
                onfocus: () => {
                    canvas.draw_ex = true;
                    canvas.handleResize();
                },
                onblur: () => {
                    canvas.draw_ex = false;
                    canvas.handleResize();
                },
                onchange: () => {
                    canvas.handleResize();
                }
            },
        },
    },
    level_complete: {
        label: 'Levelwechsel',
        placed_properties: {
            delta: {
                label: 'Delta',
                hint: 'Gib hier an, wie weit der Levelwechsel nach vorne springen soll (1: nächstes Level, 2: übernächstes Level).',
                type: 'int',
                default: 1,
                min: -100,
                max: 100,
            },
        },
    },
    checkpoint: {
        label: 'Checkpoint'
    },
};

var STATE_TRAITS = {
    actor: {
        front: { label: 'Spielfigur schaut nach vorn' },
        back: { label: 'Spielfigur schaut nach hinten' },
        left: { label: 'Spielfigur schaut nach links' },
        right: { label: 'Spielfigur schaut nach rechts' },
        walk_front: { label: 'Spielfigur läuft nach vorn' },
        walk_back: { label: 'Spielfigur läuft nach hinten' },
        walk_left: { label: 'Spielfigur läuft nach links' },
        walk_right: { label: 'Spielfigur läuft nach rechts' },
        jump_front: { label: 'Spielfigur springt nach vorn' },
        jump_back: { label: 'Spielfigur springt nach hinten' },
        jump_left: { label: 'Spielfigur springt nach links' },
        jump_right: { label: 'Spielfigur springt nach rechts' },
        fall_front: { label: 'Spielfigur fällt nach vorn' },
        fall_back: { label: 'Spielfigur fällt nach hinten' },
        fall_left: { label: 'Spielfigur fällt nach links' },
        fall_right: { label: 'Spielfigur fällt nach rechts' },
        // on a ladder (always seen from behind); without it: "schaut nach hinten"
        climb: { label: 'Spielfigur klettert' },
        attack_front: { label: 'Spielfigur greift nach vorn an' },
        attack_back: { label: 'Spielfigur greift nach hinten an' },
        attack_left: { label: 'Spielfigur greift nach links an' },
        attack_right: { label: 'Spielfigur greift nach rechts an' },
        hit_front: { label: 'Spielfigur: Treffer (vorn)' },
        hit_back: { label: 'Spielfigur: Treffer (hinten)' },
        hit_left: { label: 'Spielfigur: Treffer (links)' },
        hit_right: { label: 'Spielfigur: Treffer (rechts)' },
        // in a Bewegungsbereich (movement_regions.js); without them: the walk,
        // jump and fall pictures
        swim_front: { label: 'Spielfigur schwimmt nach vorn' },
        swim_back: { label: 'Spielfigur schwimmt nach hinten' },
        swim_left: { label: 'Spielfigur schwimmt nach links' },
        swim_right: { label: 'Spielfigur schwimmt nach rechts' },
        float_front: { label: 'Spielfigur schwebt nach vorn' },
        float_back: { label: 'Spielfigur schwebt nach hinten' },
        float_left: { label: 'Spielfigur schwebt nach links' },
        float_right: { label: 'Spielfigur schwebt nach rechts' },
        // optional as well: no key pressed in the water / in space, swimming down, up
        drift_front: { label: 'Spielfigur treibt, schaut nach vorn' },
        drift_back: { label: 'Spielfigur treibt, schaut nach hinten' },
        drift_left: { label: 'Spielfigur treibt, schaut nach links' },
        drift_right: { label: 'Spielfigur treibt, schaut nach rechts' },
        dive_front: { label: 'Spielfigur taucht ab nach vorn' },
        dive_back: { label: 'Spielfigur taucht ab nach hinten' },
        dive_left: { label: 'Spielfigur taucht ab nach links' },
        dive_right: { label: 'Spielfigur taucht ab nach rechts' },
        rise_front: { label: 'Spielfigur taucht auf nach vorn' },
        rise_back: { label: 'Spielfigur taucht auf nach hinten' },
        rise_left: { label: 'Spielfigur taucht auf nach links' },
        rise_right: { label: 'Spielfigur taucht auf nach rechts' },
        dead: { label: 'Spielfigur tot' }
    },
    baddie: {
        front: { label: 'Gegner schaut nach vorn' },
        back: { label: 'Gegner schaut nach hinten' },
        left: { label: 'Gegner schaut nach links' },
        right: { label: 'Gegner schaut nach rechts' },
        walk_front: { label: 'Gegner läuft nach vorn' },
        walk_back: { label: 'Gegner läuft nach hinten' },
        walk_left: { label: 'Gegner läuft nach links' },
        walk_right: { label: 'Gegner läuft nach rechts' },
        jump_front: { label: 'Gegner springt nach vorn' },
        jump_back: { label: 'Gegner springt nach hinten' },
        jump_left: { label: 'Gegner springt nach links' },
        jump_right: { label: 'Gegner springt nach rechts' },
        fall_front: { label: 'Gegner fällt nach vorn' },
        fall_back: { label: 'Gegner fällt nach hinten' },
        fall_left: { label: 'Gegner fällt nach links' },
        fall_right: { label: 'Gegner fällt nach rechts' },
        climb: { label: 'Gegner klettert' },
        attack_front: { label: 'Gegner greift nach vorn an' },
        attack_back: { label: 'Gegner greift nach hinten an' },
        attack_left: { label: 'Gegner greift nach links an' },
        attack_right: { label: 'Gegner greift nach rechts an' },
        hit_front: { label: 'Gegner: Treffer (vorn)' },
        hit_back: { label: 'Gegner: Treffer (hinten)' },
        hit_left: { label: 'Gegner: Treffer (links)' },
        hit_right: { label: 'Gegner: Treffer (rechts)' },
        hunt_front: { label: 'Gegner jagt nach vorn' },
        hunt_back: { label: 'Gegner jagt nach hinten' },
        hunt_left: { label: 'Gegner jagt nach links' },
        hunt_right: { label: 'Gegner jagt nach rechts' },
        flee_front: { label: 'Gegner flieht nach vorn' },
        flee_back: { label: 'Gegner flieht nach hinten' },
        flee_left: { label: 'Gegner flieht nach links' },
        flee_right: { label: 'Gegner flieht nach rechts' },
        stunned_front: { label: 'Gegner ist benommen (vorn)' },
        stunned_back: { label: 'Gegner ist benommen (hinten)' },
        stunned_left: { label: 'Gegner ist benommen (links)' },
        stunned_right: { label: 'Gegner ist benommen (rechts)' },
        landed_front: { label: 'Gegner ist aufgeschlagen (vorn)' },
        landed_back: { label: 'Gegner ist aufgeschlagen (hinten)' },
        landed_left: { label: 'Gegner ist aufgeschlagen (links)' },
        landed_right: { label: 'Gegner ist aufgeschlagen (rechts)' },
        // in a Bewegungsbereich (movement_regions.js), like the player character
        swim_front: { label: 'Gegner schwimmt nach vorn' },
        swim_back: { label: 'Gegner schwimmt nach hinten' },
        swim_left: { label: 'Gegner schwimmt nach links' },
        swim_right: { label: 'Gegner schwimmt nach rechts' },
        float_front: { label: 'Gegner schwebt nach vorn' },
        float_back: { label: 'Gegner schwebt nach hinten' },
        float_left: { label: 'Gegner schwebt nach links' },
        float_right: { label: 'Gegner schwebt nach rechts' },
        drift_front: { label: 'Gegner treibt, schaut nach vorn' },
        drift_back: { label: 'Gegner treibt, schaut nach hinten' },
        drift_left: { label: 'Gegner treibt, schaut nach links' },
        drift_right: { label: 'Gegner treibt, schaut nach rechts' },
        dive_front: { label: 'Gegner taucht ab nach vorn' },
        dive_back: { label: 'Gegner taucht ab nach hinten' },
        dive_left: { label: 'Gegner taucht ab nach links' },
        dive_right: { label: 'Gegner taucht ab nach rechts' },
        rise_front: { label: 'Gegner taucht auf nach vorn' },
        rise_back: { label: 'Gegner taucht auf nach hinten' },
        rise_left: { label: 'Gegner taucht auf nach links' },
        rise_right: { label: 'Gegner taucht auf nach rechts' },
        dead: { label: 'Gegner tot' }
    },
    companion: {
        front: { label: 'Begleiter schaut nach vorn' },
        back: { label: 'Begleiter schaut nach hinten' },
        left: { label: 'Begleiter schaut nach links' },
        right: { label: 'Begleiter schaut nach rechts' },
        walk_front: { label: 'Begleiter läuft nach vorn' },
        walk_back: { label: 'Begleiter läuft nach hinten' },
        walk_left: { label: 'Begleiter läuft nach links' },
        walk_right: { label: 'Begleiter läuft nach rechts' },
        jump_front: { label: 'Begleiter springt nach vorn' },
        jump_back: { label: 'Begleiter springt nach hinten' },
        jump_left: { label: 'Begleiter springt nach links' },
        jump_right: { label: 'Begleiter springt nach rechts' },
        fall_front: { label: 'Begleiter fällt nach vorn' },
        fall_back: { label: 'Begleiter fällt nach hinten' },
        fall_left: { label: 'Begleiter fällt nach links' },
        fall_right: { label: 'Begleiter fällt nach rechts' },
        // only shown when the Begleiter "kann fliegen"; without them: Laufen / Stehen
        fly_front: { label: 'Begleiter fliegt nach vorn' },
        fly_back: { label: 'Begleiter fliegt nach hinten' },
        fly_left: { label: 'Begleiter fliegt nach links' },
        fly_right: { label: 'Begleiter fliegt nach rechts' },
        // while the player stands still it keeps busy (companion_ai.js): sits down,
        // sniffs or pecks around – shown only if drawn
        sit_front: { label: 'Begleiter sitzt, schaut nach vorn' },
        sit_back: { label: 'Begleiter sitzt, schaut nach hinten' },
        sit_left: { label: 'Begleiter sitzt, schaut nach links' },
        sit_right: { label: 'Begleiter sitzt, schaut nach rechts' },
        busy_front: { label: 'Begleiter beschäftigt sich (vorn)' },
        busy_back: { label: 'Begleiter beschäftigt sich (hinten)' },
        busy_left: { label: 'Begleiter beschäftigt sich (links)' },
        busy_right: { label: 'Begleiter beschäftigt sich (rechts)' },
        // in a Bewegungsbereich (movement_regions.js), like the player character
        swim_front: { label: 'Begleiter schwimmt nach vorn' },
        swim_back: { label: 'Begleiter schwimmt nach hinten' },
        swim_left: { label: 'Begleiter schwimmt nach links' },
        swim_right: { label: 'Begleiter schwimmt nach rechts' },
        float_front: { label: 'Begleiter schwebt nach vorn' },
        float_back: { label: 'Begleiter schwebt nach hinten' },
        float_left: { label: 'Begleiter schwebt nach links' },
        float_right: { label: 'Begleiter schwebt nach rechts' },
        drift_front: { label: 'Begleiter treibt, schaut nach vorn' },
        drift_back: { label: 'Begleiter treibt, schaut nach hinten' },
        drift_left: { label: 'Begleiter treibt, schaut nach links' },
        drift_right: { label: 'Begleiter treibt, schaut nach rechts' },
        dive_front: { label: 'Begleiter taucht ab nach vorn' },
        dive_back: { label: 'Begleiter taucht ab nach hinten' },
        dive_left: { label: 'Begleiter taucht ab nach links' },
        dive_right: { label: 'Begleiter taucht ab nach rechts' },
        rise_front: { label: 'Begleiter taucht auf nach vorn' },
        rise_back: { label: 'Begleiter taucht auf nach hinten' },
        rise_left: { label: 'Begleiter taucht auf nach links' },
        rise_right: { label: 'Begleiter taucht auf nach rechts' },
    },
    checkpoint: {
        active: { label: 'Checkpoint aktiviert' },
    },
    falls_down: {
        crumbling: { label: 'zerbröselt' },
    },
    door: {
        closed: { label: 'geschlossen' },
        open: { label: 'geöffnet' },
        transition: { label: 'Übergang' },
    },
    switch: {
        off: { label: 'Schalter ist aus' },
        on: { label: 'Schalter ist an' },
    },
    pressure_plate: {
        up: { label: 'Druckplatte nicht gedrückt' },
        down: { label: 'Druckplatte gedrückt' },
    },
    text: {
        speaking: { label: 'spricht gerade' },
    },
    counter: {
        waiting: { label: 'Zähler wartet' },
        ...Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => [`count_${n}`, { label: `Zähler zeigt ${n}` }])),
        done: { label: 'Zähler erreicht' },
    },
    bomb: {
        fuse: { label: 'Zündschnur' },
        explosion: { label: 'Explosion' },
    },
};
