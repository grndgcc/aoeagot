/**
 * ==========================================================================
 * Westeros: Kingdoms of D&D 5.5e - Sabitler, Ülke Tanımları ve Harita Üretici (config.js)
 * ==========================================================================
 * Westeros coğrafyası bu dosyada matematiksel denklemler, fraktal gürültü (fBm)
 * ve iklim matrisi ile 220x220 grid formatında üretilir.
 */

const GAME_CONFIG = {
    MAP_SIZE: 220,             // 220x220 Tile
    BASE_TILE_SIZE: 32,        // Piksel cinsinden temel kare boyutu
    MIN_ZOOM: 0.4,
    MAX_ZOOM: 2.5,
    INITIAL_ZOOM: 1.0,

    // D&D 5.5e Tabanlı Arazi Geçiş ve Hız Sabitleri
    TILE_TYPES: {
        SEA: { id: 0, name: 'Derin Deniz', passable: false, navalPassable: true, speedMult: 1.0, color: '#0b1626', minimapColor: '#070f1a' },
        COAST: { id: 1, name: 'Kıyı / Sığ Deniz', passable: false, navalPassable: true, speedMult: 0.8, color: '#162e4c', minimapColor: '#102238' },
        PLAINS: { id: 2, name: 'Ova', passable: true, navalPassable: false, speedMult: 1.0, color: '#436b36', minimapColor: '#2d4a25' },
        FOREST: { id: 3, name: 'Orman', passable: true, navalPassable: false, speedMult: 0.6, color: '#1f421f', minimapColor: '#122a12' },
        MOUNTAIN: { id: 4, name: 'Sarp Dağlar', passable: false, navalPassable: false, speedMult: 0.0, color: '#4a4e52', minimapColor: '#303336' },
        DESERT: { id: 5, name: 'Kum Çölü', passable: true, navalPassable: false, speedMult: 0.7, color: '#c29d5b', minimapColor: '#967740' },
        SNOW: { id: 6, name: 'Karlı Tundra', passable: true, navalPassable: false, speedMult: 0.8, color: '#eef2f7', minimapColor: '#b8c4d4' },
        SWAMP: { id: 7, name: 'Bataklık / Boğaz', passable: true, navalPassable: false, speedMult: 0.4, color: '#2a3a2e', minimapColor: '#1c261e' },
        GOLD_VEIN: { id: 8, name: 'Altın Damarı', passable: false, navalPassable: false, speedMult: 0.0, color: '#d4af37', minimapColor: '#b89218' },
        STONE_QUARRY: { id: 9, name: 'Taş Ocağı', passable: false, navalPassable: false, speedMult: 0.0, color: '#8c8c8c', minimapColor: '#636363' }
    },

    // 9 Seçilebilir Krallığın Başlangıç Konumları ve D&D İstatistiksel Modifikatörleri
    FACTIONS: {
        'kuzey': {
            name: 'Kuzey Krallığı',
            house: 'Hane Stark',
            capital: 'Winterfell',
            startX: 110,
            startY: 55,
            primaryColor: '#7a8a99',
            secondaryColor: '#2b3036',
            bonusStats: { CON: 2, STR: 1 },
            specialTrait: 'SOĞUK_DIRENCI',
            startResources: { food: 600, wood: 400, gold: 150, stone: 50 }
        },
        'batidiyar': {
            name: 'Batıdiyar',
            house: 'Hane Lannister',
            capital: 'Casterly Rock',
            startX: 45,
            startY: 150,
            primaryColor: '#8b0000',
            secondaryColor: '#d4af37',
            bonusStats: { CHA: 2, INT: 1 },
            specialTrait: 'ALTIN_AKISI',
            startResources: { food: 400, wood: 300, gold: 500, stone: 100 }
        },
        'demir-adalar': {
            name: 'Demir Adalar',
            house: 'Hane Greyjoy',
            capital: 'Pyke',
            startX: 28,
            startY: 132,
            primaryColor: '#0a1017',
            secondaryColor: '#303e4d',
            bonusStats: { STR: 2, CON: 1 },
            specialTrait: 'DENIZ_YAGMACISI',
            startResources: { food: 300, wood: 500, gold: 150, stone: 0 }
        },
        'nehir-topraklari': {
            name: 'Nehir Toprakları',
            house: 'Hane Tully',
            capital: 'Riverrun',
            startX: 95,
            startY: 135,
            primaryColor: '#103050',
            secondaryColor: '#7a1515',
            bonusStats: { WIS: 2, CHA: 1 },
            specialTrait: 'NEHIR_LOJISTIGI',
            startResources: { food: 500, wood: 350, gold: 200, stone: 50 }
        },
        'vadi': {
            name: 'Arryn Vadisi',
            house: 'Hane Arryn',
            capital: 'The Eyrie',
            startX: 155,
            startY: 130,
            primaryColor: '#2e5c84',
            secondaryColor: '#ffffff',
            bonusStats: { DEX: 2, WIS: 1 },
            specialTrait: 'DAG_KOYASI_AVANTAJI',
            startResources: { food: 450, wood: 300, gold: 200, stone: 150 }
        },
        'menzil': {
            name: 'Menzil',
            house: 'Hane Tyrell',
            capital: 'Highgarden',
            startX: 80,
            startY: 175,
            primaryColor: '#1d5c1d',
            secondaryColor: '#e0b034',
            bonusStats: { INT: 2, CHA: 1 },
            specialTrait: 'TARIM_BEREKETI',
            startResources: { food: 800, wood: 300, gold: 250, stone: 50 }
        },
        'tac-topraklari': {
            name: 'Taç Toprakları',
            house: 'Kralın Şehri',
            capital: 'King\'s Landing',
            startX: 145,
            startY: 158,
            primaryColor: '#0d0d0d',
            secondaryColor: '#a62424',
            bonusStats: { CHA: 2, STR: 1 },
            specialTrait: 'KIRAL_YASALARI',
            startResources: { food: 500, wood: 300, gold: 300, stone: 100 }
        },
        'firtinadiyar': {
            name: 'Fırtına Diyarı',
            house: 'Hane Baratheon',
            capital: 'Storm\'s End',
            startX: 165,
            startY: 175,
            primaryColor: '#262412',
            secondaryColor: '#cca300',
            bonusStats: { STR: 2, CON: 1 },
            specialTrait: 'FIRTINA_KOYALARI',
            startResources: { food: 450, wood: 400, gold: 150, stone: 150 }
        },
        'dorne': {
            name: 'Dorne Prensliği',
            house: 'Hane Martell',
            capital: 'Sunspear',
            startX: 185,
            startY: 205,
            primaryColor: '#bd410a',
            secondaryColor: '#cca625',
            bonusStats: { DEX: 2, CON: 1 },
            specialTrait: 'ZEHIR_VE_GÜNES',
            startResources: { food: 350, wood: 250, gold: 300, stone: 100 }
        }
    }
};

/**
 * Westeros Kıtasını Prosedürel Oluşturan Yardımcı Sınıf
 */
class WesterosMapGenerator {
    constructor(size) {
        this.size = size;
        this.grid = [];
        this.seed = 422026; // Sabit tohumlama ile her seferinde tutarlı coğrafya
    }

    /**
     * Basit bir sözde rastgele sayı üreteci (LCG)
     */
    random() {
        let x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    }

    /**
     * 2D Cosine Gürültü fonksiyonu (Dağlar ve ormanlar için organik hatlar oluşturur)
     */
    noise2D(x, y) {
        const xInt = Math.floor(x);
        const yInt = Math.floor(y);
        const xFrac = x - xInt;
        const yFrac = y - yInt;

        const s = this.getNoiseVal(xInt, yInt);
        const t = this.getNoiseVal(xInt + 1, yInt);
        const u = this.getNoiseVal(xInt, yInt + 1);
        const v = this.getNoiseVal(xInt + 1, yInt + 1);

        const xInterp = this.cosineInterpolate(s, t, xFrac);
        const yInterp = this.cosineInterpolate(u, v, xFrac);

        return this.cosineInterpolate(xInterp, yInterp, yFrac);
    }

    getNoiseVal(x, y) {
        let n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
        return n - Math.floor(n);
    }

    cosineInterpolate(a, b, x) {
        const ft = x * Math.PI;
        const f = (1 - Math.cos(ft)) * 0.5;
        return a * (1 - f) + b * f;
    }

    /**
     * Fraktal Brownian Hareketi (fBm) ile daha zengin yeryüzü şekilleri
     */
    fBm(x, y, octaves = 4) {
        let total = 0;
        let frequency = 1;
        let amplitude = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            total += this.noise2D(x * frequency, y * frequency) * amplitude;
            maxValue += amplitude;
            amplitude *= 0.5;
            frequency *= 2.0;
        }

        return total / maxValue;
    }

    /**
     * Westeros Haritasını İnşa Eden Ana Metod
     */
    generate() {
        this.grid = [];
        const centerX = this.size / 2;

        for (let y = 0; y < this.size; y++) {
            this.grid[y] = [];
            for (let x = 0; x < this.size; x++) {
                // 1. Westeros Silueti Maskesi (Kuzeyden Güneye Uzanan İnce Uzun Kıta)
                const relativeY = y / this.size; // 0.0 (Kuzey) -> 1.0 (Güney)
                
                // Kıta genişliğini y eksenine göre daraltıp genişleten Westeros Taslağı
                let continentWidth = 40; 
                if (relativeY < 0.15) continentWidth = 55;        // Duvar ve Ötesi Geniş Kuzey
                else if (relativeY < 0.45) continentWidth = 45;   // Boğaz bölgesi daralır
                else if (relativeY < 0.70) continentWidth = 65;   // Vale ve Nehir Toprakları geniş
                else if (relativeY < 0.85) continentWidth = 55;   // Menzil ve Batıdiyar dengeli
                else continentWidth = 75;                         // Dorne doğuya doğru uzanır

                // Kıtayı merkez eksenden sağa/sola hafif bükerek kıvrımlı hale getirme
                const centerShift = Math.sin(relativeY * Math.PI * 2.5) * 15;
                const dynamicCenter = centerX + centerShift;

                const distanceToCenter = Math.abs(x - dynamicCenter);
                
                // Kenar kıyılarda organik pürüz oluşturmak için gürültü ekleme
                const shorelineNoise = (this.fBm(x * 0.08, y * 0.08, 3) - 0.5) * 18;
                const isLand = distanceToCenter < (continentWidth / 2 + shorelineNoise);

                if (!isLand) {
                    // Kıta dışı tamamen Deniz ve Kıyı sığlığıdır
                    const distanceToShore = distanceToCenter - (continentWidth / 2 + shorelineNoise);
                    if (distanceToShore < 6) {
                        this.grid[y][x] = this.createTile(GAME_CONFIG.TILE_TYPES.COAST, x, y);
                    } else {
                        this.grid[y][x] = this.createTile(GAME_CONFIG.TILE_TYPES.SEA, x, y);
                    }
                } else {
                    // Kıta İçi Kara Alanı ve Bölgesel Biyom Atamaları
                    let tileType = GAME_CONFIG.TILE_TYPES.PLAINS;
                    const elevation = this.fBm(x * 0.06, y * 0.06, 4); // Yükseklik haritası
                    const wetness = this.fBm(x * 0.05 + 10, y * 0.05 + 10, 3); // Nem haritası

                    // Dağların Oluşturulması (Yüksek irtifa alanları)
                    if (elevation > 0.72) {
                        tileType = GAME_CONFIG.TILE_TYPES.MOUNTAIN;
                    } 
                    // İklim Bölgesi 1: KUZEY (y = 0 ila 90 arası)
                    else if (y < 90) {
                        if (elevation < 0.25) {
                            tileType = GAME_CONFIG.TILE_TYPES.SNOW;
                        } else {
                            tileType = (wetness > 0.52) ? GAME_CONFIG.TILE_TYPES.FOREST : GAME_CONFIG.TILE_TYPES.SNOW;
                        }
                    } 
                    // İklim Bölgesi 2: BOĞAZ VE SULAK ALANLAR (y = 90 ila 108 arası swamp)
                    else if (y >= 90 && y < 108) {
                        if (elevation < 0.45 && wetness > 0.40) {
                            tileType = GAME_CONFIG.TILE_TYPES.SWAMP;
                        } else {
                            tileType = (wetness > 0.55) ? GAME_CONFIG.TILE_TYPES.FOREST : GAME_CONFIG.TILE_TYPES.PLAINS;
                        }
                    }
                    // İklim Bölgesi 3: DORNE ÇÖLLERİ (y = 190 ve yukarısı güney)
                    else if (y > 190) {
                        if (elevation < 0.65) {
                            tileType = GAME_CONFIG.TILE_TYPES.DESERT;
                        } else {
                            tileType = GAME_CONFIG.TILE_TYPES.MOUNTAIN;
                        }
                    }
                    // İklim Bölgesi 4: ORTA WESTEROS (Riverlands, Vale, Reach, Stormlands)
                    else {
                        if (wetness > 0.62 && elevation < 0.50) {
                            tileType = GAME_CONFIG.TILE_TYPES.FOREST;
                        } else {
                            tileType = GAME_CONFIG.TILE_TYPES.PLAINS;
                        }
                    }

                    // İnşa Edilemez Doğal Maden Kaynaklarının Serpiştirilmesi (Altın ve Taş)
                    if (tileType === GAME_CONFIG.TILE_TYPES.PLAINS || tileType === GAME_CONFIG.TILE_TYPES.SNOW || tileType === GAME_CONFIG.TILE_TYPES.DESERT) {
                        const resourceRoll = this.random();
                        if (resourceRoll < 0.007) {
                            // Altın Madeni
                            tileType = GAME_CONFIG.TILE_TYPES.GOLD_VEIN;
                        } else if (resourceRoll < 0.02) {
                            // Taş Ocağı
                            tileType = GAME_CONFIG.TILE_TYPES.STONE_QUARRY;
                        }
                    }

                    this.grid[y][x] = this.createTile(tileType, x, y);
                }
            }
        }

        // Demir Adalar'ın Prosedürel Doğrulanması (Belirlenen bölgede kara parçası açar)
        this.carveIronIslands();
        
        return this.grid;
    }

    createTile(typeObj, x, y) {
        return {
            type: typeObj.id,
            name: typeObj.name,
            passable: typeObj.passable,
            navalPassable: typeObj.navalPassable,
            speedMult: typeObj.speedMult,
            color: typeObj.color,
            minimapColor: typeObj.minimapColor,
            x: x,
            y: y,
            owner: null,
            structure: null,
            unit: null
        };
    }

    /**
     * Demir Adalar (Batı yakası kayalık ada grubu) için özel alan oyması
     */
    carveIronIslands() {
        const startX = 18;
        const endX = 35;
        const startY = 125;
        const endY = 145;

        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                const noiseVal = this.noise2D(x * 0.3, y * 0.3);
                // Gürültü eşiğine göre ufak ufak kayalık takım adalar oluşturulması
                if (noiseVal > 0.60) {
                    this.grid[y][x] = this.createTile(GAME_CONFIG.TILE_TYPES.PLAINS, x, y);
                } else if (noiseVal > 0.45) {
                    this.grid[y][x] = this.createTile(GAME_CONFIG.TILE_TYPES.MOUNTAIN, x, y);
                } else {
                    // Adalar arası sığ deniz bağlantısı
                    this.grid[y][x] = this.createTile(GAME_CONFIG.TILE_TYPES.COAST, x, y);
                }
            }
        }
    }
}

/**
 * config.js - D&D 5.5e (2024) Birim Tabanlı Sınıf Şablonları ve Silah Ustası (Weapon Mastery) Özellikleri
 */
GAME_CONFIG.WEAPON_MASTERIES = {
    NICK: { name: 'Nick', desc: 'Ekstra hafif silah saldırısı yapma imkanı tanır.' },
    GRAZE: { name: 'Graze', desc: 'Saldırı ıskalasa bile hedefe güç modifikasyonu kadar hasar verir.' },
    TOPPLE: { name: 'Topple', desc: 'Hedefin Constitution kurtarma zarı atmasını gerektirir, başarısız olursa yere serilir (Prone).' },
    SLOW: { name: 'Slow', desc: 'İsabet alan hedefin hareket hızını 10 feet (2 tile) düşürür.' },
    CLEAVE: { name: 'Cleave', desc: 'Yakındaki ikincil bir hedefe tek bir saldırı ile ek hasar vurur.' },
    VEX: { name: 'Vex', desc: 'İsabet halinde, bir sonraki saldırıda birime avantaj sağlar.' },
    PUSH: { name: 'Push', desc: 'Hedefi 10 feet geriye doğru iter.' }
};

GAME_CONFIG.UNIT_TEMPLATES = {
    COMMONER: {
        id: 'villager',
        name: 'İşçi / Villager',
        cr: 0,
        level: 1,
        hitDice: { count: 1, type: 8 },
        stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        armor: { type: 'unarmored', baseAc: 10, hasShield: false },
        weapon: { name: 'İnşaat Baltası / Sopa', type: 'simple', damageDice: '1d4', mastery: 'SLOW' },
        proficientSaves: []
    },
    LIGHT_INFANTRY: {
        id: 'guardsman',
        name: 'Kuzeyli Muhafız / Spearmen',
        cr: 0.125, // 1/8
        level: 1,
        hitDice: { count: 1, type: 10 },
        stats: { str: 12, dex: 12, con: 12, int: 9, wis: 10, cha: 9 },
        armor: { type: 'medium', baseAc: 13, hasShield: true }, // Chain Shirt + Shield
        weapon: { name: 'Mızrak', type: 'martial', damageDice: '1d6', mastery: 'SLOW' },
        proficientSaves: ['STR']
    },
    HEAVY_INFANTRY: {
        id: 'man_at_arms',
        name: 'Ağır Piyade / Man-at-Arms',
        cr: 1,
        level: 2,
        hitDice: { count: 2, type: 10 },
        stats: { str: 16, dex: 10, con: 15, int: 10, wis: 10, cha: 10 },
        armor: { type: 'heavy', baseAc: 16, hasShield: false }, // Chain Mail
        weapon: { name: 'Ulu Kılıç', type: 'martial', damageDice: '2d6', mastery: 'GRAZE' },
        proficientSaves: ['STR', 'CON']
    },
    LONGBOWMAN: {
        id: 'longbowman',
        name: 'Uzun Yaycı / Longbowman',
        cr: 0.5, // 1/2
        level: 1,
        hitDice: { count: 1, type: 8 },
        stats: { str: 11, dex: 16, con: 12, int: 10, wis: 12, cha: 10 },
        armor: { type: 'light', baseAc: 11, hasShield: false }, // Leather Armor
        weapon: { name: 'Uzun Yay', type: 'ranged', damageDice: '1d8', mastery: 'VEX' },
        proficientSaves: ['DEX']
    },
    KNIGHT: {
        id: 'knight',
        name: 'Yeminli Şövalye / Heavy Cavalry',
        cr: 3,
        level: 5,
        hitDice: { count: 5, type: 10 },
        stats: { str: 18, dex: 11, con: 16, int: 11, wis: 12, cha: 14 },
        armor: { type: 'heavy', baseAc: 18, hasShield: true }, // Plate Mail + Shield
        weapon: { name: 'Kargı / Lance', type: 'martial', damageDice: '1d12', mastery: 'TOPPLE' },
        proficientSaves: ['STR', 'CON', 'WIS']
    },
    ALCHEMIST: {
        id: 'pyromancer',
        name: 'Simyacı / Maester',
        cr: 2,
        level: 3,
        hitDice: { count: 3, type: 6 },
        stats: { str: 9, dex: 12, con: 12, int: 16, wis: 14, cha: 11 },
        armor: { type: 'unarmored', baseAc: 10, hasShield: false },
        weapon: { name: 'Vahşi Ateş Şişesi', type: 'magic', damageDice: '2d6', mastery: 'CLEAVE' },
        proficientSaves: ['INT', 'WIS']
    },
    COMMANDER: {
        id: 'commander',
        name: 'Ordu Komutanı / Commander',
        cr: 4,
        level: 7,
        hitDice: { count: 7, type: 10 },
        stats: { str: 16, dex: 12, con: 14, int: 14, wis: 14, cha: 16 },
        armor: { type: 'heavy', baseAc: 18, hasShield: false }, // Plate
        weapon: { name: 'Görkemli Çelik Kılıç', type: 'martial', damageDice: '1d10', mastery: 'PUSH' },
        proficientSaves: ['STR', 'CHA', 'WIS']
    }
};

// MapGenerator nesnesi küresel olarak erişilebilir kılınır
window.WesterosGenerator = new WesterosMapGenerator(GAME_CONFIG.MAP_SIZE);

/**
 * config.js - D&D Gemi Şablonları Entegrasyonu
 */
GAME_CONFIG.NAVAL_TEMPLATES = {
    TRANSPORT_SHIP: {
        id: 'transport_ship',
        name: 'Taşıma Gemisi',
        cr: 1,
        level: 3,
        isNaval: true,
        maxCargo: 10, // 10 İnsansı birim taşıyabilir
        hitDice: { count: 4, type: 12 },
        stats: { str: 14, dex: 8, con: 16, int: 0, wis: 0, cha: 0 },
        armor: { type: 'heavy', baseAc: 12, hasShield: false }, // Ahşap gövde ACsi
        weapon: { name: 'Eylemsiz', type: 'none', damageDice: '0d0', mastery: 'none' },
        proficientSaves: ['CON']
    },
    WAR_GALLEY: {
        id: 'war_galley',
        name: 'Savaş Kadırgası',
        cr: 3,
        level: 5,
        isNaval: true,
        maxCargo: 3,
        hitDice: { count: 6, type: 12 },
        stats: { str: 20, dex: 12, con: 18, int: 0, wis: 0, cha: 0 },
        armor: { type: 'heavy', baseAc: 15, hasShield: false }, // Kalın kaplama ahşap gövde
        weapon: { name: 'Dev Balista', type: 'ranged', damageDice: '3d10', mastery: 'PUSH' }, // 3d10 hasar ve itme gücü
        proficientSaves: ['STR', 'CON']
    }
};

/**
 * config.js - 9 Krallığın Elit D&D 5.5e Özel Birimleri
 */
GAME_CONFIG.FACTION_SPECIAL_UNITS = {
    'kuzey': {
        id: 'direwolf_rider',
        name: 'Stark Direwolf Süvarisi',
        cr: 4,
        level: 6,
        hitDice: { count: 6, type: 10 },
        stats: { str: 16, dex: 14, con: 18, int: 8, wis: 12, cha: 8 },
        armor: { type: 'medium', baseAc: 14, hasShield: false }, // Deri/Zırh kaplama
        weapon: { name: 'Ulu Isırık ve Mızrak', type: 'martial', damageDice: '2d8', mastery: 'TOPPLE' },
        proficientSaves: ['STR', 'CON'],
        specialAbility: 'DIRE_BITE', // Vurduğu hedefi yere serme olasılığı yüksektir
        startResources: null
    },
    'batidiyar': {
        id: 'crimson_guard',
        name: 'Lannister Kızıl Muhafızı',
        cr: 4,
        level: 6,
        hitDice: { count: 6, type: 10 },
        stats: { str: 18, dex: 10, con: 16, int: 10, wis: 10, cha: 14 },
        armor: { type: 'heavy', baseAc: 18, hasShield: true }, // Full Plate + Shield
        weapon: { name: 'Kraliyet Halberdi', type: 'martial', damageDice: '1d10', mastery: 'SLOW' },
        proficientSaves: ['STR', 'WIS'],
        specialAbility: 'GOLDEN_RESOLVE', // Zihinsel etkilere ve korkuya karşı avantajlı
        startResources: null
    },
    'demir-adalar': {
        id: 'drowned_reaver',
        name: 'Greyjoy Boğulmuş Yağmacısı',
        cr: 3,
        level: 5,
        hitDice: { count: 5, type: 12 },
        stats: { str: 17, dex: 12, con: 16, int: 8, wis: 11, cha: 9 },
        armor: { type: 'light', baseAc: 12, hasShield: false }, // Hafif Deri Zırh
        weapon: { name: 'Boğulmuş Balta', type: 'martial', damageDice: '1d12', mastery: 'CLEAVE' },
        proficientSaves: ['STR', 'CON'],
        specialAbility: 'RELENTLESS_ENDURANCE', // Canı 0'a düştüğünde 1 HP ile hayatta kalma şansı (D&D 5.5e Half-Orc özelliği)
        startResources: null
    },
    'nehir-topraklari': {
        id: 'river_sentinel',
        name: 'Tully Nehir Gözcüsü',
        cr: 3,
        level: 5,
        hitDice: { count: 5, type: 8 },
        stats: { str: 12, dex: 17, con: 13, int: 10, wis: 14, cha: 11 },
        armor: { type: 'medium', baseAc: 14, hasShield: false }, // Scale Mail
        weapon: { name: 'Mızraklı Halberd', type: 'martial', damageDice: '1d10', mastery: 'PUSH' },
        proficientSaves: ['DEX', 'WIS'],
        specialAbility: 'SWIFT_WATER', // Bataklık (Swamp) ve sulak alanlarda hız cezalarından muaf olma
        startResources: null
    },
    'vadi': {
        id: 'falcon_knight',
        name: 'Arryn Şahin Şövalyesi',
        cr: 5,
        level: 8,
        hitDice: { count: 8, type: 10 },
        stats: { str: 16, dex: 15, con: 14, int: 10, wis: 12, cha: 14 },
        armor: { type: 'heavy', baseAc: 18, hasShield: true }, // Plate + Shield
        weapon: { name: 'Gökkuşağı Kargısı', type: 'martial', damageDice: '1d12', mastery: 'TOPPLE' },
        proficientSaves: ['STR', 'CHA'],
        specialAbility: 'DIVE_ATTACK', // Koşarak/Süvari hücumuyla vurduğunda ekstra 2d6 delici hasar
        startResources: null
    },
    'menzil': {
        id: 'knight_of_flowers',
        name: 'Tyrell Çiçek Şövalyesi',
        cr: 4,
        level: 7,
        hitDice: { count: 7, type: 10 },
        stats: { str: 14, dex: 18, con: 14, int: 11, wis: 12, cha: 16 },
        armor: { type: 'medium', baseAc: 15, hasShield: false }, // Gösterişli Hafif Zırh
        weapon: { name: 'Asil Flöre / Rapier', type: 'martial', damageDice: '1d8', mastery: 'VEX' },
        proficientSaves: ['DEX', 'CHA'],
        specialAbility: 'ELEGANT_PARRY', // Reaksiyon olarak AC değerini geçici olarak +3 artırma yeteneği
        startResources: null
    },
    'tac-topraklari': {
        id: 'dragon_guard',
        name: 'Ejderha Muhafızı',
        cr: 5,
        level: 8,
        hitDice: { count: 8, type: 10 },
        stats: { str: 15, dex: 14, con: 15, int: 10, wis: 12, cha: 16 },
        armor: { type: 'heavy', baseAc: 17, hasShield: false }, // Ejderha pulu kaplama zırh
        weapon: { name: 'Valyrian Çeliği Kılıç', type: 'martial', damageDice: '1d10', mastery: 'GRAZE' },
        proficientSaves: ['CON', 'CHA'],
        specialAbility: 'DRAGON_FIRE', // Hasarına ekstra 1d6 ateş hasarı ekler, ateş direnci sağlar
        startResources: null
    },
    'firtinadiyar': {
        id: 'stormcaller_infantry',
        name: 'Baratheon Fırtına Piyadesi',
        cr: 4,
        level: 6,
        hitDice: { count: 6, type: 10 },
        stats: { str: 18, dex: 10, con: 16, int: 9, wis: 11, cha: 12 },
        armor: { type: 'heavy', baseAc: 17, hasShield: false }, // Ağır Plaka Zırh
        weapon: { name: 'Fırtına Çekici / Warhammer', type: 'martial', damageDice: '2d6', mastery: 'PUSH' },
        proficientSaves: ['STR', 'CON'],
        specialAbility: 'THUNDEROUS_STRIKE', // Hedefi itip yere serme şansı olan elektrik/ses sarsıntılı saldırı
        startResources: null
    },
    'dorne': {
        id: 'sand_viper',
        name: 'Martell Kum Engereği',
        cr: 3,
        level: 5,
        hitDice: { count: 5, type: 8 },
        stats: { str: 11, dex: 18, con: 13, int: 11, wis: 12, cha: 12 },
        armor: { type: 'light', baseAc: 13, hasShield: false }, // Çöl Giysisi / Deri
        weapon: { name: 'Zehirli Çift Kama / Spear', type: 'martial', damageDice: '1d6', mastery: 'VEX' },
        proficientSaves: ['DEX', 'WIS'],
        specialAbility: 'VIPERS_KISS', // Saldırı isabet ettiğinde hedefi zehirleme (Poisoned)
        startResources: null
    }
};
