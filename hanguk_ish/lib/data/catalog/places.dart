/// Reference lists shown in pickers (A02). Names are the institutions' and
/// districts' own official names, written the way each app language writes
/// them; the stored value is the stable [code], so a profile reads correctly
/// whatever language it is later shown in.
library;

/// One entry of a picker list, named in the four worker-app languages.
class Place {
  const Place(this.code, {required this.uz, required this.ru, required this.en, required this.ko});

  final String code;
  final String uz;
  final String ru;
  final String en;
  final String ko;

  String name(String languageCode) => switch (languageCode) {
        'ru' => ru,
        'en' => en,
        'ko' => ko,
        _ => uz,
      };

  /// True when [query] occurs in any of the names (case-insensitive).
  bool matches(String query) {
    final q = query.trim().toLowerCase();
    if (q.isEmpty) return true;
    return [uz, ru, en, ko, code].any((n) => n.toLowerCase().contains(q));
  }
}

/// Universities in Seoul, by official English name.
const seoulUniversities = <Place>[
  Place('snu', uz: 'Seul milliy universiteti', ru: 'Сеульский национальный университет', en: 'Seoul National University', ko: '서울대학교'),
  Place('yonsei', uz: 'Yonsei universiteti', ru: 'Университет Ёнсе', en: 'Yonsei University', ko: '연세대학교'),
  Place('korea', uz: 'Koreya universiteti', ru: 'Университет Корё', en: 'Korea University', ko: '고려대학교'),
  Place('sogang', uz: 'Sogang universiteti', ru: 'Университет Соган', en: 'Sogang University', ko: '서강대학교'),
  Place('hanyang', uz: 'Hanyang universiteti', ru: 'Университет Ханъян', en: 'Hanyang University', ko: '한양대학교'),
  Place('skku', uz: 'Sungkyunkwan universiteti', ru: 'Университет Сонгюнгван', en: 'Sungkyunkwan University', ko: '성균관대학교'),
  Place('khu', uz: 'Kyung Hee universiteti', ru: 'Университет Кёнхи', en: 'Kyung Hee University', ko: '경희대학교'),
  Place('cau', uz: 'Chung-Ang universiteti', ru: 'Университет Чунан', en: 'Chung-Ang University', ko: '중앙대학교'),
  Place('hufs', uz: 'Hankuk xorijiy tillar universiteti', ru: 'Университет иностранных языков Хангук', en: 'Hankuk University of Foreign Studies', ko: '한국외국어대학교'),
  Place('konkuk', uz: 'Konkuk universiteti', ru: 'Университет Конкук', en: 'Konkuk University', ko: '건국대학교'),
  Place('dongguk', uz: 'Dongguk universiteti', ru: 'Университет Тонгук', en: 'Dongguk University', ko: '동국대학교'),
  Place('hongik', uz: 'Hongik universiteti', ru: 'Университет Хоник', en: 'Hongik University', ko: '홍익대학교'),
  Place('ewha', uz: 'Ewha ayollar universiteti', ru: 'Женский университет Ихва', en: 'Ewha Womans University', ko: '이화여자대학교'),
  Place('sookmyung', uz: 'Sookmyung ayollar universiteti', ru: 'Женский университет Сукмён', en: "Sookmyung Women's University", ko: '숙명여자대학교'),
  Place('kookmin', uz: 'Kookmin universiteti', ru: 'Университет Кунмин', en: 'Kookmin University', ko: '국민대학교'),
  Place('sejong', uz: 'Sejong universiteti', ru: 'Университет Седжон', en: 'Sejong University', ko: '세종대학교'),
  Place('kw', uz: 'Kwangwoon universiteti', ru: 'Университет Квангун', en: 'Kwangwoon University', ko: '광운대학교'),
  Place('uos', uz: 'Seul shahar universiteti', ru: 'Сеульский городской университет', en: 'University of Seoul', ko: '서울시립대학교'),
  Place('ssu', uz: 'Soongsil universiteti', ru: 'Университет Сунсиль', en: 'Soongsil University', ko: '숭실대학교'),
  Place('mju', uz: 'Myongji universiteti', ru: 'Университет Мёнджи', en: 'Myongji University', ko: '명지대학교'),
  Place('smu', uz: 'Sangmyung universiteti', ru: 'Университет Санмён', en: 'Sangmyung University', ko: '상명대학교'),
  Place('hansung', uz: 'Hansung universiteti', ru: 'Университет Хансон', en: 'Hansung University', ko: '한성대학교'),
  Place('skuniv', uz: 'Seokyeong universiteti', ru: 'Университет Сокён', en: 'Seokyeong University', ko: '서경대학교'),
  Place('catholic', uz: 'Koreya katolik universiteti', ru: 'Католический университет Кореи', en: 'The Catholic University of Korea', ko: '가톨릭대학교'),
  Place('seoultech', uz: 'Seul milliy fan va texnologiya universiteti', ru: 'Сеульский национальный университет науки и технологий', en: 'Seoul National University of Science and Technology', ko: '서울과학기술대학교'),
];

/// Code stored when the worker is not a student.
const notAStudentCode = 'none';

/// The 25 districts (구) of Seoul.
const seoulDistricts = <Place>[
  Place('gangnam', uz: 'Gangnam-gu, Seul', ru: 'Каннам-гу, Сеул', en: 'Gangnam-gu, Seoul', ko: '서울 강남구'),
  Place('gangdong', uz: 'Gangdong-gu, Seul', ru: 'Кандон-гу, Сеул', en: 'Gangdong-gu, Seoul', ko: '서울 강동구'),
  Place('gangbuk', uz: 'Gangbuk-gu, Seul', ru: 'Канбук-гу, Сеул', en: 'Gangbuk-gu, Seoul', ko: '서울 강북구'),
  Place('gangseo', uz: 'Gangseo-gu, Seul', ru: 'Кансо-гу, Сеул', en: 'Gangseo-gu, Seoul', ko: '서울 강서구'),
  Place('gwanak', uz: 'Gwanak-gu, Seul', ru: 'Кванак-гу, Сеул', en: 'Gwanak-gu, Seoul', ko: '서울 관악구'),
  Place('gwangjin', uz: 'Gwangjin-gu, Seul', ru: 'Кванджин-гу, Сеул', en: 'Gwangjin-gu, Seoul', ko: '서울 광진구'),
  Place('guro', uz: 'Guro-gu, Seul', ru: 'Куро-гу, Сеул', en: 'Guro-gu, Seoul', ko: '서울 구로구'),
  Place('geumcheon', uz: 'Geumcheon-gu, Seul', ru: 'Кымчхон-гу, Сеул', en: 'Geumcheon-gu, Seoul', ko: '서울 금천구'),
  Place('nowon', uz: 'Nowon-gu, Seul', ru: 'Новон-гу, Сеул', en: 'Nowon-gu, Seoul', ko: '서울 노원구'),
  Place('dobong', uz: 'Dobong-gu, Seul', ru: 'Тобон-гу, Сеул', en: 'Dobong-gu, Seoul', ko: '서울 도봉구'),
  Place('dongdaemun', uz: 'Dongdaemun-gu, Seul', ru: 'Тондэмун-гу, Сеул', en: 'Dongdaemun-gu, Seoul', ko: '서울 동대문구'),
  Place('dongjak', uz: 'Dongjak-gu, Seul', ru: 'Тонджак-гу, Сеул', en: 'Dongjak-gu, Seoul', ko: '서울 동작구'),
  Place('mapo', uz: 'Mapo-gu, Seul', ru: 'Мапхо-гу, Сеул', en: 'Mapo-gu, Seoul', ko: '서울 마포구'),
  Place('seodaemun', uz: 'Seodaemun-gu, Seul', ru: 'Содэмун-гу, Сеул', en: 'Seodaemun-gu, Seoul', ko: '서울 서대문구'),
  Place('seocho', uz: 'Seocho-gu, Seul', ru: 'Сочхо-гу, Сеул', en: 'Seocho-gu, Seoul', ko: '서울 서초구'),
  Place('seongdong', uz: 'Seongdong-gu, Seul', ru: 'Сондон-гу, Сеул', en: 'Seongdong-gu, Seoul', ko: '서울 성동구'),
  Place('seongbuk', uz: 'Seongbuk-gu, Seul', ru: 'Сонбук-гу, Сеул', en: 'Seongbuk-gu, Seoul', ko: '서울 성북구'),
  Place('songpa', uz: 'Songpa-gu, Seul', ru: 'Сонпха-гу, Сеул', en: 'Songpa-gu, Seoul', ko: '서울 송파구'),
  Place('yangcheon', uz: 'Yangcheon-gu, Seul', ru: 'Янчхон-гу, Сеул', en: 'Yangcheon-gu, Seoul', ko: '서울 양천구'),
  Place('yeongdeungpo', uz: 'Yeongdeungpo-gu, Seul', ru: 'Ёндынпхо-гу, Сеул', en: 'Yeongdeungpo-gu, Seoul', ko: '서울 영등포구'),
  Place('yongsan', uz: 'Yongsan-gu, Seul', ru: 'Ёнсан-гу, Сеул', en: 'Yongsan-gu, Seoul', ko: '서울 용산구'),
  Place('eunpyeong', uz: 'Eunpyeong-gu, Seul', ru: 'Ынпхён-гу, Сеул', en: 'Eunpyeong-gu, Seoul', ko: '서울 은평구'),
  Place('jongno', uz: 'Jongno-gu, Seul', ru: 'Чонно-гу, Сеул', en: 'Jongno-gu, Seoul', ko: '서울 종로구'),
  Place('jung', uz: 'Jung-gu, Seul', ru: 'Чун-гу, Сеул', en: 'Jung-gu, Seoul', ko: '서울 중구'),
  Place('jungnang', uz: 'Jungnang-gu, Seul', ru: 'Чуннан-гу, Сеул', en: 'Jungnang-gu, Seoul', ko: '서울 중랑구'),
];

/// The name to show for a stored [code] (or free text a worker typed).
String placeName(List<Place> list, String? code, String languageCode) {
  if (code == null || code.isEmpty) return '';
  for (final place in list) {
    if (place.code == code) return place.name(languageCode);
  }
  return code;
}
