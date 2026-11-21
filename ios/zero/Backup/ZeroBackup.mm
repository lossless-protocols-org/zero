// The encrypted backup for JS (3.0, plan P10): the NativeBackup Turbo Module
// that src/data/backup/vault.ts reaches. The work is in Swift
// (ios/ZeroBackup: the file format and ZeroBackupStore); this file only
// carries each call across and back. Nothing is sent anywhere and no library
// is used. Android's module is bridge/BackupModule.kt.
#import <ZeroSpecs/ZeroSpecs.h>
#import "ZeroBackupStoreObjC.h"

@interface ZeroBackup : NSObject <NativeBackupSpec>
@end

@implementation ZeroBackup

RCT_EXPORT_MODULE(NativeBackup)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (void)chooseFolder:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [ZeroBackupStore chooseFolder:^(NSString *json) {
    resolve(json);
  }];
}

- (void)folder:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [ZeroBackupStore folder:^(NSString *json) {
    resolve(json);
  }];
}

- (void)setPassphrase:(NSString *)passphrase resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [ZeroBackupStore setPassphrase:passphrase
                      completion:^(NSString *_Nullable failure) {
                        if (failure == nil) {
                          resolve(nil);
                        } else {
                          reject(@"failed", failure, nil);
                        }
                      }];
}

- (void)write:(NSString *)json
          day:(NSString *)day
         keep:(double)keep
      resolve:(RCTPromiseResolveBlock)resolve
       reject:(RCTPromiseRejectBlock)reject
{
  [ZeroBackupStore write:json
                     day:day
                    keep:(NSInteger)keep
              completion:^(NSString *_Nullable result, NSString *_Nullable code, NSString *_Nullable failure) {
                if (result != nil) {
                  resolve(result);
                } else {
                  reject(code ?: @"failed", failure ?: @"backup: the write failed", nil);
                }
              }];
}

- (void)decrypt:(NSString *)base64
     passphrase:(NSString *)passphrase
        resolve:(RCTPromiseResolveBlock)resolve
         reject:(RCTPromiseRejectBlock)reject
{
  [ZeroBackupStore decrypt:base64
                passphrase:passphrase
                completion:^(NSString *_Nullable json, NSString *_Nullable code) {
                  if (json != nil) {
                    resolve(json);
                  } else {
                    reject(code ?: @"damaged", @"backup: the file did not open", nil);
                  }
                }];
}

- (void)forget:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [ZeroBackupStore forget:^{
    resolve(nil);
  }];
}

- (void)holdBackground:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  resolve(@([ZeroBackupStore holdBackground]));
}

- (void)releaseBackground:(double)token resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject
{
  [ZeroBackupStore releaseBackground:(NSInteger)token];
  resolve(nil);
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeBackupSpecJSI>(params);
}

@end
