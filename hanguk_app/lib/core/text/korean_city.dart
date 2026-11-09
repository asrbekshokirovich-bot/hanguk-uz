/// Korean city names (`institutions.city_ko`) in the Revised Romanization
/// the guideline Excels use for `shahar`. A university with no guideline yet
/// reaches the app with only its Korean city ("정읍"); everywhere else the
/// city reads in Latin letters, so this one should too.
const Map<String, String> kKoreanCities = {
  '강릉': 'Gangneung', '거창': 'Geochang', '경산': 'Gyeongsan', '경주': 'Gyeongju', '고양': 'Goyang',
  '공주': 'Gongju', '광양': 'Gwangyang', '광주': 'Gwangju', '괴산': 'Goesan', '구미': 'Gumi',
  '군산': 'Gunsan', '군포': 'Gunpo', '금산': 'Geumsan', '김천': 'Gimcheon', '김포': 'Gimpo',
  '김해': 'Gimhae', '나주': 'Naju', '남양주': 'Namyangju', '남해': 'Namhae', '논산': 'Nonsan',
  '담양': 'Damyang', '당진': 'Dangjin', '대구': 'Daegu', '대전': 'Daejeon', '동해': 'Donghae',
  '목포': 'Mokpo', '무안': 'Muan', '문경': 'Mungyeong', '보령': 'Boryeong', '부산': 'Busan',
  '부여': 'Buyeo', '부천': 'Bucheon', '서산': 'Seosan', '서울': 'Seoul', '성남': 'Seongnam',
  '세종': 'Sejong', '수원': 'Suwon', '순천': 'Suncheon', '시흥': 'Siheung', '아산': 'Asan',
  '안동': 'Andong', '안산': 'Ansan', '안성': 'Anseong', '안양': 'Anyang', '양산': 'Yangsan',
  '양주': 'Yangju', '여주': 'Yeoju', '영광': 'Yeonggwang', '영동': 'Yeongdong', '영암': 'Yeongam',
  '영월': 'Yeongwol', '영주': 'Yeongju', '영천': 'Yeongcheon', '예천': 'Yecheon', '오산': 'Osan',
  '옥천': 'Okcheon', '완주': 'Wanju', '용인': 'Yongin', '울산': 'Ulsan', '원주': 'Wonju',
  '음성': 'Eumseong', '의왕': 'Uiwang', '의정부': 'Uijeongbu', '이천': 'Icheon', '익산': 'Iksan',
  '인천': 'Incheon', '임실': 'Imsil', '전주': 'Jeonju', '정읍': 'Jeongeup', '제주': 'Jeju',
  '제천': 'Jecheon', '진주': 'Jinju', '창원': 'Changwon', '천안': 'Cheonan', '청양': 'Cheongyang',
  '청주': 'Cheongju', '춘천': 'Chuncheon', '충주': 'Chungju', '태백': 'Taebaek', '파주': 'Paju',
  '평택': 'Pyeongtaek', '포천': 'Pocheon', '포항': 'Pohang', '홍성': 'Hongseong', '화성': 'Hwaseong',
  '횡성': 'Hoengseong',
};

/// [city] in Latin letters when it is one of [kKoreanCities]; anything else
/// as written.
String latinCity(String city) => kKoreanCities[city.trim()] ?? city;
