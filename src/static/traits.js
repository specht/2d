var SPRITE_TRAITS = [
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

];

var STATE_TRAITS = {
    actor: [
        'actor_front',
        'actor_back',
        'actor_left',
        'actor_right',
    ],
};

var TRAITS = {
    actor: {
        label: 'Spielfigur',
        properties: {
            vrun: {
                label: 'Geschwindigkeit',
                type: 'float',
                min: 0.0,
                max: 100.0,
                default: 3.0,
            },
            vjump: {
                label: 'Sprungkraft',
                type: 'float',
                default: 9.0,
                min: 0.0,
                max: 100.0,
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
        state_traits: {
            actor_front: {
                label: 'Spielfigur schaut nach vorn',
            },
            actor_back: {
                label: 'Spielfigur schaut nach hinten',
            },
            actor_left: {
                label: 'Spielfigur schaut nach links',
            },
            actor_right: {
                label: 'Spielfigur schaut nach rechts',
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
};
