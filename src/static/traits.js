var traits = {
    actor: {
        label: 'Spielfigur',
        properties: {
            vrun: {
                type: 'float',
                default: 1.0,
                label: 'Geschwindigkeit',
            },
            vjump: {
                type: 'float',
                default: 1.0,
                label: 'Sprungkraft',
            },
            can_dash: {
                type: 'bool',
                default: false,
            },
            can_jump: {
                type: 'bool',
                default: true,
            },
            affected_by_gravity: {
                type: 'bool',
                default: true,
            },
        },
    },
    block_above: {
        label: 'man kann nicht von oben reinfallen',
    },
};

class ActorTrait {
    constructor() {
        this.key = 'actor';
        this.label = 'Spielfigur';
    }
}

class CantFallThroughTrait {
    constructor() {
        this.key = 'block_above';
        this.label = 'man kann nicht von oben reinfallen';
    }
}

