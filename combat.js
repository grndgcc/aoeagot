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
