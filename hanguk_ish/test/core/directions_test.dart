import 'package:flutter_test/flutter_test.dart';
import 'package:hanguk_ish/core/links/directions.dart';
import 'package:hanguk_ish/data/models/business.dart';
import 'package:hanguk_ish/data/models/shift.dart';

void main() {
  final start = DateTime.utc(2026, 11, 12, 5);
  ShiftListing shift({required Business business, String address = '', double? lat, double? lng}) => ShiftListing(
        id: 's',
        business: business,
        title: '홀 보조',
        address: address,
        startsAt: start,
        endsAt: start.add(const Duration(hours: 4)),
        hourlyWage: 10320,
        slots: 1,
        slotsLeft: 1,
        lat: lat,
        lng: lng,
      );

  const placed = Business(
    id: 'b',
    name: '해운대 카페',
    category: BusinessCategory.cafe,
    address: '부산 해운대구 해운대해변로 264',
    lat: 35.1587,
    lng: 129.1604,
  );
  const bare = Business(id: 'n', name: '사업장 123-45-67891', category: BusinessCategory.other);

  test("a point (the shift's, else the business's): the route to it", () {
    expect(directionsUri(shift(business: placed), 'E2E Kafe').toString(),
        'https://map.kakao.com/link/to/E2E%20Kafe,35.1587,129.1604');
    expect(directionsUri(shift(business: bare, lat: 37.5, lng: 126.9), 'Kafe').toString(),
        'https://map.kakao.com/link/to/Kafe,37.5,126.9');
  });

  test("no point: a search for the shift's address, else the business's, else the name", () {
    expect(directionsUri(shift(business: bare, address: '서울 마포구 양화로 160'), 'Kafe').queryParameters['q'],
        '서울 마포구 양화로 160');
    const addressOnly = Business(id: 'a', name: '카페', category: BusinessCategory.cafe, address: '서울 마포구 도화동');
    expect(directionsUri(shift(business: addressOnly), 'Kafe').queryParameters['q'], '서울 마포구 도화동');
    expect(directionsUri(shift(business: bare), 'Kafe').queryParameters['q'], 'Kafe');
  });
}
