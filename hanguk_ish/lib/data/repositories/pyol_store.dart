import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// A puyl pack the store sells (Google Play / App Store product).
@immutable
class StoreProduct {
  const StoreProduct({required this.id, required this.pyols, required this.price});

  /// 'puyl_30', 'puyl_100', 'puyl_300' (the same ids in both stores).
  final String id;
  final int pyols;

  /// The store's own price text, in the buyer's currency («₩9,900»).
  final String price;
}

/// What came of a purchase.
sealed class StoreResult {
  const StoreResult();
}

/// The store took the money and the server added the puyl.
class StoreCredited extends StoreResult {
  const StoreCredited(this.pyols, this.balance);

  final int pyols;
  final int balance;
}

/// Waiting for the payment (a slow card, a parent's approval …).
class StorePending extends StoreResult {
  const StorePending();
}

/// The buyer closed the store sheet.
class StoreCancelled extends StoreResult {
  const StoreCancelled();
}

/// It did not go through ([code]: the store's or the server's).
class StoreFailed extends StoreResult {
  const StoreFailed(this.code);

  final String code;
}

/// The product ids, and how many puyl each one is.
const storeProductPyols = {'puyl_30': 30, 'puyl_100': 100, 'puyl_300': 300};

/// Buying puyl inside the app: the store's payment sheet (card, Google Pay,
/// Apple Pay …), then the ish-iap function checks it with the store and adds
/// the puyl once. A purchase left unfinished (no network) is finished the
/// next time the app starts.
abstract interface class PyolStore {
  /// The packs with the store's prices; empty when buying is not possible
  /// here (no store, products not set up yet).
  Future<List<StoreProduct>> products();

  /// Opens the store's payment sheet; the outcome comes on [results].
  Future<void> buy(StoreProduct product);

  Stream<StoreResult> get results;
}

/// The demo build: no store; a purchase «goes through» at once.
class DemoPyolStore implements PyolStore {
  final _results = StreamController<StoreResult>.broadcast();
  int _balance = 90;

  @override
  Future<List<StoreProduct>> products() async => const [
        StoreProduct(id: 'puyl_30', pyols: 30, price: '₩3,300'),
        StoreProduct(id: 'puyl_100', pyols: 100, price: '₩9,900'),
        StoreProduct(id: 'puyl_300', pyols: 300, price: '₩24,000'),
      ];

  @override
  Future<void> buy(StoreProduct product) async {
    _balance += product.pyols;
    _results.add(StoreCredited(product.pyols, _balance));
  }

  @override
  Stream<StoreResult> get results => _results.stream;
}

/// The store the app uses. The demo one until a backend is configured.
final pyolStoreProvider = Provider<PyolStore>((ref) => DemoPyolStore());
