/// QS World University Rankings position of a university, for the QS block
/// on the home card (design screen 03).
///
/// [from] is the position, or the first of QS's band for the lower ranks
/// ("1201-1400"); [to] is the band's last. The block is drawn only for
/// universities listed in [kQsRanks]; the others show the card without it.
class QsRank {
  const QsRank(this.from, [this.to, this.tied = false, this.openEnded = false]);

  final int from;
  final int? to;

  /// QS's "=52": tied with others for that place.
  final bool tied;

  /// QS's last band, "1401+": no upper end.
  final bool openEnded;

  /// The position as QS prints it: "38", "=52", "1401+".
  String get label => openEnded ? '$from+' : (tied ? '=$from' : '$from');

  /// "38", "=52", "1201-1400" or "1401+".
  static QsRank? parse(String text) {
    final m = RegExp(
      r'^\s*(=?)(\d+)(?:\s*[-–]\s*(\d+)|(\+))?\s*$',
    ).firstMatch(text);
    if (m == null) return null;
    final from = int.parse(m.group(2)!);
    final to = m.group(3) == null ? null : int.parse(m.group(3)!);
    return QsRank(
      from,
      to != null && to > from ? to : null,
      m.group(1) == '=',
      m.group(4) != null,
    );
  }
}

/// Institution id → QS position or band, as QS prints it, from the QS World
/// University Rankings table on topuniversities.com (the owner's screenshots,
/// 2026-10-13). A university that is not here has no QS block. Korea
/// University's entry in the catalogue is its Sejong campus, which QS lists
/// under Korea University (=52); it is left out until the owner decides.
const Map<String, String> kQsRanks = {
  '11111111-1111-1111-1111-111111111111': '38', // Seoul National University
  '22222222-2222-2222-2222-222222222222':
      '42', // Yonsei University — Graduate School
  '33333333-3333-3333-3333-333333333333':
      '65', // Korea Advanced Institute of Science and Technology (KAIST)
  '4dbe3360-8e85-42dd-b70d-1f17cd7a89d8':
      '106', // POSTECH (Pohang University of Science and Technology)
  '77777777-7777-7777-7777-777777777777':
      '108', // Sungkyunkwan University (SKKU)
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb': '155', // Hanyang University
  '0f90e879-fd71-45b9-863e-a2922152218d':
      '299', // Ulsan National Institute of Science and Technology (UNIST)
  '504d551b-5249-4312-ba65-6f8323e5c54f':
      '=309', // Kyung Hee University — Graduate School
  'cc700f75-c562-4b4e-a44f-c0627c75507e':
      '=379', // Gwangju Institute of Science and Technology (GIST)
  '43737f59-c9c2-491b-ab12-39b14166d62e':
      '=385', // DGIST (Daegu Gyeongbuk Institute of Science and Technology) — Graduate School
  '0b88b3f0-c854-4b2b-b8a2-262e2ae11ddf': '=432', // Chung-Ang University
  '981124c6-2aa2-4ccb-aea9-8072820f8182': '=449', // Pusan National University
  'bc8aa9cc-e3db-4ed4-871e-fe0febcb2e64':
      '=481', // Kyungpook National University
  'a11cdb3a-efae-4bde-942a-b948bad911db':
      '=488', // Ewha Womans University — The General Graduate School
  'd7cebc4f-0f90-4d7b-983e-0f2c3dd0cc72': '=494', // Sogang University
  'f8614cb9-8c88-4abc-b0d4-de16dd0ee135': '520', // Dongguk University
  '88888888-8888-8888-8888-888888888888': '=555', // Inha University
  'c8ab7972-f64d-4e4c-aca4-cc65ccd9681e':
      '=570', // Ajou University — The Graduate School
  '65171bea-1046-4c1e-960e-17bda528605f':
      '=620', // Hankuk University of Foreign Studies — Graduate School
  '4a8d2576-6aa1-41bb-bc4b-d4f1377bdbbc':
      '=652', // The Catholic University of Korea
  '66666666-6666-6666-6666-666666666666':
      '=677', // Jeonbuk National University — Graduate School
  '0710b972-74c0-4a01-bb59-34c8590965c7':
      '781-790', // Chonnam National University
  '4c24796c-5078-435c-8b1b-774c0f88394f': '791-800', // Yeungnam University
  '1ff198d5-b04b-4521-87e6-c3fd05db77d4':
      '801-850', // Chungnam National University
  'cdae34f5-3648-4b24-b9a4-2103dfc0e0ad': '851-900', // University of Seoul
  '585b01da-317b-4b05-af4a-12763bc3d5a4': '901-950', // Gachon University
  '55555555-5555-5555-5555-555555555555':
      '951-1000', // Chungbuk National University
  '7e7e0fc3-e0d7-4a74-9a72-0a9dbf85873b': '1001-1200', // Dankook University
  '99999999-9999-9999-9999-999999999999':
      '1001-1200', // Kangwon National University — Graduate School (Chuncheon Campus)
  '0ab07c8e-6d25-43f1-a7c2-a3fb452f10e4': '1001-1200', // Kookmin University
  '16038490-c33c-4177-9d82-e29edfeffb01':
      '1001-1200', // Seoul National University of Science and Technology (SeoulTech)
  'c5ca77ce-7f06-4e2a-8057-96bf441582c0':
      '1201-1400', // Sookmyung Women's University — Graduate School
  '6cf8889a-91ee-4385-a5cd-be761792ad08':
      '1201-1400', // Sungshin Women's University
  'aca61dee-fc98-42fd-966f-62dd2fb75dee': '1401+', // Hongik University
};

QsRank? qsRankOf(String institutionId) {
  final text = kQsRanks[institutionId];
  return text == null ? null : QsRank.parse(text);
}
