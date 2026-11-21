// What the billing Turbo Module calls on ZeroBillingStore
// (ios/ZeroBilling/ZeroBillingStore.swift, @objc(ZeroBillingStore)): its whole
// Objective-C surface, declared by hand for the reason ZeroWidgetStoreObjC.h
// gives (the generated zero-Swift.h drags in the app delegate's headers).
// The Swift class is found by its Objective-C name at link time;
// __tests__/contract/nativeModules.test.ts fails when a selector here has no
// @objc method in the Swift file.
//
// Every block is called exactly once, on a Swift concurrency thread. The
// strings are JSON text or an outcome word for src/pro/schema.ts to check; a
// `failure` is a description for the error log and holds nothing about the buyer.
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface ZeroBillingStore : NSObject
+ (void)start;
+ (void)setChangeHandler:(void (^_Nullable)(void))handler;
+ (void)isAvailable:(void (^)(BOOL available))completion;
+ (void)getProducts:(NSArray<NSString *> *)ids
         completion:(void (^)(NSString *_Nullable json, NSString *_Nullable failure))completion;
+ (void)purchase:(NSString *)productId
      completion:(void (^)(NSString *_Nullable outcome, NSString *_Nullable failure))completion;
+ (void)getEntitlements:(void (^)(NSString *json))completion;
+ (void)restore:(void (^)(NSString *json))completion;
+ (void)openManageSubscriptions:(void (^)(NSString *_Nullable failure))completion;
+ (void)getOriginalInstall:(void (^)(NSString *json))completion;
@end

NS_ASSUME_NONNULL_END
