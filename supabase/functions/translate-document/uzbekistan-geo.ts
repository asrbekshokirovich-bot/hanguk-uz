// Uzbekistan regions and their districts for handwriting disambiguation
// When AI can read region but not district, it can search within correct region

export const UZBEKISTAN_REGIONS: Record<string, string[]> = {
  // Toshkent shahri (Tashkent City)
  "Toshkent shahri": [
    "Bektemir tumani", "Chilonzor tumani", "Mirzo Ulugʻbek tumani", "Mirobod tumani",
    "Olmazor tumani", "Sergeli tumani", "Shayxontohur tumani", "Uchtepa tumani",
    "Yakkasaroy tumani", "Yangihayot tumani", "Yunusobod tumani"
  ],
  "Тошкент шаҳри": [
    "Бектемир тумани", "Чилонзор тумани", "Мирзо Улуғбек тумани", "Миробод тумани",
    "Олмазор тумани", "Сергели тумани", "Шайхонтоҳур тумани", "Учтепа тумани",
    "Яккасарой тумани", "Янгиҳаёт тумани", "Юнусобод тумани"
  ],
  
  // Toshkent viloyati (Tashkent Region)
  "Toshkent viloyati": [
    "Angren shahri", "Olmaliq shahri", "Chirchiq shahri", "Bekobod shahri",
    "Oqqo'rg'on tumani", "Bo'stonliq tumani", "Bo'ka tumani", "Zangiota tumani",
    "Qibray tumani", "Quyichirchiq tumani", "O'rtachirchiq tumani", "Parkent tumani",
    "Piskent tumani", "Toshkent tumani", "Chinoz tumani", "Yuqorichirchiq tumani"
  ],
  "Тошкент вилояти": [
    "Ангрен шаҳри", "Олмалиқ шаҳри", "Чирчиқ шаҳри", "Бекобод шаҳри",
    "Оққўрғон тумани", "Бўстонлиқ тумани", "Бўка тумани", "Зангиота тумани",
    "Қибрай тумани", "Қуйичирчиқ тумани", "Ўртачирчиқ тумани", "Паркент тумани",
    "Пискент тумани", "Тошкент тумани", "Чиноз тумани", "Юқоричирчиқ тумани"
  ],
  
  // Samarqand viloyati
  "Samarqand viloyati": [
    "Samarqand shahri", "Kattaqo'rg'on shahri", "Bulung'ur tumani", "Ishtixon tumani",
    "Jomboy tumani", "Kattaqo'rg'on tumani", "Narpay tumani", "Nurobod tumani",
    "Oqdaryo tumani", "Past-darg'om tumani", "Payariq tumani", "Samarqand tumani",
    "Toyloq tumani", "Urgut tumani"
  ],
  "Самарқанд вилояти": [
    "Самарқанд шаҳри", "Каттақўрғон шаҳри", "Булунғур тумани", "Иштихон тумани",
    "Жомбой тумани", "Каттақўрғон тумани", "Нарпай тумани", "Нуробод тумани",
    "Оқдарё тумани", "Паст-дарғом тумани", "Пайариқ тумани", "Самарқанд тумани",
    "Тойлоқ тумани", "Ургут тумани"
  ],
  
  // Buxoro viloyati
  "Buxoro viloyati": [
    "Buxoro shahri", "Kogon shahri", "Olot tumani", "Buxoro tumani", "Gʻijduvon tumani",
    "Jondor tumani", "Kogon tumani", "Peshku tumani", "Qorakuʻl tumani",
    "Qorakoʻl tumani", "Romitan tumani", "Shofirkon tumani", "Vobkent tumani"
  ],
  "Бухоро вилояти": [
    "Бухоро шаҳри", "Когон шаҳри", "Олот тумани", "Бухоро тумани", "Ғиждувон тумани",
    "Жондор тумани", "Когон тумани", "Пешку тумани", "Қоракўл тумани",
    "Қоракўл тумани", "Ромитан тумани", "Шофиркон тумани", "Вобкент тумани"
  ],
  
  // Farg'ona viloyati
  "Farg'ona viloyati": [
    "Farg'ona shahri", "Marg'ilon shahri", "Quvasoy shahri", "Qo'qon shahri",
    "Beshariq tumani", "Bog'dod tumani", "Buvayda tumani", "Dang'ara tumani",
    "Farg'ona tumani", "Furqat tumani", "O'zbekiston tumani", "Oltiariq tumani",
    "Qo'shtepa tumani", "Quva tumani", "Rishton tumani", "So'x tumani",
    "Toshloq tumani", "Uchko'prik tumani", "Yozyovon tumani"
  ],
  "Фарғона вилояти": [
    "Фарғона шаҳри", "Марғилон шаҳри", "Қувасой шаҳри", "Қўқон шаҳри",
    "Бешариқ тумани", "Боғдод тумани", "Бувайда тумани", "Данғара тумани",
    "Фарғона тумани", "Фурқат тумани", "Ўзбекистон тумани", "Олтиариқ тумани",
    "Қўштепа тумани", "Қува тумани", "Риштон тумани", "Сўх тумани",
    "Тошлоқ тумани", "Учкўприк тумани", "Ёзёвон тумани"
  ],
  
  // Andijon viloyati
  "Andijon viloyati": [
    "Andijon shahri", "Xonobod shahri", "Asaka tumani", "Baliqchi tumani",
    "Bo'z tumani", "Buloqboshi tumani", "Jalolquduq tumani", "Izboskan tumani",
    "Marhamat tumani", "Oltinko'l tumani", "Paxtaobod tumani", "Qo'rg'ontepa tumani",
    "Shahrixon tumani", "Ulug'nor tumani", "Xo'jaobod tumani"
  ],
  "Андижон вилояти": [
    "Андижон шаҳри", "Хонобод шаҳри", "Асака тумани", "Балиқчи тумани",
    "Бўз тумани", "Булоқбоши тумани", "Жалолқудуқ тумани", "Избоскан тумани",
    "Марҳамат тумани", "Олтинкўл тумани", "Пахтаобод тумани", "Қўрғонтепа тумани",
    "Шаҳрихон тумани", "Улуғнор тумани", "Хўжаобод тумани"
  ],
  
  // Namangan viloyati
  "Namangan viloyati": [
    "Namangan shahri", "Chortoq tumani", "Chust tumani", "Kosonsoy tumani",
    "Mingbuloq tumani", "Namangan tumani", "Norin tumani", "Pop tumani",
    "To'raqo'rg'on tumani", "Uchqo'rg'on tumani", "Yangiqo'rg'on tumani"
  ],
  "Наманган вилояти": [
    "Наманган шаҳри", "Чортоқ тумани", "Чуст тумани", "Косонсой тумани",
    "Мингбулоқ тумани", "Наманган тумани", "Норин тумани", "Поп тумани",
    "Тўрақўрғон тумани", "Учқўрғон тумани", "Янгиқўрғон тумани"
  ],
  
  // Qashqadaryo viloyati
  "Qashqadaryo viloyati": [
    "Qarshi shahri", "Shahrisabz shahri", "Chiroqchi tumani", "Dehqonobod tumani",
    "Gʻuzor tumani", "Kasbi tumani", "Kitob tumani", "Koson tumani",
    "Mirishkor tumani", "Muborak tumani", "Nishon tumani", "Qamashi tumani",
    "Qarshi tumani", "Yakkabog' tumani"
  ],
  "Қашқадарё вилояти": [
    "Қарши шаҳри", "Шаҳрисабз шаҳри", "Чироқчи тумани", "Деҳқонобод тумани",
    "Ғузор тумани", "Касби тумани", "Китоб тумани", "Косон тумани",
    "Миришкор тумани", "Муборак тумани", "Нишон тумани", "Қамаши тумани",
    "Қарши тумани", "Яккабоғ тумани"
  ],
  
  // Surxondaryo viloyati
  "Surxondaryo viloyati": [
    "Termiz shahri", "Angor tumani", "Bandixon tumani", "Boysun tumani",
    "Denov tumani", "Jarqo'rg'on tumani", "Muzrabot tumani", "Oltinsoy tumani",
    "Qiziriq tumani", "Qo'mqurorq tumani", "Sariosiyo tumani", "Sherobod tumani",
    "Sho'rchi tumani", "Termiz tumani", "Uzun tumani"
  ],
  "Сурхондарё вилояти": [
    "Термиз шаҳри", "Ангор тумани", "Бандихон тумани", "Бойсун тумани",
    "Денов тумани", "Жарқўрғон тумани", "Музработ тумани", "Олтинсой тумани",
    "Қизириқ тумани", "Қўмқуроқ тумани", "Сариосиё тумани", "Шеробод тумани",
    "Шўрчи тумани", "Термиз тумани", "Узун тумани"
  ],
  
  // Xorazm viloyati
  "Xorazm viloyati": [
    "Urganch shahri", "Xiva shahri", "Bog'ot tumani", "Gurlan tumani",
    "Xonqa tumani", "Xazorasp tumani", "Qo'shko'pir tumani", "Shovot tumani",
    "Urganch tumani", "Yangiariq tumani", "Yangibozor tumani"
  ],
  "Хоразм вилояти": [
    "Урганч шаҳри", "Хива шаҳри", "Боғот тумани", "Гурлан тумани",
    "Хонқа тумани", "Хазорасп тумани", "Қўшкўпир тумани", "Шовот тумани",
    "Урганч тумани", "Янгиариқ тумани", "Янгибозор тумани"
  ],
  
  // Navoiy viloyati
  "Navoiy viloyati": [
    "Navoiy shahri", "Zarafshon shahri", "Konimex tumani", "Karmana tumani",
    "Navbahor tumani", "Nurota tumani", "Qiziltepa tumani", "Tomdi tumani",
    "Uchquduq tumani", "Xatirchi tumani"
  ],
  "Навоий вилояти": [
    "Навоий шаҳри", "Зарафшон шаҳри", "Конимех тумани", "Кармана тумани",
    "Навбаҳор тумани", "Нурота тумани", "Қизилтепа тумани", "Томди тумани",
    "Учқудуқ тумани", "Хатирчи тумани"
  ],
  
  // Jizzax viloyati
  "Jizzax viloyati": [
    "Jizzax shahri", "Arnasoy tumani", "Baxmal tumani", "Do'stlik tumani",
    "Forish tumani", "G'allaorol tumani", "Mirzacho'l tumani", "Paxtakor tumani",
    "Yangiobod tumani", "Zafarobod tumani", "Zarbdor tumani", "Zomin tumani"
  ],
  "Жиззах вилояти": [
    "Жиззах шаҳри", "Арнасой тумани", "Бахмал тумани", "Дўстлик тумани",
    "Фориш тумани", "Ғаллаорол тумани", "Мирзачўл тумани", "Пахтакор тумани",
    "Янгиобод тумани", "Зафаробод тумани", "Зарбдор тумани", "Зомин тумани"
  ],
  
  // Sirdaryo viloyati
  "Sirdaryo viloyati": [
    "Guliston shahri", "Yangiyer shahri", "Shirin shahri", "Boyovut tumani",
    "Guliston tumani", "Mirzaobod tumani", "Oqoltin tumani", "Sayxunobod tumani",
    "Sardoba tumani", "Sirdaryo tumani", "Xovos tumani"
  ],
  "Сирдарё вилояти": [
    "Гулистон шаҳри", "Янгиер шаҳри", "Ширин шаҳри", "Боёвут тумани",
    "Гулистон тумани", "Мирзаобод тумани", "Оқолтин тумани", "Сайхунобод тумани",
    "Сардоба тумани", "Сирдарё тумани", "Ховос тумани"
  ],
  
  // Qoraqalpog'iston Respublikasi
  "Qoraqalpog'iston Respublikasi": [
    "Nukus shahri", "Amudaryo tumani", "Beruniy tumani", "Chimboy tumani",
    "Ellikqala tumani", "Kegeyli tumani", "Mo'ynoq tumani", "Nukus tumani",
    "Qanliko'l tumani", "Qo'ng'irot tumani", "Shumanay tumani", "Taxtako'pir tumani",
    "To'rtko'l tumani", "Xo'jayli tumani"
  ],
  "Қорақалпоғистон Республикаси": [
    "Нукус шаҳри", "Амударё тумани", "Беруний тумани", "Чимбой тумани",
    "Элликқала тумани", "Кегейли тумани", "Мўйноқ тумани", "Нукус тумани",
    "Қанликўл тумани", "Қўнғирот тумани", "Шуманай тумани", "Тахтакўпир тумани",
    "Тўрткўл тумани", "Хўжайли тумани"
  ]
};

// Helper to find districts for a region (normalized search)
export function findDistrictsForRegion(regionName: string): string[] {
  const normalizedRegion = regionName.toLowerCase().trim();
  
  for (const [region, districts] of Object.entries(UZBEKISTAN_REGIONS)) {
    if (region.toLowerCase().includes(normalizedRegion) || 
        normalizedRegion.includes(region.toLowerCase())) {
      return districts;
    }
  }
  
  return [];
}

// Export all districts flattened for general search
export function getAllDistricts(): string[] {
  return Object.values(UZBEKISTAN_REGIONS).flat();
}
