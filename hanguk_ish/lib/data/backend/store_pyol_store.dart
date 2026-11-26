import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../repositories/pyol_store.dart';
import 'ish_names.dart';

/// [PyolStore] on Google Play Billing / StoreKit (in_app_purchase) and the
/// ish-iap function (supabase/functions/ish-iap).
class StorePyolStore implements PyolStore {
  StorePyolStore(this._client, {InAppPurchase? iap}) : _iap = iap ?? InAppPurchase.instance {
    _sub = _iap.purchaseStream.listen(_onPurchases, onError: (Object _) {});
  }

  final SupabaseClient _client;
  final InAppPurchase _iap;
  late final StreamSubscription<List<PurchaseDetails>> _sub;
  final _results = StreamController<StoreResult>.broadcast();
  final Map<String, ProductDetails> _details = {};

  /// The server said no for good: finish the purchase so it stops coming
  /// back. Anything else (offline, server not set up) is tried again later.
  static const _final = {'NOT_YOURS', 'INVALID', 'NOT_FOUND', 'NOT_PURCHASED', 'REVOKED', 'WRONG_APP'};

  void dispose() {
    _sub.cancel();
    _results.close();
  }

  @override
  Stream<StoreResult> get results => _results.stream;

  @override
  Future<List<StoreProduct>> products() async {
    if (!await _iap.isAvailable()) return const [];
    final response = await _iap.queryProductDetails(storeProductPyols.keys.toSet());
    final list = [
      for (final d in response.productDetails)
        if (storeProductPyols[d.id] != null) StoreProduct(id: d.id, pyols: storeProductPyols[d.id]!, price: d.price),
    ]..sort((a, b) => a.pyols.compareTo(b.pyols));
    for (final d in response.productDetails) {
      _details[d.id] = d;
    }
    return list;
  }

  @override
  Future<void> buy(StoreProduct product) async {
    final details = _details[product.id];
    if (details == null) {
      _results.add(const StoreFailed('NOT_FOUND'));
      return;
    }
    // Not consumed on the phone: the server consumes it after adding the puyl.
    final started = await _iap.buyConsumable(
      purchaseParam: PurchaseParam(productDetails: details, applicationUserName: _client.auth.currentUser?.id),
      autoConsume: false,
    );
    if (!started) _results.add(const StoreFailed('STORE'));
  }

  Future<void> _onPurchases(List<PurchaseDetails> purchases) async {
    for (final p in purchases) {
      switch (p.status) {
        case PurchaseStatus.pending:
          _results.add(const StorePending());
        case PurchaseStatus.canceled:
          _results.add(const StoreCancelled());
          await _finish(p);
        case PurchaseStatus.error:
          _results.add(StoreFailed(p.error?.code ?? 'STORE'));
          await _finish(p);
        case PurchaseStatus.purchased || PurchaseStatus.restored:
          await _deliver(p);
      }
    }
  }

  Future<void> _deliver(PurchaseDetails p) async {
    final android = !kIsWeb && Platform.isAndroid;
    try {
      final response = await _client.functions.invoke(ishIapFunction, body: {
        'store': android ? 'google' : 'apple',
        'product_id': p.productID,
        if (android) 'token': p.verificationData.serverVerificationData else 'transaction_id': p.purchaseID,
      });
      final data = response.data;
      final balance = data is Map ? (data['balance'] as num?)?.toInt() ?? 0 : 0;
      await _finish(p);
      _results.add(StoreCredited(storeProductPyols[p.productID] ?? 0, balance));
    } on FunctionException catch (e) {
      final code = e.details is Map ? '${(e.details as Map)['error'] ?? 'FAILED'}' : 'FAILED';
      if (_final.contains(code)) await _finish(p);
      _results.add(StoreFailed(code));
    } on Object {
      // Offline: the store gives it back at the next start; then it is added.
      _results.add(const StoreFailed('OFFLINE'));
    }
  }

  Future<void> _finish(PurchaseDetails p) async {
    if (!p.pendingCompletePurchase) return;
    try {
      await _iap.completePurchase(p);
    } on Object {
      // Already consumed by the server (Android): nothing to finish.
    }
  }
}
