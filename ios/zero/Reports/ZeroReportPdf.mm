// PDF reports for JS (3.0, plan P12): the NativeReportPdf Turbo Module that
// src/pro/reportPdf.ts reaches. The drawing is in Swift (ios/ZeroReports);
// this file only carries each call across and back. Nothing is sent anywhere
// and no library is used. Android's module is bridge/ReportPdfModule.kt.
#import <ZeroSpecs/ZeroSpecs.h>
#import "ZeroReportPdfStoreObjC.h"

@interface ZeroReportPdf : NSObject <NativeReportPdfSpec>
@end

@implementation ZeroReportPdf

RCT_EXPORT_MODULE(NativeReportPdf)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (void)render:(NSString *)json
      fileName:(NSString *)fileName
       resolve:(RCTPromiseResolveBlock)resolve
        reject:(RCTPromiseRejectBlock)reject
{
  [ZeroReportPdfStore render:json
                    fileName:fileName
                  completion:^(NSString *_Nullable path, NSString *_Nullable failure) {
                    if (path != nil) {
                      resolve(path);
                    } else {
                      reject(@"report", failure ?: @"report: the PDF could not be made", nil);
                    }
                  }];
}

- (void)share:(NSString *)path
        title:(NSString *)title
      resolve:(RCTPromiseResolveBlock)resolve
       reject:(RCTPromiseRejectBlock)reject
{
  [ZeroReportPdfStore share:path
                      title:title
                 completion:^(NSString *_Nullable failure) {
                   if (failure == nil) {
                     resolve(nil);
                   } else {
                     reject(@"report", failure, nil);
                   }
                 }];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeReportPdfSpecJSI>(params);
}

@end
