var SPRITE_TRAITS = [
    [
        'Spielfigur',
        [
            'actor',
        ]
    ],
    [
        'Blöcke',
        [
            'block_above',
            'block_sides',
            'block_below',
        ]
    ],

];

var TRAITS = {
    actor: {
        label: 'Spielfigur',
        properties: {
            vrun: {
                label: 'Geschwindigkeit',
                type: 'float',
                default: 3.0,
            },
            vjump: {
                label: 'Sprungkraft',
                type: 'float',
                default: 9.0,
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
};
