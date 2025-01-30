var SPRITE_TRAITS_ORDER = [
    [
        'Spielfigur',
        [
            'actor',
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
        'dead',
    ],
    baddie: [
        ['Stehen', ['front', 'back', 'left', 'right']],
        ['Laufen', ['walk_front', 'walk_back', 'walk_left', 'walk_right']],
        ['Springen', ['jump_front', 'jump_back', 'jump_left', 'jump_right']],
        ['Fallen', ['fall_front', 'fall_back', 'fall_left', 'fall_right']],
        'dead',
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
};

var SPRITE_TRAITS = {
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
                hint: 'Gib hier an, ob man einen Schlüssel braucht oder einen Schalter umlegen muss, um diese Tür zu öffnen.',
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
            // auto_close_timeout: {
            //     label: 'schließt automatisch nach',
            //     hint: 'Gibt an, nach welcher Zeit die Tür automatisch wieder schließt (0: nie).',
            //     type: 'float',
            //     suffix: 's',
            //     min: 0.0,
            //     max: 1000.0,
            //     default: 0.0,
            //     decimalPlaces: 1,
            //     step: 0.1,
            // },
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
            door_code: {
                label: 'Code',
                hint: 'Nur ein Schlüssel / Schalter mit demselben Code kann diese Tür öffnen.',
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
        },
    },
    key: {
        label: 'ist ein Schlüssel',
        placed_properties: {
            door_code: {
                label: 'Code',
                hint: 'Der Schlüssel kann nur Türen mit demselben Code öffnen.',
                type: 'int',
                min: 0,
                max: 1000,
                default: 0,
            },
        },
    },
    text: {
        label: 'Hinweistext',
        placed_properties: {
            text: {
                label: 'Text',
                hint: 'Gib hier den Text ein, der angezeigt werden soll.',
                type: 'string',
                options: {
                    multiline: true,
                },
                default: '',
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
    baddie: {
        label: 'Gegner',
        properties: {
            energy: {
                label: 'Energie',
                hint: 'Da auch Gegner Schaden erleiden können, muss hier die Anfangsenergie angegeben werden.',
                type: 'float',
                min: 0,
                max: 10000,
                default: 100,
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
            // knockback: {
            //     label: 'Knockback',
            //     type: 'float',
            //     default: 0.0,
            //     step: 1.0,
            //     min: 0.0,
            //     max: 100.0,
            // },
            vrun: {
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
                label: 'beeinflusst durch Schwerkraft',
                hint: 'Wenn der Gegner durch die Schwerkraft beeinflusst wird, fällt er nach unten.',
                type: 'bool',
                default: true,
            },
            vjump: {
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
                label: 'patrouilliert',
                hint: 'Ein patrouillierender Gegner läuft hin und her und bewacht ein begrenztes Gebiet.',
                type: 'bool',
                default: true,
            },
            start_dir: {
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
                label: 'Sprungfaktor',
                type: 'float',
                min: 0.0,
                max: 100,
                decimalPlaces: 1,
                default: 3.0,
            },
            camera_shake_on_land: {
                label: 'Camera Shake bei Landung',
                type: 'float',
                min: 0.0,
                max: 100,
                decimalPlaces: 0,
                default: 0,
                suffix: 'px',
            },
            camera_shake_max_dist: {
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
        dead: { label: 'Gegner tot' }
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
};
