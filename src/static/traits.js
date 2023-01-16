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
