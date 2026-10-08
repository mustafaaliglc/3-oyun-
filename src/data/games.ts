import { GameInfo } from '../types/game';

export const GAMES: GameInfo[] = [
  {
    id: 'vice_city',
    title: 'Vice City 3D: Online Açık Dünya',
    shortTitle: 'Vice City 3D',
    category: '3D Açık Dünya / Karakter & Araç Sürme',
    badge: 'GTA İlhamlı 3D',
    accentColor: '#ec4899', // retro pink
    glowColor: 'rgba(236, 72, 153, 0.4)',
    coverImage: '/src/assets/images/vice_city_cover_1791447310120.jpg',
    ageRating: '13+ Yaş ve Üzeri',
    ageDetails: 'Genişletilmiş açık dünya, Tommy Vercetti tarzı karakter, sokaklarda arabalara binme/inme (F tuşu), rampa atlayışları ve canlı polis kovalamacaları.',
    contentTags: ['Tommy Vercetti', 'Arabalara Bin/İn (F)', 'Devasa Harita', 'Polis Takibi', '80’ler Retro'],
    shortDescription:
      'Genişletilmiş Vice City açık dünyasında Tommy Vercetti ile yürüyün veya sokaklardaki spor arabaların, taksilerin ve polis araçlarının yanına gidip [F] tuşuyla binerek şehri turlayın! Canlı çok oyunculu sunucuda arkadaşlarınızla aynı haritada gezin.',
    fullDescription:
      '80’ler neon sahil metropolü tarayıcınızda! Artık Tommy Vercetti karakterinizle caddelerde özgürce yürüyebilir, koşabilir ve zıplayabilirsiniz. Haritada park edilmiş veya devriye gezen onlarca farklı arabanın (Cheetah, Infernus, Stallion, Vice Taxi, Polis Kruvazörü) yanına yaklaşıp F tuşuna basarak direksiyon başına geçebilirsiniz. Sürüş sırasında drift yapın, rampalardan uçun, 80’ler synthwave radyolarını dinleyin veya tekrar F tuşuna basarak arabadan inip sokakları yaya keşfedin!',
    onlineFeature: 'Canlı Çok Oyunculu: Haritada gezen diğer oyuncular (yaya veya araç içinde), 3D isim etiketleri, araç paylaşımları ve radyo telsizi.',
    controls: [
      { key: 'F Tuşu / Buton', action: 'Arabaya BİN / İN (Kapıyı Aç)' },
      { key: 'W / S / A / D', action: 'Yaya İken Yürü / Araçta Gaz & Direksiyon' },
      { key: 'Shift (Basılı Tut)', action: 'Hızlı Koş (Depar)' },
      { key: 'Boşluk (Space)', action: 'Yaya İken Zıpla / Araçta El Freni & Drift' },
      { key: 'R Tuşu', action: 'Radyo İstasyonu Değiştir (Flash FM, Wave 103)' },
      { key: 'H Tuşu', action: 'Korna Çal / Siren Aç' },
      { key: 'C Tuşu', action: 'Kamera Açısını Değiştir' },
    ],
    touchControls: 'Mobilde ekrandaki [F - ARABAYA BİN/İN] butonu, analog yön tuşları, zıplama ve gaz butonları.',
    rules: [
      'Arabaların yanına yaklaştığınızda beliren "F - ARACA BİN" uyarısıyla direksiyona geçebilirsiniz.',
      'Araç içindeyken dilediğiniz yerde tekrar [F] tuşuna basarak inebilirsiniz.',
      'Hız ve drift yaptıkça, ayrıca rampa atlayışlarında Akrobasi Puanı kazanırsınız.',
      'Polislere çarptığınızda aranma seviyeniz (★) yükselir ve peşinize takılırlar!',
    ],
    tips: [
      'Genişletilmiş sahil kordonunda, lüks otellerin önünde ve otoparklarda farklı model spor arabalar bulabilirsiniz.',
      'Polislerden kaçmak için virajlarda el freniyle drift atın veya rampaları kullanarak üzerlerinden uçun.',
    ],
    iconName: 'Car',
  },
  {
    id: 'valorant',
    title: 'Valorant 3D: Spike Defusal & Poligon',
    shortTitle: 'Valorant 3D',
    category: 'Taktiksel FPS / Spike İmha Arenası',
    badge: 'Taktiksel FPS 3D',
    accentColor: '#f43f5e', // Valorant Crimson Red
    glowColor: 'rgba(244, 63, 94, 0.45)',
    coverImage: '/src/assets/images/valorant_cover_1791449562394.jpg',
    ageRating: '12+ Yaş ve Üzeri',
    ageDetails: 'Taktiksel refleks nişancılığı, silah geri tepme kontrolü, kafa vuruşu (Headshot) çarpanı, Spike imha görevi ve ajan yetenekleri.',
    contentTags: ['Vandal & Phantom', 'Spike İmha', 'Headshot (160 HP)', 'Jett Dash', 'Canlı Poligon'],
    shortDescription:
      'Tarayıcınızda 3D Valorant deneyimi! Vandal, Phantom ve Operator ile antrenman botlarını vurun, Jett Dash yeteneğiyle fırlayın, kurulan Spike bombasını 45 saniye içinde imha edin ve çevrimiçi arkadaşlarınızla kapışın!',
    fullDescription:
      'Radianite sandıkları ve Spike bölgesiyle donatılmış fütüristik taktiksel 3D FPS poligonu! Vandal ile tek kurşunda kafa vuruşu (160 Hasar) yapın, sağ tık ile ADS dürbünü açın, E tuşu ile Jett rüzgar atılması (Dash) gerçekleştirin, Q tuşu ile flaş atın. 45 saniyelik geri sayımda düşman botlarını temizleyip Spike’ı çözün!',
    onlineFeature: 'Canlı Çok Oyunculu: Aynı poligonda antrenman yapan diğer ajanlar, canlı vuruş bildirimleri ve küresel skor tablosu.',
    controls: [
      { key: 'Fare Sol Tık', action: 'Ateş Et (Silahı Sık)' },
      { key: 'Fare Sağ Tık', action: 'Dürbün Aç (ADS Zoom)' },
      { key: '1 / 2 / 3', action: 'Vandal / Phantom / Operator Seç' },
      { key: 'R Tuşu', action: 'Şarjör Değiştir (Reload)' },
      { key: 'E Tuşu / Buton', action: 'Jett Yeteneği: Rüzgar Atılması (Dash)' },
      { key: 'Q Tuşu / Buton', action: 'Ajan Yeteneği: Parlama / Flaş' },
      { key: '4 veya E (Spike)', action: 'Spike Bombasını Çöz / İmha Et' },
      { key: 'W / A / S / D', action: 'Taktiksel Hareket (Yürüme)' },
      { key: 'Boşluk (Space)', action: 'Zıpla' },
    ],
    touchControls: 'Mobilde nişan alanı, ateş ve dürbün butonları, silah seçici ve Spike çözme tuşları.',
    rules: [
      'Kafadan vuruşlar (Headshot) 160 hasar verir ve tek atışta hedefleri etkisiz hale getirir.',
      'Spike kurulduğunda 45 saniye süreniz vardır; botları temizleyip Spike yanına giderek imha edin.',
      'Seri atışlarda (spray) geri tepmeye (recoil) dikkat edin; ilk mermiler en isabetlidir.',
    ],
    tips: [
      'Hareket halindeyken ateş etmek mermi dağılımını artırır; durarak ateş ettiğinizde tam isabet sağlarsınız.',
      'Sıkıştığınızda Jett Dash (E) ile hızlıca siper arkasına kaçabilirsiniz.',
    ],
    iconName: 'Crosshair',
  },
  {
    id: 'minecraft',
    title: 'Minecraft 3D: Voxel Blok Dünyası',
    shortTitle: 'Minecraft 3D',
    category: '3D Voxel Sandbox / Hayatta Kalma & Yaratıcı',
    badge: 'Voxel Sandbox 3D',
    accentColor: '#10b981', // Emerald green
    glowColor: 'rgba(16, 185, 129, 0.45)',
    coverImage: '/src/assets/images/minecraft_cover_1791449573993.jpg',
    ageRating: '7+ Yaş (Herkes İçin)',
    ageDetails: 'Şiddetsiz, sonsuz yaratıcılık, 3D küp bloklarla inşaat, madencilik, mimari ve çok oyunculu ortak yapı kurma.',
    contentTags: ['Steve', 'Blok Yerleştir/Kır', 'Elmas & TNT', 'Yaratıcı Dünya', 'Çok Oyunculu'],
    shortDescription:
      'Kendi Minecraft dünyanızı kurun! Çimen, Taş, Odun, Cam, Elmas ve TNT bloklarını kazın veya istediğiniz yere yerleştirin. Steve karakterinizle tepeleri tırmanın, kaleler inşa edin ve online oyuncularla birlikte dünyayı şekillendirin.',
    fullDescription:
      'Tarayıcınızda çalışan gerçek zamanlı 3D Voxel motoru! Elinizdeki kazma ve bloklarla araziyi kazabilir, mağaralar açabilir veya gökyüzüne uzanan kuleler ve evler inşa edebilirsiniz. Envanter çubuğundan blok türünü seçin, sol tık ile blokları parçalayın, sağ tık ile yeni bloklar koyun. Canlı çok oyunculu sunucu sayesinde koyduğunuz bloklar diğer oyuncular tarafından anında görünür!',
    onlineFeature: 'Canlı Çok Oyunculu: Diğer oyuncuları Steve karakteri olarak görme, eşzamanlı blok yerleştirme ve ortak inşaat.',
    controls: [
      { key: 'Fare Sol Tık', action: 'Bloğu Kır / Maden Kaz' },
      { key: 'Fare Sağ Tık', action: 'Bloğu Yerleştir (Koy)' },
      { key: '1 - 8 Rakamları', action: 'Blok Seç: Çimen, Taş, Odun, Elmas, Cam, Tuğla, TNT, Meşale' },
      { key: 'W / A / S / D', action: 'Yürü / Hareket Et' },
      { key: 'Boşluk (Space)', action: 'Zıpla (Blokların üstüne çık)' },
      { key: 'C / F5 Tuşu', action: '1. Şahıs / 3. Şahıs (Steve Görünümü)' },
    ],
    touchControls: 'Mobilde ekrandan dokunarak blok kırma/koyma, hızlı hotbar envanteri ve yön butonları.',
    rules: [
      'Sol tık ile hedeflenen bloğa vurup envanterinize katabilirsiniz.',
      'Sağ tık ile baktığınız bloğun üzerine elinizdeki bloğu yerleştirebilirsiniz.',
      'TNT bloğuna vurulduğunda patlama oluşturarak etraftaki blokları savurur.',
    ],
    tips: [
      'Gökdelen veya kule yaparken ayaklarınızın altına blok koymak için zıplayıp (Space) aynı anda sağ tık yapın.',
      'Cam blokları pencerelerde, tuğla ve odunları duvarlarda kullanarak estetik evler tasarlayabilirsiniz.',
    ],
    iconName: 'Box',
  },
];
