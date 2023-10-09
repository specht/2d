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
};

var SPRITE_TRAITS = {
    actor: {
        label: 'Spielfigur',
        properties: {
            vrun: {
                label: 'Geschwindigkeit',
                type: 'float',
                min: 0.0,
                max: 100.0,
                default: 3.0,
                decimalPlaces: 1,
                step: 0.1,
            },
            vjump: {
                label: 'Sprungkraft',
                type: 'float',
                default: 9.0,
                min: 0.0,
                max: 100.0,
                decimalPlaces: 1,
                step: 0.1,
            },
            can_jump: {
                label: 'kann springen',
                type: 'bool',
                default: true,
            },
            affected_by_gravity: {
                label: 'beeinflusst durch Schwerkraft',
                type: 'bool',
                default: true,
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
    block_above: {
        label: 'man kann nicht von oben reinfallen',
    },
    block_sides: {
        label: 'man kann nicht von den Seiten reinlaufen',
    },
    block_below: {
        label: 'man kann nicht von unten reinspringen',
    },
    falls_down: {
        label: 'fällt runter, wenn man drauf steht',
        properties: {
            timeout: {
                label: 'fällt nach',
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
                type: 'bool',
                default: false,
            },
            falls_on_baddie: {
                label: 'fällt auch bei Gegnern',
                type: 'bool',
                default: false,
            },
            damage: {
                label: 'Schaden',
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
                type: 'float',
                min: 0,
                max: 100,
                step: 1,
                decimalPlaces: 0,
                default: 0,
            },
            lives: {
                label: 'gibt Leben',
                type: 'float',
                min: 0,
                max: 100,
                step: 1,
                decimalPlaces: 0,
                default: 0,
            },
            energy: {
                label: 'gibt Energie',
                type: 'float',
                min: 0,
                max: 100,
                step: 1,
                decimalPlaces: 0,
                default: 0,
            },
        },
    },
    trap: {
        label: 'Falle',
        properties: {
            damage: {
                label: 'Schaden',
                type: 'float',
                default: 100,
                min: 0,
                max: 1000,
            },
            damage_cool_down: {
                label: 'Cooldown',
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
                type: 'float',
                min: 0,
                max: 10000,
                default: 100,
            },
            damage: {
                label: 'Schaden',
                type: 'float',
                default: 100,
                min: 0,
                max: 1000,
            },
            damage_cool_down: {
                label: 'Cooldown',
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
                type: 'float',
                min: 0.0,
                max: 100.0,
                default: 0.5,
                decimalPlaces: 1,
                step: 0.1,
            },
            affected_by_gravity: {
                label: 'beeinflusst durch Schwerkraft',
                type: 'bool',
                default: true,
            },
            vjump: {
                label: 'Sprungkraft',
                type: 'float',
                default: 9.0,
                min: 0.0,
                max: 100.0,
                decimalPlaces: 1,
                step: 0.1,
            },
            patrols: {
                label: 'patrouilliert',
                type: 'bool',
                default: true,
            },
            start_dir: {
                label: 'Startrichtung',
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
        front: {label: 'Spielfigur schaut nach vorn'},
        back: {label: 'Spielfigur schaut nach hinten'},
        left: {label: 'Spielfigur schaut nach links'},
        right: {label: 'Spielfigur schaut nach rechts'},
        walk_front: {label: 'Spielfigur läuft nach vorn'},
        walk_back: {label: 'Spielfigur läuft nach hinten'},
        walk_left: {label: 'Spielfigur läuft nach links'},
        walk_right: {label: 'Spielfigur läuft nach rechts'},
        jump_front: {label: 'Spielfigur springt nach vorn'},
        jump_back: {label: 'Spielfigur springt nach hinten'},
        jump_left: {label: 'Spielfigur springt nach links'},
        jump_right: {label: 'Spielfigur springt nach rechts'},
        fall_front: {label: 'Spielfigur fällt nach vorn'},
        fall_back: {label: 'Spielfigur fällt nach hinten'},
        fall_left: {label: 'Spielfigur fällt nach links'},
        fall_right: {label: 'Spielfigur fällt nach rechts'},
        dead: {label: 'Spielfigur tot'}
    },
    baddie: {
        front: {label: 'Gegner schaut nach vorn'},
        back: {label: 'Gegner schaut nach hinten'},
        left: {label: 'Gegner schaut nach links'},
        right: {label: 'Gegner schaut nach rechts'},
        walk_front: {label: 'Gegner läuft nach vorn'},
        walk_back: {label: 'Gegner läuft nach hinten'},
        walk_left: {label: 'Gegner läuft nach links'},
        walk_right: {label: 'Gegner läuft nach rechts'},
        jump_front: {label: 'Gegner springt nach vorn'},
        jump_back: {label: 'Gegner springt nach hinten'},
        jump_left: {label: 'Gegner springt nach links'},
        jump_right: {label: 'Gegner springt nach rechts'},
        fall_front: {label: 'Gegner fällt nach vorn'},
        fall_back: {label: 'Gegner fällt nach hinten'},
        fall_left: {label: 'Gegner fällt nach links'},
        fall_right: {label: 'Gegner fällt nach rechts'},
        dead: {label: 'Gegner tot'}
    },
    checkpoint: {
        active: {label: 'Checkpoint aktiviert'},
    },
    falls_down: {
        crumbling: {label: 'zerbröselt'},
    }
};
