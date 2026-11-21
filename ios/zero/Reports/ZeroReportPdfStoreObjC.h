// What the report Turbo Module calls on ZeroReportPdfStore
// (ios/ZeroReports/ZeroReportPdfStore.swift, @objc(ZeroReportPdfStore)): its
// whole Objective-C surface, declared by hand for the reason
// ZeroWidgetStoreObjC.h gives. __tests__/contract/nativeModules.test.ts fails
// when a selector here has no @objc method in the Swift file.
//
// Every block is called exactly once, on the main queue. A `failure` names
// what went wrong for the error log and never holds a figure of the report.
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface ZeroReportPdfStore : NSObject
+ (void)render:(NSString *)json
      fileName:(NSString *)fileName
    completion:(void (^)(NSString *_Nullable path, NSString *_Nullable failure))completion;
+ (void)share:(NSString *)path title:(NSString *)title completion:(void (^)(NSString *_Nullable failure))completion;
@end

NS_ASSUME_NONNULL_END
