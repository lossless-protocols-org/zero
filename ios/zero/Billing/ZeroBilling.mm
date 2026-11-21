// The App Store's purchases for JS (3.0): the NativeBilling Turbo Module.
// StoreKit 2 lives in Swift (ios/ZeroBilling); this file only carries each
// call across and back. It reports what the store says and decides nothing:
// src/pro/billing.ts checks every value, and src/pro/entitlement.ts decides
// what the answer means. Android's module is the play flavour's (plan P5).
#import <ZeroSpecs/ZeroSpecs.h>
#import "ZeroBillingStoreObjC.h"

// The spec's generated base class carries the event emitter (onEntitlementsChanged).
@interface ZeroBilling : NativeBillingSpecBase <NativeBillingSpec>
@end

@implementation ZeroBilling

RCT_EXPORT_MODULE(NativeBilling)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (instancetype)init
{
  if (self = [super init]) {
    // The listener itself started at launch (AppDelegate); from here JS hears of each change.
    // Emitting before JS has subscribed does nothing, and JS asks the store at start anyway.
    __weak ZeroBilling *weakSelf = self;
    [ZeroBillingStore setChangeHandler:^{
      // StoreKit calls this from its own threads; the emitter is handed over on one queue.
      dispatch_async(dispatch_get_main_queue(), ^{
        [weakSelf emitOnEntitlementsChanged];
      });
    }];
  }
  return self;
}

- (void)isAvailable:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [ZeroBillingStore isAvailable:^(BOOL available) {
    resolve(@(available));
  }];
}

- (void)getProducts:(NSArray *)ids resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  NSMutableArray<NSString *> *strings = [NSMutableArray arrayWithCapacity:ids.count];
  for (id value in ids) {
    if ([value isKindOfClass:[NSString class]]) {
      [strings addObject:value];
    }
  }
  [ZeroBillingStore getProducts:strings
                     completion:^(NSString *_Nullable json, NSString *_Nullable failure) {
                       if (json != nil) {
                         resolve(json);
                       } else {
                         reject(@"billing_products", failure ?: @"the App Store returned no products", nil);
                       }
                     }];
}

- (void)purchase:(NSString *)productId
      offerToken:(NSString *)offerToken
         resolve:(RCTPromiseResolveBlock)resolve
          reject:(RCTPromiseRejectBlock)reject
{
  // offerToken is Google Play's; the App Store has none.
  [ZeroBillingStore purchase:productId
                  completion:^(NSString *_Nullable outcome, NSString *_Nullable failure) {
                    if (outcome != nil) {
                      resolve(outcome);
                    } else {
                      reject(@"billing_purchase", failure ?: @"the purchase failed", nil);
                    }
                  }];
}

- (void)getEntitlements:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [ZeroBillingStore getEntitlements:^(NSString *json) {
    resolve(json);
  }];
}

- (void)restore:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [ZeroBillingStore restore:^(NSString *json) {
    resolve(json);
  }];
}

- (void)openManageSubscriptions:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [ZeroBillingStore openManageSubscriptions:^(NSString *_Nullable failure) {
    if (failure == nil) {
      resolve(nil);
    } else {
      reject(@"billing_manage", failure, nil);
    }
  }];
}

- (void)getOriginalInstall:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [ZeroBillingStore getOriginalInstall:^(NSString *json) {
    resolve(json);
  }];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeBillingSpecJSI>(params);
}

@end
