/**
 * ==========================================================================
 * Westeros: Kingdoms of D&D 5.5e - Ekonomi ve İnşa Sistemi (economy.js)
 * ==========================================================================
 * Bu dosya, Age of Empires ekonomisini D&D 5.5e statlarıyla birleştiren temel
 * sistemi yönetir. İşçi (Villager) durum makinesi (FSM), kaynak toplama kapasiteleri,
 * bina çakışma kontrolleri ve dinamik inşa döngüleri bu dosyada işletilir.
 */

class ResourceManager {
    constructor() {
        this.resources = {
            food: 500,
            wood: 300,
            gold: 100,
            stone: 0
        };
        this.currentPopulation = 0;
        this.maxPopulation = 20; // Başlangıç limiti
    }

    /**
     * Gerekli kaynakların mevcut olup olmadığını denetler
     */
    hasResources(costs) {
        return (
            this.resources.food >= (costs.food || 0) &&
            this.resources.wood >= (costs.wood || 0) &&
            this.resources.gold >= (costs.gold || 0) &&
            this.resources.stone >= (costs.stone || 0)
        );
    }

    /**
     * Kaynakları hesaptan düşer
     */
    deductResources(costs) {
        if (!this.hasResources(costs)) return false;
        this.resources.food -= (costs.food || 0);
        this.resources.wood -= (costs.wood || 0);
        this.resources.gold -= (costs.gold || 0);
        this.resources.stone -= (costs.stone || 0);
        this.updateHUD();
        return true;
    }

    /**
     * Depolanan kaynağa ekleme yapar
     */
    addResources(type, amount) {
        if (this.resources.hasOwnProperty(type)) {
            this.resources[type] += amount;
            this.updateHUD();
        }
    }

    /**
     * Nüfus sınırını günceller (Ev yapıldığında çağrılır)
     */
    addPopulationCap(amount) {
        this.maxPopulation = Math.min(200, this.maxPopulation + amount); // Limit 200
        this.updateHUD();
    }

    /**
     * Aktif nüfusu artırır/azaltır
     */
    adjustPopulation(amount) {
        this.currentPopulation = Math.max(0, this.currentPopulation + amount);
        this.updateHUD();
    }

    /**
     * HUD arayüzünü güncel hammadde miktarlarıyla besler
     */
    updateHUD() {
        const foodEl = document.getElementById('res-food');
        const woodEl = document.getElementById('res-wood');
        const goldEl = document.getElementById('res-gold');
        const stoneEl = document.getElementById('res-stone');
        const popEl = document.getElementById('res-pop');

        if (foodEl) foodEl.querySelector('.resource-value').innerText = Math.round(this.resources.food);
        if (woodEl) woodEl.querySelector('.resource-value').innerText = Math.round(this.resources.wood);
        if (goldEl) goldEl.querySelector('.resource-value').innerText = Math.round(this.resources.gold);
        if (stoneEl) stoneEl.querySelector('.resource-value').innerText = Math.round(this.resources.stone);
        if (popEl) popEl.querySelector('.resource-value').innerText = `${this.currentPopulation}/${this.maxPopulation}`;
    }
}

/**
 * AoE Tarzı Bina Tanımları ve Maliyet Veritabanı
 */
const BINDING_DATABASE = {
    TOWN_CENTER: { type: 'TOWN_CENTER', width: 3, height: 3, hp: 2400, costs: { wood: 275, stone: 100 }, popCap: 10, isDock: false },
    HOUSE: { type: 'HOUSE', width: 1, height: 1, hp: 400, costs: { wood: 50 }, popCap: 5, isDock: false },
    BARRACKS: { type: 'BARRACKS', width: 2, height: 2, hp: 1200, costs: { wood: 175 }, popCap: 0, isDock: false },
    DOCK: { type: 'DOCK', width: 2, height: 2, hp: 1200, costs: { wood: 150 }, popCap: 0, isDock: true }, // Su kenarına kurulmalı
    KEEP: { type: 'KEEP', width: 2, height: 2, hp: 1800, costs: { wood: 125, stone: 200 }, popCap: 0, isDock: false },
    STONE_WALL: { type: 'STONE_WALL', width: 1, height: 1, hp: 1500, costs: { stone: 5 }, popCap: 0, isDock: false }
};

/**
 * Harita Üzerindeki Her Bir Binanın Durumunu Temsil Eden Sınıf
 */
class Building {
    constructor(dbType, gridX, gridY, faction) {
        this.id = 'b_' + Math.random().toString(36).substr(2, 9);
        this.type = dbType.type;
        this.width = dbType.width;
        this.height = dbType.height;
        this.gridX = gridX;
        this.gridY = gridY;
        this.faction = faction;
        
        this.maxHp = dbType.hp;
        this.hp = 1; // İnşaat aşamasında 1 canla başlar
        this.progress = 0; // %0'dan başlar
        this.isCompleted = false;
        this.popCapBonus = dbType.popCap || 0;
    }

    /**
     * İşçi çekiç vurdukça inşaat ilerlemesini günceller
     */
    build(increment, resourceMgr) {
        if (this.isCompleted) return;

        this.progress = Math.min(100, this.progress + increment);
        // Can barı inşaat yüzdesi ile doğru orantılı olarak yükselir
        this.hp = Math.round((this.progress / 100) * this.maxHp);

        if (this.progress >= 100) {
            this.isCompleted = true;
            this.hp = this.maxHp;
            
            // Eğer ev veya belediye binası ise nüfus sınırını artır
            if (this.popCapBonus > 0) {
                resourceMgr.addPopulationCap(this.popCapBonus);
            }
            window.UI.writeBattleLog(`[İnşaat] Hane ${this.faction} yeni bir ${this.type} inşa etti!`, 'success');
        }
    }
}

/**
 * İşçi (Villager) Durum Makinesi ve D&D Entegrasyon Sınıfı
 */
class VillagerAI {
    constructor(unitEntity) {
        this.entity = unitEntity; // Savaş motoruna bağlı birim gövdesi
        this.state = 'IDLE'; // IDLE, MOVING_TO_RESOURCE, GATHERING, RETURNING_TO_DEPOSIT, CONSTRUCTING
        
        // İşçinin D&D statlarının alınması
        this.stats = unitEntity.stats || { str: 10, dex: 10, con: 10 };
        
        // D&D 5.5e Stat Modifikatörlerinin Toplama Hızına ve Kapasitesine Etkisi:
        // Strength (Güç) -> Taşıma kapasitesini artırır. Mod başına +2 taşır.
        const strMod = Math.floor((this.stats.str - 10) / 2);
        this.maxCapacity = 10 + Math.max(0, strMod * 2);

        // Dexterity (El Becerisi) -> Toplama hızını milisaniye bazında azaltır (hızlandırır)
        const dexMod = Math.floor((this.stats.dex - 10) / 2);
        this.gatherTickRate = 1.0 - Math.min(0.5, dexMod * 0.05); // Standart saniyede 1 toplama

        this.inventory = {
            type: null, // 'food', 'wood', 'gold', 'stone'
            amount: 0
        };

        this.targetResourceNode = null;
        this.targetBuildingSite = null;
        this.gatherTimer = 0;
    }

    /**
     * İşçinin gerçek zamanlı durum makinesi döngüsü
     */
    update(deltaTime, economyManager) {
        switch (this.state) {
            case 'IDLE':
                // İşsiz durma hali
                break;

            case 'MOVING_TO_RESOURCE':
                // Kaynak karesine doğru hareket et (A* navigasyonu)
                if (this.isNearTarget(this.targetResourceNode.x, this.targetResourceNode.y)) {
                    this.state = 'GATHERING';
                    this.gatherTimer = 0;
                } else {
                    this.moveTowards(this.targetResourceNode.x, this.targetResourceNode.y, deltaTime);
                }
                break;

            case 'GATHERING':
                // Kaynağı kaz/topla
                this.gatherTimer += deltaTime;
                if (this.gatherTimer >= this.gatherTickRate) {
                    this.gatherTimer = 0;
                    this.gatherResource();
                }

                if (this.inventory.amount >= this.maxCapacity) {
                    this.state = 'RETURNING_TO_DEPOSIT';
                    // En yakın belediye binası veya depolama alanını bul
                    this.targetDepositNode = economyManager.findNearestDeposit(this.entity.x, this.entity.y, this.entity.faction);
                }
                break;

            case 'RETURNING_TO_DEPOSIT':
                // Depoya geri dön
                if (this.targetDepositNode) {
                    if (this.isNearTarget(this.targetDepositNode.gridX, this.targetDepositNode.gridY)) {
                        // Kaynağı teslim et
                        economyManager.resourceManager.addResources(this.inventory.type, this.inventory.amount);
                        
                        window.UI.writeBattleLog(`[Ekonomi] İşçi ${this.inventory.amount} ${this.inventory.type} teslim etti.`, 'system');
                        
                        this.inventory.amount = 0;

                        // Kaynak düğümüne geri dön
                        if (this.targetResourceNode) {
                            this.state = 'MOVING_TO_RESOURCE';
                        } else {
                            this.state = 'IDLE';
                        }
                    } else {
                        this.moveTowards(this.targetDepositNode.gridX, this.targetDepositNode.gridY, deltaTime);
                    }
                } else {
                    this.state = 'IDLE'; // Depo yoksa beklemeye geç
                }
                break;

            case 'CONSTRUCTING':
                // İnşaat yap
                if (this.targetBuildingSite) {
                    if (this.isNearTarget(this.targetBuildingSite.gridX, this.targetBuildingSite.gridY)) {
                        this.gatherTimer += deltaTime;
                        if (this.gatherTimer >= 1.0) { // Her saniye çekiç vurur
                            this.gatherTimer = 0;
                            // Constitution modifikatörü inşa etme hızını artırır
                            const conMod = Math.floor((this.stats.con - 10) / 2);
                            const buildPower = 5 + Math.max(0, conMod);
                            this.targetBuildingSite.build(buildPower, economyManager.resourceManager);

                            if (this.targetBuildingSite.isCompleted) {
                                this.targetBuildingSite = null;
                                this.state = 'IDLE';
                            }
                        }
                    } else {
                        this.moveTowards(this.targetBuildingSite.gridX, this.targetBuildingSite.gridY, deltaTime);
                    }
                } else {
                    this.state = 'IDLE';
                }
                break;
        }
    }

    /**
     * İşçinin hedefe varıp varmadığını denetler (Kare mesafe olarak)
     */
    isNearTarget(tx, ty) {
        const dx = Math.abs(this.entity.x - tx);
        const dy = Math.abs(this.entity.y - ty);
        return (dx <= 1.5 && dy <= 1.5);
    }

    moveTowards(tx, ty, deltaTime) {
        // Basit doğrusal hareket (A* detayları combat.js adımında kurulacak)
        const angle = Math.atan2(ty - this.entity.y, tx - this.entity.x);
        const speed = 3.0; // Kare/saniye bazında hız
        this.entity.x += Math.cos(angle) * speed * deltaTime;
        this.entity.y += Math.sin(angle) * speed * deltaTime;
    }

    gatherResource() {
        if (!this.targetResourceNode) return;
        
        // Kaynak tipini belirle
        let resType = 'wood';
        if (this.targetResourceNode.type === 8) resType = 'gold';       // Gold Vein
        else if (this.targetResourceNode.type === 9) resType = 'stone';  // Stone Quarry
        else if (this.targetResourceNode.type === 3) resType = 'wood';   // Forest
        else if (this.targetResourceNode.type === 7) resType = 'food';   // Swamp/Farming/Forage

        this.inventory.type = resType;

        // Strength (Güç) modu toplama verimini artırır
        const strMod = Math.floor((this.stats.str - 10) / 2);
        const gatherValue = 1 + Math.max(0, strMod);

        this.inventory.amount = Math.min(this.maxCapacity, this.inventory.amount + gatherValue);
    }

    assignToGather(resourceNode) {
        this.targetResourceNode = resourceNode;
        this.targetBuildingSite = null;
        this.state = 'MOVING_TO_RESOURCE';
    }

    assignToBuild(buildingObj) {
        this.targetBuildingSite = buildingObj;
        this.targetResourceNode = null;
        this.state = 'CONSTRUCTING';
    }
}

/**
 * Tüm Krallığın İnşaat ve Ekonomi Altyapısını Yöneten Ana Sınıf
 */
class EconomySystem {
    constructor() {
        this.resourceManager = new ResourceManager();
        this.buildings = [];
        this.activeWorkers = [];
    }

    /**
     * 220x220 Harita Üzerinde Belirlenen Alana Bina Yerleştirilebilirlik Kontrolü
     */
    canPlaceBuilding(dbType, gridX, gridY, mapData) {
        // Harita dışı kontrolü
        if (gridX < 0 || gridX + dbType.width > GAME_CONFIG.MAP_SIZE ||
            gridY < 0 || gridY + dbType.height > GAME_CONFIG.MAP_SIZE) {
            return false;
        }

        // Çakışma ve Arazi Kontrolleri
        for (let y = gridY; y < gridY + dbType.height; y++) {
            for (let x = gridX; x < gridX + dbType.width; x++) {
                const tile = mapData[y][x];

                // Zaten bir yapı var mı?
                if (tile.structure) return false;

                // Üzerinde duran askeri birim var mı?
                if (tile.unit) return false;

                // Su ve Sarp Dağ kontrolü
                if (dbType.isDock) {
                    // Liman sadece sığ denizde veya kıyıda (COAST/SEA) ve kara birleşiminde olmalıdır
                    if (tile.type !== 1 && tile.type !== 0) return false;
                } else {
                    // Kara yapıları denize veya dağa yapılamaz
                    if (tile.type === 0 || tile.type === 1 || tile.type === 4) return false;
                }
            }
        }

        return true;
    }

    /**
     * Haritaya İnşaat Temeli (Blueprint) Atılması
     */
    placeBuildingBlueprint(buildingId, gridX, gridY, faction, mapData) {
        const dbType = BINDING_DATABASE[buildingId];
        if (!dbType) return null;

        if (!this.canPlaceBuilding(dbType, gridX, gridY, mapData)) {
            window.UI.writeBattleLog(`[İnşaat Hatası] Seçili alana ${dbType.type} yerleştirilemez! Arazi uygun değil veya engel var.`, 'damage');
            return null;
        }

        // Kaynak kontrolü ve kesinti
        if (!this.resourceManager.deductResources(dbType.costs)) {
            window.UI.writeBattleLog(`[İnşaat Hatası] Yetersiz hammadde! Gerekli: Wood:${dbType.costs.wood || 0} Stone:${dbType.costs.stone || 0}`, 'damage');
            return null;
        }

        const newBuilding = new Building(dbType, gridX, gridY, faction);
        this.buildings.push(newBuilding);

        // Harita matrisine yapıyı kaydet (collision blokajı için)
        for (let y = gridY; y < gridY + dbType.height; y++) {
            for (let x = gridX; x < gridX + dbType.width; x++) {
                mapData[y][x].structure = newBuilding;
            }
        }

        window.UI.writeBattleLog(`[Ekonomi] ${dbType.type} temeli atıldı. İşçi görevlendirin.`, 'system');
        return newBuilding;
    }

    /**
     * En yakın Depolama Alanını (Town Center veya depo) bulma yardımcı fonksiyonu
     */
    findNearestDeposit(gx, gy, faction) {
        let nearest = null;
        let minDist = Infinity;

        for (let b of this.buildings) {
            if (b.faction === faction && b.isCompleted && (b.type === 'TOWN_CENTER' || b.type === 'KEEP')) {
                const dist = Math.hypot(b.gridX - gx, b.gridY - gy);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = b;
                }
            }
        }

        return nearest;
    }

    /**
     * Gerçek zamanlı ekonomi güncellemeleri
     */
    update(deltaTime) {
        for (let worker of this.activeWorkers) {
            worker.update(deltaTime, this);
        }
    }
}

// Global olarak EconomySystem sınıfını bağla
window.Economy = new EconomySystem();
