// What the Turbo Module bridges call on ZeroWidgetStore (ZeroWidgetStore.swift,
// @objc(ZeroWidgetStore)): its whole Objective-C surface, declared by hand.
//
// The bridges used to import the generated zero-Swift.h, which declares every
// @objc class in the app, SceneDelegate included, and so needed React Native's
// app-delegate header (a path that moved twice between RN 0.76 and 0.80) just
// to compile a widget call (audit 2026-11-08 §6.3). The Swift class is found
// by its Objective-C name at link time. __tests__/contract/nativeObjcSurface
// .test.ts fails when a selector here has no @objc method in the Swift file.
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface ZeroWidgetStore : NSObject
+ (void)writeSnapshot:(NSString *)json;
+ (NSString *)readPendingEntries;
+ (void)removePendingEntries:(NSArray<NSString *> *)ids;
@end

NS_ASSUME_NONNULL_END
