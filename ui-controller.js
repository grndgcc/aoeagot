/**
 * ==========================================================================
 * Westeros: Kingdoms of D&D 5.5e - UI & Girdi Denetleyici (ui-controller.js)
 * ==========================================================================
 * Bu dosya, oyun içi ve dışı kullanıcı etkileşimlerini, ülke seçim ekranını,
 * mobil joystick dinamiklerini ve HUD (ekran göstergeleri) durumunu yönetir.
 */

class UIController {
    constructor() {
        this.selectedFaction = null;
        this.isMobile = false;

        // Joystick Durum Değişkenleri
        this.joystickActive = false;
        this.joystickStartPos = { x: 0, y: 0 };
        this.joystickCurPos = { x: 0, y: 0 };
        this.joystickMaxDrag = 40; // Piksel cinsinden çekilebilecek maksimum mesafe

        // DOM Elementlerini Bağlama
        this.bindElements();

        // Adım 10 - Dokunmatik ve Klavye Takip Değişkenleri (Sınıf İçi Kapsam Tanımlamaları)
        this.touchStartDist = 0;
        this.initialTouchZoom = 1;
        this.activeKeys = {}; // Basılı tutulan tuşların takibi (WASD kaydırması için)
    }

    /**
     * Sınıf içindeki tüm DOM referanslarını tanımlar
     */
    bindElements() {
        // Ekran Katmanları
        this.screenFactionSelect = document.getElementById('screen-faction-select');
        this.screenGame = document.getElementById('screen-game');
        this.menuModal = document.getElementById('menu-modal');

        // Butonlar ve Kontroller
        this.btnStartGame = document.getElementById('btn-start-game');
        this.btnToggleMenu = document.getElementById('btn-toggle-menu');
        this.btnResume = document.getElementById('btn-resume');
        this.btnRestart = document.getElementById('btn-restart');
        
        // Faction Kartları
        this.factionCards = document.querySelectorAll('.faction-card');

        // HUD Bilgi Paneli Elementleri
        this.infoPanelEmpty = document.getElementById('info-panel-empty');
        this.infoPanelDetails = document.getElementById('info-panel-details');
        this.infoUnitName = document.getElementById('info-unit-name');
        this.infoUnitType = document.getElementById('info-unit-type');
        this.infoUnitAvatar = document.getElementById('info-unit-avatar');
        this.statStr = document.getElementById('stat-str');
        this.statDex = document.getElementById('stat-dex');
        this.statCon = document.getElementById('stat-con');
        this.statInt = document.getElementById('stat-int');
        this.statWis = document.getElementById('stat-wis');
        this.statCha = document.getElementById('stat-cha');
        this.infoAc = document.getElementById('info-ac');
        this.infoHp = document.getElementById('info-hp');
        this.infoInitiative = document.getElementById('info-initiative');
        this.infoAttacksList = document.getElementById('info-attacks');

        // Log ve Kaynak Elementleri
        this.battleLogs = document.getElementById('battle-logs');
        this.camX = document.getElementById('cam-x');
        this.camY = document.getElementById('cam-y');

        // Mobil Joystick Elementleri
        this.joystickBase = document.getElementById('joystick-base');
        this.joystickHandle = document.getElementById('joystick-handle');
    }

    /**
     * Olay dinleyicilerini (Event Listeners) başlatan ana metod
     */
    init() {
        this.detectDeviceType();
        this.setupFactionSelection();
        this.setupMenuTriggers();
        this.setupJoystick();
        this.addWindowResizeListener();
    }

    /**
     * Cihazın mobil olup olmadığını tespit eder ve arayüzü hazırlar
     */
    detectDeviceType() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        if (/android|ipad|iphone|ipod/i.test(userAgent)) {
            this.isMobile = true;
            document.body.classList.add('mobile-device');
        } else {
            this.isMobile = false;
        }
    }

    /**
     * Ülke seçim kartlarının klikleme mantığını yönetir
     */
    setupFactionSelection() {
        this.factionCards.forEach(card => {
            card.addEventListener('click', () => {
                // Önceki seçili sınıfı kaldır
                this.factionCards.forEach(c => c.classList.remove('selected'));
                
                // Yeniyi seçili yap
                card.classList.add('selected');
                this.selectedFaction = card.getAttribute('data-faction');
                
                // Başla butonunu aktif et
                this.btnStartGame.removeAttribute('disabled');
                
                // Sistem ses efekti simülasyonu
                this.playUISound();
            });
        });

        this.btnStartGame.addEventListener('click', () => {
            if (this.selectedFaction) {
                this.launchGame(this.selectedFaction);
            }
        });
    }

    /**
     * Oyun menüsü (ESC veya menü butonu) tetikleyicilerini kurar
     */
    setupMenuTriggers() {
        // HUD içindeki Menü butonu
        this.btnToggleMenu.addEventListener('click', () => {
            this.menuModal.classList.remove('hidden');
        });

        // Oyuna geri dön butonu
        this.btnResume.addEventListener('click', () => {
            this.menuModal.classList.add('hidden');
        });

        // Yeniden Başlat butonu (Sayfayı yeniler veya oyun durumunu sıfırlar)
        this.btnRestart.addEventListener('click', () => {
            location.reload();
        });

        // PC'de ESC tuşu basıldığında menüyü açma / kapatma
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.screenGame.classList.contains('active')) {
                    this.menuModal.classList.toggle('hidden');
                }
            }
        });
    }

    /**
     * Dokunmatik mobil kontroller için Joystick kaydırma mantığını kurar
     */
    setupJoystick() {
        if (!this.joystickBase || !this.joystickHandle) return;

        const onTouchStart = (e) => {
            const touch = e.touches[0];
            const baseRect = this.joystickBase.getBoundingClientRect();
            
            this.joystickActive = true;
            this.joystickStartPos = {
                x: baseRect.left + baseRect.width / 2,
                y: baseRect.top + baseRect.height / 2
            };
            this.joystickHandle.style.transition = 'none';
        };

        const onTouchMove = (e) => {
            if (!this.joystickActive) return;
            e.preventDefault();

            const touch = e.touches[0];
            this.joystickCurPos = { x: touch.clientX, y: touch.clientY };

            let deltaX = this.joystickCurPos.x - this.joystickStartPos.x;
            let deltaY = this.joystickCurPos.y - this.joystickStartPos.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            // Sınırlandırma (Maksimum çekim çemberinin dışına taşmama)
            if (distance > this.joystickMaxDrag) {
                const angle = Math.atan2(deltaY, deltaX);
                deltaX = Math.cos(angle) * this.joystickMaxDrag;
                deltaY = Math.sin(angle) * this.joystickMaxDrag;
            }

            // Kulpu görsel olarak hareket ettir
            this.joystickHandle.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

            // Hareket yönünü belirle ve kamera/oyuncu yönlendirmesine gönder
            this.handleJoystickDirection(deltaX / this.joystickMaxDrag, deltaY / this.joystickMaxDrag);
        };

        const onTouchEnd = () => {
            this.joystickActive = false;
            // Kulpu eski yerine yavaşça geri döndür
            this.joystickHandle.style.transition = 'transform 0.2s ease-out';
            this.joystickHandle.style.transform = 'translate(0px, 0px)';
            this.handleJoystickDirection(0, 0);
        };

        this.joystickBase.addEventListener('touchstart', onTouchStart, { passive: false });
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd);
    }

    /**
     * Alınan joystick oranlarına göre (X: -1 ile 1, Y: -1 ile 1 arası) yön tespiti
     */
    handleJoystickDirection(powerX, powerY) {
        // Bu değerler Engine.js içindeki harita kaydırma veya birim yönlendirme modülüne iletilecek.
        if (powerX !== 0 || powerY !== 0) {
            // Test log mekanizması
            this.camX.innerText = Math.round(110 + powerX * 10);
            this.camY.innerText = Math.round(110 + powerY * 10);
        }
    }

    /**
     * Ekran yeniden boyutlandırıldığında canvasın düzgün şekillenmesini sağlar
     */
    addWindowResizeListener() {
        window.addEventListener('resize', () => {
            const canvas = document.getElementById('gameCanvas');
            if (canvas && this.screenGame.classList.contains('active')) {
                canvas.width = canvas.parentElement.clientWidth;
                canvas.height = canvas.parentElement.clientHeight;
            }
        });
    }

    /**
     * Oyunu başlatan ve ana döngüye geçiş yapan mekanizma
     */
    launchGame(faction) {
        // Seçim ekranını gizle, oyun ekranını göster
        this.screenFactionSelect.classList.remove('active');
        this.screenGame.classList.add('active');

        // Üst paneldeki aktif ülke ismini güncelle
        const formattedFactionName = faction.charAt(0).toUpperCase() + faction.slice(1);
        document.getElementById('txt-current-faction').innerText = "Hane " + formattedFactionName;

        this.writeBattleLog(`[Sistem] Hane ${formattedFactionName} savaşa katıldı! Westeros'un hakimiyeti sizin elinizde.`, 'success');

        // Yapay Zeka (AI) ve Diğer modülleri harekete geçirmek için Engine tetiklemesi
        if (window.GameEngine) {
            window.GameEngine.init(faction);
        }
    }

    /**
     * HUD Üzerindeki seçili birim detay panelini dinamik olarak günceller (D&D Stat Entegrasyonu)
     */
    updateSelectedUnitPanel(unitData) {
        if (!unitData) {
            this.infoPanelEmpty.classList.remove('hidden');
            this.infoPanelDetails.classList.add('hidden');
            return;
        }

        this.infoPanelEmpty.classList.add('hidden');
        this.infoPanelDetails.classList.remove('hidden');

        // D&D Statlarının Atanması
        this.infoUnitName.innerText = unitData.name || "Bilinmeyen Birim";
        this.infoUnitType.innerText = unitData.type || "İnsansı";
        
        // 404 Hatalarını Tamamen Engellemek İçin Programatik Inline SVG Vektör Görsel Desteği
        this.infoUnitAvatar.src = unitData.avatarUrl || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'><rect width='60' height='60' fill='%231a202c'/><path d='M30 15a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM15 45c0-8.3 6.7-15 15-15s15 6.7 15 15' stroke='%23d4af37' stroke-width='2' fill='none'/></svg>";
        
        this.statStr.innerText = unitData.stats.str;
        this.statDex.innerText = unitData.stats.dex;
        this.statCon.innerText = unitData.stats.con;
        this.statInt.innerText = unitData.stats.int;
        this.statWis.innerText = unitData.stats.wis;
        this.statCha.innerText = unitData.stats.cha;

        this.infoAc.innerText = unitData.ac;
        this.infoHp.innerText = `${unitData.currentHp}/${unitData.maxHp}`;
        this.infoInitiative.innerText = unitData.initiative;

        // Saldırıların listelenmesi
        this.infoAttacksList.innerHTML = '';
        unitData.attacks.forEach(attack => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${attack.name}:</strong> +${attack.bonus} Vuruş Bonusu, ${attack.damageFormula} ${attack.type} Hasarı`;
            this.infoAttacksList.appendChild(li);
        });
    }

    /**
     * Alt kısımdaki Zar ve Savaş Günlüğüne yeni satır ekler
     */
    writeBattleLog(text, type = 'system') {
        const entry = document.createElement('p');
        entry.className = `log-entry ${type}`;
        
        const timestamp = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        entry.innerHTML = `[${timestamp}] ${text}`;
        
        this.battleLogs.appendChild(entry);
        
        // Otomatik aşağı kaydırma
        this.battleLogs.scrollTop = this.battleLogs.scrollHeight;
    }

    /**
     * Kullanıcı arayüzü tıklama ses efekti simülasyonu
     */
    playUISound() {
        // Ses API altyapısı kurulduğunda buraya entegre edilebilir.
        // Web Audio API kullanılarak dinamik dıt-dıt sesleri üretilebilir.
    }
}

// Globalde tekilleştirme yapıyoruz. Dom yüklendiğinde Controller aktif edilir.
document.addEventListener('DOMContentLoaded', () => {
    window.UI = new UIController();
    window.UI.init();
});

/**
 * ui-controller.js - İnşaat Modu ve Fare Tıklama İşleyicileri Eki
 */

this.mouseGridY = 0;

// UIController sınıfına eklenecek metodlar:

/**
 * İnşaat modunu aktifleştirir
 */
UIController.prototype.enterBuildMode = function(buildingKey) {
    if (!BINDING_DATABASE[buildingKey]) return;
    this.buildModeActive = true;
    this.selectedBuildingToBuild = buildingKey;
    this.writeBattleLog(`[İnşaat Modu] ${buildingKey} yerleştirmek için haritaya tıklayın. İptal için ESC.`, 'system');
};

/**
 * Fare hareket ederken harita hücresi tespiti ve bina gölgesi çizimi tetikleyicisi
 */
UIController.prototype.handleBuildModeMouseMove = function(clientX, clientY, engine) {
    if (!this.buildModeActive) return;

    // Ekran koordinatından harita hücresi koordinatına dönüşüm
    const rect = engine.canvas.getBoundingClientRect();
    const relativeX = (clientX - rect.left - engine.canvas.width / 2) / engine.zoom + engine.camX;
    const relativeY = (clientY - rect.top - engine.canvas.height / 2) / engine.zoom + engine.camY;

    this.mouseGridX = Math.floor(relativeX / engine.tileSize);
    this.mouseGridY = Math.floor(relativeY / engine.tileSize);
    
    // Sınır koruması
    this.mouseGridX = Math.max(0, Math.min(GAME_CONFIG.MAP_SIZE - 1, this.mouseGridX));
    this.mouseGridY = Math.max(0, Math.min(GAME_CONFIG.MAP_SIZE - 1, this.mouseGridY));
};

/**
 * Tıklama ile Blueprint inşaat yerleşimini tetikleme
 */
UIController.prototype.handleBuildModeClick = function(engine) {
    if (!this.buildModeActive || !this.selectedBuildingToBuild) return;

    const mapData = engine.mapData;
    const faction = this.selectedFaction;

    const newBuilding = window.Economy.placeBuildingBlueprint(
        this.selectedBuildingToBuild, 
        this.mouseGridX, 
        this.mouseGridY, 
        faction, 
        mapData
    );

    if (newBuilding) {
        // İnşaat modu başarılıysa sonlandır
        this.buildModeActive = false;
        this.selectedBuildingToBuild = null;
        
        // Canvas alanını yeniden çizdir
        engine.render();
    }
};

/**
 * İptal etme mantığı (Sağ tık veya ESC ile tetiklenir)
 */
UIController.prototype.cancelBuildMode = function() {
    this.buildModeActive = false;
    this.selectedBuildingToBuild = null;
    this.writeBattleLog(`[İnşaat] İnşaat modu iptal edildi.`, 'system');
};

/**
 * ui-controller.js - RTS Fare Seçim Sürüklemesi ve Sağ Tık Hareket Komutu Entegrasyonu
 */

// Sınıfın init() metoduna eklenecek olay dinleyiciler (Event Listeners):

UIController.prototype.setupCombatInputHandlers = function(engine) {
    const canvas = engine.canvas;

    canvas.addEventListener('mousedown', (e) => {
        // İnşaat modu aktifse bu akışı kes
        if (this.buildModeActive) {
            this.handleBuildModeClick(engine);
            return;
        }

        if (e.button === 0) { // Sol Tık (Seçim Başlat)
            const rect = canvas.getBoundingClientRect();
            engine.selectionManager.startSelection(e.clientX - rect.left, e.clientY - rect.top);
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // İnşaat önizleme koordinatlarını güncelle
        if (this.buildModeActive) {
            this.handleBuildModeMouseMove(e.clientX, e.clientY, engine);
            return;
        }

        // Sol tık basılı sürükleniyorsa seçim kutusunu büyüt
        if (engine.selectionManager.isSelecting) {
            engine.selectionManager.updateSelectionBox(mouseX, mouseY);
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0) { // Sol Tık Bırakıldı (Seçimi Bitir)
            if (engine.selectionManager.isSelecting) {
                // Burada mock birim listesi verilebilir, asıl entegrasyonda küresel birim listesi beslenir
                const allUnits = window.GameEngine.unitsList || []; 
                engine.selectionManager.endSelection(this.selectedFaction, allUnits);
            }
        }
    });

    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault(); // Varsayılan tarayıcı sağ tık menüsünü engelle

        if (this.buildModeActive) {
            this.cancelBuildMode();
            return;
        }

        // Sağ Tık (Hareket/Bindirme Emri)
        const rect = canvas.getBoundingClientRect();
        const worldCoords = engine.selectionManager.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
        const targetGridX = Math.floor(worldCoords.x / GAME_CONFIG.BASE_TILE_SIZE);
        const targetGridY = Math.floor(worldCoords.y / GAME_CONFIG.BASE_TILE_SIZE);

        // Grid sınırları koruması
        if (targetGridX < 0 || targetGridX >= GAME_CONFIG.MAP_SIZE || targetGridY < 0 || targetGridY >= GAME_CONFIG.MAP_SIZE) return;

        const targetTile = engine.mapData[targetGridY][targetGridX];
        const selected = engine.selectionManager.selectedUnits;

        if (selected.length > 0) {
            // Eğer sağ tıklanan hedef karede dost bir Gemi bulunuyorsa gemiye binme emri tetiklenir
            if (targetTile.unit && targetTile.unit.isNaval && targetTile.unit.faction === this.selectedFaction) {
                const transportShip = targetTile.unit;
                
                selected.forEach(unit => {
                    if (!unit.isNaval) {
                        // Birimi gemiye gitmesi için yönlendir, yanına vardığında gemiye binecek
                        unit.path = engine.groupMovement.pathfinder.findPath(
                            Math.floor(unit.x), Math.floor(unit.y),
                            transportShip.x, transportShip.y,
                            false
                        );
                        
                        // Yolun sonuna varıp varmadığını denetleyen update() içine kanca (hook) yerleştirilir:
                        unit.onReachedDestination = () => {
                            if (Math.hypot(unit.x - transportShip.x, unit.y - transportShip.y) <= 1.5) {
                                transportShip.boardUnit(unit);
                            }
                        };
                    }
                });
            } else {
                // Standart grup hareketi
                engine.groupMovement.orderGroupMovement(selected, targetGridX, targetGridY);
            }
        }
    });
};

// GameEngine'in render() metodunun en sonuna seçim kutusunun çizilmesi eklenmelidir:
// if (this.selectionManager) {
//     this.selectionManager.drawSelectionBox(this.ctx);
// }

/**
 * ui-controller.js - Mobil Pinch-to-Zoom ve Klavye/Kısayol Entegrasyonu (Adım 10)
 * ==========================================================================
 */

/**
 * PC Klavye Girişlerini ve Kısayollarını Kaydeder
 */
UIController.prototype.setupPCKeyboardControls = function(engine) {
    // Tuş basma takibi
    window.addEventListener('keydown', (e) => {
        this.activeKeys[e.key.toLowerCase()] = true;

        // Age of Empires Tarzı Hızlı İnşaat/Üretim Kısayolları (Hotkey bindings)
        // Eğer bir kışla veya işçi seçiliyse kısayollar tetiklenir
        if (this.buildModeActive) {
            if (e.key === 'Escape') this.cancelBuildMode();
            return;
        }

        const selected = engine.selectionManager.selectedUnits;
        if (selected && selected.length > 0) {
            const leader = selected[0];
            
            if (leader.unitType === 'villager') {
                // İşçi seçiliyken kısayollar
                if (e.key === 'q' || e.key === 'Q') this.enterBuildMode('HOUSE');
                if (e.key === 'w' || e.key === 'W') this.enterBuildMode('BARRACKS');
                if (e.key === 'e' || e.key === 'E') this.enterBuildMode('DOCK');
            } else if (leader.type === 'TOWN_CENTER') {
                // Belediye binası seçiliyken Q ile işçi üretimi
                if (e.key === 'q' || e.key === 'Q') {
                    window.Economy.trainUnitInBuilding(leader, GAME_CONFIG.UNIT_TEMPLATES.COMMONER);
                }
            }
        }
    });

    window.addEventListener('keyup', (e) => {
        this.activeKeys[e.key.toLowerCase()] = false;
    });
};

/**
 * WASD veya Yön Tuşları Basılı Tutulduğunda Kamerayı Yumuşakça Kaydırır
 */
UIController.prototype.updateKeyboardCameraScroll = function(deltaTime, engine) {
    const scrollSpeed = 400 * deltaTime; // Saniyede kat edilecek piksel mesafesi
    let dx = 0;
    let dy = 0;

    if (this.activeKeys['w'] || this.activeKeys['arrowup']) dy = -scrollSpeed;
    if (this.activeKeys['s'] || this.activeKeys['arrowdown']) dy = scrollSpeed;
    if (this.activeKeys['a'] || this.activeKeys['arrowleft']) dx = -scrollSpeed;
    if (this.activeKeys['d'] || this.activeKeys['arrowright']) dx = scrollSpeed;

    if (dx !== 0 || dy !== 0) {
        engine.camX += dx / engine.zoom;
        engine.camY += dy / engine.zoom;
        engine.clampCamera();
    }
};

/**
 * Mobil Cihazlar İçin Çift Parmak Dokunma Yakınlaştırma (Pinch-to-Zoom) Sistemi
 * İki parmak arasındaki Euclidean mesafeyi hesaplayarak kamerayı yaklaştırır/uzaklaştırır.
 */
UIController.prototype.setupMobileTouchGestures = function(engine) {
    const canvas = engine.canvas;

    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            e.preventDefault();
            // İki dokunma noktası arasındaki başlangıç mesafesini hesapla
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            this.touchStartDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            this.initialTouchZoom = engine.zoom;
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && this.touchStartDist > 0) {
            e.preventDefault();
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

            // Yakınlaştırma çarpanını hesapla
            const factor = currentDist / this.touchStartDist;
            const targetZoom = this.initialTouchZoom * factor;

            // Zoom sınırlandırması uygula
            engine.zoom = Math.max(GAME_CONFIG.MIN_ZOOM, Math.min(GAME_CONFIG.MAX_ZOOM, targetZoom));
            engine.clampCamera();
        }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            this.touchStartDist = 0; // Mesafe takibini sıfırla
        }
    });
};

/**
 * ==========================================================================
 * Westeros D&D 5.5e - Küresel Başlatıcı (Bootstrapper)
 * ==========================================================================
 * Oyuncu lobi ekranından "Savaşa Başla" butonuna tıkladığı anda tetiklenerek,
 * haritayı kuran, kamera kontrol döngüsünü başlatan kancadır.
 */

UIController.prototype.launchGame = function(faction) {
    // 1. Ekran geçiş animasyonunu tetikle
    this.screenFactionSelect.classList.remove('active');
    this.screenGame.classList.add('active');

    // 2. Seçili ülkeye göre HUD başlığını güncelle
    const factionData = GAME_CONFIG.FACTIONS[faction];
    document.getElementById('txt-current-faction').innerText = `${factionData.name} (${factionData.house})`;

    // 3. Oyun motorunu ilk kez seçili hane ile tetikle
    window.GameEngine.init(faction);

    // 4. Oyuncunun başlangıç belediye binası (Town Center) ve 3 işçisini yerleştir
    this.spawnPlayerStartingBase(faction);

    // 5. Giriş ve kontrolcü dinleyicilerini tamamen bağla
    this.setupPCKeyboardControls(window.GameEngine);
    this.setupCombatInputHandlers(window.GameEngine);
    this.setupMobileTouchGestures(window.GameEngine);

    // 6. Savaş döngüsüne klavye güncellemelerini besleyecek kancayı ekle
    const originalUpdate = window.GameEngine.update;
    window.GameEngine.update = function(deltaTime) {
        // Klavye ile kamera hareketini her karede güncelle
        window.UI.updateKeyboardCameraScroll(deltaTime, this);
        
        // Performans optimizasyonlarını çalıştır (Yol kuyruğu & Çöp Toplayıcı)
        this.performOptimizations(deltaTime);

        // Orijinal motor güncellemelerini sürdür (AI, Combat vb.)
        originalUpdate.call(this, deltaTime);
    };

    this.writeBattleLog(`[Başlatıcı] Oyun motoru başarıyla kuruldu. D&D 5.5e kuralları aktif.`, 'success');
};

/**
 * Oyuncu için başlangıç karargahını haritada konumlandırır
 */
UIController.prototype.spawnPlayerStartingBase = function(faction) {
    const facInfo = GAME_CONFIG.FACTIONS[faction];
    if (!facInfo) return;

    const mapData = window.GameEngine.mapData;

    // 1. Oyuncu Town Center (Belediye Binası) inşası (Tamamlanmış durumda)
    const tcDb = BINDING_DATABASE.TOWN_CENTER;
    const playerTC = new Building(tcDb, facInfo.startX, facInfo.startY, faction);
    playerTC.progress = 100;
    playerTC.hp = playerTC.maxHp;
    playerTC.isCompleted = true;

    window.Economy.buildings.push(playerTC);
    window.Economy.resourceManager.addPopulationCap(tcDb.popCap);

    // Harita hücresi blokajı
    for (let y = facInfo.startY; y < facInfo.startY + tcDb.height; y++) {
        for (let x = facInfo.startX; x < facInfo.startX + tcDb.width; x++) {
            mapData[y][x].structure = playerTC;
        }
    }

    // 2. 3 Adet Başlangıç İşçisini (Villager) doğur
    for (let i = 0; i < 3; i++) {
        window.GameEngine.combatEngine.spawnUnit(
            GAME_CONFIG.UNIT_TEMPLATES.COMMONER,
            facInfo.startX + tcDb.width + 1,
            facInfo.startY + i,
            faction
        );
    }

    // Nüfus sayısını güncelle
    window.Economy.resourceManager.adjustPopulation(3);
};
