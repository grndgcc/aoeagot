/**
 * ==========================================================================
 * Westeros: Kingdoms of D&D 5.5e - Core Rules Engine (dnd-rules.js)
 * ==========================================================================
 * Bu dosya D&D 5.5e (2024) kurallarını işleten çekirdek mekanizmayı içerir.
 * Stat modifikatörleri, Zırh Sınıfı (AC), HP hesabı, kurtarma zarları, 
 * d20 zar simulasyonu ve D&D statlarının AoE tarzı kaynak fiyatlamasına 
 * dönüştürülmesini sağlayan karmaşık ekonomik formülleri barındırır.
 */

class DnDRulesEngine {
    constructor() {
        // D&D 5.5e Seviye/CR bazlı Proficiency Bonus tablosu
        this.proficiencyTable = [
            { maxLevel: 4, bonus: 2 },
            { maxLevel: 8, bonus: 3 },
            { maxLevel: 12, bonus: 4 },
            { maxLevel: 16, bonus: 5 },
            { maxLevel: 20, bonus: 6 }
        ];

        // Savaş Loglama Sistemi Referansı
        this.logCallback = null;
    }

    /**
     * Savaş günlüğü yazdırma mekanizmasıyla olan bağlantıyı kurar
     */
    registerLogger(callback) {
        this.logCallback = callback;
    }

    /**
     * D&D Modifikatör Hesaplayıcı
     * Formül: Mod = Math.floor((Score - 10) / 2)
     */
    getModifier(score) {
        return Math.floor((score - 10) / 2);
    }

    /**
     * D&D 5.5e Kurallarına Göre Proficiency Bonusunu Belirler
     */
    getProficiencyBonus(levelOrCr) {
        const value = Math.max(1, Math.ceil(levelOrCr));
        for (let tier of this.proficiencyTable) {
            if (value <= tier.maxLevel) {
                return tier.bonus;
            }
        }
        return 6; // Maksimum limit
    }

    /**
     * D&D 5.5e Zırh Sınıfı (AC - Armor Class) Hesaplama Algoritması
     * @param {string} armorType - 'unarmored', 'light', 'medium', 'heavy'
     * @param {number} baseAc - Zırhın ana koruma tabanı
     * @param {number} dexScore - Birimin Dexterity değeri
     * @param {boolean} hasShield - Kalkan taşıyıp taşımadığı (+2 AC)
     */
    calculateAC(armorType, baseAc, dexScore, hasShield = false) {
        const dexMod = this.getModifier(dexScore);
        let finalAc = baseAc;

        switch (armorType) {
            case 'unarmored':
                // 10 + DEX Modifikatörü
                finalAc = 10 + dexMod;
                break;
            case 'light':
                // Hafif Zırh: Taban AC + DEX modifikatörünün tamamı
                finalAc = baseAc + dexMod;
                break;
            case 'medium':
                // Orta Zırh: Taban AC + DEX modifikatörü (Maksimum +2 limitli)
                const cappedDexMod = Math.min(2, dexMod);
                finalAc = baseAc + cappedDexMod;
                break;
            case 'heavy':
                // Ağır Zırh: DEX modifikatöründen etkilenmez, sadece taban zırh değeri geçerlidir
                finalAc = baseAc;
                break;
            default:
                finalAc = 10 + dexMod;
        }

        // Kalkan varsa ekstra +2 AC eklenir
        if (hasShield) {
            finalAc += 2;
        }

        return finalAc;
    }

    /**
     * D&D Kurallarına Göre Maksimum HP (Hit Points) Hesabı
     * Birinci seviye için en yüksek zar değeri alınır, sonraki seviyeler için ortalama zar uygulanır.
     */
    calculateMaxHP(hitDiceCount, hitDiceType, conScore) {
        const conMod = this.getModifier(conScore);
        if (hitDiceCount <= 1) {
            return hitDiceType + conMod;
        }

        // Seviye 1: Maksimum Zar Değeri
        let hpSum = hitDiceType + conMod;

        // Sonraki Seviyeler: Ortalama Zar Değeri (Örn: d10 için 6, d8 için 5)
        const averageDiceVal = Math.floor(hitDiceType / 2) + 1;
        for (let i = 1; i < hitDiceCount; i++) {
            hpSum += averageDiceVal + conMod;
        }

        return Math.max(5, hpSum); // Can miktarı asla 5'in altına düşemez
    }

    /**
     * D&D 5.5e d20 Zar Atış Sistemi
     * @param {number} modifier - Zar sonucuna eklenecek bonus
     * @param {string} advantageState - 'normal', 'advantage', 'disadvantage'
     */
    rollD20(modifier = 0, advantageState = 'normal') {
        const roll1 = Math.floor(Math.random() * 20) + 1;
        const roll2 = Math.floor(Math.random() * 20) + 1;

        let baseRoll = roll1;
        if (advantageState === 'advantage') {
            baseRoll = Math.max(roll1, roll2);
            this.log(`[D&D Zarı] Avantaj Atışı: [${roll1}, ${roll2}] -> Seçilen: ${baseRoll}`, 'roll');
        } else if (advantageState === 'disadvantage') {
            baseRoll = Math.min(roll1, roll2);
            this.log(`[D&D Zarı] Dezavantaj Atışı: [${roll1}, ${roll2}] -> Seçilen: ${baseRoll}`, 'roll');
        } else {
            this.log(`[D&D Zarı] Standart d20 Atışı: [${roll1}]`, 'roll');
        }

        const totalResult = baseRoll + modifier;
        
        return {
            natural: baseRoll,
            total: totalResult,
            isCriticalHit: baseRoll === 20,
            isCriticalMiss: baseRoll === 1
        };
    }

    /**
     * Kurtarma Zarı (Saving Throw) Hesaplayıcı
     * @param {string} saveType - 'STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'
     * @param {object} unitStats - Birimin 6 temel statını barındıran nesne
     * @param {Array} proficientSaves - Birimin uzman olduğu kurtarma zarı türleri dizisi
     * @param {number} levelOrCr - Birimin seviyesi veya CR değeri
     */
    rollSavingThrow(saveType, unitStats, proficientSaves = [], levelOrCr = 1) {
        const statKey = saveType.toLowerCase();
        const statValue = unitStats[statKey] || 10;
        let modifier = this.getModifier(statValue);

        // Eğer birim bu kurtarma zarında uzman (proficient) ise Proficiency Bonus eklenir
        if (proficientSaves.includes(saveType.toUpperCase())) {
            const profBonus = this.getProficiencyBonus(levelOrCr);
            modifier += profBonus;
        }

        const rollResult = this.rollD20(modifier);
        this.log(`[Kurtarma Zarı] ${saveType} Zarı Atıldı: d20(${rollResult.natural}) + Mod(${modifier}) = Toplam: ${rollResult.total}`, 'system');
        
        return rollResult;
    }

    /**
     * ==========================================================================
     * D&D 5.5e -> Age of Empires Fiyatlandırma ve Dengeleme Algoritması
     * ==========================================================================
     * Bu formül, bir birimin gücünü (CR seviyesi, statları, zırhı ve can havuzu)
     * analiz ederek AoE 2 / 4 tarzı mantıklı hammadde giderlerine ve üretim sürelerine dönüştürür.
     */
    calculateAoECostAndTrainTime(unitTemplate) {
        const stats = unitTemplate.stats;
        const cr = unitTemplate.cr;
        
        // Temel Stat Farklılıkları (10'un üzerindeki her stat puanı ek maliyet yaratır)
        const strExcess = Math.max(0, stats.str - 10);
        const dexExcess = Math.max(0, stats.dex - 10);
        const conExcess = Math.max(0, stats.con - 10);
        const intExcess = Math.max(0, stats.int - 10);
        const wisExcess = Math.max(0, stats.wis - 10);
        const chaExcess = Math.max(0, stats.cha - 10);

        // Başlangıç Baz Maliyetleri (İşçi Tabanlı)
        let food = 30;
        let wood = 10;
        let gold = 0;
        let stone = 0;

        // 1. Fiziksel Maliyet (Constitution ve Strength -> Yiyecek maliyetini artırır)
        // Yaşam gücü, beslenme ihtiyacı ve fiziki hacim yiyecek tüketir.
        food += (conExcess * 6) + (strExcess * 4);

        // 2. Ekipman/İşçilik Maliyeti (Dexterity ve Zırh Tipi -> Odun ve Taş maliyetini artırır)
        // Menzilli silahlar, yay üretimi, tahta/metal işçiliği.
        if (unitTemplate.weapon && unitTemplate.weapon.type === 'ranged') {
            wood += (dexExcess * 8) + 15;
        } else {
            wood += (strExcess * 3);
        }

        // Ağır zırhlar demir, taş döküm ve yüksek işçilik gerektirir.
        if (unitTemplate.armor.type === 'heavy') {
            wood += 20;
            stone += 10 + (strExcess * 2);
            gold += 30; // Ağır şövalye zırhı lüks maden gerektirir
        } else if (unitTemplate.armor.type === 'medium') {
            wood += 10;
            stone += 5;
        }

        if (unitTemplate.armor.hasShield) {
            wood += 10; // Kalkan odun gerektirir
        }

        // 3. Entelektüel/Karizma Gideri (Intelligence, Wisdom, Charisma -> Altın maliyetini belirler)
        // Alimler, simyacılar, rütbeli komutanlar, paralı askerler ve ruhaniler altın talep eder.
        gold += (intExcess * 20) + (wisExcess * 12) + (chaExcess * 18);

        // 4. Seviye / Challenge Rating (CR) Çarpanı
        // Birimin toplam savaş gücü ve deneyimi maliyeti doğrudan çarpar.
        let crMultiplier = 1.0;
        if (cr > 0) {
            crMultiplier += (cr * 0.4);
        }

        food = Math.round(food * crMultiplier);
        wood = Math.round(wood * crMultiplier);
        gold = Math.round(gold * crMultiplier);
        stone = Math.round(stone * crMultiplier);

        // Fiyat Güvenlik Sınırları (Hatalı stat girişlerinde ekonominin tıkanmaması için)
        food = Math.max(0, Math.min(food, 250));
        wood = Math.max(0, Math.min(wood, 200));
        gold = Math.max(0, Math.min(gold, 250));
        stone = Math.max(0, Math.min(stone, 120));

        // İşçilerin (Villager) D&D statlarına göre dengelenmesi (Maksimum 50 Yiyecek standardı)
        if (unitTemplate.id === 'villager') {
            food = 50;
            wood = 0;
            gold = 0;
            stone = 0;
        }

        // 5. Üretim Süresi (Train Time - Saniye cinsinden)
        // Birimin can potansiyeli ve hantal ekipmanları kışlada geçireceği süreyi artırır.
        let trainTime = 12 + (cr * 6) + (conExcess * 1.2);
        trainTime = Math.round(Math.max(8, Math.min(trainTime, 45))); // Minimum 8, maksimum 45 saniye

        return {
            costs: { food, wood, gold, stone },
            trainTime: trainTime
        };
    }

    /**
     * D&D Hasar Zar Atışı Algoritması
     * Örneğin "2d6+3" veya "1d8+2" gibi formülleri çözer ve toplam hasarı hesaplar
     */
    rollDamage(damageDiceStr, statBlock, isMelee = true) {
        // Formül ayrıştırma (Örn: "2d6")
        const parts = damageDiceStr.toLowerCase().split('d');
        if (parts.length !== 2) return 1;

        const count = parseInt(parts[0], 10) || 1;
        const faces = parseInt(parts[1], 10) || 4;

        let baseDamage = 0;
        for (let i = 0; i < count; i++) {
            baseDamage += Math.floor(Math.random() * faces) + 1;
        }

        // Hasara eklenecek stat modifikatörü tespiti
        // Yakın dövüş için STR mod, menzilli için DEX mod kullanılır
        const modifier = isMelee ? this.getModifier(statBlock.str) : this.getModifier(statBlock.dex);
        const finalDamage = Math.max(1, baseDamage + modifier);

        this.log(`[Hasar Atışı] Hasar Zarı: ${damageDiceStr} (${baseDamage}) + Mod(${modifier}) = Toplam ${finalDamage} hasar`, 'damage');
        
        return finalDamage;
    }

    /**
     * Günlük konsoluna / UI alanına çıktı gönderen yardımcı logger
     */
    log(msg, type = 'system') {
        if (this.logCallback) {
            this.logCallback(msg, type);
        } else {
            console.log(`%c[DnD] ${msg}`, 'color: #ebcb8b');
        }
    }
}

// Kurallar motorunu global kapsamda oluşturuyoruz
window.DnDRules = new DnDRulesEngine();

// ==========================================================================
// TEST VE DENGE DOĞRULAMA ÇIKTISI
// ==========================================================================
// Sayfa yüklendiğinde tüm birimlerin AoE maliyetlerini konsola yazarak dengeler.
document.addEventListener('DOMContentLoaded', () => {
    if (window.GAME_CONFIG && window.GAME_CONFIG.UNIT_TEMPLATES) {
        console.groupCollapsed("⚔️ D&D 5.5e -> AoE Ekonomi Fiyatlandırma Raporu");
        for (let key in window.GAME_CONFIG.UNIT_TEMPLATES) {
            const unit = window.GAME_CONFIG.UNIT_TEMPLATES[key];
            const result = window.DnDRules.calculateAoECostAndTrainTime(unit);
            console.log(
                `%c${unit.name} (CR: ${unit.cr})`, 
                'color: #d4af37; font-weight: bold;',
                `\n- Yiyecek: ${result.costs.food}\n- Odun: ${result.costs.wood}\n- Altın: ${result.costs.gold}\n- Taş: ${result.costs.stone}\n- Üretim Süresi: ${result.trainTime}sn`
            );
        }
        console.groupEnd();
    }
});
// dnd-rules.js - Başlangıç alanına veya kurucu metoda (constructor) eklenecek satır:
this.logCallback = function(msg, type) {
    if (window.UI && window.UI.writeBattleLog) {
        window.UI.writeBattleLog(msg, type);
    }
};
