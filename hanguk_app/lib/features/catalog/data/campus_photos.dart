/// Institutions whose campus photo is bundled under `assets/campus/<id>.jpg`.
///
/// The photos were picked by hand from each university's official website and
/// from Wikimedia Commons: a daytime shot of the main building or gate. Where
/// no such photo was found the id is simply absent and the card shows the
/// university's name instead. Sources, authors and licences are listed in
/// `docs/campus_photo_credits.md`.
const Set<String> campusPhotoIds = {
  '0b88b3f0-c854-4b2b-b8a2-262e2ae11ddf',
  '11111111-1111-1111-1111-111111111111',
  '16038490-c33c-4177-9d82-e29edfeffb01',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '3531aa6b-eb08-4026-816f-04fb86c5a7f0',
  '36319c54-8219-4595-b064-a4a69a57738c',
  '423214ab-a1a5-412d-805d-a9c3eba900b5',
  '42c597fd-c4c0-4f90-9e1d-3c9e07c78c19',
  '489d2a7e-5e93-4307-b781-4b356f444044',
  '4c24796c-5078-435c-8b1b-774c0f88394f',
  '4ef85fa9-4810-4587-a1f6-05193417fbef',
  '504d551b-5249-4312-ba65-6f8323e5c54f',
  '65171bea-1046-4c1e-960e-17bda528605f',
  '66666666-6666-6666-6666-666666666666',
  '7631a149-4f3d-4a1e-a379-e6499596bb8f',
  '76efb017-0bf1-40f7-93ef-cf6a3aa9fdd7',
  '77777777-7777-7777-7777-777777777777',
  '7e7e0fc3-e0d7-4a74-9a72-0a9dbf85873b',
  '9f633866-b1f2-424a-b2a3-a03b748c12b5',
  'a11cdb3a-efae-4bde-942a-b948bad911db',
  'a79aab64-8ad7-4b96-8d60-dd7664822446',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'bc8aa9cc-e3db-4ed4-871e-fe0febcb2e64',
  'c5ca77ce-7f06-4e2a-8057-96bf441582c0',
  'c7730462-efda-495e-8743-043ef12d9665',
  'c8ab7972-f64d-4e4c-aca4-cc65ccd9681e',
  'cdae34f5-3648-4b24-b9a4-2103dfc0e0ad',
  'd7cebc4f-0f90-4d7b-983e-0f2c3dd0cc72',
  'dedc9b3c-6c4c-4e76-a5e1-6e93f23d406f',
};

/// Asset path of [institutionId]'s campus photo, or null when there is none.
String? campusPhotoAsset(String institutionId) =>
    campusPhotoIds.contains(institutionId) ? 'assets/campus/$institutionId.jpg' : null;
