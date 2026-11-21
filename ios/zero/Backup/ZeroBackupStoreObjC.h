// What the backup Turbo Module calls on ZeroBackupStore
// (ios/ZeroBackup/ZeroBackupStore.swift, @objc(ZeroBackupStore)): its whole
// Objective-C surface, declared by hand for the reason ZeroWidgetStoreObjC.h
// gives (the generated zero-Swift.h drags in the app delegate's headers).
// __tests__/contract/nativeModules.test.ts fails when a selector here has no
// @objc method in the Swift file.
//
// Every block is called exactly once, on the store's own queue (or the main
// queue for the picker). Strings are JSON text or a code for
// src/data/backup/vault.ts; a `failure` describes what went wrong for the
// error log and never holds the passphrase or the data.
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface ZeroBackupStore : NSObject
+ (void)chooseFolder:(void (^)(NSString *json))completion;
+ (void)folder:(void (^)(NSString *json))completion;
+ (void)setPassphrase:(NSString *)passphrase completion:(void (^)(NSString *_Nullable failure))completion;
+ (void)write:(NSString *)text
          day:(NSString *)day
         keep:(NSInteger)keep
   completion:(void (^)(NSString *_Nullable json, NSString *_Nullable code, NSString *_Nullable failure))completion;
+ (void)decrypt:(NSString *)base64
     passphrase:(NSString *)passphrase
     completion:(void (^)(NSString *_Nullable json, NSString *_Nullable code))completion;
+ (void)forget:(void (^)(void))completion;
+ (NSInteger)holdBackground;
+ (void)releaseBackground:(NSInteger)token;
@end

NS_ASSUME_NONNULL_END
