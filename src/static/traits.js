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
];

var STATE_TRAITS_ORDER = {
    actor: [
        ['Stehen', ['front', 'back', 'left', 'right']],
        ['Laufen', ['walk_front', 'walk_back', 'walk_left', 'walk_right']],
        ['Springen', ['jump_front', 'jump_back', 'jump_left', 'jump_right']],
        ['Fallen', ['fall_front', 'fall_back', 'fall_left', 'fall_right']],
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
        },
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
    },
};
