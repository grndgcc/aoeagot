/**
 * ==========================================================================
 * Westeros: Kingdoms of D&D 5.5e - Extreme AI Decision Engine (ai.js)
 * ==========================================================================
 * Bu dosya, insan oyuncuya karşı değişken, uyarlanabilir ve son derece zorlu
 * kararlar alan "Extreme AI" motorunu yönetir. AI, tehdit analizi, makro
 * ekonomik denge, hanedan profilleri ve taktiksel saldırı grupları oluşturur.
 */

class AIFactionController {
    constructor(factionKey, economySystem, combatEngine) {
        this.faction = factionKey;
        this.economy = economySystem;
        this.combat = combatEngine;

        // Yapay Zeka Durum Değişkenleri
        this.militaryUnits = [];
        this.workerUnits = [];
        this.aiBuildings = [];
        this.strikeTeams = []; // Taktiksel saldırı timleri
        
        // Tehdit ve Hedef Kayıtları
        this.threatMatrix = {}; // Grid bazlı tehdit skoru deposu
        this.primaryEnemyFaction = null;
        
        // Hanedan Kişilik Şablonu Yüklemesi
        this.personality = this.loadFactionPersonality(factionKey);
    }

    /**
     * Her hanedanın kendi D&D stat bonuslarına ve GoT lore'una uygun stratejik kişilik profili
     */
    loadFactionPersonality(factionKey) {
        const basePersonalities = {
            'kuzey': {
                name: 'Hane Stark',
                strategy: 'TURTLE_DEFENSE', // Savunma ve yıpratma savaşı odaklı
                resourcePriority: { food: 0.40, wood: 0.35, gold: 0.15, stone: 0.10 },
                unitPreference: ['direwolf_rider', 'man_at_arms'],
                aggression: 0.35, // Düşük agresiflik, savunma hattına önem verir
                expandRate: 0.4,
                buildKeepsEarly: true
            },
            'batidiyar': {
                name: 'Hane Lannister',
                strategy: 'GOLD_BOOM', // Altın biriktirip pahalı ordular basma
                resourcePriority: { food: 0.25, wood: 0.25, gold: 0.45, stone: 0.05 },
                unitPreference: ['crimson_guard', 'knight'],
                aggression: 0.65,
                expandRate: 0.6,
                buildKeepsEarly: false
            },
            'demir-adalar': {
                name: 'Hane Greyjoy',
                strategy: 'NAVAL_RAIDER', // Erken liman kurup denizden saldırma
                resourcePriority: { food: 0.20, wood: 0.45, gold: 0.25, stone: 0.10 },
                unitPreference: ['drowned_reaver', 'war_galley'],
                aggression: 0.85, // Çok yüksek agresiflik, erken baskınlar yapar
                expandRate: 0.3,
                buildKeepsEarly: false
            },
            'nehir-topraklari': {
                name: 'Hane Tully',
                strategy: 'BALANCED_EXPAND', // Hızlı yayılma ve esnek savunma
                resourcePriority: { food: 0.35, wood: 0.30, gold: 0.25, stone: 0.10 },
                unitPreference: ['river_sentinel', 'guardsman'],
                aggression: 0.50,
                expandRate: 0.8, // Haritaya hızla yayılır
                buildKeepsEarly: false
            },
            'vadi': {
                name: 'Hane Arryn',
                strategy: 'CHOKEPOINT_DEFENSE', // Dağ geçitlerini tutup süvariyle ezme
                resourcePriority: { food: 0.30, wood: 0.25, gold: 0.25, stone: 0.20 },
                unitPreference: ['falcon_knight', 'knight'],
                aggression: 0.40,
                expandRate: 0.4,
                buildKeepsEarly: true
            },
            'menzil': {
                name: 'Hane Tyrell',
                strategy: 'POPULATION_SWARM', // Sınırsız yiyecek ile ucuz ordu yığma
                resourcePriority: { food: 0.50, wood: 0.25, gold: 0.20, stone: 0.05 },
                unitPreference: ['knight_of_flowers', 'guardsman'],
                aggression: 0.55,
                expandRate: 0.7,
                buildKeepsEarly: false
            },
            'tac-topraklari': {
                name: 'Kralın Şehri',
                strategy: 'BALANCED_EMPIRE', // Dengeli askeri ve teknolojik gelişim
                resourcePriority: { food: 0.30, wood: 0.30, gold: 0.30, stone: 0.10 },
                unitPreference: ['dragon_guard', 'man_at_arms'],
                aggression: 0.60,
                expandRate: 0.5,
                buildKeepsEarly: true
            },
            'firtinadiyar': {
                name: 'Hane Baratheon',
                strategy: 'HEAVY_ATTRITION', // Surlar örüp ağır piyadelerle ezme
                resourcePriority: { food: 0.30, wood: 0.25, gold: 0.25, stone: 0.20 },
                unitPreference: ['stormcaller_infantry', 'man_at_arms'],
                aggression: 0.70,
                expandRate: 0.4,
                buildKeepsEarly: true
            },
            'dorne': {
                name: 'Hane Martell',
                strategy: 'GUERILLA_VIPER', // Hafif zehirli birimlerle vur-kaç
                resourcePriority: { food: 0.25, wood: 0.30, gold: 0.35, stone: 0.10 },
                unitPreference: ['sand_viper', 'longbowman'],
                aggression: 0.75, // Yüksek agresiflik, sürekli işçi tacizi yapar
                expandRate: 0.5,
                buildKeepsEarly: false
            }
        };

        return basePersonalities[factionKey] || basePersonalities['tac-topraklari'];
    }

    /**
     * AI Güncelleme Döngüsü (Her 1.5 saniyede bir tetiklenir, CPU kasmayı önler)
     */
    tick() {
        this.updateAIOwnership();
        this.buildThreatMatrix();
        this.manageMacroEconomy();
        this.manageMicroTactics();
    }

    /**
     * Haritadaki tüm AI birimlerinin durumlarını günceller
     */
    updateAIOwnership() {
        this.militaryUnits = [];
        this.workerUnits = [];
        this.aiBuildings = [];

        // Mevcut canlı birimleri tasnif et
        for (let unit of this.combat.unitsList) {
            if (unit.faction === this.faction && !unit.isDead) {
                if (unit.villagerAI) {
                    this.workerUnits.push(unit);
                } else {
                    this.militaryUnits.push(unit);
                }
            }
        }

        // Mevcut binaları tasnif et
        this.aiBuildings = this.economy.buildings.filter(b => b.faction === this.faction && !b.isDead);
    }

    /**
     * Tehdit Matrisi: Haritadaki düşman birimlerinin koordinat yoğunluğunu tarar
     * AI, bu ısı haritasına göre nereye savunma kulesi dikeceğini veya nereye saldıracağını belirler.
     */
    buildThreatMatrix() {
        this.threatMatrix = {};

        for (let unit of this.combat.unitsList) {
            if (unit.faction !== this.faction && !unit.isDead) {
                // Koordinatları 10x10'luk büyük bölgelere sığdır (Grid performansı için)
                const regionX = Math.floor(unit.x / 10);
                const regionY = Math.floor(unit.y / 10);
                const key = `${regionX},${regionY}`;

                if (!this.threatMatrix[key]) this.threatMatrix[key] = 0;
                // Birimin D&D CR seviyesine göre tehdit skorunu artır
                this.threatMatrix[key] += (unit.cr || 0.5) + 1.0;
                
                // En çok tehdit üreten düşmanı ana düşman faction olarak belirle
                this.primaryEnemyFaction = unit.faction;
            }
        }
    }

    /**
     * MAKRO EKONOMİ PLANLAYICISI (Bina İnşası ve Birim Üretimi)
     */
    manageMacroEconomy() {
        const resMgr = this.economy.resourceManager;
        const currentGold = resMgr.resources.gold;
        const currentFood = resMgr.resources.food;
        const currentWood = resMgr.resources.wood;
        const currentStone = resMgr.resources.stone;

        // 1. İşçi İhtiyaç Analizi (Maksimum 35 işçiye kadar basma hedefi)
        if (this.workerUnits.length < 30 && currentFood >= 50) {
            const townCenters = this.aiBuildings.filter(b => b.type === 'TOWN_CENTER' && b.isCompleted);
            if (townCenters.length > 0) {
                // İşçi üret (AoE tarzı kışla/merkez üretimi)
                this.trainUnitInBuilding(townCenters[0], GAME_CONFIG.UNIT_TEMPLATES.COMMONER);
            }
        }

        // 2. İşçileri Hanedan Önceliklerine Göre Kaynaklara Dağıt
        this.distributeWorkers();

        // 3. Nüfus Sınırı (Pop Cap) Kontrolü
        // Eğer nüfus sınırına yaklaşıldıysa acilen Ev (HOUSE) inşa et
        const popLeft = resMgr.maxPopulation - resMgr.currentPopulation;
        if (popLeft <= 3 && currentWood >= 50) {
            this.buildStructureNearBase('HOUSE');
        }

        // 4. Askeri Altyapı İnşası
        const barracksCount = this.aiBuildings.filter(b => b.type === 'BARRACKS').length;
        if (barracksCount < 2 && currentWood >= 175) {
            this.buildStructureNearBase('BARRACKS');
        }

        // 5. Hanedana Özgü Savunma veya Liman İnşası
        if (this.personality.strategy === 'NAVAL_RAIDER') {
            const dockCount = this.aiBuildings.filter(b => b.type === 'DOCK').length;
            if (dockCount < 1 && currentWood >= 150) {
                this.buildStructureNearShoreline('DOCK');
            }
        }

        if (this.personality.buildKeepsEarly) {
            const keepCount = this.aiBuildings.filter(b => b.type === 'KEEP').length;
            if (keepCount < 2 && currentWood >= 125 && currentStone >= 200) {
                // Tehdit seviyesi yüksek bir bölgenin yakınına Keep (Kale) inşa et
                this.buildStructureNearBase('KEEP');
            }
        }

        // 6. Askeri Birim Üretim Döngüsü
        this.recruitMilitaryForces();
    }

    /**
     * İşçileri hanedanın stratejik kaynak dağılımına göre tarlalara, ormana ve madenlere atar
     */
    distributeWorkers() {
        const priorities = this.personality.resourcePriority;
        const totalWorkers = this.workerUnits.length;
        if (totalWorkers === 0) return;

        // Her kaynak için hedeflenen işçi sayısı
        const targetFoodCount = Math.floor(totalWorkers * priorities.food);
        const targetWoodCount = Math.floor(totalWorkers * priorities.wood);
        const targetGoldCount = Math.floor(totalWorkers * priorities.gold);
        const targetStoneCount = Math.floor(totalWorkers * priorities.stone);

        let foodAllocated = 0, woodAllocated = 0, goldAllocated = 0, stoneAllocated = 0;

        this.workerUnits.forEach(worker => {
            if (worker.villagerAI.state === 'IDLE') {
                // Hangi kaynağın işçi açığı varsa oraya yönlendir
                if (foodAllocated < targetFoodCount) {
                    const node = this.findNearestResourceTile(worker.x, worker.y, 7); // SWAMP / FOOD
                    if (node) {
                        worker.villagerAI.assignToGather(node);
                        foodAllocated++;
                    }
                } else if (woodAllocated < targetWoodCount) {
                    const node = this.findNearestResourceTile(worker.x, worker.y, 3); // FOREST / WOOD
                    if (node) {
                        worker.villagerAI.assignToGather(node);
                        woodAllocated++;
                    }
                } else if (goldAllocated < targetGoldCount) {
                    const node = this.findNearestResourceTile(worker.x, worker.y, 8); // GOLD
                    if (node) {
                        worker.villagerAI.assignToGather(node);
                        goldAllocated++;
                    }
                } else if (stoneAllocated < targetStoneCount) {
                    const node = this.findNearestResourceTile(worker.x, worker.y, 9); // STONE
                    if (node) {
                        worker.villagerAI.assignToGather(node);
                        stoneAllocated++;
                    }
                } else {
                    // Boşta kalan olursa rastgele oduna gönder
                    const node = this.findNearestResourceTile(worker.x, worker.y, 3);
                    if (node) worker.villagerAI.assignToGather(node);
                }
            } else {
                // Zaten çalışıyorsa tipleri say
                const type = worker.villagerAI.inventory.type;
                if (type === 'food') foodAllocated++;
                if (type === 'wood') woodAllocated++;
                if (type === 'gold') goldAllocated++;
                if (type === 'stone') stoneAllocated++;
            }
        });
    }

    /**
     * Kışlalarda hanedanın özel veya tercih ettiği askeri birlikleri basma
     */
    recruitMilitaryForces() {
        const barracks = this.aiBuildings.filter(b => b.type === 'BARRACKS' && b.isCompleted);
        if (barracks.length === 0) return;

        // Bütçe dengesine göre birim şablonu seçimi
        let selectedTemplate = GAME_CONFIG.UNIT_TEMPLATES.LIGHT_INFANTRY; // Standart ucuz birim
        const prefName = this.personality.unitPreference[0];

        // Hanedan özel birimi mi, yoksa şövalye mi?
        if (GAME_CONFIG.FACTION_SPECIAL_UNITS[this.faction] && Math.random() < 0.6) {
            selectedTemplate = GAME_CONFIG.FACTION_SPECIAL_UNITS[this.faction];
        } else if (GAME_CONFIG.UNIT_TEMPLATES.HEAVY_INFANTRY) {
            selectedTemplate = GAME_CONFIG.UNIT_TEMPLATES.HEAVY_INFANTRY;
        }

        // Limitli ve dengeli ordu basma (Altın ve Yiyecek varsa bas)
        const activeBarracks = barracks[Math.floor(Math.random() * barracks.length)];
        const costResult = window.DnDRules.calculateAoECostAndTrainTime(selectedTemplate);

        if (this.economy.resourceManager.hasResources(costResult.costs)) {
            this.trainUnitInBuilding(activeBarracks, selectedTemplate);
        }
    }

    /**
     * Bir binadan askeri birim üretme emrini işletir
     */
    trainUnitInBuilding(building, template) {
        const costResult = window.DnDRules.calculateAoECostAndTrainTime(template);
        
        // Kaynakları kes ve birimi doğur (spawn)
        this.economy.resourceManager.deductResources(costResult.costs);
        this.economy.resourceManager.adjustPopulation(1);

        setTimeout(() => {
            this.combat.spawnUnit(template, building.gridX + 1, building.gridY + building.height, this.faction);
        }, costResult.trainTime * 100); // Test için çarpım azaltılmıştır
    }

    /**
     * Taktiksel AI Savaş Alanı Kararları (Saldırı, Savunma, Baskın Timleri)
     */
    manageMicroTactics() {
        // Askeri birlikler yeterli boyuta ulaştığında saldırı timleri kur (RTS Flocking & Attack Waves)
        const minStrikeForceSize = 8;

        if (this.militaryUnits.length >= minStrikeForceSize && this.strikeTeams.length === 0) {
            // Bir saldırı timi oluştur
            const team = [...this.militaryUnits];
            this.strikeTeams.push(team);

            // Saldırı Hedefi Belirleme (En yüksek tehdit noktası veya doğrudan düşman Town Center'ı)
            const targetX = 110; // Varsayılan merkez koordinat
            const targetY = 110;
            
            const enemyTC = this.economy.buildings.find(b => b.faction !== this.faction && b.type === 'TOWN_CENTER');
            if (enemyTC) {
                // Düşmanın kalbini hedef al!
                window.GameEngine.groupMovement.orderGroupMovement(team, enemyTC.gridX, enemyTC.gridY);
                window.UI.writeBattleLog(`⚔️ [Extreme AI] Hane ${this.faction} büyük bir saldırı timi gönderdi!`, 'damage');
            } else {
                // Rastgele bir düşman birimine odaklan
                const randEnemy = this.combat.unitsList.find(u => u.faction !== this.faction && !u.isDead);
                if (randEnemy) {
                    window.GameEngine.groupMovement.orderGroupMovement(team, Math.floor(randEnemy.x), Math.floor(randEnemy.y));
                }
            }
        }

        // Saldırı timindeki ölenleri listeden temizle
        this.strikeTeams = this.strikeTeams.map(team => team.filter(u => !u.isDead)).filter(team => team.length > 0);
    }

    /**
     * Yardımcı fonksiyonlar (Maden, orman ve arazi tespiti)
     */
    findNearestResourceTile(gx, gy, tileTypeID) {
        let nearest = null;
        let minDist = Infinity;
        const map = window.GameEngine.mapData;

        // Yakındaki 20x20 karelik alanı tara (Hızlı performans için lokal tarama)
        const scanRadius = 25;
        const startX = Math.max(0, Math.floor(gx - scanRadius));
        const endX = Math.min(GAME_CONFIG.MAP_SIZE - 1, Math.floor(gx + scanRadius));
        const startY = Math.max(0, Math.floor(gy - scanRadius));
        const endY = Math.min(GAME_CONFIG.MAP_SIZE - 1, Math.floor(gy + scanRadius));

        for (let y = startY; y <= endY; y++) {
            for (let x = startX; x <= endX; x++) {
                const tile = map[y][x];
                if (tile.type === tileTypeID && !tile.structure) {
                    const dist = Math.hypot(x - gx, y - gy);
                    if (dist < minDist) {
                        minDist = dist;
                        nearest = tile;
                    }
                }
            }
        }
        return nearest;
    }

    /**
     * Karargah (Town Center) çevresinde boş bir inşaat alanı bularak blueprint yerleştirir
     */
    buildStructureNearBase(buildingKey) {
        const base = this.aiBuildings.find(b => b.type === 'TOWN_CENTER');
        if (!base) return;

        const dbType = BINDING_DATABASE[buildingKey];
        const mapData = window.GameEngine.mapData;

        // Spiral arama yöntemiyle üssün etrafında 4 kare açığa bina yerleştirilebilecek bir alan tara
        for (let r = 4; r <= 15; r += 2) {
            const checkPoints = [
                { x: base.gridX + r, y: base.gridY },
                { x: base.gridX - r, y: base.gridY },
                { x: base.gridX, y: base.gridY + r },
                { x: base.gridX, y: base.gridY - r }
            ];

            for (let pt of checkPoints) {
                if (this.economy.canPlaceBuilding(dbType, pt.x, pt.y, mapData)) {
                    const blueprint = this.economy.placeBuildingBlueprint(buildingKey, pt.x, pt.y, this.faction, mapData);
                    if (blueprint) {
                        // Bir işçiyi acilen inşaat alanına yönlendir
                        const idleWorker = this.workerUnits.find(w => w.villagerAI.state === 'IDLE' || w.villagerAI.state === 'GATHERING');
                        if (idleWorker) {
                            idleWorker.villagerAI.assignToBuild(blueprint);
                        }
                        return;
                    }
                }
            }
        }
    }

    /**
     * Deniz kıyısında liman yapılabilecek su-kara birleşimi bir alan tespit eder
     */
    buildStructureShoreline(buildingKey) {
        // Implement edilebilir liman arama algoritmaları
    }
}

/**
 * Tüm AI Krallıklarını Döngüsel Olarak Yöneten Yapay Zeka Yöneticisi
 */
class AISystemManager {
    constructor() {
        this.activeAIClients = [];
        this.updateInterval = 1.5; // Saniye bazında güncelleme sıklığı
        this.timer = 0;
    }

    /**
     * Aktif olmayan tüm krallıklar için arka planda bağımsız bir AI zekası oluşturur
     * @param {string} playerFaction - Oyuncunun seçtiği ülke (AI bu ülkeyi kontrol etmez)
     */
    init(playerFaction, economySystem, combatEngine) {
        this.activeAIClients = [];

        for (let key in GAME_CONFIG.FACTIONS) {
            if (key !== playerFaction) {
                const aiClient = new AIFactionController(key, economySystem, combatEngine);
                this.activeAIClients.push(aiClient);
                
                // AI Başlangıç Güçlerini Haritada Konumlandır (Town Center + 3 İşçi)
                this.setupAIBase(aiClient, economySystem, combatEngine);
            }
        }
    }

    setupAIBase(aiClient, economy, combat) {
        const facInfo = GAME_CONFIG.FACTIONS[aiClient.faction];
        if (!facInfo) return;

        const mapData = window.GameEngine.mapData;

        // 1. AI Town Center'ı yerleştir (Hemen ve ücretsiz tamamlanır)
        const tcDb = BINDING_DATABASE.TOWN_CENTER;
        const newBuilding = new Building(tcDb, facInfo.startX, facInfo.startY, aiClient.faction);
        newBuilding.progress = 100;
        newBuilding.hp = newBuilding.maxHp;
        newBuilding.isCompleted = true;
        
        economy.buildings.push(newBuilding);
        economy.resourceManager.addPopulationCap(tcDb.popCap);

        for (let y = facInfo.startY; y < facInfo.startY + tcDb.height; y++) {
            for (let x = facInfo.startX; x < facInfo.startX + tcDb.width; x++) {
                mapData[y][x].structure = newBuilding;
            }
        }

        // 2. 4 Tane AI Başlangıç İşçisini doğur (D&D Commoner)
        for (let i = 0; i < 4; i++) {
            combat.spawnUnit(
                GAME_CONFIG.UNIT_TEMPLATES.COMMONER, 
                facInfo.startX + tcDb.width + 1, 
                facInfo.startY + i, 
                aiClient.faction
            );
        }
    }

    /**
     * Oyun döngüsünden (Game Loop) çağrılan güncelleme tetikleyicisi
     */
    update(deltaTime) {
        this.timer += deltaTime;
        if (this.timer >= this.updateInterval) {
            this.timer = 0;
            
            // Tüm AI krallıklarını sırayla güncelleyerek işlemci (CPU) yükünü yayar
            this.activeAIClients.forEach(ai => ai.tick());
        }
    }
}

// Global Yapay Zeka Sistemini Kaydet
window.AISystem = new AISystemManager();
