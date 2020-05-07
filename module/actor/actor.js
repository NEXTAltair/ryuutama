import {
    RYUU
} from "../config.js";

/**
 * Extend the base Actor entity by defining a custom roll data structure which is ideal for the Simple system.
 * @extends {Actor}
 */
export class RyuutamaActor extends Actor {
    /**
     * Augment the basic actor data with additional dynamic data.
     */
    prepareData() {
        super.prepareData();

        const actorData = this.data;
        const data = actorData.data;
        const flags = actorData.flags;

        // Make separate methods for each Actor type (character, npc, etc.) to keep
        // things organized.
        if (actorData.type === "character") this._prepareCharacterData(actorData);
    }

    /**
     * Prepare Character type specific data
     */
    _prepareCharacterData(actorData) {
        const data = actorData.data;
        const items = actorData.items;

        // Level
        data.attributes.level.value = RYUU.CHARACTER_EXP_LEVELS.findIndex(i => i > Number(data.attributes.exp.value));
        data.attributes.statIncreases.earned = (data.attributes.level.value - 1) * 3;
        if (data.attributes.statIncreases.hp + data.attributes.statIncreases.mp > data.attributes.statIncreases.earned) {
            data.attributes.statIncreases.hp = data.attributes.statIncreases.mp = 0;
        }
        data.attributes.statIncreases.hp = data.attributes.statIncreases.hp < 0 ? 0 : data.attributes.statIncreases.hp;
        data.attributes.statIncreases.mp = data.attributes.statIncreases.mp < 0 ? 0 : data.attributes.statIncreases.mp;

        // Health Points
        data.hp.max = data.attributes.str.value * 2;
        const hpItems = items.filter(i => i.data.enchantments.find(e => e.data.hpMod !== 0) !== undefined && i.data.equipped);
        hpItems.forEach(item => {
            let hpEnchantments = item.data.enchantments.filter(e => e.data.hpMod !== 0);
            hpEnchantments.forEach(enchantment => {
                data.hp.max += enchantment.data.hpMod;
            });
        });
        data.hp.max += data.attributes.statIncreases.hp;

        // Mental Points
        data.mp.max = data.attributes.spi.value * 2;
        const mpItems = items.filter(i => i.data.enchantments.find(e => e.data.mpMod !== 0) !== undefined && i.data.equipped);
        mpItems.forEach(item => {
            let mpEnchantments = item.data.enchantments.filter(e => e.data.mpMod !== 0);
            mpEnchantments.forEach(enchantment => {
                data.mp.max += enchantment.data.mpMod;
            });
        });
        data.mp.max += data.attributes.statIncreases.mp;

        // Don't allow values under min or over max
        data.hp.value = Math.clamped(data.hp.value, 0, data.hp.max);
        data.mp.value = Math.clamped(data.mp.value, 0, data.mp.max);
        data.attributes.condition.value = Math.clamped(data.attributes.condition.value, 0, data.attributes.condition.max);

        // Carrying capacity
        let str = Number(data.attributes.str.value);
        if (data.attributes.str.bonus) {
            str = RYUU.DICE[RYUU.DICE.findIndex(i => i === str) + 1];
        }

        data.attributes.capacity.max = Number(str) + 2 + data.attributes.level.value;
        const carried = items.filter(i => !i.data.equipped && i.data.size !== undefined && i.type !== "animal");
        const equipped = items.filter(i => i.data.equipped === true && i.data.size !== undefined);
        const containers = items.filter(i => i.type === "container" || i.type === "animal");

        let carriedWeight = 0;
        carried.forEach(item => {
            let weightless = item.data.enchantments.find(e => e.data.weightless)
            if (weightless === undefined) {
                let inContainer = false;

                containers.forEach(container => {
                    const found = container.data.holding.find(i => i.id === item._id);
                    if (found !== undefined) {
                        inContainer = true;
                    }
                });

                if (!inContainer) {
                    carriedWeight += Number(item.data.size);
                }
            }
        });
        data.attributes.capacity.value = carriedWeight;

        let equippedWeight = 0;
        equipped.forEach(item => {
            equippedWeight += Number(item.data.size);
        });
        data.attributes.capacity.equipped = equippedWeight;

        // Terrain
        for (const name in data.traveling) {
            if (data.traveling.hasOwnProperty(name)) {
                data.traveling[name] = 0;
                let mod = items.filter(i => i.data[name] && i.data.equipped);
                mod.forEach(item => {
                    data.traveling[name] += item.data.itemBonus;
                });
            }
        }

        // Effects
        for (const name in data.effects) {
            if (data.effects.hasOwnProperty(name) && data.immunity[name]) {
                data.effects[name] = 0;
            }
        }
    }



    /** @override */
    getRollData() {
        const data = super.getRollData();
        const shorthand = game.settings.get("ryuutama", "macroShorthand");

        // Re-map all attributes onto the base roll data
        if (!!shorthand) {
            for (let [k, v] of Object.entries(data.attributes)) {
                if (!(k in data)) data[k] = v.value;
            }
            delete data.attributes;
        }

        // Map all items data using their slugified names
        data.items = this.data.items.reduce((obj, i) => {
            let key = i.name.slugify({
                strict: true
            });
            let itemData = duplicate(i.data);
            if (!!shorthand) {
                for (let [k, v] of Object.entries(itemData.attributes)) {
                    if (!(k in itemData)) itemData[k] = v.value;
                }
                delete itemData["attributes"];
            }
            obj[key] = itemData;
            return obj;
        }, {});
        return data;
    }

    /** @override */
    static async create(data, options = {}) {
        data.token = data.token || {};
        if (data.type === "character") {
            mergeObject(data.token, {
                vision: true,
                dimSight: 30,
                brightSight: 0,
                actorLink: true,
                disposition: 1,
                displayBars: 40,
                bar1: {
                    attribute: "hp"
                },
                bar2: {
                    attribute: "mp"
                }
            }, {
                overwrite: false
            });
        }
        return super.create(data, options);
    }
}