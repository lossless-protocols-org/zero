// The widget bridge, iOS side (2.8): the NativeWidgetBridge Turbo Module that
// src/features/widgets/bridge.ts reaches. Writes go to the App Group through
// ZeroWidgetStore (Swift). Quick-add window control is Android's own module
// (NativeQuickAddWindow), and the queue of entries made outside the app is
// ZeroPendingEntries.mm (audit 2026-11-08 §6.2).
#import <ZeroSpecs/ZeroSpecs.h>
#import "ZeroWidgetStoreObjC.h"

@interface ZeroWidgetBridge : NSObject <NativeWidgetBridgeSpec>
@end

@implementation ZeroWidgetBridge

RCT_EXPORT_MODULE(NativeWidgetBridge)

+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (void)writeSnapshot:(NSString *)json
{
  [ZeroWidgetStore writeSnapshot:json];
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params
{
  return std::make_shared<facebook::react::NativeWidgetBridgeSpecJSI>(params);
}

@end
