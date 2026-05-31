/**
 * ==========================================================================
 * Westeros: Kingdoms of D&D 5.5e - Oyun Döngüsü ve Render Motoru (engine.js)
 * ==========================================================================
 * Bu dosya, HTML5 Canvas render döngüsünü yönetir. Viewport Culling tekniği ile
 * dev harita üzerinde sadece kameraya yansıyan alanı çizerek performansı korur.
 */

class GameEngine {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.minimapCanvas = null;
        this.minimapCtx = null;
        
        // Harita ve Coğrafi Veri Deposu
        this.mapData = null;
        
        // Kamera ve Viewport Durum Değişkenleri
        this.tileSize = GAME_CONFIG.BASE_TILE_SIZE;
        this.zoom = GAME_CONFIG.INITIAL_ZOOM;
        this.camX = 0; // Kamera merkez koordinatları
        this.camY = 0;
        
        // Fare ve Dokunmatik Sürükleme Durumları
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.camStart = { x: 0, y: 0 };

        // Parçacık Tabanlı Atmosferik Hava Durumu Sistemi
        this.weatherSystem = null;

        this.lastFrameTime = 0;
    }

    /**
     * Motoru başlatan ana metod
     */
    init(selectedFaction) {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.minimapCanvas = document.getElementById('minimapCanvas');
        this.minimapCtx = this.minimapCanvas.getContext('2d');

        // Harita Verisini Çek / Üret
        this.mapData = window.WesterosGenerator.generate();

        // Kamera Başlangıç Pozisyonunu Seçili Ülkeye Göre Odakla
        const factionInfo = GAME_CONFIG.FACTIONS[selectedFaction];
        if (factionInfo) {
            this.focusCameraOnTile(factionInfo.startX, factionInfo.startY);
        } else {
            this.focusCameraOnTile(110, 110); // Orta Westeros varsayılan odak
        }

        // Ekran ve Canvas Boyutlarını Ayarla
        this.resizeCanvas();
        
        // Giriş ve Fare Dinleyicilerini Kur
        this.setupInputHandlers();

        // Hava Durumu Sistemini Başlat
        this.weatherSystem = new WeatherSystem(this);

        // İlk Seferlik Mini Haritayı Çiz (Statik Arka Plan Olarak)
        this.renderMinimap();

        // Ana Çizim Döngüsünü Tetikle (Loop)
        this.lastFrameTime = performance.now();
        requestAnimationFrame((time) => this.gameLoop(time));
    }

    /**
     * Canvas boyutlarını ana konteynere sığdıracak şekilde günceller
     */
    resizeCanvas() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        
        // Mini harita oran ayarlaması
        this.minimapCanvas.width = this.minimapCanvas.parentElement.clientWidth;
        this.minimapCanvas.height = this.minimapCanvas.parentElement.clientHeight;
    }

    /**
     * Kamerayı belirli bir harita karesine merkezler
     */
    focusCameraOnTile(tileX, tileY) {
        this.camX = tileX * this.tileSize;
        this.camY = tileY * this.tileSize;
        this.updateCoordinatesUI(tileX, tileY);
    }

    /**
     * Fare, Kaydırma Tekerleği ve Dokunmatik Kamera Hareketleri
     */
    setupInputHandlers() {
        // Fare ile sürükleyerek harita taşıma
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Sol tık
                this.isDragging = true;
                this.dragStart.x = e.clientX;
                this.dragStart.y = e.clientY;
                this.camStart.x = this.camX;
                this.camStart.y = this.camY;
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const deltaX = (e.clientX - this.dragStart.x) / this.zoom;
                const deltaY = (e.clientY - this.dragStart.y) / this.zoom;
                this.camX = this.camStart.x - deltaX;
                this.camY = this.camStart.y - deltaY;
                
                this.clampCamera();
            }
        });

        window.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        // Zoom Kontrolü (Kaydırma Tekerleği)
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomFactor = 1.1;
            let newZoom = this.zoom;

            if (e.deltaY < 0) {
                newZoom *= zoomFactor; // Yakınlaştır
            } else {
                newZoom /= zoomFactor; // Uzaklaştır
            }

            // Sınırlandırma
            this.zoom = Math.max(GAME_CONFIG.MIN_ZOOM, Math.min(GAME_CONFIG.MAX_ZOOM, newZoom));
            this.clampCamera();
        }, { passive: false });
    }

    /**
     * Kameranın harita sınırları dışına çıkmasını engeller
     */
    clampCamera() {
        const totalMapPixels = GAME_CONFIG.MAP_SIZE * this.tileSize;
        const maxCamX = totalMapPixels - (this.canvas.width / (2 * this.zoom));
        const minCamX = this.canvas.width / (2 * this.zoom);
        const maxCamY = totalMapPixels - (this.canvas.height / (2 * this.zoom));
        const minCamY = this.canvas.height / (2 * this.zoom);

        this.camX = Math.max(minCamX, Math.min(maxCamX, this.camX));
        this.camY = Math.max(minCamY, Math.min(maxCamY, this.camY));

        // Koordinat göstergelerini güncelle
        const currentTileX = Math.floor(this.camX / this.tileSize);
        const currentTileY = Math.floor(this.camY / this.tileSize);
        this.updateCoordinatesUI(currentTileX, currentTileY);
    }

    updateCoordinatesUI(tx, ty) {
        const domX = document.getElementById('cam-x');
        const domY = document.getElementById('cam-y');
        if (domX && domY) {
            domX.innerText = Math.max(0, Math.min(GAME_CONFIG.MAP_SIZE - 1, tx));
            domY.innerText = Math.max(0, Math.min(GAME_CONFIG.MAP_SIZE - 1, ty));
        }
    }

    /**
     * 60 FPS Kararlılığında Çalışan Ana Oyun Döngüsü
     */
    gameLoop(currentTime) {
        const deltaTime = (currentTime - this.lastFrameTime) / 1000; // Saniye cinsinden
        this.lastFrameTime = currentTime;

        this.update(deltaTime);
        this.render();

        requestAnimationFrame((time) => this.gameLoop(time));
    }

    /**
     * Mantıksal Güncellemeler (Hava durumu, animasyon kareleri vb.)
     */
    update(deltaTime) {
        if (this.weatherSystem) {
            this.weatherSystem.update(deltaTime);
        }
    }

    /**
     * Ekrana Çizim Yapan Ana Metod (Viewport Culling Uygulanır)
     */
    render() {
        // Ekranı temizle
        this.ctx.fillStyle = '#05070a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.save();
        // Kamera Ofsetlerini ve Zoom Çarpanını Uygula
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.scale(this.zoom, this.zoom);
        this.ctx.translate(-this.camX, -this.camY);

        // Viewport Culling: Sadece ekrana düşen tile indeks aralıklarını belirleme
        const curTileSize = this.tileSize;
        
        // Sol üst köşe koordinatlarının harita karesi karşılığı
        const startX = Math.floor((this.camX - (this.canvas.width / 2) / this.zoom) / curTileSize);
        const startY = Math.floor((this.camY - (this.canvas.height / 2) / this.zoom) / curTileSize);
        
        // Sağ alt köşe koordinatlarının harita karesi karşılığı
        const endX = Math.ceil((this.camX + (this.canvas.width / 2) / this.zoom) / curTileSize);
        const endY = Math.ceil((this.camY + (this.canvas.height / 2) / this.zoom) / curTileSize);

        // Sınır Güvenliği (Clamp)
        const renderStartX = Math.max(0, startX);
        const renderStartY = Math.max(0, startY);
        const renderEndX = Math.min(GAME_CONFIG.MAP_SIZE - 1, endX);
        const renderEndY = Math.min(GAME_CONFIG.MAP_SIZE - 1, endY);

        // 1. Harita Karelerini Çiz
        for (let y = renderStartY; y <= renderEndY; y++) {
            for (let x = renderStartX; x <= renderEndX; x++) {
                const tile = this.mapData[y][x];
                this.ctx.fillStyle = tile.color;
                this.ctx.fillRect(x * curTileSize, y * curTileSize, curTileSize + 0.5, curTileSize + 0.5); // Grid sızıntısını önlemek için +0.5 piksel bindirme
                
                // Belirli yaklaşımlarda (Zoom > 1.2) hafif grid çizgileri çizimi
                if (this.zoom > 1.2) {
                    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
                    this.ctx.lineWidth = 0.5;
                    this.ctx.strokeRect(x * curTileSize, y * curTileSize, curTileSize, curTileSize);
                }
            }
        }

        // 2. Hava Durumu Parçacıklarının Çizilmesi
        if (this.weatherSystem) {
            this.weatherSystem.render(this.ctx);
        }

        this.ctx.restore();

        // 3. Mini Haritada Görüş Çerçevesini Güncelle
        this.drawMinimapViewportIndicator(renderStartX, renderStartY, renderEndX, renderEndY);
    }

    /**
     * Sol alt paneldeki Mini haritayı tam ölçekte (220x220 piksel) bir kez çizip önbelleğe alır
     */
    renderMinimap() {
        const mmW = this.minimapCanvas.width;
        const mmH = this.minimapCanvas.height;
        const scaleX = mmW / GAME_CONFIG.MAP_SIZE;
        const scaleY = mmH / GAME_CONFIG.MAP_SIZE;

        this.minimapCtx.clearRect(0, 0, mmW, mmH);

        for (let y = 0; y < GAME_CONFIG.MAP_SIZE; y++) {
            for (let x = 0; x < GAME_CONFIG.MAP_SIZE; x++) {
                const tile = this.mapData[y][x];
                this.minimapCtx.fillStyle = tile.minimapColor;
                this.minimapCtx.fillRect(x * scaleX, y * scaleY, scaleX + 0.2, scaleY + 0.2);
            }
        }

        // Mini harita önbelleği saklanır
        this.minimapCache = this.minimapCtx.getImageData(0, 0, mmW, mmH);
    }

    /**
     * Mini harita üzerinde kameranın o an gördüğü alanı gösteren kırmızı bir çerçeve çizer
     */
    drawMinimapViewportIndicator(sX, sY, eX, eY) {
        if (!this.minimapCache) return;

        // Önbellekten temiz harita görselini geri yükle
        this.minimapCtx.putImageData(this.minimapCache, 0, 0);

        const mmW = this.minimapCanvas.width;
        const mmH = this.minimapCanvas.height;
        const scaleX = mmW / GAME_CONFIG.MAP_SIZE;
        const scaleY = mmH / GAME_CONFIG.MAP_SIZE;

        // Çerçeve sınırlarını çiz
        this.minimapCtx.strokeStyle = GAME_CONFIG.FACTIONS[window.UI.selectedFaction]?.primaryColor || '#d4af37';
        this.minimapCtx.lineWidth = 1.5;
        this.minimapCtx.strokeRect(
            sX * scaleX,
            sY * scaleY,
            (eX - sX) * scaleX,
            (eY - sY) * scaleY
        );
    }
}

/**
 * Westeros'un Bölgesel Hava Durumu Simülasyonu
 */
class WeatherSystem {
    constructor(engine) {
        this.engine = engine;
        this.particles = [];
        this.maxParticles = 150;
        this.initParticles();
    }

    initParticles() {
        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push(this.createParticle(true));
        }
    }

    createParticle(randomY = false) {
        const mapPixels = GAME_CONFIG.MAP_SIZE * GAME_CONFIG.BASE_TILE_SIZE;
        return {
            x: Math.random() * mapPixels,
            y: randomY ? Math.random() * mapPixels : -10,
            speedY: 20 + Math.random() * 40,
            speedX: (Math.random() - 0.5) * 15,
            size: 1 + Math.random() * 3,
            opacity: 0.2 + Math.random() * 0.6
        };
    }

    update(deltaTime) {
        const mapPixels = GAME_CONFIG.MAP_SIZE * GAME_CONFIG.BASE_TILE_SIZE;
        for (let p of this.particles) {
            p.y += p.speedY * deltaTime;
            p.x += p.speedX * deltaTime;

            // Harita sınırları dışına çıkanları tekrar tepede canlandır
            if (p.y > mapPixels || p.x < 0 || p.x > mapPixels) {
                Object.assign(p, this.createParticle(false));
            }
        }
    }

    render(ctx) {
        for (let p of this.particles) {
            // Sadece kameranın gördüğü alana yakın hava parçacıklarını çizerek performansı optimize eder
            const distance = Math.hypot(p.x - this.engine.camX, p.y - this.engine.camY);
            if (distance < 800) {
                // Kamera koordinatı kuzeydeyse kar tanesi (beyaz), güneydeyse kum tanesi (sarımsı) efekti verilir
                if (p.y < 90 * GAME_CONFIG.BASE_TILE_SIZE) {
                    ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`; // Kar
                } else if (p.y > 190 * GAME_CONFIG.BASE_TILE_SIZE) {
                    ctx.fillStyle = `rgba(210, 166, 91, ${p.opacity})`; // Çöl Kumu
                } else {
                    ctx.fillStyle = `rgba(174, 219, 240, ${p.opacity * 0.4})`; // Hafif Yağmur çisintisi
                }

                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
}

// Global motor nesnesini kaydet
window.GameEngine = new GameEngine();
/**
 * engine.js - Programatik 2D Sanatsal Çizim Sınıfı Eki
 * ==========================================================================
 * Piksel bazlı sprite resimleri yerine yüksek kaliteli, performanslı ve
 * her çözünürlükte net görünen HTML5 Canvas çizim motorunu kurar.
 */

class UnitArtist {
    /**
     * Bir birimi harita koordinatlarında görselleştirir
     */
    static draw(ctx, unit, tileSize, zoom) {
        if (unit.isDead) return;

        // Grid hücresinden piksel dünyasına dönüşüm (Merkezleme dahil)
        const px = unit.x * tileSize + tileSize / 2;
        const py = unit.y * tileSize + tileSize / 2;
        const radius = tileSize * 0.38;

        // Hareket doğrultusuna göre açıyı hesaplama (Yön bulma)
        let angle = 0;
        if (unit.path && unit.path.length > 0 && unit.path[unit.pathIndex]) {
            const nextNode = unit.path[unit.pathIndex];
            angle = Math.atan2(nextNode.y - unit.y, nextNode.x - unit.x);
        }

        ctx.save();
        ctx.translate(px, py);

        // 1. SEÇİLİ HALKASI (Glow Ring)
        if (unit.selected) {
            ctx.beginPath();
            ctx.arc(0, 0, radius * 1.35, 0, Math.PI * 2);
            ctx.strokeStyle = '#d4af37';
            ctx.lineWidth = 2 / zoom;
            ctx.shadowColor = '#d4af37';
            ctx.shadowBlur = 10 * zoom;
            ctx.stroke();
            ctx.shadowBlur = 0; // Gölge sıfırlama
        }

        // 2. AKTİF D&D DURUM EFEKTLERİ (Arka Plan Çizimi)
        if (unit.conditions['SLOWED']) {
            // Yavaşlatılmış birimlere mavi donma çemberi çizilir
            ctx.beginPath();
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(100, 180, 255, 0.25)';
            ctx.fill();
        }

        // Yön rotasyonu uygulanır (Binek ve kılıç yönü için)
        ctx.rotate(angle);

        // 3. SAVAŞ BİNEĞİ VEYA GÖVDESİ (Süvariler ve Canavarlar İçin)
        const factionColor = GAME_CONFIG.FACTIONS[unit.faction]?.primaryColor || '#d4af37';
        const secondColor = GAME_CONFIG.FACTIONS[unit.faction]?.secondaryColor || '#222';

        if (unit.unitType === 'direwolf_rider') {
            // Stark Ulu Kurt Bineği Çizimi (Büyük gri elips gövde ve pençeler)
            ctx.fillStyle = '#6e7680';
            ctx.beginPath();
            ctx.ellipse(0, 0, radius * 1.5, radius * 0.7, 0, 0, Math.PI * 2);
            ctx.fill();
            // Kurt Baş Hattı
            ctx.fillStyle = '#4f555c';
            ctx.beginPath();
            ctx.arc(radius * 1.1, 0, radius * 0.45, 0, Math.PI * 2);
            ctx.fill();
        } else if (unit.unitType === 'falcon_knight') {
            // Arryn Göklerin Şahini Bineği (Beyaz devasa kanat hatları)
            ctx.fillStyle = '#e1e5eb';
            ctx.beginPath();
            ctx.ellipse(0, 0, radius * 1.2, radius * 0.5, 0, 0, Math.PI * 2);
            ctx.fill();
            // Kanatlar
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, -radius * 0.4);
            ctx.lineTo(-radius * 0.5, -radius * 1.6);
            ctx.moveTo(0, radius * 0.4);
            ctx.lineTo(-radius * 0.5, radius * 1.6);
            ctx.stroke();
        } else if (unit.isNaval) {
            // Gemi Çizimi (Ahşap kadırga silueti)
            ctx.fillStyle = '#7d522a';
            ctx.beginPath();
            ctx.moveTo(-radius * 1.8, -radius * 0.7);
            ctx.lineTo(radius * 1.8, 0); // Burun
            ctx.lineTo(-radius * 1.8, radius * 0.7);
            ctx.closePath();
            ctx.fill();
            // Yelken Direği
            ctx.fillStyle = '#f5f5f5';
            ctx.fillRect(-radius * 0.3, -radius * 0.8, radius * 0.6, radius * 1.6);
            ctx.restore();
            return; // Gemi çizimi tamamlandı, insansı süslemelerini geç
        }

        // 4. İNSANSI ANA GÖVDE (Zırhlı Savaşçı Yuvarlağı)
        const bodyGrad = ctx.createRadialGradient(0, 0, radius * 0.2, 0, 0, radius);
        bodyGrad.addColorStop(0, secondColor);
        bodyGrad.addColorStop(1, factionColor);
        
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        
        // Eğer birim Prone (yere serilmiş) ise elips şeklinde yassı çizilir (D&D 5.5e kural simülasyonu)
        if (unit.conditions['PRONE']) {
            ctx.ellipse(0, 0, radius * 0.9, radius * 0.4, 0, 0, Math.PI * 2);
        } else {
            ctx.arc(0, 0, radius, 0, Math.PI * 2);
        }
        ctx.fill();

        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 5. SİLAH VE KALKAN GRAFİKLERİ
        ctx.fillStyle = '#cccccc'; // Çelik rengi
        
        if (unit.armor.hasShield) {
            // Sol kola kalkan çizimi (Örn: Lannister zırh kalkanı)
            ctx.fillStyle = '#b89c30';
            ctx.beginPath();
            ctx.arc(-radius * 0.3, -radius * 0.8, radius * 0.35, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.stroke();
        }

        // Silah Çizimi (Sağ kol kılıç, balta veya yay uzantısı)
        ctx.strokeStyle = '#dddddd';
        ctx.lineWidth = 3 / zoom;
        ctx.beginPath();
        if (unit.weapon.type === 'ranged') {
            // Yay çizen yay gergisi yayı
            ctx.arc(radius * 0.5, 0, radius * 0.5, -Math.PI / 3, Math.PI / 3);
            ctx.stroke();
        } else {
            // Yakın dövüş kılıç / balta çizgisi (İleriye dönük doğrultuda)
            ctx.moveTo(radius * 0.5, radius * 0.5);
            ctx.lineTo(radius * 1.4, radius * 0.5);
            ctx.stroke();
        }

        // 6. DETAYLI SÜSLEMELER (Kraliyet Pelerini ve Armalar)
        if (unit.unitType === 'dragon_guard') {
            // Targaryen pelerini (Ateş kırmızısı)
            ctx.fillStyle = '#bf1c1c';
            ctx.beginPath();
            ctx.moveTo(-radius * 0.8, -radius * 0.5);
            ctx.lineTo(-radius * 1.5, 0);
            ctx.lineTo(-radius * 0.8, radius * 0.5);
            ctx.closePath();
            ctx.fill();
        } else if (unit.unitType === 'sand_viper') {
            // Çöl kum fuları (Turuncu peçe)
            ctx.strokeStyle = '#de8212';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(radius * 0.4, 0, radius * 0.6, -Math.PI / 4, Math.PI / 4);
            ctx.stroke();
        }

        ctx.restore();

        // 7. FLOATING BARS (CAN BARLARI VE KOŞUL İKONLARI - Rotasyonsuz)
        ctx.save();
        ctx.translate(px, py);

        // Can Barı Kutusu
        const barW = tileSize * 0.9;
        const barH = 5 / zoom;
        const barY = -radius * 1.5;

        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(-barW / 2, barY, barW, barH);

        // Kalan Can Oranı
        const hpRatio = unit.currentHp / unit.maxHp;
        ctx.fillStyle = hpRatio > 0.5 ? '#2ecc71' : hpRatio > 0.2 ? '#f1c40f' : '#e74c3c';
        ctx.fillRect(-barW / 2, barY, barW * hpRatio, barH);

        // Can barı kenar çizgisi
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.strokeRect(-barW / 2, barY, barW, barH);

        // Üzerindeki Durum İkonlarının Çizilmesi (Icons above unit head)
        if (unit.conditions['POISONED']) {
            ctx.font = `bold ${10 / zoom}px Montserrat`;
            ctx.fillStyle = '#2ecc71';
            ctx.fillText('🤢 Zehir', -barW / 2, barY - 6);
        } else if (unit.conditions['PRONE']) {
            ctx.font = `bold ${10 / zoom}px Montserrat`;
            ctx.fillStyle = '#e67e22';
            ctx.fillText('🪨 Yıkık', -barW / 2, barY - 6);
        }

        ctx.restore();
    }
}

// Global Çizim Motoru Sınıfına Entegrasyon
window.UnitArtist = UnitArtist;
