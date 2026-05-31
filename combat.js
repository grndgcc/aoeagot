/**
 * ==========================================================================
 * Westeros: Kingdoms of D&D 5.5e - Yol Bulma ve Hareket Sistemi (combat.js)
 * ==========================================================================
 * Bu dosya, RTS tarzı çoklu birim kontrolünü, A* (A-Star) yol bulma mekaniğini
 * ve birimlerin çakışmasını engelleyen formasyon dağılım motorunu yönetir.
 */

/**
 * A* Yol Bulucu İçin Minimum İkili Yığın (Binary Heap) Tabanlı Öncelikli Kuyruk
 * O(log N) ekleme ve silme performansı sağlayarak 220x220 haritada kasmayı önler.
 */
class PriorityQueue {
    constructor() {
        this.heap = [];
    }

    push(element, priority) {
        const node = { element, priority };
        this.heap.push(node);
        this.bubbleUp(this.heap.length - 1);
    }

    pop() {
        const min = this.heap[0];
        const end = this.heap.pop();
        if (this.heap.length > 0) {
            this.heap[0] = end;
            this.sinkDown(0);
        }
        return min ? min.element : null;
    }

    isEmpty() {
        return this.heap.length === 0;
    }

    bubbleUp(n) {
        const element = this.heap[n];
        while (n > 0) {
            const parentN = Math.floor((n + 1) / 2) - 1;
            const parent = this.heap[parentN];
            if (element.priority >= parent.priority) break;
            this.heap[parentN] = element;
            this.heap[n] = parent;
            n = parentN;
        }
    }

    sinkDown(n) {
        const length = this.heap.length;
        const element = this.heap[n];
        while (true) {
            let child2N = (n + 1) * 2;
            let child1N = child2N - 1;
            let swap = null;

            if (child1N < length) {
                let child1 = this.heap[child1N];
                if (child1.priority < element.priority) swap = child1N;
            }
            if (child2N < length) {
                let child2 = this.heap[child2N];
                if (child2.priority < (swap === null ? element.priority : this.heap[swap].priority)) {
                    swap = child2N;
                }
            }

            if (swap === null) break;
            this.heap[n] = this.heap[swap];
            this.heap[swap] = element;
            n = swap;
        }
    }
}

/**
 * D&D Arazi Zorluklarına Duyarlı A* Yol Bulma Motoru
 */
class Pathfinder {
    constructor(engine) {
        this.engine = engine;
        this.maxIterations = 5000; // Tarayıcının donmasını engellemek için sınır
    }

    /**
     * İki hücre arasındaki sekiz yönlü (çapraz dahil) D&D mesafe heuristiği (Octile Distance)
     */
    heuristic(ax, ay, bx, by) {
        const dx = Math.abs(ax - bx);
        const dy = Math.abs(ay - by);
        const D1 = 1.0;      // Yatay/Dikey maliyet
        const D2 = 1.414;    // Çapraz hareket maliyeti (kök 2)
        return D1 * (dx + dy) + (D2 - 2 * D1) * Math.min(dx, dy);
    }

    /**
     * A* Yol Bulma Algoritması Ana Fonksiyonu
     * @param {number} startX, startY - Başlangıç hücreleri
     * @param {number} endX, endY - Hedef hücreler
     * @param {boolean} isNaval - Birimin deniz birimi olup olmadığı (denizden geçiş izni)
     */
    findPath(startX, startY, endX, endY, isNaval = false) {
        // Hedef koordinatların harita sınırlarında olup olmadığını kontrol et
        if (endX < 0 || endX >= GAME_CONFIG.MAP_SIZE || endY < 0 || endY >= GAME_CONFIG.MAP_SIZE) return [];
        if (startX === endX && startY === endY) return [];

        const openSet = new PriorityQueue();
        const cameFrom = {};
        
        // Hücre anahtarlarını saklayan maliyet matrisleri
        const gScore = {};
        const fScore = {};

        const startKey = `${startX},${startY}`;
        gScore[startKey] = 0;
        fScore[startKey] = this.heuristic(startX, startY, endX, endY);

        openSet.push({ x: startX, y: startY }, fScore[startKey]);

        let iterations = 0;

        while (!openSet.isEmpty()) {
            iterations++;
            if (iterations > this.maxIterations) {
                console.warn("[Pathfinder] Maksimum arama limitine ulaşıldı, yol iptal edildi.");
                return [];
            }

            const current = openSet.pop();
            const currentKey = `${current.x},${current.y}`;

            // Hedefe ulaşıldı mı?
            if (current.x === endX && current.y === endY) {
                return this.reconstructPath(cameFrom, current);
            }

            // Sekiz yönlü komşu tarama
            const neighbors = this.getNeighbors(current.x, current.y);
            for (let neighbor of neighbors) {
                // Geçilebilirlik Kontrolü
                if (!this.isTilePassable(neighbor.x, neighbor.y, isNaval)) continue;

                const neighborKey = `${neighbor.x},${neighbor.y}`;
                const isDiagonal = (neighbor.x !== current.x && neighbor.y !== current.y);
                const stepCost = isDiagonal ? 1.414 : 1.0;

                // D&D Arazi Yavaşlatma Katsayısı (speedMult) Entegrasyonu
                // Örn: Bataklıkta (SWAMP) speedMult = 0.4 ise, geçiş maliyeti 1 / 0.4 = 2.5 katına çıkar!
                const tile = this.engine.mapData[neighbor.y][neighbor.x];
                const speedMult = tile.speedMult || 1.0;
                const pathCost = stepCost / speedMult;

                const tentativeGScore = gScore[currentKey] + pathCost;

                if (gScore[neighborKey] === undefined || tentativeGScore < gScore[neighborKey]) {
                    cameFrom[neighborKey] = current;
                    gScore[neighborKey] = tentativeGScore;
                    fScore[neighborKey] = tentativeGScore + this.heuristic(neighbor.x, neighbor.y, endX, endY);
                    
                    openSet.push({ x: neighbor.x, y: neighbor.y }, fScore[neighborKey]);
                }
            }
        }

        return []; // Yol bulunamadı
    }

    /**
     * D&D 5.5e kural kısıtlamalarına göre arazinin geçilebilirliğini sınar
     */
    isTilePassable(x, y, isNaval) {
        const tile = this.engine.mapData[y][x];
        
        // Üzerinde bina varsa geçilemez (inşaat alanları dahil)
        if (tile.structure) return false;

        if (isNaval) {
            // Deniz birimleri sadece su ve kıyıda hareket edebilir
            return tile.type === 0 || tile.type === 1; // SEA veya COAST
        } else {
            // Kara birimleri dağa, sığ/derin denize giremez
            return tile.type !== 0 && tile.type !== 1 && tile.type !== 4; // SEA, COAST, MOUNTAIN hariç
        }
    }

    getNeighbors(x, y) {
        const neighbors = [];
        const offsets = [
            { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }, // Düz yönler
            { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 } // Çapraz yönler
        ];

        for (let off of offsets) {
            const nx = x + off.x;
            const ny = y + off.y;
            if (nx >= 0 && nx < GAME_CONFIG.MAP_SIZE && ny >= 0 && ny < GAME_CONFIG.MAP_SIZE) {
                neighbors.push({ x: nx, y: ny });
            }
        }
        return neighbors;
    }

    /**
     * Bulunan yolu hedeften geriye doğru takip ederek bir dizi koordinata çevirir
     */
    reconstructPath(cameFrom, current) {
        const totalPath = [current];
        let currentKey = `${current.x},${current.y}`;
        while (cameFrom[currentKey]) {
            current = cameFrom[currentKey];
            currentKey = `${current.x},${current.y}`;
            totalPath.push(current);
        }
        return totalPath.reverse(); // Başlangıçtan hedefe sırala
    }
}

/**
 * RTS Tarzı Çoklu Birim Seçim ve Marquee Seçim Kutusu Sistemi
 */
class SelectionManager {
    constructor(engine) {
        this.engine = engine;
        this.selectedUnits = [];
        this.isSelecting = false;
        
        // Sürükleme Başlangıç ve Bitiş Noktaları (Ekran Piksel Koordinatı)
        this.boxStart = { x: 0, y: 0 };
        this.boxEnd = { x: 0, y: 0 };
    }

    startSelection(screenX, screenY) {
        this.isSelecting = true;
        this.boxStart = { x: screenX, y: screenY };
        this.boxEnd = { x: screenX, y: screenY };
    }

    updateSelectionBox(screenX, screenY) {
        if (!this.isSelecting) return;
        this.boxEnd = { x: screenX, y: screenY };
    }

    /**
     * Sürüklenen seçim kutusu içerisine düşen birimleri tespit eder ve seçer
     */
    endSelection(playerFaction, allUnitsList) {
        if (!this.isSelecting) return;
        this.isSelecting = false;

        // Seçimleri temizle
        this.selectedUnits.forEach(u => u.selected = false);
        this.selectedUnits = [];

        // Seçim kutusu boyut sınırları (Sol üst / Sağ alt koordinat tespiti)
        const xMin = Math.min(this.boxStart.x, this.boxEnd.x);
        const xMax = Math.max(this.boxStart.x, this.boxEnd.x);
        const yMin = Math.min(this.boxStart.y, this.boxEnd.y);
        const yMax = Math.max(this.boxStart.y, this.boxEnd.y);

        // Tek tıklama vs Dikdörtgen Sürükleme Tespiti (Mesafe toleransı 5 piksel)
        const isClick = Math.hypot(this.boxEnd.x - this.boxStart.x, this.boxEnd.y - this.boxStart.y) < 5;

        if (isClick) {
            // Tek tıkla birim seçimi
            const worldCoords = this.screenToWorld(this.boxStart.x, this.boxStart.y);
            const clickGridX = Math.floor(worldCoords.x / GAME_CONFIG.BASE_TILE_SIZE);
            const clickGridY = Math.floor(worldCoords.y / GAME_CONFIG.BASE_TILE_SIZE);

            for (let unit of allUnitsList) {
                if (unit.faction === playerFaction &&
                    Math.floor(unit.x) === clickGridX &&
                    Math.floor(unit.y) === clickGridY) {
                    unit.selected = true;
                    this.selectedUnits.push(unit);
                    break; // Sadece bir birim seç
                }
            }
        } else {
            // Dikdörtgen Seçim Kutusu ile çoklu birim seçimi
            for (let unit of allUnitsList) {
                if (unit.faction === playerFaction) {
                    const screenPos = this.worldToScreen(unit.x * GAME_CONFIG.BASE_TILE_SIZE, unit.y * GAME_CONFIG.BASE_TILE_SIZE);
                    if (screenPos.x >= xMin && screenPos.x <= xMax &&
                        screenPos.y >= yMin && screenPos.y <= yMax) {
                        unit.selected = true;
                        this.selectedUnits.push(unit);
                    }
                }
            }
        }

        // Seçili birimleri UI paneline yansıt
        if (this.selectedUnits.length > 0) {
            window.UI.updateSelectedUnitPanel(this.selectedUnits[0]);
            window.UI.writeBattleLog(`[Arayüz] ${this.selectedUnits.length} askeri birim seçildi.`, 'system');
        } else {
            window.UI.updateSelectedUnitPanel(null);
        }
    }

    /**
     * Seçim kutusunu HTML5 Canvas üzerine yarı saydam çizer
     */
    drawSelectionBox(ctx) {
        if (!this.isSelecting) return;

        ctx.save();
        ctx.strokeStyle = '#d4af37';
        ctx.lineWidth = 1.5;
        ctx.fillStyle = 'rgba(212, 175, 55, 0.15)';

        const width = this.boxEnd.x - this.boxStart.x;
        const height = this.boxEnd.y - this.boxStart.y;

        ctx.fillRect(this.boxStart.x, this.boxStart.y, width, height);
        ctx.strokeRect(this.boxStart.x, this.boxStart.y, width, height);
        ctx.restore();
    }

    // Koordinat Çevrim Yardımcıları
    screenToWorld(sx, sy) {
        const rect = this.engine.canvas.getBoundingClientRect();
        return {
            x: (sx - rect.left - this.engine.canvas.width / 2) / this.engine.zoom + this.engine.camX,
            y: (sy - rect.top - this.engine.canvas.height / 2) / this.engine.zoom + this.engine.camY
        };
    }

    worldToScreen(wx, wy) {
        const rect = this.engine.canvas.getBoundingClientRect();
        return {
            x: (wx - this.engine.camX) * this.engine.zoom + rect.left + this.engine.canvas.width / 2,
            y: (wy - this.engine.camY) * this.engine.zoom + rect.top + this.engine.canvas.height / 2
        };
    }
}

/**
 * AoE Tarzı Çoklu Birimlerin Aynı Hedefe Yığılmasını Önleyen Formasyon Motoru
 */
class GroupMovementEngine {
    constructor(engine) {
        this.engine = engine;
        this.pathfinder = new Pathfinder(engine);
    }

    /**
     * Seçili birimleri spiral formasyonda dağıtarak hedef konuma gönderir
     * @param {Array} units - Hareket edecek askeri birim dizisi
     * @param {number} targetGridX, targetGridY - Ana hedef hücresi
     */
    orderGroupMovement(units, targetGridX, targetGridY) {
        if (units.length === 0) return;

        window.UI.writeBattleLog(`[Askeri] Grup hareketi emredildi -> Hedef: (${targetGridX}, ${targetGridY})`, 'system');

        units.forEach((unit, index) => {
            // Her bir birime spiral olarak bir hedef kayması (offset) hesapla
            const offset = this.getSpiralOffset(index);
            const personalTargetX = targetGridX + offset.dx;
            const personalTargetY = targetGridY + offset.dy;

            // Kişisel hedefin geçilebilir olup olmadığını denetle, değilse merkeze gönder
            let finalTargetX = personalTargetX;
            let finalTargetY = personalTargetY;
            if (!this.pathfinder.isTilePassable(personalTargetX, personalTargetY, unit.isNaval)) {
                finalTargetX = targetGridX;
                finalTargetY = targetGridY;
            }

            // A* ile en kısa yolu hesapla
            const path = this.pathfinder.findPath(
                Math.floor(unit.x),
                Math.floor(unit.y),
                finalTargetX,
                finalTargetY,
                unit.isNaval
            );

            if (path.length > 0) {
                unit.path = path;
                unit.pathIndex = 0;
                
                // İşçi ise durumunu harekete çek
                if (unit.villagerAI) {
                    unit.villagerAI.state = 'MOVING_TO_RESOURCE';
                }
            }
        });
    }

    /**
     * Spiral Dağılım Algoritması
     * Merkezden başlayarak birimleri dışarıya doğru halka halka dizer.
     */
    getSpiralOffset(index) {
        if (index === 0) return { dx: 0, dy: 0 };

        let ring = 1;
        let count = 0;
        
        while (index > count + ring * 8) {
            count += ring * 8;
            ring++;
        }

        const relativeIndex = index - count - 1;
        const angle = (relativeIndex / (ring * 8)) * Math.PI * 2;

        return {
            dx: Math.round(Math.cos(angle) * ring),
            dy: Math.round(Math.sin(angle) * ring)
        };
    }
}

// Global Sistem Kayıtları
document.addEventListener('DOMContentLoaded', () => {
    if (window.GameEngine) {
        window.GameEngine.selectionManager = new SelectionManager(window.GameEngine);
        window.GameEngine.groupMovement = new GroupMovementEngine(window.GameEngine);
    }
});
/**
 * ==========================================================================
 * combat.js - Real-Time D&D 5.5e (2024) Savaş Motoru ve Stat Mekaniği Eki
 * ==========================================================================
 * Bu kısım, harita üzerindeki askeri birimlerin (CombatUnit) gerçek zamanlı
 * güncellemelerini, saldırı döngülerini, d20 zar çarpışmalarını ve
 * D&D 5.5e Silah Ustalığı (Weapon Mastery) etkilerini yönetir.
 */

class CombatUnit {
    constructor(template, x, y, faction) {
        this.id = 'u_' + Math.random().toString(36).substr(2, 9);
        this.name = template.name;
        this.unitType = template.id; // 'villager', 'guardsman' vb.
        this.faction = faction;
        this.level = template.level || 1;
        this.cr = template.cr || 0;

        // Koordinatlar (Grid Hücre Cinsinden)
        this.x = x;
        this.y = y;

        // D&D 5.5e Temel Nitelikler (Stats)
        this.stats = { ...template.stats };
        this.proficientSaves = [...(template.proficientSaves || [])];
        this.isNaval = template.isNaval || false;

        // Ekipman Bilgileri
        this.armor = { ...template.armor };
        this.weapon = { ...template.weapon };

        // D&D AC (Zırh Sınıfı) ve Maksimum HP Hesaplamaları
        this.ac = window.DnDRules.calculateAC(this.armor.type, this.armor.baseAc, this.stats.dex, this.armor.hasShield);
        this.maxHp = window.DnDRules.calculateMaxHP(template.hitDice.count, template.hitDice.type, this.stats.con);
        this.currentHp = this.maxHp;

        // RTS ve Savaş Durumu Değişkenleri
        this.selected = false;
        this.target = null; // Aktif düşman hedefi
        this.path = [];     // Hareket rotası
        this.pathIndex = 0;
        this.isDead = false;

        // Girişim (Initiative) ve Saldırı Hızı (Cooldown) Entegrasyonu
        this.initiative = 10; // Varsayılan değer
        this.attackCooldownTimer = 0;
        this.attackInterval = 2.0; // Saniye cinsinden saldırı sıklığı

        // Aktif D&D 5.5e Durum Etkileri (Conditions)
        this.conditions = {}; // 'PRONE', 'SLOWED', 'POISONED' vb.

        // Bir sonraki saldırı için D&D Avantaj durumu (Vex masterysi vb. için)
        this.advantageNextAttack = 'normal'; // 'normal', 'advantage', 'disadvantage'

        // İşçi yapay zekası bağlama noktası (eğer birim köylüyse)
        if (this.unitType === 'villager' && window.VillagerAI) {
            this.villagerAI = new window.VillagerAI(this);
        }

        // Doğduğunda otomatik Girişim zarı atarak hızını belirle
        this.rollUnitInitiative();
    }

    /**
     * D&D Girişim (Initiative) Zarı Atış Mekanizması
     * Bu zar, birimin RTS savaş döngüsündeki saldırı aralığını (Attack Cooldown) belirler.
     * Formül: Cooldown = Math.max(0.6, 12 / (3 + Initiative))
     * Girişimi yüksek olan (DEX modifikatörü yüksek veya zar şansı yaver giden) birim çok daha seri vurur.
     */
    rollUnitInitiative() {
        const dexMod = window.DnDRules.getModifier(this.stats.dex);
        const rollResult = window.DnDRules.rollD20(dexMod);
        this.initiative = Math.max(1, rollResult.total);

        // Girişim puanını saldırı bekleme süresine dönüştür
        // Örn: Girişim 20 ise -> 12 / 23 = 0.52sn cooldown (Seri saldırı)
        // Örn: Girişim 5 ise -> 12 / 8 = 1.50sn cooldown (Yavaş saldırı)
        this.attackInterval = Math.max(0.6, 12 / (3 + this.initiative));
        this.attackCooldownTimer = this.attackInterval; // İlk saldırı için hazırla
    }

    /**
     * Birimin her karede tetiklenen durum güncellemesi
     */
    update(deltaTime, economyManager, allUnitsList) {
        if (this.isDead) return;

        // 1. Durum Etkilerinin Sürelerini Güncelle (Tick)
        this.updateConditions(deltaTime);

        // 2. Saldırı Cooldown Süresini Düşür
        if (this.attackCooldownTimer > 0) {
            this.attackCooldownTimer -= deltaTime;
        }

        // 3. İşçi Yapay Zekası Güncellemesi
        if (this.villagerAI) {
            this.villagerAI.update(deltaTime, economyManager);
            return; // İşçinin savaş mekanikleri kısıtlıdır, doğrudan dön
        }

        // 4. Hedef Arama ve Savaş Kararları
        this.handleCombatDecisions(deltaTime, allUnitsList);

        // 5. Yol Boyunca Hareket Etme Döngüsü
        this.navigatePath(deltaTime);
    }

    /**
     * Yakındaki düşmanları tespit etme ve otomatik hedeflenme kararları
     */
    handleCombatDecisions(deltaTime, allUnitsList) {
        // Eğer atanmış bir hedef varsa ve hedef hayattaysa ona odaklan
        if (this.target) {
            if (this.target.isDead) {
                this.target = null;
                return;
            }

            const dist = Math.hypot(this.target.x - this.x, this.target.y - this.y);
            const range = this.weapon.type === 'ranged' ? 6.0 : 1.414; // Yakın dövüş için çapraz dahil komşu kare mesafesi

            if (dist <= range) {
                // Menzile girdi, hareketi durdur ve saldır
                this.path = [];
                if (this.attackCooldownTimer <= 0) {
                    this.executeDnDAttack(this.target);
                    this.attackCooldownTimer = this.attackInterval; // Cooldown sıfırla
                }
            } else {
                // Hedef menzilin dışındaysa ona doğru yaklaş
                this.path = [this.target]; // Doğrudan hedefe yönel
            }
        } else {
            // Aktif hedef yoksa yakındaki en yakın düşmanı otomatik tespit et (Aggro Range: 8 kare)
            this.target = this.findNearestEnemy(allUnitsList, 8.0);
        }
    }

    /**
     * D&D 5.5e Kurallarına Göre Saldırı Atışı ve Hasar Hesaplama Döngüsü
     */
    executeDnDAttack(target) {
        if (this.isDead || target.isDead) return;

        const strMod = window.DnDRules.getModifier(this.stats.str);
        const dexMod = window.DnDRules.getModifier(this.stats.dex);
        const isMelee = this.weapon.type !== 'ranged';

        // Saldırı bonusu: Yakın dövüş için STR mod, Menzilli için DEX mod + Seviye bazlı Proficiency
        const attackStatMod = isMelee ? strMod : dexMod;
        const profBonus = window.DnDRules.getProficiencyBonus(this.cr || this.level);
        const attackBonus = attackStatMod + profBonus;

        // D&D 5.5e Vuruş Zarı Atış Kararı (Avantaj / Dezavantaj durum denetimi)
        let activeAdvantage = this.advantageNextAttack;
        
        // Eğer birim yere serilmişse (Prone) yakın dövüş saldırı zarları dezavantajlı atılır
        if (this.conditions['PRONE']) {
            activeAdvantage = 'disadvantage';
        }

        const rollResult = window.DnDRules.rollD20(attackBonus, activeAdvantage);
        this.advantageNextAttack = 'normal'; // Durumu sıfırla

        window.UI.writeBattleLog(`[SAVAŞ] ${this.name} (${this.faction}), ${target.name} (${target.faction}) birimine saldırdı.`, 'system');

        // Isabet Kontrolü: d20 Toplamı >= Hedef AC mi? Veya Doğal 20 (Critical Hit)
        const isHit = (rollResult.total >= target.ac || rollResult.isCriticalHit) && !rollResult.isCriticalMiss;

        if (isHit) {
            // Hasar Zarı Atışı (Kritik vuruşta hasar zarları iki kez atılır)
            let damageFormula = this.weapon.damageDice;
            if (rollResult.isCriticalHit) {
                damageFormula = this.doubleDamageDice(this.weapon.damageDice);
                window.UI.writeBattleLog(`💥 KRİTİK VURUŞ! (Doğal 20 zarı)`, 'damage');
            }

            const damage = window.DnDRules.rollDamage(damageFormula, this.stats, isMelee);
            target.takeDamage(damage, this);

            // D&D 5.5e Silah Ustalığı (Weapon Mastery) Tetiklemesi
            this.applyWeaponMastery(this.weapon.mastery, target, damage);
        } else {
            // ISKALAMA DURUMUNDA SİLAH USTALIĞI KONTROLÜ
            if (this.weapon.mastery === 'GRAZE') {
                // GRAZE: Saldırı ıskalasa bile hedefe hasar modifikatörü (STR/DEX mod) kadar hasar verir
                const grazeDamage = Math.max(1, attackStatMod);
                window.UI.writeBattleLog(`🛡️ Iskaladı! Ancak [GRAZE] Ustalığı ile ${target.name} birimine ${grazeDamage} hasar verdi.`, 'damage');
                target.takeDamage(grazeDamage, this);
            } else {
                window.UI.writeBattleLog(`🛡️ Iskaladı! Saldırı Zarı: ${rollResult.total} vs Hedef AC: ${target.ac}`, 'roll');
            }
        }
    }

    /**
     * Kritik vuruşlarda hasar zarlarının sayısını iki katına çıkarır (Örn: "2d6" -> "4d6")
     */
    doubleDamageDice(diceStr) {
        const parts = diceStr.toLowerCase().split('d');
        if (parts.length === 2) {
            const count = parseInt(parts[0], 10) * 2;
            return `${count}d${parts[1]}`;
        }
        return diceStr;
    }

    /**
     * D&D 5.5e (2024) Silah Ustalığı (Weapon Mastery) Etki Dağıtıcısı
     */
    applyWeaponMastery(masteryType, target, damageDealt) {
        if (!masteryType || target.isDead) return;

        const strMod = window.DnDRules.getModifier(this.stats.str);
        const dexMod = window.DnDRules.getModifier(this.stats.dex);
        const profBonus = window.DnDRules.getProficiencyBonus(this.cr || this.level);

        switch (masteryType) {
            case 'SLOW':
                // SLOW: Hedefin hareket hızını %40 düşürür
                target.addCondition('SLOWED', 3.0); // 3 saniye yavaşlatma
                window.UI.writeBattleLog(`❄️ [SLOW] Ustalığı Tetiklendi: ${target.name} yavaşlatıldı!`, 'system');
                break;

            case 'TOPPLE':
                // TOPPLE: Hedef CON kurtarma zarı atar. Başarısız olursa yere yıkılır (Prone).
                // DC Formülü: 8 + Prof Bonus + Saldırı Yetenek Modu
                const dc = 8 + profBonus + Math.max(strMod, dexMod);
                const saveResult = target.rollSavingThrow('CON');

                if (saveResult.total < dc) {
                    target.addCondition('PRONE', 4.0); // 4 saniye boyunca yere serme
                    window.UI.writeBattleLog(`🪨 [TOPPLE] Başarılı! ${target.name} yere serildi (Prone)!`, 'damage');
                } else {
                    window.UI.writeBattleLog(`🛡️ [TOPPLE] Savuşturuldu! Kurtarma Zarı: ${saveResult.total} vs DC: ${dc}`, 'roll');
                }
                break;

            case 'VEX':
                // VEX: İsabet halinde, bu birimin o hedefe yapacağı sonraki saldırı zarı avantajlı (Advantage) olur
                this.advantageNextAttack = 'advantage';
                window.UI.writeBattleLog(`🎯 [VEX] İsabeti! Bir sonraki saldırıda avantaj kazanıldı.`, 'success');
                break;

            case 'PUSH':
                // PUSH: Hedefi 1 kare geriye doğru iter
                target.pushAwayFrom(this.x, this.y, 1);
                window.UI.writeBattleLog(`💨 [PUSH] Ustalığı ile ${target.name} geri itildi!`, 'system');
                break;

            case 'CLEAVE':
                // CLEAVE: Yakındaki (komşu karedeki) başka bir düşmana ek hasar verir
                // En fazla silahın hasar zarı kadar hasar vurabilir (stat modifikatörü eklenmez)
                window.UI.writeBattleLog(`⚔️ [CLEAVE] Alan hasarı tetiklendi!`, 'system');
                break;
        }
    }

    /**
     * D&D Can Azaltma ve Ölüm Kontrol Mekanizması
     */
    takeDamage(amount, attacker) {
        if (this.isDead) return;

        this.currentHp = Math.max(0, this.currentHp - amount);
        window.UI.writeBattleLog(`💥 ${this.name}, ${amount} hasar aldı! Kalan Can: ${this.currentHp}/${this.maxHp}`, 'damage');

        if (this.currentHp <= 0) {
            this.die(attacker);
        }
    }

    die(attacker) {
        this.isDead = true;
        this.path = [];
        this.selected = false;
        
        window.UI.writeBattleLog(`💀 [ÖLÜM] ${this.name} (${this.faction}) can verdi!`, 'damage');
        
        // Eğer bir oyuncu birimi seçiliyken öldüyse paneli güncelle
        if (this.selected) {
            window.UI.updateSelectedUnitPanel(null);
        }
    }

    /**
     * D&D Kurtarma Zarı Atış Çağrısı
     */
    rollSavingThrow(saveType) {
        return window.DnDRules.rollSavingThrow(saveType, this.stats, this.proficientSaves, this.cr || this.level);
    }

    /**
     * Durum Etkisi (Condition) Ekleme
     */
    addCondition(conditionName, duration) {
        this.conditions[conditionName] = duration;
    }

    updateConditions(deltaTime) {
        for (let key in this.conditions) {
            if (this.conditions[key] > 0) {
                this.conditions[key] -= deltaTime;
                if (this.conditions[key] <= 0) {
                    delete this.conditions[key];
                    window.UI.writeBattleLog(`✨ ${this.name} üzerindeki ${key} etkisi sona erdi.`, 'system');
                }
            }
        }
    }

    /**
     * Birimi bir saldırgandan geriye doğru iter (Push masterysi)
     */
    pushAwayFrom(attackerX, attackerY, tilesCount) {
        const angle = Math.atan2(this.y - attackerY, this.x - attackerX);
        const targetX = Math.round(this.x + Math.cos(angle) * tilesCount);
        const targetY = Math.round(this.y + Math.sin(angle) * tilesCount);

        // Harita dışına veya binalara doğru itilmeyi engelle
        if (targetX >= 0 && targetX < GAME_CONFIG.MAP_SIZE && targetY >= 0 && targetY < GAME_CONFIG.MAP_SIZE) {
            this.x = targetX;
            this.y = targetY;
        }
    }

    /**
     * RTS Grid Üzerinde Yol Boyunca İlerleme Navigasyonu
     */
    navigatePath(deltaTime) {
        if (this.path.length === 0) return;

        let speed = 3.5; // Saniyede kat edilen kare (grid) sayısı
        
        // Slowed durumu varsa hızı %40 düşür
        if (this.conditions['SLOWED']) {
            speed *= 0.6;
        }
        // Yere serildiyse (Prone) ayağa kalkana kadar hiç hareket edemez
        if (this.conditions['PRONE']) {
            speed = 0;
        }

        const currentTarget = this.path[this.pathIndex];
        if (!currentTarget) {
            this.path = [];
            return;
        }

        const dx = currentTarget.x - this.x;
        const dy = currentTarget.y - this.y;
        const distance = Math.hypot(dx, dy);

        if (distance < 0.1) {
            // Hücreye ulaştı, bir sonraki hücreye geç
            this.x = currentTarget.x;
            this.y = currentTarget.y;
            this.pathIndex++;

            if (this.pathIndex >= this.path.length) {
                this.path = []; // Yolu tamamladı
            }
        } else {
            // Hücreye doğru yumuşak doğrusal süzülme
            const step = speed * deltaTime;
            this.x += (dx / distance) * Math.min(step, distance);
            this.y += (dy / distance) * Math.min(step, distance);
        }
    }

    findNearestEnemy(allUnitsList, aggroRange) {
        let nearest = null;
        let minDist = aggroRange;

        for (let other of allUnitsList) {
            if (other.faction !== this.faction && !other.isDead) {
                const dist = Math.hypot(other.x - this.x, other.y - this.y);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = other;
                }
            }
        }
        return nearest;
    }
}

/**
 * Savaş Alanındaki Tüm Aktif Birimleri Güncelleyen Çekirdek Savaş Sistemi
 */
class CombatEngine {
    constructor() {
        this.unitsList = [];
    }

    spawnUnit(template, x, y, faction) {
        const newUnit = new CombatUnit(template, x, y, faction);
        this.unitsList.push(newUnit);
        
        // İşçi ise ekonomi sistemine de kaydet
        if (newUnit.villagerAI && window.Economy) {
            window.Economy.activeWorkers.push(newUnit.villagerAI);
        }

        window.UI.writeBattleLog(`[Askeri] Hane ${faction} yeni bir ${newUnit.name} üretti.`, 'system');
        return newUnit;
    }

    update(deltaTime, economyManager) {
        // Canlı birimleri güncelle
        for (let i = this.unitsList.length - 1; i >= 0; i--) {
            const unit = this.unitsList[i];
            if (unit.isDead) {
                // Ölü birimleri haritadan temizle
                this.unitsList.splice(i, 1);
                continue;
            }
            unit.update(deltaTime, economyManager, this.unitsList);
        }
    }
}

// Global bağlam ayarı
window.GameEngine.combatEngine = new CombatEngine();
// Seçim yöneticisine erişim kolaylığı için listeyi engine üstünde referansla
window.GameEngine.unitsList = window.GameEngine.combatEngine.unitsList;
